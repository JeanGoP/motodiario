import express from 'express';
import sql from 'mssql';
import { getPool } from '../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

export function resolveEmpresaScope({ isSuperAdmin, tokenEmpresaId, requestEmpresaId, intent = 'read' }) {
  const reqEmpresa = requestEmpresaId ? String(requestEmpresaId) : '';
  const tokenEmpresa = tokenEmpresaId ? String(tokenEmpresaId) : '';

  if (!reqEmpresa) return { ok: false, status: 400, error: 'Falta empresa_id' };
  if (isSuperAdmin) return { ok: true, empresaId: reqEmpresa };
  if (!tokenEmpresa) return { ok: false, status: 400, error: 'Falta empresa_id en el token' };
  if (tokenEmpresa !== reqEmpresa) {
    return intent === 'write'
      ? { ok: false, status: 400, error: 'No puedes operar fuera de tu empresa asignada' }
      : { ok: false, status: 403, error: 'No autorizado' };
  }
  return { ok: true, empresaId: tokenEmpresa };
}

export function canWrite({ rol }) {
  return String(rol || '').toLowerCase() === 'admin';
}

export function validateEmpresaIdBody({ bodyEmpresaId, empresaId }) {
  const b = bodyEmpresaId ? String(bodyEmpresaId) : '';
  const e = empresaId ? String(empresaId) : '';
  if (b && e && b !== e) return { ok: false, status: 400, error: 'empresa_id no coincide con la empresa de la sesión' };
  return { ok: true };
}

const getTokenPayload = (req) => {
  const auth = req.headers?.authorization ? String(req.headers.authorization) : '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

const getDefaultEmpresaId = async (pool) => {
  const r = await pool.request().query(`SELECT TOP 1 id FROM empresas WHERE es_default = 1`);
  return r.recordset?.[0]?.id ? String(r.recordset[0].id) : null;
};

const isSuperAdminUser = async (pool, userId, defaultEmpresaId) => {
  if (!defaultEmpresaId) return false;
  const r = await pool.request()
    .input('id', sql.UniqueIdentifier, userId)
    .input('empresa_id', sql.UniqueIdentifier, defaultEmpresaId)
    .query(`
      SELECT TOP 1 1 AS ok
      FROM usuarios
      WHERE id = @id AND empresa_id = @empresa_id AND rol = 'admin' AND activo = 1
    `);
  return Boolean(r.recordset?.length);
};

const getAuthContext = async (req, { intent = 'read' } = {}) => {
  const payload = getTokenPayload(req);
  if (!payload?.sub) return { ok: false, status: 401, error: 'No autenticado' };

  const pool = await getPool();
  const defaultEmpresaId = await getDefaultEmpresaId(pool);
  const userId = String(payload.sub);
  const isSuperAdmin = await isSuperAdminUser(pool, userId, defaultEmpresaId);

  const scope = resolveEmpresaScope({
    isSuperAdmin,
    tokenEmpresaId: payload.empresa_id,
    requestEmpresaId: req.empresaId,
    intent,
  });
  if (!scope.ok) return scope;

  const empresaIdForUserCheck = isSuperAdmin ? defaultEmpresaId : scope.empresaId;
  if (!empresaIdForUserCheck) return { ok: false, status: 403, error: 'No autorizado' };

  const u = await pool.request()
    .input('id', sql.UniqueIdentifier, userId)
    .input('empresa_id', sql.UniqueIdentifier, empresaIdForUserCheck)
    .query(`
      SELECT TOP 1 id, rol, activo
      FROM usuarios
      WHERE id = @id AND empresa_id = @empresa_id
    `);
  const row = u.recordset?.[0] || null;
  if (!row || !row.activo) return { ok: false, status: 403, error: 'No autorizado' };

  return {
    ok: true,
    pool,
    empresaId: scope.empresaId,
    userId,
    rol: row.rol,
    isSuperAdmin,
    defaultEmpresaId,
  };
};

const auditCreate = async (pool, { empresaId, userId, resource, resourceId, payload }) => {
  try {
    await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('usuario_id', sql.UniqueIdentifier, userId)
      .input('accion', sql.NVarChar(32), 'CREATE')
      .input('recurso', sql.NVarChar(64), resource)
      .input('recurso_id', sql.UniqueIdentifier, resourceId)
      .input('payload_json', sql.NVarChar(sql.MAX), payload ? JSON.stringify(payload) : null)
      .query(`
        INSERT INTO audit_logs (empresa_id, usuario_id, accion, recurso, recurso_id, payload_json, creado_en)
        VALUES (@empresa_id, @usuario_id, @accion, @recurso, @recurso_id, @payload_json, SYSDATETIMEOFFSET())
      `);
  } catch (e) {
    console.error('Error auditando CREATE:', e instanceof Error ? e.message : e);
  }
};

export function preferRecurringDiasGracia(recurringDias, monthDias) {
  return Array.isArray(recurringDias) && recurringDias.length > 0 ? recurringDias : (monthDias || []);
}

const parseBogotaDateInput = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map((p) => Number(p));
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d, 5, 0, 0, 0));
  }
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

