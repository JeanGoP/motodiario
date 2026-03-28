import express from 'express';
import sql from 'mssql';
import { getPool } from '../db.js';

const router = express.Router();

// Get cash receipts with filters
router.get('/', async (req, res) => {
  const { from, to, asociado_id } = req.query;
  try {
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const pool = await getPool();
    const request = pool.request().input('empresa_id', sql.UniqueIdentifier, empresaId);
    let query = `
      SELECT r.*, a.nombre as asociado_nombre, a.documento as asociado_documento
      FROM recibos_caja r
      JOIN asociados a ON r.asociado_id = a.id AND a.empresa_id = r.empresa_id
      WHERE r.empresa_id = @empresa_id
    `;

    if (from && to) {
      request.input('from', sql.NVarChar(10), String(from));
      request.input('to', sql.NVarChar(10), String(to));
      query += ` AND r.fecha >= CONVERT(date, @from) AND r.fecha <= CONVERT(date, @to)`;
    }
    
    if (asociado_id) {
      request.input('asociado_id', sql.UniqueIdentifier, String(asociado_id));
      query += ` AND r.asociado_id = @asociado_id`;
    }

    query += ` ORDER BY r.fecha DESC, r.created_at DESC`;

    const result = await request.query(query);
    
    const receipts = result.recordset.map(row => ({
      id: row.id,
      asociado_id: row.asociado_id,
      monto: row.monto,
      concepto: row.concepto,
      fecha: row.fecha,
      observaciones: row.observaciones,
      created_by: row.created_by,
      created_at: row.created_at,
      asociado: {
        id: row.asociado_id,
        nombre: row.asociado_nombre,
        documento: row.asociado_documento
      }
    }));

    res.json(receipts);
  } catch (err) {
    console.error('Error fetching cash receipts:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new cash receipt
router.post('/', async (req, res) => {
  const { asociado_id, monto, concepto, fecha, observaciones, created_by } = req.body;

  try {
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const pool = await getPool();
    const request = pool.request();

    request.input('empresa_id', sql.UniqueIdentifier, empresaId);
    request.input('asociado_id', sql.UniqueIdentifier, asociado_id);
    request.input('monto', sql.Decimal(10, 2), monto);
    request.input('concepto', sql.NVarChar, concepto);
    request.input('fecha', sql.Date, fecha);
    request.input('observaciones', sql.NVarChar, observaciones || null);
    request.input('created_by', sql.NVarChar, created_by || null);

    const asociadoCheck = await request.query(`
      SELECT TOP 1 1 AS ok
      FROM asociados
      WHERE id = @asociado_id AND empresa_id = @empresa_id
    `);
    if (!asociadoCheck.recordset?.length) return res.status(400).json({ error: 'Asociado inválido' });

    const result = await request.query(`
      INSERT INTO recibos_caja (empresa_id, asociado_id, monto, concepto, fecha, observaciones, created_by)
      OUTPUT inserted.*
      VALUES (@empresa_id, @asociado_id, @monto, @concepto, @fecha, @observaciones, @created_by)
    `);

    const newReceipt = result.recordset[0];
    
    // Fetch associate details for the response
    const associateResult = await pool.request()
      .input('id', sql.UniqueIdentifier, asociado_id)
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .query('SELECT nombre, documento FROM asociados WHERE id = @id AND empresa_id = @empresa_id');
      
    const associate = associateResult.recordset[0];

    res.status(201).json({
      ...newReceipt,
      asociado: associate
    });
  } catch (err) {
    console.error('Error creating cash receipt:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
