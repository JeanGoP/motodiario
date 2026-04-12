import { Router } from 'express';
import { getPool, sql } from '../db.js';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

const getTokenPayload = (req) => {
  const auth = req.headers.authorization || '';
  const [, token] = auth.split(' ');
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

const isUuid = (value) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(value || '').trim());

const getDefaultEmpresaId = async (pool) => {
  const r = await pool.request()
    .input('codigo', sql.NVarChar, 'DEFAULT')
    .query('SELECT TOP 1 id FROM empresas WHERE codigo = @codigo');
  return r.recordset?.[0]?.id ? String(r.recordset[0].id) : null;
};

const isSuperAdmin = async (pool, userId, defaultEmpresaId) => {
  if (!userId || !defaultEmpresaId) return false;
  const r = await pool.request()
    .input('id', sql.UniqueIdentifier, userId)
    .input('empresa_id', sql.UniqueIdentifier, defaultEmpresaId)
    .query(`SELECT TOP 1 1 AS ok FROM usuarios WHERE id = @id AND empresa_id = @empresa_id AND rol = N'admin' AND activo = 1`);
  return !!r.recordset?.length;
};

const ensureUserActiveInEmpresa = async (pool, userId, empresaId) => {
  const r = await pool.request()
    .input('id', sql.UniqueIdentifier, userId)
    .input('empresa_id', sql.UniqueIdentifier, empresaId)
    .query(`SELECT TOP 1 1 AS ok FROM usuarios WHERE id = @id AND empresa_id = @empresa_id AND activo = 1`);
  return !!r.recordset?.length;
};

const resolveEmpresaForRequest = async (pool, payload, reqEmpresaId) => {
  const tokenEmpresaId = payload?.empresa_id ? String(payload.empresa_id) : '';
  const defaultEmpresaId = await getDefaultEmpresaId(pool);
  const superOk = await isSuperAdmin(pool, String(payload.sub), defaultEmpresaId);
  if (superOk) return { ok: true, empresaId: reqEmpresaId, isSuperAdmin: true };
  if (!tokenEmpresaId || tokenEmpresaId !== reqEmpresaId) return { ok: false, status: 403, error: 'No autorizado' };
  return { ok: true, empresaId: reqEmpresaId, isSuperAdmin: false };
};

const buildCrearComprobanteUrl = ({ baseUrl, token }) => {
  const trimmed = String(baseUrl || '').trim();
  if (!trimmed) return null;
  const base = trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  let u;
  try {
    u = new URL('CrearComprobante', base);
  } catch {
    return null;
  }
  u.searchParams.set('token', String(token || '').trim());
  return u.toString();
};

router.post('/crear-comprobante', async (req, res) => {
  const payload = getTokenPayload(req);
  if (!payload?.sub) return res.status(401).json({ error: 'No autorizado' });

  const empresaId = req.empresaId ? String(req.empresaId) : '';
  if (!isUuid(empresaId)) return res.status(400).json({ error: 'Falta empresa_id' });

  try {
    const pool = await getPool();
    const scope = await resolveEmpresaForRequest(pool, payload, empresaId);
    if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

    const userOk = await ensureUserActiveInEmpresa(pool, String(payload.sub), empresaId);
    if (!userOk) return res.status(403).json({ error: 'No autorizado' });

    const cfg = await pool.request()
      .input('id', sql.UniqueIdentifier, empresaId)
      .query(`
        SELECT TOP 1 erp_sync, erp_api_url, erp_api_token
        FROM empresas
        WHERE id = @id
      `);
    const row = cfg.recordset?.[0] || null;
    if (!row) return res.status(404).json({ error: 'Empresa no existe' });
    if (!row.erp_sync) return res.status(400).json({ error: 'ERP no está habilitado para esta empresa' });
    if (!row.erp_api_url || !row.erp_api_token) return res.status(400).json({ error: 'Configuración ERP incompleta (URL/Token)' });

    const url = buildCrearComprobanteUrl({ baseUrl: row.erp_api_url, token: row.erp_api_token });
    if (!url) return res.status(400).json({ error: 'URL ERP inválida' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let upstream;
    try {
      upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body ?? {}),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        return res.status(upstream.status).json(JSON.parse(text || 'null'));
      } catch {
        return res.status(upstream.status).send(text);
      }
    }
    return res.status(upstream.status).send(text);
  } catch (err) {
    if (String(err?.name) === 'AbortError') return res.status(504).json({ error: 'Tiempo de espera agotado al contactar ERP' });
    res.status(500).json({ error: err.message });
  }
});

