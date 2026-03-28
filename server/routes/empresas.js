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

router.get('/', async (req, res) => {
  const payload = getTokenPayload(req);
  if (!payload) return res.status(401).json({ error: 'No autorizado' });

  try {
    const pool = await getPool();
    const defaultEmpresaId = await getDefaultEmpresaId(pool);
    const ok = await isSuperAdmin(pool, payload.sub, defaultEmpresaId);
    if (!ok) return res.status(403).json({ error: 'No autorizado' });

    const result = await pool.request().query(`
      SELECT id, nombre, codigo, activo, leadconnector_location_id, creado_en, actualizado_en
      FROM empresas
      ORDER BY creado_en DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const payload = getTokenPayload(req);
  if (!payload) return res.status(401).json({ error: 'No autorizado' });

  const { nombre, codigo, leadconnector_location_id = null, activo = true } = req.body || {};
  if (!nombre || !codigo) return res.status(400).json({ error: 'Faltan campos' });

  try {
    const pool = await getPool();
    const defaultEmpresaId = await getDefaultEmpresaId(pool);
    const ok = await isSuperAdmin(pool, payload.sub, defaultEmpresaId);
    if (!ok) return res.status(403).json({ error: 'No autorizado' });

    const request = pool.request();
    request.input('nombre', sql.NVarChar, nombre);
    request.input('codigo', sql.NVarChar, codigo);
    request.input('activo', sql.Bit, !!activo);
    request.input('leadconnector_location_id', sql.NVarChar, leadconnector_location_id);
    const result = await request.query(`
      INSERT INTO empresas (id, nombre, codigo, activo, leadconnector_location_id, creado_en, actualizado_en)
      OUTPUT inserted.id, inserted.nombre, inserted.codigo, inserted.activo, inserted.leadconnector_location_id, inserted.creado_en, inserted.actualizado_en
      VALUES (NEWID(), @nombre, @codigo, @activo, @leadconnector_location_id, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET())
    `);
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const payload = getTokenPayload(req);
  if (!payload) return res.status(401).json({ error: 'No autorizado' });

  const { id } = req.params;
  const { nombre, codigo, leadconnector_location_id = null, activo = true } = req.body || {};
  if (!nombre || !codigo) return res.status(400).json({ error: 'Faltan campos' });

  try {
    const pool = await getPool();
    const defaultEmpresaId = await getDefaultEmpresaId(pool);
    const ok = await isSuperAdmin(pool, payload.sub, defaultEmpresaId);
    if (!ok) return res.status(403).json({ error: 'No autorizado' });

    const request = pool.request();
    request.input('id', sql.UniqueIdentifier, id);
    request.input('nombre', sql.NVarChar, nombre);
    request.input('codigo', sql.NVarChar, codigo);
    request.input('activo', sql.Bit, !!activo);
    request.input('leadconnector_location_id', sql.NVarChar, leadconnector_location_id);
    const result = await request.query(`
      UPDATE empresas
      SET nombre = @nombre,
          codigo = @codigo,
          activo = @activo,
          leadconnector_location_id = @leadconnector_location_id,
          actualizado_en = SYSDATETIMEOFFSET()
      WHERE id = @id;

      SELECT id, nombre, codigo, activo, leadconnector_location_id, creado_en, actualizado_en
      FROM empresas
      WHERE id = @id;
    `);
    res.json(result.recordset[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

