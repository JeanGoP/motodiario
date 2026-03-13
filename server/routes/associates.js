import express from 'express';
import sql from 'mssql';
import { getPool } from '../db.js';

const router = express.Router();

const LEADCONNECTOR_LOCATION_ID = process.env.LEADCONNECTOR_LOCATION_ID || 'x8eF7OoF2Ld9p1ASAUGe';
const LEADCONNECTOR_API_VERSION = '2021-07-28';
const LEADCONNECTOR_UPSERT_URL = 'https://services.leadconnectorhq.com/contacts/upsert';

let asociadosColumnsCache = {
  checkedAt: 0,
  hasContactId: false,
};

const getAsociadosColumnsSupport = async (request) => {
  const now = Date.now();
  if (now - asociadosColumnsCache.checkedAt < 60_000) return asociadosColumnsCache;

  const cols = await request.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'asociados'
      AND COLUMN_NAME IN ('contact_id')
  `);

  const names = new Set((cols.recordset || []).map((r) => r.COLUMN_NAME));
  asociadosColumnsCache = {
    checkedAt: now,
    hasContactId: names.has('contact_id'),
  };
  return asociadosColumnsCache;
};

const webhookDbConfig = {
  user: process.env.WEBHOOK_DB_USER,
  password: process.env.WEBHOOK_DB_PASS,
  server: process.env.WEBHOOK_DB_HOST || 'sintesiserpcloud.webhop.org',
  database: process.env.WEBHOOK_DB_NAME || 'RopofyWebHook',
  port: Number.parseInt(process.env.WEBHOOK_DB_PORT || '1433', 10),
  connectionTimeout: 8000,
  options: {
    encrypt: process.env.WEBHOOK_DB_ENCRYPT !== 'false',
    trustServerCertificate: true,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let webhookPoolPromise;
const getWebhookPool = async () => {
  const enabled = Boolean(webhookDbConfig.user && webhookDbConfig.password && webhookDbConfig.server && webhookDbConfig.database);
  if (!enabled) return null;
  if (!webhookPoolPromise) {
    const pool = new sql.ConnectionPool(webhookDbConfig);
    webhookPoolPromise = pool.connect().catch((err) => {
      webhookPoolPromise = null;
      throw err;
    });
  }
  return webhookPoolPromise;
};

let leadConnectorTokenCache = {
  token: null,
  expiresAt: 0,
};

const fetchLeadConnectorAccessToken = async (locationId) => {
  const pool = await getWebhookPool();
  if (!pool) return null;
  const r = await pool.request()
    .input('locationId', sql.NVarChar, locationId)
    .query(`SELECT TOP 1 access_token FROM empresas WHERE locationid = @locationId`);
  const token = r.recordset?.[0]?.access_token ? String(r.recordset[0].access_token) : '';
  return token.trim() ? token.trim() : null;
};

const getLeadConnectorAccessToken = async (locationId, opts = {}) => {
  const forceRefresh = Boolean(opts.forceRefresh);
  const now = Date.now();
  if (!forceRefresh && leadConnectorTokenCache.token && leadConnectorTokenCache.expiresAt > now) {
    return leadConnectorTokenCache.token;
  }
  const token = await fetchLeadConnectorAccessToken(locationId);
  if (!token) return null;
  leadConnectorTokenCache = {
    token,
    expiresAt: now + 23 * 60 * 60 * 1000,
  };
  return token;
};

const extractContactIdFromLeadConnectorResponse = (data) => {
  if (!data || typeof data !== 'object') return null;

  const fromContact = data.contact && typeof data.contact === 'object' ? data.contact : null;
  const candidates = [
    fromContact?.id,
    fromContact?.contactId,
    data.contactId,
    data.id,
    Array.isArray(data.contacts) ? data.contacts?.[0]?.id : null,
  ];

  for (const v of candidates) {
    if (!v) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
};

const upsertLeadConnectorContact = async ({ name, email, phone, locationId }) => {
  const token = await getLeadConnectorAccessToken(locationId);
  if (!token) return { ok: false, skipped: true, error: 'No hay access_token disponible' };

  const body = { name, locationId };
  if (email && String(email).trim()) body.email = String(email).trim();
  if (phone && String(phone).trim()) body.phone = String(phone).trim();

  const doRequest = async (bearer) => {
    const res = await fetch(LEADCONNECTOR_UPSERT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': LEADCONNECTOR_API_VERSION,
        'Authorization': `Bearer ${bearer}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const parsed = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
    return { res, parsed };
  };

  let { res, parsed } = await doRequest(token);
  if (res.status === 401) {
    const refreshed = await getLeadConnectorAccessToken(locationId, { forceRefresh: true });
    if (refreshed) {
      ({ res, parsed } = await doRequest(refreshed));
    }
  }

  if (!res.ok) {
    return { ok: false, skipped: false, error: typeof parsed === 'string' ? parsed : JSON.stringify(parsed), status: res.status };
  }
  return { ok: true, skipped: false, data: parsed, contactId: extractContactIdFromLeadConnectorResponse(parsed) };
};

