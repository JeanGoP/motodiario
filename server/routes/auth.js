import { Router } from 'express';
import { getPool, sql } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const TOKEN_EXP = '7d';

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

const getAdminScope = async (req) => {
  const payload = getTokenPayload(req);
  if (!payload) return { ok: false, status: 401, error: 'No autorizado' };

  const pool = await getPool();
  const defaultEmpresaId = await getDefaultEmpresaId(pool);
  const userId = payload.sub;

  const superAdminCheck = defaultEmpresaId
    ? await pool.request()
      .input('id', sql.UniqueIdentifier, userId)
      .input('empresa_id', sql.UniqueIdentifier, defaultEmpresaId)
      .query(`SELECT TOP 1 1 AS ok FROM usuarios WHERE id = @id AND empresa_id = @empresa_id AND rol = N'admin' AND activo = 1`)
    : { recordset: [] };
  if (superAdminCheck.recordset?.length) {
    return { ok: true, userId, isSuperAdmin: true, tokenEmpresaId: String(payload.empresa_id || '') };
  }

  const tokenEmpresaId = payload.empresa_id ? String(payload.empresa_id) : null;
  if (!tokenEmpresaId) return { ok: false, status: 400, error: 'Falta empresa_id' };

  const empresaAdminCheck = await pool.request()
    .input('id', sql.UniqueIdentifier, userId)
    .input('empresa_id', sql.UniqueIdentifier, tokenEmpresaId)
    .query(`SELECT TOP 1 1 AS ok FROM usuarios WHERE id = @id AND empresa_id = @empresa_id AND rol = N'admin' AND activo = 1`);
  if (!empresaAdminCheck.recordset?.length) return { ok: false, status: 403, error: 'No autorizado' };

  return { ok: true, userId, isSuperAdmin: false, tokenEmpresaId };
};

router.post('/registro', async (req, res) => {
  res.status(403).json({ error: 'Registro deshabilitado. Solicite acceso al administrador.' });
});

router.get('/usuarios', async (req, res) => {
  try {
    const admin = await getAdminScope(req);
    if (!admin.ok) return res.status(admin.status).json({ error: admin.error });

    const empresaId = (req.query?.empresa_id ? String(req.query.empresa_id) : null) || req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    if (!admin.isSuperAdmin && String(admin.tokenEmpresaId) !== String(empresaId)) return res.status(403).json({ error: 'No autorizado' });

    const pool = await getPool();
    const r = await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .query(`
        SELECT id, nombre, correo, rol, activo, creado_en
        FROM usuarios
        WHERE empresa_id = @empresa_id
        ORDER BY creado_en DESC
      `);
    res.json(r.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/usuarios', async (req, res) => {
  const { nombre, correo, password, rol = 'usuario', activo = true } = req.body;
  if (!nombre || !correo || !password) return res.status(400).json({ error: 'Faltan campos' });

  try {
    const admin = await getAdminScope(req);
    if (!admin.ok) return res.status(admin.status).json({ error: admin.error });

    const empresaId = String(req.body.empresa_id || req.empresaId || '').trim();
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    if (!admin.isSuperAdmin && String(admin.tokenEmpresaId) !== String(empresaId)) return res.status(403).json({ error: 'No autorizado' });

    const pool = await getPool();
    const empresaExists = await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .query('SELECT TOP 1 1 AS ok FROM empresas WHERE id = @empresa_id');
    if (!empresaExists.recordset?.length) return res.status(400).json({ error: 'Empresa inválida' });

    const existing = await pool.request()
      .input('correo', sql.NVarChar, correo)
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .query('SELECT id FROM usuarios WHERE correo = @correo AND empresa_id = @empresa_id');
    if (existing.recordset.length) return res.status(409).json({ error: 'Correo ya registrado' });

    const hash = await bcrypt.hash(password, 10);
    const reqIns = pool.request();
    reqIns.input('empresa_id', sql.UniqueIdentifier, empresaId);
    reqIns.input('nombre', sql.NVarChar, nombre);
    reqIns.input('correo', sql.NVarChar, correo);
    reqIns.input('hash', sql.NVarChar, hash);
    reqIns.input('rol', sql.NVarChar, rol);
    reqIns.input('activo', sql.Bit, !!activo);
    const ins = await reqIns.query(`
      INSERT INTO usuarios (empresa_id, nombre, correo, hash_password, rol, activo, creado_en)
      OUTPUT inserted.id, inserted.nombre, inserted.correo, inserted.rol, inserted.activo, inserted.creado_en
      VALUES (@empresa_id, @nombre, @correo, @hash, @rol, @activo, SYSDATETIMEOFFSET())
    `);
    res.status(201).json(ins.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { correo, password } = req.body;
  if (!correo || !password) {
    return res.status(400).json({ error: 'Faltan campos' });
  }
  try {
    const pool = await getPool();
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });

    const tryLogin = async (targetEmpresaId) => {
      const r = await pool.request()
        .input('correo', sql.NVarChar, correo)
        .input('empresa_id', sql.UniqueIdentifier, targetEmpresaId)
        .query('SELECT id, nombre, correo, hash_password, rol, activo FROM usuarios WHERE correo = @correo AND empresa_id = @empresa_id');
      return r.recordset?.[0] ? { user: r.recordset[0], empresaId: targetEmpresaId } : null;
    };

    const firstTry = await tryLogin(empresaId);
    let authUser = firstTry;

    if (!authUser) {
      const defaultEmpresaId = await getDefaultEmpresaId(pool);
      if (defaultEmpresaId && String(defaultEmpresaId) !== String(empresaId)) {
        const fallback = await tryLogin(defaultEmpresaId);
        if (fallback?.user?.rol === 'admin') authUser = fallback;
      }
    }

    if (!authUser) return res.status(401).json({ error: 'Credenciales inválidas' });
    const u = authUser.user;
    if (!u.activo) return res.status(403).json({ error: 'Usuario inactivo' });
    const ok = await bcrypt.compare(password, u.hash_password);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
    const token = jwt.sign({ sub: u.id, correo: u.correo, nombre: u.nombre, rol: u.rol, empresa_id: authUser.empresaId }, JWT_SECRET, { expiresIn: TOKEN_EXP });
    res.json({ token, usuario: { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', async (req, res) => {
  const auth = req.headers.authorization || '';
  const [, token] = auth.split(' ');
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const empresaId = payload.empresa_id ? String(payload.empresa_id) : '';
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.UniqueIdentifier, payload.sub)
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .query('SELECT id, nombre, correo, rol, activo, creado_en FROM usuarios WHERE id = @id AND empresa_id = @empresa_id');
    if (!r.recordset.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(r.recordset[0]);
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

export default router;
