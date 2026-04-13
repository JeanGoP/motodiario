import express from 'express';
import sql from 'mssql';
import { randomUUID } from 'crypto';
import { getPool } from '../db.js';
import { computeAsiento } from './accounting.js';

const router = express.Router();

const ALLOWED_PAYMENT_METHODS = new Set([
  'EFECTIVO',
  'TRANSFERENCIA',
  'TARJETA',
  'NEQUI',
  'DAVIPLATA',
  'OTRO',
]);

let pagosColumnsCache = {
  checkedAt: 0,
  hasInstallmentNumber: false,
  hasPaymentMethod: false,
};

const getPagosColumnsSupport = async (request) => {
  const now = Date.now();
  if (now - pagosColumnsCache.checkedAt < 60_000) return pagosColumnsCache;

  const cols = await request.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'pagos'
      AND COLUMN_NAME IN ('installment_number', 'payment_method')
  `);

  const names = new Set((cols.recordset || []).map((r) => r.COLUMN_NAME));
  pagosColumnsCache = {
    checkedAt: now,
    hasInstallmentNumber: names.has('installment_number'),
    hasPaymentMethod: names.has('payment_method'),
  };
  return pagosColumnsCache;
};

const normalizeDateOnly = (value) => {
  if (!value) return value;
  if (typeof value === 'string') return value.includes('T') ? value.split('T')[0] : value;
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value);
};

const isValidISODate = (value) => {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

export const validatePaymentPayload = (body) => {
  const motorcycle_id = typeof body?.motorcycle_id === 'string' ? body.motorcycle_id : '';
  const asociado_id = typeof body?.asociado_id === 'string' ? body.asociado_id : '';
  const receipt_number = typeof body?.receipt_number === 'string' ? body.receipt_number.trim() : '';
  const notes = typeof body?.notes === 'string' ? body.notes : '';
  const created_by = typeof body?.created_by === 'string' ? body.created_by : null;
  const payment_date = body?.payment_date;
  const amount = Number(body?.amount);

  const installmentRaw = body?.installment_number;
  const installment_number =
    installmentRaw === undefined || installmentRaw === null || installmentRaw === ''
      ? null
      : Number(installmentRaw);

  const paymentMethodRaw = body?.payment_method;
  const payment_method =
    paymentMethodRaw === undefined || paymentMethodRaw === null || paymentMethodRaw === ''
      ? null
      : String(paymentMethodRaw).trim().toUpperCase();

  if (!motorcycle_id) return { ok: false, status: 400, error: 'motorcycle_id es requerido' };
  if (!asociado_id) return { ok: false, status: 400, error: 'asociado_id es requerido' };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, status: 400, error: 'El monto debe ser mayor a 0' };
  if (!isValidISODate(payment_date)) return { ok: false, status: 400, error: 'La fecha de pago es inválida' };
  if (!receipt_number) return { ok: false, status: 400, error: 'El número de recibo es requerido' };

  if (installment_number !== null) {
    if (!Number.isInteger(installment_number) || installment_number <= 0) {
      return { ok: false, status: 400, error: 'El número de cuota debe ser un entero mayor a 0' };
    }
  }

  if (payment_method !== null) {
    if (!ALLOWED_PAYMENT_METHODS.has(payment_method)) {
      return { ok: false, status: 400, error: 'El método de pago no es válido' };
    }
  }

  return {
    ok: true,
    data: {
      motorcycle_id,
      asociado_id,
      amount,
      payment_date,
      receipt_number,
      notes,
      created_by,
      installment_number,
      payment_method,
    },
  };
};

router.get('/', async (req, res) => {
  const { from, to } = req.query;
  try {
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const pool = await getPool();
    // Fetch payments and their distributions
    // We can do this in one query with JOIN, but the frontend expects separate objects or nested.
    // Let's do a JOIN and format it.
    const request = pool.request().input('empresa_id', sql.UniqueIdentifier, empresaId);
    let query = `
      SELECT p.*, 
             d.id as dist_id, d.associate_amount, d.company_amount, d.created_at as dist_created_at,
             a.nombre as asociado_nombre, a.documento as asociado_documento,
             m.plate as motorcycle_plate
      FROM pagos p
      LEFT JOIN distribuciones_pagos d ON p.id = d.payment_id AND d.empresa_id = p.empresa_id
      LEFT JOIN asociados a ON p.asociado_id = a.id AND a.empresa_id = p.empresa_id
      LEFT JOIN motos m ON p.motorcycle_id = m.id AND m.empresa_id = p.empresa_id
      WHERE p.empresa_id = @empresa_id
    `;

    if (from && to) {
      request.input('from', sql.NVarChar(10), String(from));
      request.input('to', sql.NVarChar(10), String(to));
      query += ` AND p.payment_date >= CONVERT(date, @from) AND p.payment_date <= CONVERT(date, @to)`;
    }

    query += ` ORDER BY p.payment_date DESC`;

    const result = await request.query(query);
    
    // Format result: distribution should be a nested object or separate?
    // Frontend logic:
    // const distByPaymentId = Object.fromEntries(distributionsRes.data.map(d => [d.payment_id, d]));
    // payments.map(p => ({ ...p, distribution: distByPaymentId[p.id] }))
    
    // So if I return payments with nested distribution, I can simplify frontend logic.
    const payments = result.recordset.map(row => {
      const { dist_id, associate_amount, company_amount, dist_created_at, asociado_nombre, asociado_documento, motorcycle_plate, ...payment } = row;
      return {
        ...payment,
        payment_date: normalizeDateOnly(payment.payment_date),
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
  const validation = validatePaymentPayload(req.body);
  if (!validation.ok) {
    res.status(validation.status).json({ error: validation.error });
    return;
  }
  const empresaId = req.empresaId;
  if (!empresaId) {
    res.status(400).json({ error: 'Falta empresa_id' });
    return;
  }

  const {
    motorcycle_id,
    asociado_id,
    amount,
    payment_date,
    receipt_number,
    notes,
    created_by,
    installment_number,
    payment_method,
  } = validation.data;
  
  const transaction = new sql.Transaction(await getPool());
  
  try {
    await transaction.begin();
    const request = new sql.Request(transaction);
    request.input('empresa_id', sql.UniqueIdentifier, empresaId);
    
    const paymentId = randomUUID();
    const columnSupport = await getPagosColumnsSupport(request);

    const requiresInstallmentColumn = installment_number !== null;
    const requiresMethodColumn = payment_method !== null;

    if (requiresInstallmentColumn && !columnSupport.hasInstallmentNumber) {
      await transaction.rollback();
      res.status(500).json({ error: "La base de datos no está actualizada: falta la columna 'installment_number'. Ejecuta la migración 005_add_payment_installment_and_method.sql" });
      return;
    }

    if (requiresMethodColumn && !columnSupport.hasPaymentMethod) {
      await transaction.rollback();
      res.status(500).json({ error: "La base de datos no está actualizada: falta la columna 'payment_method'. Ejecuta la migración 005_add_payment_installment_and_method.sql" });
      return;
    }

    request.input('receipt_number', sql.NVarChar, receipt_number);

    const existingReceipt = await request.query(`
      SELECT TOP 1 1 as exists_flag
      FROM pagos
      WHERE receipt_number = @receipt_number AND empresa_id = @empresa_id
    `);
    if (existingReceipt.recordset.length > 0) {
      await transaction.rollback();
      res.status(409).json({ error: 'Ya existe un pago con ese número de recibo' });
      return;
    }

    request.input('motorcycle_id', sql.UniqueIdentifier, motorcycle_id);
    request.input('asociado_id', sql.UniqueIdentifier, asociado_id);

    const motoResult = await request.query(`
      SELECT TOP 1 asociado_id, plan_months
      FROM motos
      WHERE id = @motorcycle_id AND empresa_id = @empresa_id
    `);

    if (motoResult.recordset.length === 0) {
      await transaction.rollback();
      res.status(400).json({ error: 'La moto no existe' });
      return;
    }

    const moto = motoResult.recordset[0];
    if (moto.asociado_id !== asociado_id) {
      await transaction.rollback();
      res.status(400).json({ error: 'El asociado no corresponde a la moto seleccionada' });
      return;
    }

    if (installment_number !== null && Number(moto.plan_months) > 0 && installment_number > Number(moto.plan_months)) {
      await transaction.rollback();
      res.status(400).json({ error: `El número de cuota excede el plan de ${moto.plan_months} meses` });
      return;
    }

    if (installment_number !== null && columnSupport.hasInstallmentNumber) {
      request.input('installment_number', sql.Int, installment_number);
      const existingInstallment = await request.query(`
        SELECT TOP 1 1 as exists_flag
        FROM pagos
        WHERE motorcycle_id = @motorcycle_id
          AND empresa_id = @empresa_id
          AND installment_number = @installment_number
      `);

      if (existingInstallment.recordset.length > 0) {
        await transaction.rollback();
        res.status(409).json({ error: 'Ya existe un pago registrado para esa cuota de la moto' });
        return;
      }
    } else if (columnSupport.hasInstallmentNumber) {
      request.input('installment_number', sql.Int, null);
    }

    request.input('id', sql.UniqueIdentifier, paymentId);
    request.input('amount', sql.Decimal(10, 2), amount);
    request.input('payment_date', sql.NVarChar(10), payment_date);
    request.input('notes', sql.NVarChar, notes);
    request.input('created_by', sql.NVarChar, created_by || null);
    if (columnSupport.hasPaymentMethod) {
      request.input('payment_method', sql.NVarChar(50), payment_method || null);
    }

    // Insert Payment (Trigger tr_create_payment_distribution will create the distribution)
    if (columnSupport.hasInstallmentNumber && columnSupport.hasPaymentMethod) {
      await request.query(`
        INSERT INTO pagos (empresa_id, id, motorcycle_id, asociado_id, amount, payment_date, receipt_number, notes, created_by, installment_number, payment_method, created_at)
        VALUES (@empresa_id, @id, @motorcycle_id, @asociado_id, @amount, CONVERT(date, @payment_date), @receipt_number, @notes, @created_by, @installment_number, @payment_method, SYSDATETIMEOFFSET())
      `);
    } else if (columnSupport.hasInstallmentNumber) {
      await request.query(`
        INSERT INTO pagos (empresa_id, id, motorcycle_id, asociado_id, amount, payment_date, receipt_number, notes, created_by, installment_number, created_at)
        VALUES (@empresa_id, @id, @motorcycle_id, @asociado_id, @amount, CONVERT(date, @payment_date), @receipt_number, @notes, @created_by, @installment_number, SYSDATETIMEOFFSET())
      `);
    } else if (columnSupport.hasPaymentMethod) {
      await request.query(`
        INSERT INTO pagos (empresa_id, id, motorcycle_id, asociado_id, amount, payment_date, receipt_number, notes, created_by, payment_method, created_at)
        VALUES (@empresa_id, @id, @motorcycle_id, @asociado_id, @amount, CONVERT(date, @payment_date), @receipt_number, @notes, @created_by, @payment_method, SYSDATETIMEOFFSET())
      `);
    } else {
      await request.query(`
        INSERT INTO pagos (empresa_id, id, motorcycle_id, asociado_id, amount, payment_date, receipt_number, notes, created_by, created_at)
        VALUES (@empresa_id, @id, @motorcycle_id, @asociado_id, @amount, CONVERT(date, @payment_date), @receipt_number, @notes, @created_by, SYSDATETIMEOFFSET())
      `);
    }
    
    // Fetch inserted payment
    const paymentResult = await request.query(`SELECT * FROM pagos WHERE id = @id AND empresa_id = @empresa_id`);
    const payment = paymentResult.recordset[0];

    // Fetch automatically created distribution
    const distResult = await request.query(`SELECT * FROM distribuciones_pagos WHERE payment_id = @id AND empresa_id = @empresa_id`);

    const contabilidadSupport = await request.query(`
      SELECT 
        OBJECT_ID('dbo.contable_reglas_versiones') AS reglas,
        OBJECT_ID('dbo.contable_regla_lineas') AS regla_lineas,
        OBJECT_ID('dbo.contable_asientos') AS asientos,
        OBJECT_ID('dbo.contable_asiento_lineas') AS asiento_lineas
    `);
    const s = contabilidadSupport.recordset?.[0] || {};
    const contabilidadOk = !!(s.reglas && s.regla_lineas && s.asientos && s.asiento_lineas);

    if (contabilidadOk) {
      const reglaActiva = await request.query(`
        SELECT TOP 1 id, tipo_cuota, version
        FROM contable_reglas_versiones
        WHERE empresa_id = @empresa_id AND tipo_cuota = N'CUOTA' AND activa = 1
        ORDER BY version DESC
      `);
      const regla = reglaActiva.recordset?.[0] || null;
      if (!regla) {
        await transaction.rollback();
        res.status(409).json({ error: 'No existe configuración contable activa para CUOTA' });
        return;
      }

      const reglaLineasRequest = new sql.Request(transaction);
      reglaLineasRequest.input('empresa_id', sql.UniqueIdentifier, empresaId);
      reglaLineasRequest.input('regla_id', sql.UniqueIdentifier, regla.id);
      const reglaLineas = await reglaLineasRequest.query(`
        SELECT cuenta_id, movimiento, porcentaje, descripcion
        FROM contable_regla_lineas
        WHERE empresa_id = @empresa_id AND regla_version_id = @regla_id
      `);
      const computed = computeAsiento({ monto: amount, lineas: reglaLineas.recordset || [] });
      if (!computed.ok) {
        await transaction.rollback();
        res.status(computed.status || 400).json({ error: computed.error || 'Configuración contable inválida' });
        return;
      }

      const asientoId = randomUUID();
      const descripcion = installment_number ? `Pago cuota ${installment_number} (${receipt_number})` : `Pago cuota (${receipt_number})`;
      const asientoRequest = new sql.Request(transaction);
      asientoRequest.input('empresa_id', sql.UniqueIdentifier, empresaId);
      asientoRequest.input('asiento_id', sql.UniqueIdentifier, asientoId);
      asientoRequest.input('origen', sql.NVarChar(32), 'PAGO');
      asientoRequest.input('origen_id', sql.UniqueIdentifier, paymentId);
      asientoRequest.input('regla_version_id', sql.UniqueIdentifier, regla.id);
      asientoRequest.input('fecha', sql.NVarChar(10), payment_date);
      asientoRequest.input('descripcion', sql.NVarChar(255), descripcion);
      await asientoRequest.query(`
          INSERT INTO contable_asientos (id, empresa_id, origen, origen_id, regla_version_id, fecha, descripcion, creado_en)
          VALUES (@asiento_id, @empresa_id, @origen, @origen_id, @regla_version_id, CONVERT(date, @fecha), @descripcion, SYSDATETIMEOFFSET())
        `);

      for (const l of computed.data) {
        const lineaRequest = new sql.Request(transaction);
        lineaRequest.input('empresa_id', sql.UniqueIdentifier, empresaId);
        lineaRequest.input('linea_id', sql.UniqueIdentifier, randomUUID());
        lineaRequest.input('asiento_id', sql.UniqueIdentifier, asientoId);
        lineaRequest.input('asociado_id', sql.UniqueIdentifier, asociado_id);
        lineaRequest.input('cuenta_id', sql.UniqueIdentifier, l.cuenta_id);
        lineaRequest.input('movimiento', sql.NVarChar(7), l.movimiento);
        lineaRequest.input('porcentaje', sql.Decimal(9, 4), l.porcentaje);
        lineaRequest.input('valor', sql.Decimal(18, 2), l.valor);
        lineaRequest.input('descripcion', sql.NVarChar(255), l.descripcion);
        await lineaRequest.query(`
            INSERT INTO contable_asiento_lineas (id, empresa_id, asiento_id, asociado_id, cuenta_id, movimiento, porcentaje, valor, descripcion, creado_en)
            VALUES (@linea_id, @empresa_id, @asiento_id, @asociado_id, @cuenta_id, @movimiento, @porcentaje, @valor, @descripcion, SYSDATETIMEOFFSET())
          `);
      }
    }
    
    await transaction.commit();
    
    res.status(201).json({
      ...payment,
      payment_date: normalizeDateOnly(payment?.payment_date),
      distribution: distResult.recordset[0]
    });

  } catch (err) {
    if (transaction.active) await transaction.rollback();
    res.status(500).json({ error: err.message });
  }
});

export default router;
