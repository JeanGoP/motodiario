import express from 'express';
import sql from 'mssql';
import { getPool } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { active } = req.query;
  try {
    const pool = await getPool();
    let query = `
      SELECT a.id, a.centro_costo_id, a.nombre, a.documento, a.telefono, a.correo, a.direccion,
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
      SELECT a.id, a.centro_costo_id, a.nombre, a.documento, a.telefono, a.correo, a.direccion,
             a.dias_gracia, a.activo, a.creado_en, a.actualizado_en,
             cc.id AS cc_id, cc.nombre AS cc_nombre, cc.codigo AS cc_codigo
      FROM asociados a INNER JOIN centros_costo cc ON cc.id = a.centro_costo_id
      WHERE a.id = @id
    `);
    const r = result.recordset[0];
    res.status(201).json({
      id: r.id,
      centro_costo_id: r.centro_costo_id,
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
      SELECT a.id, a.centro_costo_id, a.nombre, a.documento, a.telefono, a.correo, a.direccion,
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