router.post('/contabilizar-recibo/:id', async (req, res) => {
  const { id } = req.params;
  const payload = getTokenPayload(req);
  if (!payload?.sub) return res.status(401).json({ error: 'No autorizado' });

  const empresaId = req.empresaId ? String(req.empresaId) : '';
  if (!isUuid(empresaId)) return res.status(400).json({ error: 'Falta empresa_id' });
  if (!isUuid(id)) return res.status(400).json({ error: 'ID de recibo inválido' });

  try {
    const pool = await getPool();
    const scope = await resolveEmpresaForRequest(pool, payload, empresaId);
    if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

    const userOk = await ensureUserActiveInEmpresa(pool, String(payload.sub), empresaId);
    if (!userOk) return res.status(403).json({ error: 'No autorizado' });

    const cfg = await pool.request()
      .input('id', sql.UniqueIdentifier, empresaId)
      .query(`
        SELECT TOP 1 erp_sync, erp_api_url, erp_api_token
        FROM empresas
        WHERE id = @id
      `);
    const row = cfg.recordset?.[0] || null;
    if (!row) return res.status(404).json({ error: 'Empresa no existe' });
    if (!row.erp_sync) return res.status(400).json({ error: 'ERP no está habilitado para esta empresa' });
    if (!row.erp_api_url || !row.erp_api_token) return res.status(400).json({ error: 'Configuración ERP incompleta (URL/Token)' });

    const url = buildCrearComprobanteUrl({ baseUrl: row.erp_api_url, token: row.erp_api_token });
    if (!url) return res.status(400).json({ error: 'URL ERP inválida' });

    // 1. Obtener asiento del recibo
    const asientoResult = await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('origen_id', sql.UniqueIdentifier, id)
      .query(`
        SELECT TOP 1 id, fecha, descripcion
        FROM contable_asientos
        WHERE empresa_id = @empresa_id AND origen_id = @origen_id AND origen = 'RECIBO_CAJA'
        ORDER BY creado_en DESC
      `);
    const asiento = asientoResult.recordset?.[0];
    if (!asiento) return res.status(404).json({ error: 'No se encontró el asiento contable para este recibo' });

    // 2. Obtener lineas del asiento
    const lineasResult = await pool.request()
      .input('asiento_id', sql.UniqueIdentifier, asiento.id)
      .query(`
        SELECT l.movimiento, l.valor, c.codigo as cuenta_codigo, asoc.documento as tercero_documento
        FROM contable_asiento_lineas l
        JOIN contable_cuentas c ON l.cuenta_id = c.id
        LEFT JOIN asociados asoc ON l.asociado_id = asoc.id
        WHERE l.asiento_id = @asiento_id
      `);
    const lineas = lineasResult.recordset || [];
    if (!lineas.length) return res.status(400).json({ error: 'El asiento no tiene líneas configuradas' });

    // 3. Formar JSON ERP
    const payloadERP = {
      TipoDocumento: "NOTA CONTABLE",
      CentroCosto: "01",
      FechaDoc: new Date(asiento.fecha).toISOString().split('T')[0],
      Descripcion: asiento.descripcion || "Contabilización de recibo",
      Detalle: lineas.map(l => ({
        CentroCosto: "68",
        Concepto: "",
        Cuenta: l.cuenta_codigo || "",
        Tercero: l.tercero_documento || "",
        Factura: "",
        Vencimiento: "",
        Valor: l.movimiento === 'CREDITO' ? -Number(l.valor) : Number(l.valor),
        Detalle: l.movimiento === 'DEBITO' ? 'Ingreso' : 'Salida'
      }))
    };

    // 4. Enviar a ERP
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let upstream;
    try {
      upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadERP),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';
    let responseData = text;
    if (contentType.includes('application/json')) {
      try { responseData = JSON.parse(text || 'null'); } catch {}
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Error del ERP', details: responseData });
    }

    return res.status(200).json({ success: true, erpResponse: responseData });

  } catch (err) {
    if (String(err?.name) === 'AbortError') return res.status(504).json({ error: 'Tiempo de espera agotado al contactar ERP' });
    res.status(500).json({ error: err.message });
  }
});

export default router;
