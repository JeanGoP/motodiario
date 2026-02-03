import express from 'express';
import sql from 'mssql';
import { getPool } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT d.*, 
             a.nombre as asociado_nombre,
             m.plate as motorcycle_plate
      FROM desactivaciones d
      LEFT JOIN asociados a ON d.asociado_id = a.id
      LEFT JOIN motos m ON d.motorcycle_id = m.id
      ORDER BY d.deactivation_date DESC
    `);
    
    const deactivations = result.recordset.map(row => ({
      ...row,
      asociado: row.asociado_id ? {
        id: row.asociado_id,
        nombre: row.asociado_nombre
      } : null,
      motorcycle: row.motorcycle_id ? {
        id: row.motorcycle_id,
        plate: row.motorcycle_plate
      } : null
    }));

    res.json(deactivations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { motorcycle_id, asociado_id, deactivation_date, days_overdue, reason } = req.body;
  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('motorcycle_id', sql.UniqueIdentifier, motorcycle_id);
    request.input('asociado_id', sql.UniqueIdentifier, asociado_id);
    request.input('deactivation_date', sql.Date, deactivation_date);
    request.input('days_overdue', sql.Int, days_overdue);
    request.input('reason', sql.NVarChar, reason);

    const result = await request.query(`
      INSERT INTO desactivaciones (motorcycle_id, asociado_id, deactivation_date, days_overdue, reason, created_at)
      OUTPUT inserted.*
      VALUES (@motorcycle_id, @asociado_id, @deactivation_date, @days_overdue, @reason, SYSDATETIMEOFFSET())
    `);
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
