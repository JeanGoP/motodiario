import { Router } from 'express';
import { getPool, sql } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const TOKEN_EXP = '7d';

router.post('/registro', async (req, res) => {
  const { nombre, correo, password, rol = 'usuario' } = req.body;
  if (!nombre || !correo || !password) {
    return res.status(400).json({ error: 'Faltan campos' });
  }
  try {
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const pool = await getPool();
    const existing = await pool.request()
      .input('correo', sql.NVarChar, correo)
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .query('SELECT id FROM usuarios WHERE correo = @correo AND empresa_id = @empresa_id');
    if (existing.recordset.length) {
      return res.status(409).json({ error: 'Correo ya registrado' });
    }
    const hash = await bcrypt.hash(password, 10);
    const reqIns = pool.request();
    reqIns.input('empresa_id', sql.UniqueIdentifier, empresaId);
    reqIns.input('nombre', sql.NVarChar, nombre);
    reqIns.input('correo', sql.NVarChar, correo);
    reqIns.input('hash', sql.NVarChar, hash);
    reqIns.input('rol', sql.NVarChar, rol);
    const ins = await reqIns.query(`
      INSERT INTO usuarios (empresa_id, nombre, correo, hash_password, rol, activo, creado_en)
      OUTPUT inserted.id, inserted.nombre, inserted.correo, inserted.rol, inserted.activo, inserted.creado_en
      VALUES (@empresa_id, @nombre, @correo, @hash, @rol, 1, SYSDATETIMEOFFSET())
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
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const pool = await getPool();
    const r = await pool.request()
      .input('correo', sql.NVarChar, correo)
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .query('SELECT id, nombre, correo, hash_password, rol, activo FROM usuarios WHERE correo = @correo AND empresa_id = @empresa_id');
    if (!r.recordset.length) return res.status(401).json({ error: 'Credenciales inválidas' });
    const u = r.recordset[0];
    if (!u.activo) return res.status(403).json({ error: 'Usuario inactivo' });
    const ok = await bcrypt.compare(password, u.hash_password);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
    const token = jwt.sign({ sub: u.id, correo: u.correo, nombre: u.nombre, rol: u.rol, empresa_id: empresaId }, JWT_SECRET, { expiresIn: TOKEN_EXP });
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
    const empresaId = req.empresaId;
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
