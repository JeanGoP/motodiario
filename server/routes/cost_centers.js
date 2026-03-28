import { Router } from 'express';
import { getPool, sql } from '../db.js';
import jwt from 'jsonwebtoken';

const router = Router();

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

router.get('/', async (req, res) => {
  try {
    const auth = await getAuthContext(req, { intent: 'read' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { empresaId, pool } = auth;
    const result = await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .query(`
      SELECT id, nombre, codigo, descripcion, activo, creado_en, actualizado_en
      FROM centros_costo
      WHERE empresa_id = @empresa_id
      ORDER BY creado_en DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { nombre, codigo, descripcion = '', activo = true } = req.body;
  try {
    const auth = await getAuthContext(req, { intent: 'write' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!canWrite(auth)) return res.status(403).json({ error: 'Forbidden' });
    const empresaBodyCheck = validateEmpresaIdBody({ bodyEmpresaId: req.body?.empresa_id, empresaId: auth.empresaId });
    if (!empresaBodyCheck.ok) return res.status(empresaBodyCheck.status).json({ error: empresaBodyCheck.error });

    const { empresaId, pool } = auth;
    const request = pool.request();
    request.input('empresa_id', sql.UniqueIdentifier, empresaId);
    request.input('nombre', sql.NVarChar, nombre);
    request.input('codigo', sql.NVarChar, codigo);
    request.input('descripcion', sql.NVarChar, descripcion);
    request.input('activo', sql.Bit, activo);
    const result = await request.query(`
      INSERT INTO centros_costo (empresa_id, nombre, codigo, descripcion, activo, creado_en, actualizado_en)
      OUTPUT inserted.id, inserted.nombre, inserted.codigo, inserted.descripcion, inserted.activo, inserted.creado_en, inserted.actualizado_en
      VALUES (@empresa_id, @nombre, @codigo, @descripcion, @activo, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET())
    `);
    const created = result.recordset[0];
    if (created?.id) {
      await auditCreate(pool, {
        empresaId,
        userId: auth.userId,
        resource: 'centros_costo',
        resourceId: created.id,
        payload: { nombre, codigo, descripcion, activo },
      });
    }
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, codigo, descripcion = '', activo = true } = req.body;
  try {
    const auth = await getAuthContext(req, { intent: 'write' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!canWrite(auth)) return res.status(403).json({ error: 'Forbidden' });
    const { empresaId, pool } = auth;
    const request = pool.request();
    request.input('id', sql.UniqueIdentifier, id);
    request.input('empresa_id', sql.UniqueIdentifier, empresaId);
    request.input('nombre', sql.NVarChar, nombre);
    request.input('codigo', sql.NVarChar, codigo);
    request.input('descripcion', sql.NVarChar, descripcion);
    request.input('activo', sql.Bit, activo);
    const result = await request.query(`
      UPDATE centros_costo
      SET nombre = @nombre, codigo = @codigo, descripcion = @descripcion, activo = @activo, actualizado_en = SYSDATETIMEOFFSET()
      WHERE id = @id AND empresa_id = @empresa_id;
      SELECT id, nombre, codigo, descripcion, activo, creado_en, actualizado_en
      FROM centros_costo
      WHERE id = @id AND empresa_id = @empresa_id;
    `);
    res.json(result.recordset[0] || null);
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
    const { empresaId, pool } = auth;
    const request = pool.request();
    request.input('id', sql.UniqueIdentifier, id);
    request.input('empresa_id', sql.UniqueIdentifier, empresaId);
    await request.query(`DELETE FROM centros_costo WHERE id = @id AND empresa_id = @empresa_id`);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
