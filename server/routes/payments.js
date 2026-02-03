import express from 'express';
import sql from 'mssql';
import { randomUUID } from 'crypto';
import { getPool } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { from, to } = req.query;
  try {
    const pool = await getPool();
    // Fetch payments and their distributions
    // We can do this in one query with JOIN, but the frontend expects separate objects or nested.
    // Let's do a JOIN and format it.
    let query = `
      SELECT p.*, 
             d.id as dist_id, d.associate_amount, d.company_amount, d.created_at as dist_created_at,
             a.nombre as asociado_nombre, a.documento as asociado_documento,
             m.plate as motorcycle_plate
      FROM pagos p
      LEFT JOIN distribuciones_pagos d ON p.id = d.payment_id
      LEFT JOIN asociados a ON p.asociado_id = a.id
      LEFT JOIN motos m ON p.motorcycle_id = m.id
    `;

    if (from && to) {
      query += ` WHERE p.payment_date >= '${from}' AND p.payment_date <= '${to}'`;
    }

    query += ` ORDER BY p.payment_date DESC`;

    const result = await pool.request().query(query);
    
    // Format result: distribution should be a nested object or separate?
    // Frontend logic:
    // const distByPaymentId = Object.fromEntries(distributionsRes.data.map(d => [d.payment_id, d]));
    // payments.map(p => ({ ...p, distribution: distByPaymentId[p.id] }))
    
    // So if I return payments with nested distribution, I can simplify frontend logic.
    const payments = result.recordset.map(row => {
      const { dist_id, associate_amount, company_amount, dist_created_at, asociado_nombre, asociado_documento, motorcycle_plate, ...payment } = row;
      return {
        ...payment,
        asociado: payment.asociado_id ? {
          id: payment.asociado_id,
          nombre: asociado_nombre,
          documento: asociado_documento
        } : null,
        motorcycle: payment.motorcycle_id ? {
          id: payment.motorcycle_id,
          plate: motorcycle_plate
        } : null,
        distribution: dist_id ? {
          id: dist_id,
          payment_id: payment.id,
          associate_amount,
          company_amount,
          created_at: dist_created_at
        } : null
      };
    });

    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { motorcycle_id, asociado_id, amount, payment_date, receipt_number, notes, created_by } = req.body;
  
  const transaction = new sql.Transaction(await getPool());
  
  try {
    await transaction.begin();
    const request = new sql.Request(transaction);
    
    const paymentId = randomUUID();

    request.input('id', sql.UniqueIdentifier, paymentId);
    request.input('motorcycle_id', sql.UniqueIdentifier, motorcycle_id);
    request.input('asociado_id', sql.UniqueIdentifier, asociado_id);
    request.input('amount', sql.Decimal(10, 2), amount);
    request.input('payment_date', sql.Date, payment_date);
    request.input('receipt_number', sql.NVarChar, receipt_number);
    request.input('notes', sql.NVarChar, notes);
    request.input('created_by', sql.NVarChar, created_by || null);

    // Insert Payment (Trigger tr_create_payment_distribution will create the distribution)
    await request.query(`
      INSERT INTO pagos (id, motorcycle_id, asociado_id, amount, payment_date, receipt_number, notes, created_by, created_at)
      VALUES (@id, @motorcycle_id, @asociado_id, @amount, @payment_date, @receipt_number, @notes, @created_by, SYSDATETIMEOFFSET())
    `);
    
    // Fetch inserted payment
    const paymentResult = await request.query(`SELECT * FROM pagos WHERE id = @id`);
    const payment = paymentResult.recordset[0];

    // Fetch automatically created distribution
    const distResult = await request.query(`SELECT * FROM distribuciones_pagos WHERE payment_id = @id`);
    
    await transaction.commit();
    
    res.status(201).json({
      ...payment,
      distribution: distResult.recordset[0]
    });

  } catch (err) {
    if (transaction.active) await transaction.rollback();
    res.status(500).json({ error: err.message });
  }
});

export default router;
