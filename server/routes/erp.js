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

export default router;
