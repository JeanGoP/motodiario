import { Router } from 'express';
import { getPool, sql } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const pool = await getPool();
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
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const pool = await getPool();
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
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, codigo, descripcion = '', activo = true } = req.body;
  try {
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const pool = await getPool();
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
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const pool = await getPool();
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