router.get('/', async (req, res) => {
  const { active } = req.query;
  try {
    const pool = await getPool();
    let query = `
      SELECT a.id, a.centro_costo_id, a.contact_id, a.nombre, a.documento, a.telefono, a.correo, a.direccion,
             a.dias_gracia, a.activo, a.creado_en, a.actualizado_en,
             cc.id AS cc_id, cc.nombre AS cc_nombre, cc.codigo AS cc_codigo
      FROM asociados a
      LEFT JOIN centros_costo cc ON cc.id = a.centro_costo_id
    `;
    
    if (active !== undefined) {
      query += ` WHERE a.activo = ${active === 'true' ? 1 : 0}`;
    }
    
    query += ` ORDER BY a.nombre ASC`;

    const result = await pool.request().query(query);
    
    const asociados = result.recordset.map(row => ({
      id: row.id,
      centro_costo_id: row.centro_costo_id,
      contact_id: row.contact_id ?? null,
      nombre: row.nombre,
      documento: row.documento,
      telefono: row.telefono,
      correo: row.correo,
      direccion: row.direccion,
      dias_gracia: row.dias_gracia,
      activo: row.activo,
      creado_en: row.creado_en,
      actualizado_en: row.actualizado_en,
      centro_costo: row.cc_id ? {
        id: row.cc_id,
        nombre: row.cc_nombre,
        codigo: row.cc_codigo
      } : null
    }));

    res.json(asociados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { centro_costo_id, nombre, documento, telefono, correo = '', direccion = '', dias_gracia = 2, activo = true } = req.body;
  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('centro_costo_id', sql.UniqueIdentifier, centro_costo_id);
    request.input('nombre', sql.NVarChar, nombre);
    request.input('documento', sql.NVarChar, documento);
    request.input('telefono', sql.NVarChar, telefono);
    request.input('correo', sql.NVarChar, correo);
    request.input('direccion', sql.NVarChar, direccion);
    request.input('dias_gracia', sql.Int, dias_gracia);
    request.input('activo', sql.Bit, activo);
    const insertResult = await request.query(`
      INSERT INTO asociados (centro_costo_id, nombre, documento, telefono, correo, direccion, dias_gracia, activo, creado_en, actualizado_en)
      OUTPUT inserted.id
      VALUES (@centro_costo_id, @nombre, @documento, @telefono, @correo, @direccion, @dias_gracia, @activo, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET())
    `);
    const id = insertResult.recordset[0].id;
    const getRequest = pool.request();
    getRequest.input('id', sql.UniqueIdentifier, id);
    const result = await getRequest.query(`
      SELECT a.id, a.centro_costo_id, a.contact_id, a.nombre, a.documento, a.telefono, a.correo, a.direccion,
             a.dias_gracia, a.activo, a.creado_en, a.actualizado_en,
             cc.id AS cc_id, cc.nombre AS cc_nombre, cc.codigo AS cc_codigo
      FROM asociados a INNER JOIN centros_costo cc ON cc.id = a.centro_costo_id
      WHERE a.id = @id
    `);
    const r = result.recordset[0];

    try {
      const upsertResult = await upsertLeadConnectorContact({
        name: r.nombre,
        email: r.correo,
        phone: r.telefono,
        locationId: LEADCONNECTOR_LOCATION_ID,
      });

      if (upsertResult?.ok && upsertResult.contactId) {
        const columnsSupport = await getAsociadosColumnsSupport(pool.request());
        if (columnsSupport.hasContactId) {
          await pool.request()
            .input('id', sql.UniqueIdentifier, id)
            .input('contact_id', sql.NVarChar(128), upsertResult.contactId)
            .query(`UPDATE asociados SET contact_id = @contact_id, actualizado_en = SYSDATETIMEOFFSET() WHERE id = @id`);
          r.contact_id = upsertResult.contactId;
        }
      }
    } catch (e) {
      console.error('Error sincronizando contacto a LeadConnector:', e instanceof Error ? e.message : e);
    }

    res.status(201).json({
      id: r.id,
      centro_costo_id: r.centro_costo_id,
      contact_id: r.contact_id ?? null,
      nombre: r.nombre,
      documento: r.documento,
      telefono: r.telefono,
      correo: r.correo,
      direccion: r.direccion,
      dias_gracia: r.dias_gracia,
      activo: r.activo,
      creado_en: r.creado_en,
      actualizado_en: r.actualizado_en,
      centro_costo: { id: r.cc_id, nombre: r.cc_nombre, codigo: r.cc_codigo }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { centro_costo_id, nombre, documento, telefono, correo = '', direccion = '', dias_gracia = 2, activo = true } = req.body;
  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('id', sql.UniqueIdentifier, id);
    request.input('centro_costo_id', sql.UniqueIdentifier, centro_costo_id);
    request.input('nombre', sql.NVarChar, nombre);
    request.input('documento', sql.NVarChar, documento);
    request.input('telefono', sql.NVarChar, telefono);
    request.input('correo', sql.NVarChar, correo);
    request.input('direccion', sql.NVarChar, direccion);
    request.input('dias_gracia', sql.Int, dias_gracia);
    request.input('activo', sql.Bit, activo);
    await request.query(`
      UPDATE asociados
      SET centro_costo_id = @centro_costo_id, nombre = @nombre, documento = @documento, telefono = @telefono, correo = @correo,
          direccion = @direccion, dias_gracia = @dias_gracia, activo = @activo, actualizado_en = SYSDATETIMEOFFSET()
      WHERE id = @id
    `);
    const getRequest = pool.request();
    getRequest.input('id', sql.UniqueIdentifier, id);
    const result = await getRequest.query(`
      SELECT a.id, a.centro_costo_id, a.contact_id, a.nombre, a.documento, a.telefono, a.correo, a.direccion,
             a.dias_gracia, a.activo, a.creado_en, a.actualizado_en,
             cc.id AS cc_id, cc.nombre AS cc_nombre, cc.codigo AS cc_codigo
      FROM asociados a INNER JOIN centros_costo cc ON cc.id = a.centro_costo_id
      WHERE a.id = @id
    `);
    const r = result.recordset[0] || null;
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json({
      id: r.id,
      centro_costo_id: r.centro_costo_id,
      contact_id: r.contact_id ?? null,
      nombre: r.nombre,
      documento: r.documento,
      telefono: r.telefono,
      correo: r.correo,
      direccion: r.direccion,
      dias_gracia: r.dias_gracia,
      activo: r.activo,
      creado_en: r.creado_en,
      actualizado_en: r.actualizado_en,
      centro_costo: { id: r.cc_id, nombre: r.cc_nombre, codigo: r.cc_codigo }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('id', sql.UniqueIdentifier, id);
    await request.query(`DELETE FROM asociados WHERE id = @id`);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/dias_gracia', async (req, res) => {
  const { id } = req.params;
  const { anio, mes } = req.query;
  if (!anio || !mes) return res.status(400).json({ error: 'anio y mes requeridos' });
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('anio', sql.Int, Number(anio))
      .input('mes', sql.Int, Number(mes))
      .query(`
        SELECT dia FROM dias_gracia_asociados
        WHERE asociado_id = @id AND anio = @anio AND mes = @mes
        ORDER BY dia ASC
      `);
    res.json(r.recordset.map(d => d.dia));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/dias_gracia', async (req, res) => {
  const { id } = req.params;
  const { anio, mes, dias } = req.body;
  if (!anio || !mes || !Array.isArray(dias)) return res.status(400).json({ error: 'Datos inválidos' });
  try {
    const pool = await getPool();
    const tx = new sql.Transaction(await getPool());
    await tx.begin();
    const reqDel = new sql.Request(tx);
    reqDel.input('id', sql.UniqueIdentifier, id);
    reqDel.input('anio', sql.Int, Number(anio));
    reqDel.input('mes', sql.Int, Number(mes));
    await reqDel.query(`DELETE FROM dias_gracia_asociados WHERE asociado_id = @id AND anio = @anio AND mes = @mes`);
    for (const dia of dias) {
      const reqIns = new sql.Request(tx);
      reqIns.input('id', sql.UniqueIdentifier, id);
      reqIns.input('anio', sql.Int, Number(anio));
      reqIns.input('mes', sql.Int, Number(mes));
      reqIns.input('dia', sql.Int, Number(dia));
      await reqIns.query(`
        INSERT INTO dias_gracia_asociados (asociado_id, anio, mes, dia, creado_en)
        VALUES (@id, @anio, @mes, @dia, SYSDATETIMEOFFSET())
      `);
    }
    await tx.commit();
    res.status(200).json({ ok: true });
  } catch (err) {
    try { await tx.rollback(); } catch {}
    res.status(500).json({ error: err.message });
  }
});

export default router;
