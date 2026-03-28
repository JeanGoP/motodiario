import express from 'express';
import sql from 'mssql';
import { getPool } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const pool = await getPool();
    const result = await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .query(`
      SELECT n.*, 
             a.nombre as asociado_nombre, a.telefono as asociado_telefono,
             m.plate as motorcycle_plate
      FROM notificaciones n
      LEFT JOIN asociados a ON n.asociado_id = a.id AND a.empresa_id = n.empresa_id
      LEFT JOIN motos m ON n.motorcycle_id = m.id AND m.empresa_id = n.empresa_id
      WHERE n.empresa_id = @empresa_id
      ORDER BY n.created_at DESC
    `);
    
    const notifications = result.recordset.map(row => ({
      ...row,
      asociado: row.asociado_id ? {
        id: row.asociado_id,
        nombre: row.asociado_nombre,
        telefono: row.asociado_telefono
      } : null,
      motorcycle: row.motorcycle_id ? {
        id: row.motorcycle_id,
        plate: row.motorcycle_plate
      } : null
    }));

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { asociado_id, motorcycle_id, type, message, status, channel } = req.body;
  try {
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const pool = await getPool();
    const request = pool.request();
    request.input('empresa_id', sql.UniqueIdentifier, empresaId);
    request.input('asociado_id', sql.UniqueIdentifier, asociado_id || null);
    request.input('motorcycle_id', sql.UniqueIdentifier, motorcycle_id || null);
    request.input('type', sql.NVarChar, type);
    request.input('message', sql.NVarChar, message);
    request.input('status', sql.NVarChar, status);
    request.input('channel', sql.NVarChar, channel);

    if (asociado_id) {
      const asociadoCheck = await request.query(`SELECT TOP 1 1 AS ok FROM asociados WHERE id = @asociado_id AND empresa_id = @empresa_id`);
      if (!asociadoCheck.recordset?.length) return res.status(400).json({ error: 'Asociado inválido' });
    }
    if (motorcycle_id) {
      const motoCheck = await request.query(`SELECT TOP 1 1 AS ok FROM motos WHERE id = @motorcycle_id AND empresa_id = @empresa_id`);
      if (!motoCheck.recordset?.length) return res.status(400).json({ error: 'Moto inválida' });
    }

    const result = await request.query(`
      INSERT INTO notificaciones (empresa_id, asociado_id, motorcycle_id, type, message, status, channel, created_at, updated_at)
      OUTPUT inserted.*
      VALUES (@empresa_id, @asociado_id, @motorcycle_id, @type, @message, @status, @channel, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET())
    `);
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { status, sent_at } = req.body;
  try {
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const pool = await getPool();
    const request = pool.request();
    request.input('id', sql.UniqueIdentifier, id);
    request.input('empresa_id', sql.UniqueIdentifier, empresaId);
    request.input('status', sql.NVarChar, status);
    request.input('sent_at', sql.DateTimeOffset, sent_at ? new Date(sent_at) : null);

    const result = await request.query(`
      UPDATE notificaciones
      SET status = @status, 
          sent_at = @sent_at,
          updated_at = SYSDATETIMEOFFSET()
      WHERE id = @id AND empresa_id = @empresa_id;
      SELECT * FROM notificaciones WHERE id = @id AND empresa_id = @empresa_id;
    `);
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