router.get('/', async (req, res) => {
  try {
    const auth = await getAuthContext(req, { intent: 'read' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { empresaId, pool } = auth;
    const result = await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .query(`
      SELECT m.*, 
             a.nombre as asociado_nombre, a.documento as asociado_documento
      FROM motos m
      LEFT JOIN asociados a ON m.asociado_id = a.id AND a.empresa_id = m.empresa_id
      WHERE m.empresa_id = @empresa_id
      ORDER BY m.created_at DESC
    `);
    
    // Map result to match expected frontend format
    // Although frontend does manual mapping, returning clean data is good.
    // The frontend expects fields like 'brand', 'model', etc. which match DB columns.
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { asociado_id, brand, model, year, plate, daily_rate, status, created_at, plan_months } = req.body;
  try {
    const auth = await getAuthContext(req, { intent: 'write' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!canWrite(auth)) return res.status(403).json({ error: 'Forbidden' });
    const empresaBodyCheck = validateEmpresaIdBody({ bodyEmpresaId: req.body?.empresa_id, empresaId: auth.empresaId });
    if (!empresaBodyCheck.ok) return res.status(empresaBodyCheck.status).json({ error: empresaBodyCheck.error });
    const empresaId = auth.empresaId;
    const allowedPlans = new Set([12, 15, 18, 24]);
    const planMonthsValue =
      plan_months === undefined || plan_months === null || plan_months === ''
        ? 12
        : Number(plan_months);
    if (!Number.isFinite(planMonthsValue) || !allowedPlans.has(planMonthsValue)) {
      res.status(400).json({ error: 'plan_months inválido. Valores permitidos: 12, 15, 18, 24' });
      return;
    }

    const pool = auth.pool;
    const request = pool.request();
    request.input('empresa_id', sql.UniqueIdentifier, empresaId);
    request.input('asociado_id', sql.UniqueIdentifier, asociado_id);
    request.input('brand', sql.NVarChar, brand);
    request.input('model', sql.NVarChar, model);
    request.input('year', sql.Int, year);
    request.input('plate', sql.NVarChar, plate);
    request.input('daily_rate', sql.Decimal(10, 2), daily_rate);
    request.input('status', sql.NVarChar, status);
    request.input('plan_months', sql.Int, planMonthsValue);
    request.input('dias_gracia', sql.Int, req.body.dias_gracia || 0);
    
    // Use provided created_at or default to current time
    // If created_at is provided, we cast it to DateTimeOffset or let SQL handle the string if valid
    const createdAtValue = parseBogotaDateInput(created_at) || new Date();
    request.input('created_at', sql.DateTimeOffset, createdAtValue);

    const asociadoCheck = await request.query(`
      SELECT TOP 1 1 AS ok
      FROM asociados
      WHERE id = @asociado_id AND empresa_id = @empresa_id
    `);
    if (!asociadoCheck.recordset?.length) {
      res.status(400).json({ error: 'Asociado inválido' });
      return;
    }

    const result = await request.query(`
      INSERT INTO motos (empresa_id, asociado_id, brand, model, year, plate, daily_rate, status, plan_months, dias_gracia, created_at, updated_at)
      OUTPUT inserted.*
      VALUES (@empresa_id, @asociado_id, @brand, @model, @year, @plate, @daily_rate, @status, @plan_months, @dias_gracia, @created_at, SYSDATETIMEOFFSET())
    `);
    const created = result.recordset[0];
    if (created?.id) {
      await auditCreate(pool, {
        empresaId,
        userId: auth.userId,
        resource: 'motos',
        resourceId: created.id,
        payload: { asociado_id, brand, model, year, plate, daily_rate, status, created_at: createdAtValue, plan_months: planMonthsValue, dias_gracia: req.body.dias_gracia || 0 },
      });
    }
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { asociado_id, brand, model, year, plate, daily_rate, status, created_at, plan_months } = req.body;
  try {
    const auth = await getAuthContext(req, { intent: 'write' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!canWrite(auth)) return res.status(403).json({ error: 'Forbidden' });
    const empresaId = auth.empresaId;
    const shouldUpdatePlan = !(plan_months === undefined || plan_months === null || plan_months === '');
    const allowedPlans = new Set([12, 15, 18, 24]);
    const planMonthsValue = shouldUpdatePlan ? Number(plan_months) : null;
    if (shouldUpdatePlan && (!Number.isFinite(planMonthsValue) || !allowedPlans.has(planMonthsValue))) {
      res.status(400).json({ error: 'plan_months inválido. Valores permitidos: 12, 15, 18, 24' });
      return;
    }

    const pool = auth.pool;
    const request = pool.request();
    request.input('id', sql.UniqueIdentifier, id);
    request.input('empresa_id', sql.UniqueIdentifier, empresaId);
    request.input('asociado_id', sql.UniqueIdentifier, asociado_id);
    request.input('brand', sql.NVarChar, brand);
    request.input('model', sql.NVarChar, model);
    request.input('year', sql.Int, year);
    request.input('plate', sql.NVarChar, plate);
    request.input('daily_rate', sql.Decimal(10, 2), daily_rate);
    request.input('status', sql.NVarChar, status);
    request.input('dias_gracia', sql.Int, req.body.dias_gracia || 0);

    const asociadoCheck = await request.query(`
      SELECT TOP 1 1 AS ok
      FROM asociados
      WHERE id = @asociado_id AND empresa_id = @empresa_id
    `);
    if (!asociadoCheck.recordset?.length) {
      res.status(400).json({ error: 'Asociado inválido' });
      return;
    }
    
    // Handle created_at update if provided
    let query = `
      UPDATE motos
      SET asociado_id = @asociado_id, 
          brand = @brand, 
          model = @model, 
          year = @year, 
          plate = @plate, 
          daily_rate = @daily_rate, 
          status = @status,
          dias_gracia = @dias_gracia,
          updated_at = SYSDATETIMEOFFSET()
    `;

    if (shouldUpdatePlan) {
      request.input('plan_months', sql.Int, planMonthsValue);
      query += `, plan_months = @plan_months`;
    }

    if (created_at) {
      const createdAtValue = parseBogotaDateInput(created_at);
      if (createdAtValue) {
        request.input('created_at', sql.DateTimeOffset, createdAtValue);
        query += `, created_at = @created_at`;
      }
    }

    query += `
      WHERE id = @id AND empresa_id = @empresa_id;
      SELECT * FROM motos WHERE id = @id AND empresa_id = @empresa_id;
    `;

    const result = await request.query(query);
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const auth = await getAuthContext(req, { intent: 'write' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!canWrite(auth)) return res.status(403).json({ error: 'Forbidden' });
    const empresaId = auth.empresaId;
    const pool = auth.pool;
    const request = pool.request();
    request.input('id', sql.UniqueIdentifier, id);
    request.input('empresa_id', sql.UniqueIdentifier, empresaId);
    await request.query('DELETE FROM motos WHERE id = @id AND empresa_id = @empresa_id');
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
    const auth = await getAuthContext(req, { intent: 'read' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const empresaId = auth.empresaId;
    const pool = auth.pool;
    const motoExists = await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .query(`SELECT TOP 1 1 AS ok FROM motos WHERE id = @id AND empresa_id = @empresa_id`);
    if (!motoExists.recordset?.length) return res.status(404).json({ error: 'Not found' });

    const reqBase = pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('empresa_id', sql.UniqueIdentifier, empresaId);

    const recurring = await reqBase.query(`
      SELECT dia FROM dias_gracia_motos
      WHERE moto_id = @id AND empresa_id = @empresa_id AND anio = 0 AND mes = 0
      ORDER BY dia ASC
    `);

    if (recurring.recordset.length > 0) {
      return res.json(preferRecurringDiasGracia(recurring.recordset.map(d => d.dia), []));
    }

    const r = await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('anio', sql.Int, Number(anio))
      .input('mes', sql.Int, Number(mes))
      .query(`
        SELECT dia FROM dias_gracia_motos
        WHERE moto_id = @id AND empresa_id = @empresa_id AND anio = @anio AND mes = @mes
        ORDER BY dia ASC
      `);
    return res.json(preferRecurringDiasGracia([], r.recordset.map(d => d.dia)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/dias_gracia', async (req, res) => {
  const { id } = req.params;
  const { anio, mes, dias, recurring } = req.body;
  const isRecurring = Boolean(recurring);
  if (!Array.isArray(dias)) return res.status(400).json({ error: 'Datos inválidos' });
  if (!isRecurring && (!anio || !mes)) return res.status(400).json({ error: 'Datos inválidos' });
  let tx;
  try {
    const auth = await getAuthContext(req, { intent: 'write' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!canWrite(auth)) return res.status(403).json({ error: 'Forbidden' });
    const empresaId = auth.empresaId;
    const pool = auth.pool;
    const motoExists = await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .query(`SELECT TOP 1 1 AS ok FROM motos WHERE id = @id AND empresa_id = @empresa_id`);
    if (!motoExists.recordset?.length) return res.status(404).json({ error: 'Not found' });

    tx = new sql.Transaction(await getPool());
    await tx.begin();
    const anioDb = isRecurring ? 0 : Number(anio);
    const mesDb = isRecurring ? 0 : Number(mes);

    const reqDel = new sql.Request(tx);
    reqDel.input('id', sql.UniqueIdentifier, id);
    reqDel.input('empresa_id', sql.UniqueIdentifier, empresaId);

    if (isRecurring) {
      await reqDel.query(`DELETE FROM dias_gracia_motos WHERE moto_id = @id AND empresa_id = @empresa_id`);
    } else {
      reqDel.input('anio', sql.Int, anioDb);
      reqDel.input('mes', sql.Int, mesDb);
      await reqDel.query(`DELETE FROM dias_gracia_motos WHERE moto_id = @id AND empresa_id = @empresa_id AND anio = @anio AND mes = @mes`);
    }

    for (const dia of dias) {
      const reqIns = new sql.Request(tx);
      reqIns.input('id', sql.UniqueIdentifier, id);
      reqIns.input('empresa_id', sql.UniqueIdentifier, empresaId);
      reqIns.input('anio', sql.Int, anioDb);
      reqIns.input('mes', sql.Int, mesDb);
      reqIns.input('dia', sql.Int, Number(dia));
      await reqIns.query(`
          INSERT INTO dias_gracia_motos (empresa_id, moto_id, anio, mes, dia, creado_en)
          VALUES (@empresa_id, @id, @anio, @mes, @dia, SYSDATETIMEOFFSET())
        `);
    }
    await tx.commit();
    res.status(200).json({ ok: true });
  } catch (err) {
    try { if (tx) await tx.rollback(); } catch {}
    res.status(500).json({ error: err.message });
  }
});

export default router;
