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

const ALLOWED_PAYMENT_ALLOCATION_MODES = new Set([
  'ADELANTAR',
  'REDUCIR_PLAZO',
]);

let pagosColumnsCache = {
  checkedAt: 0,
  hasInstallmentNumber: false,
  hasPaymentMethod: false,
};

let carteraColumnsCache = {
  checkedAt: 0,
  hasCarteraSaldos: false,
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

const getCarteraSupport = async (request) => {
  const now = Date.now();
  if (now - carteraColumnsCache.checkedAt < 60_000) return carteraColumnsCache;

  const obj = await request.query(`SELECT OBJECT_ID('dbo.cartera_saldos') AS id`);
  carteraColumnsCache = {
    checkedAt: now,
    hasCarteraSaldos: obj.recordset?.[0]?.id !== null,
  };
  return carteraColumnsCache;
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

const dateOnlyToUtcMs = (value) => {
  const s = normalizeDateOnly(value);
  const [y, m, d] = String(s).split('-').map((p) => Number(p));
  if (!y || !m || !d) return NaN;
  return Date.UTC(y, m - 1, d);
};

const computeDaysPaid = (amount, dailyRate) => {
  const amountCents = Math.round(Number(amount || 0) * 100);
  const rateCents = Math.round(Number(dailyRate || 0) * 100);
  if (!Number.isFinite(amountCents) || !Number.isFinite(rateCents) || rateCents <= 0) return 0;
  return Math.max(0, Math.floor(amountCents / rateCents));
};

const parseAllocationSegmentsFromNotes = (notes, installmentEnd, amountCents, dailyRateCents) => {
  const segments = [];
  const s = typeof notes === 'string' ? notes : '';
  const lines = s.split(/\r?\n/).map((v) => v.trim()).filter((v) => v.length > 0);

  for (const line of lines) {
    const finales = line.match(/Cubre cuotas finales\s+(\d+)\s*-\s*(\d+)/i);
    if (finales) {
      const from = Number(finales[1]);
      const to = Number(finales[2]);
      if (Number.isFinite(from) && Number.isFinite(to) && from > 0 && to > 0) {
        segments.push({ from: Math.min(from, to), to: Math.max(from, to), direction: 'desc' });
      }
      continue;
    }
    const normal = line.match(/Cubre cuotas\s+(\d+)\s*-\s*(\d+)/i);
    if (normal) {
      const from = Number(normal[1]);
      const to = Number(normal[2]);
      if (Number.isFinite(from) && Number.isFinite(to) && from > 0 && to > 0) {
        segments.push({ from: Math.min(from, to), to: Math.max(from, to), direction: 'asc' });
      }
    }
  }

  if (segments.length) return segments;

  const installment = installmentEnd === null || installmentEnd === undefined ? null : Number(installmentEnd);
  if (installment !== null && Number.isFinite(installment) && installment > 0 && Number.isFinite(amountCents) && amountCents > 0) {
    const fullDays = Math.floor(amountCents / dailyRateCents);
    const remainder = amountCents - fullDays * dailyRateCents;
    const dayCount = Math.max(1, fullDays + (remainder > 0 ? 1 : 0));
    const to = installment;
    const from = Math.max(1, to - dayCount + 1);
    segments.push({ from, to, direction: 'asc' });
  }

  return segments;
};

const toCents = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
};

const computeAllocationForMoto = async ({ request, empresaId, motorcycleId, amount, mode }) => {
  const amountCents = toCents(amount);
  const allocationMode = typeof mode === 'string' && ALLOWED_PAYMENT_ALLOCATION_MODES.has(mode) ? mode : 'ADELANTAR';

  if (amountCents < 0) {
    return {
      ok: false,
      status: 400,
      error: 'El monto debe ser mayor o igual a 0',
    };
  }

  request.input('alloc_empresa_id', sql.UniqueIdentifier, empresaId);
  request.input('alloc_motorcycle_id', sql.UniqueIdentifier, motorcycleId);

  const motoRes = await request.query(`
    SELECT TOP 1 id, asociado_id, daily_rate, plan_months
    FROM motos
    WHERE empresa_id = @alloc_empresa_id AND id = @alloc_motorcycle_id
  `);

  const moto = motoRes.recordset?.[0] || null;
  if (!moto) {
    return { ok: false, status: 400, error: 'La moto no existe' };
  }

  const dailyRateCents = toCents(moto.daily_rate);
  if (dailyRateCents <= 0) {
    return { ok: false, status: 400, error: 'La moto no tiene tarifa diaria válida' };
  }

  const planMonths = Number(moto.plan_months || 0);
  const planLimit = Number.isFinite(planMonths) && planMonths > 0 ? Math.floor(planMonths) : 0;

  const support = await getCarteraSupport(request);

  let pending = [];
  if (support.hasCarteraSaldos) {
    const pendingRes = await request.query(`
      SELECT cuota_num, saldo
      FROM cartera_saldos
      WHERE empresa_id = @alloc_empresa_id
        AND motorcycle_id = @alloc_motorcycle_id
        AND saldo > 0
      ORDER BY cuota_num ASC
    `);
    pending = pendingRes.recordset || [];
  }

  const startCuota = pending.length ? Number(pending[0].cuota_num) : null;

  let baseNextCuota = 1;
  if (startCuota !== null && Number.isFinite(startCuota) && startCuota > 0) {
    baseNextCuota = startCuota;
  } else if (support.hasCarteraSaldos) {
    const maxRes = await request.query(`
      SELECT MAX(cuota_num) AS max_cuota
      FROM cartera_saldos
      WHERE empresa_id = @alloc_empresa_id
        AND motorcycle_id = @alloc_motorcycle_id
    `);
    const maxCuota = Number(maxRes.recordset?.[0]?.max_cuota || 0);
    baseNextCuota = (Number.isFinite(maxCuota) ? maxCuota : 0) + 1;
  } else {
    const maxInstallmentRes = await request.query(`
      SELECT MAX(installment_number) AS max_installment
      FROM pagos
      WHERE empresa_id = @alloc_empresa_id
        AND motorcycle_id = @alloc_motorcycle_id
        AND installment_number IS NOT NULL
    `);
    const maxInstallment = Number(maxInstallmentRes.recordset?.[0]?.max_installment || 0);
    baseNextCuota = (Number.isFinite(maxInstallment) ? maxInstallment : 0) + 1;
  }

  let saldoInicialCents = dailyRateCents;
  if (pending.length) {
    const firstRow = pending[0];
    const firstSaldoCents = toCents(firstRow?.saldo);
    if (firstSaldoCents > 0) saldoInicialCents = firstSaldoCents;
  }

  if (amountCents === 0) {
    return {
      ok: true,
      data: {
        modo: allocationMode,
        cuota_actual: baseNextCuota,
        saldo_inicial: Number((saldoInicialCents / 100).toFixed(2)),
        tarifa_diaria: Number((dailyRateCents / 100).toFixed(2)),
        en_orden: null,
        finales: null,
      },
    };
  }

  if (allocationMode === 'REDUCIR_PLAZO' && planLimit > 0) {
    let remaining = amountCents;
    let ordenFrom = null;
    let ordenTo = null;
    let ordenFull = 0;
    let ordenPartial = null;

    for (const row of pending) {
      if (remaining <= 0) break;
      const cuota = Number(row.cuota_num);
      if (!Number.isFinite(cuota) || cuota <= 0) continue;
      const saldoCents = toCents(row.saldo);
      if (saldoCents <= 0) continue;

      if (ordenFrom === null) ordenFrom = cuota;
      const applied = Math.min(remaining, saldoCents);
      remaining -= applied;
      ordenTo = cuota;

      if (applied === saldoCents) {
        ordenFull += 1;
        continue;
      }

      ordenPartial = {
        cuota_num: cuota,
        abono: Number((applied / 100).toFixed(2)),
        saldo_restante: Number(((saldoCents - applied) / 100).toFixed(2)),
      };
      remaining = 0;
      break;
    }

    let finalesFrom = null;
    let finalesTo = null;
    let finalesFull = 0;
    let finalesPartial = null;

    if (remaining > 0) {
      const paymentsRes = await request.query(`
        SELECT amount, installment_number, notes
        FROM pagos
        WHERE empresa_id = @alloc_empresa_id
          AND motorcycle_id = @alloc_motorcycle_id
        ORDER BY created_at ASC
      `);

      const allocatedCentsByCuota = new Map();
      for (const p of paymentsRes.recordset || []) {
        const installmentEnd = p.installment_number === null || p.installment_number === undefined ? null : Number(p.installment_number);
        const pAmountCents = Math.round(Number(p.amount || 0) * 100);
        if (!Number.isFinite(pAmountCents) || pAmountCents <= 0) continue;
        const notes = typeof p.notes === 'string' ? p.notes : '';
        const segments = parseAllocationSegmentsFromNotes(notes, installmentEnd, pAmountCents, dailyRateCents);
        if (!segments.length) continue;

        let r = pAmountCents;
        for (const seg of segments) {
          if (r <= 0) break;
          if (seg.direction === 'desc') {
            for (let cuota = seg.to; cuota >= seg.from; cuota -= 1) {
              if (r <= 0) break;
              const prev = allocatedCentsByCuota.get(cuota) || 0;
              const available = Math.max(0, dailyRateCents - prev);
              const applied = Math.min(r, available);
              allocatedCentsByCuota.set(cuota, prev + applied);
              r -= applied;
            }
          } else {
            for (let cuota = seg.from; cuota <= seg.to; cuota += 1) {
              if (r <= 0) break;
              const prev = allocatedCentsByCuota.get(cuota) || 0;
              const available = Math.max(0, dailyRateCents - prev);
              const applied = Math.min(r, available);
              allocatedCentsByCuota.set(cuota, prev + applied);
              r -= applied;
            }
          }
        }
      }

      const minTarget = Math.max(1, baseNextCuota);
      for (let cuota = planLimit; cuota >= minTarget; cuota -= 1) {
        if (remaining <= 0) break;
        const prev = allocatedCentsByCuota.get(cuota) || 0;
        const available = Math.max(0, dailyRateCents - prev);
        if (available <= 0) continue;

        const applied = Math.min(remaining, available);
        remaining -= applied;

        if (finalesTo === null) finalesTo = cuota;
        finalesFrom = cuota;

        if (applied === available) {
          finalesFull += 1;
          continue;
        }

        finalesPartial = {
          cuota_num: cuota,
          abono: Number((applied / 100).toFixed(2)),
          saldo_restante: Number(((available - applied) / 100).toFixed(2)),
        };
        remaining = 0;
        break;
      }
    }

    return {
      ok: true,
      data: {
        modo: allocationMode,
        cuota_actual: baseNextCuota,
        saldo_inicial: Number((saldoInicialCents / 100).toFixed(2)),
        tarifa_diaria: Number((dailyRateCents / 100).toFixed(2)),
        en_orden: ordenFrom !== null && ordenTo !== null
          ? { from_cuota: ordenFrom, to_cuota: ordenTo, cuotas_pagadas_completas: ordenFull, parcial: ordenPartial }
          : null,
        finales: finalesFrom !== null && finalesTo !== null
          ? { from_cuota: finalesFrom, to_cuota: finalesTo, cuotas_pagadas_completas: finalesFull, parcial: finalesPartial }
          : null,
      },
    };
  }

  let remaining = amountCents;
  let endCuota = 0;
  let fullCuotasPaid = 0;
  let partial = null;

  for (const row of pending) {
    if (remaining <= 0) break;
    const cuota = Number(row.cuota_num);
    if (!Number.isFinite(cuota) || cuota <= 0) continue;

    const saldoCents = toCents(row.saldo);
    if (saldoCents <= 0) continue;

    const applied = Math.min(remaining, saldoCents);
    remaining -= applied;
    endCuota = cuota;

    if (applied === saldoCents) {
      fullCuotasPaid += 1;
      continue;
    }

    partial = {
      cuota_num: cuota,
      abono: Number((applied / 100).toFixed(2)),
      saldo_restante: Number(((saldoCents - applied) / 100).toFixed(2)),
    };
    remaining = 0;
    break;
  }

  if (remaining > 0) {
    const firstFuture = endCuota > 0 ? endCuota + 1 : baseNextCuota;
    let nextCuota = firstFuture;

    const maxAllowed = planLimit > 0 ? planLimit : Number.POSITIVE_INFINITY;

    while (remaining > 0 && nextCuota <= maxAllowed) {
      const applied = Math.min(remaining, dailyRateCents);
      remaining -= applied;
      endCuota = nextCuota;

      if (applied === dailyRateCents) {
        fullCuotasPaid += 1;
        nextCuota += 1;
        continue;
      }

      partial = {
        cuota_num: nextCuota,
        abono: Number((applied / 100).toFixed(2)),
        saldo_restante: Number(((dailyRateCents - applied) / 100).toFixed(2)),
      };
      remaining = 0;
      break;
    }
  }

  if (endCuota <= 0) {
    const cuota = baseNextCuota;
    const applied = Math.min(amountCents, dailyRateCents);
    const saldoRest = Math.max(0, dailyRateCents - applied);
    endCuota = cuota;
    partial = saldoRest > 0
      ? { cuota_num: cuota, abono: Number((applied / 100).toFixed(2)), saldo_restante: Number((saldoRest / 100).toFixed(2)) }
      : null;
    fullCuotasPaid = saldoRest === 0 ? 1 : 0;
  }

  const fromCuota = baseNextCuota;
  const toCuota = endCuota;

  return {
    ok: true,
    data: {
      modo: 'ADELANTAR',
      cuota_actual: baseNextCuota,
      saldo_inicial: Number((saldoInicialCents / 100).toFixed(2)),
      tarifa_diaria: Number((dailyRateCents / 100).toFixed(2)),
      en_orden: { from_cuota: fromCuota, to_cuota: toCuota, cuotas_pagadas_completas: fullCuotasPaid, parcial: partial },
      finales: null,
    },
  };
};

const rebuildCarteraSaldosForMoto = async ({
  request,
  transaction,
  empresaId,
  motorcycleId,
  asociadoId,
}) => {
  const support = await getCarteraSupport(request);
  if (!support.hasCarteraSaldos) return;

  const motoRes = await request
    .input('cartera_empresa_id', sql.UniqueIdentifier, empresaId)
    .input('cartera_motorcycle_id', sql.UniqueIdentifier, motorcycleId)
    .query(`
      SELECT TOP 1 id, asociado_id, daily_rate, created_at
      FROM motos
      WHERE empresa_id = @cartera_empresa_id AND id = @cartera_motorcycle_id
    `);

  const moto = motoRes.recordset?.[0] || null;
  if (!moto) return;

  const dailyRate = Number(moto.daily_rate || 0);
  const dailyRateCents = Math.round(dailyRate * 100);
  if (!Number.isFinite(dailyRateCents) || dailyRateCents <= 0) return;

  const startDateOnly = normalizeDateOnly(moto.created_at);
  const startMs = dateOnlyToUtcMs(startDateOnly);
  if (!Number.isFinite(startMs)) return;

  const paymentsRes = await request.query(`
    SELECT id, amount, payment_date, installment_number, notes, created_at
    FROM pagos
    WHERE empresa_id = @cartera_empresa_id
      AND motorcycle_id = @cartera_motorcycle_id
    ORDER BY CONVERT(date, payment_date) ASC, created_at ASC
  `);

  const allocatedCentsByCuota = new Map();
  let maxAllocatedCuota = 0;

  for (const p of paymentsRes.recordset || []) {
    const installmentEnd = p.installment_number === null || p.installment_number === undefined ? null : Number(p.installment_number);
    const amountCents = Math.round(Number(p.amount || 0) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) continue;

    const notes = typeof p.notes === 'string' ? p.notes : '';
    const segments = parseAllocationSegmentsFromNotes(notes, installmentEnd, amountCents, dailyRateCents);
    if (!segments.length) continue;

    let remaining = amountCents;
    for (const seg of segments) {
      if (remaining <= 0) break;
      if (seg.direction === 'desc') {
        for (let cuota = seg.to; cuota >= seg.from; cuota -= 1) {
          if (remaining <= 0) break;
          const prev = allocatedCentsByCuota.get(cuota) || 0;
          const available = Math.max(0, dailyRateCents - prev);
          const applied = Math.min(remaining, available);
          allocatedCentsByCuota.set(cuota, prev + applied);
          remaining -= applied;
          maxAllocatedCuota = Math.max(maxAllocatedCuota, cuota);
        }
      } else {
        for (let cuota = seg.from; cuota <= seg.to; cuota += 1) {
          if (remaining <= 0) break;
          const prev = allocatedCentsByCuota.get(cuota) || 0;
          const available = Math.max(0, dailyRateCents - prev);
          const applied = Math.min(remaining, available);
          allocatedCentsByCuota.set(cuota, prev + applied);
          remaining -= applied;
          maxAllocatedCuota = Math.max(maxAllocatedCuota, cuota);
        }
      }
    }
  }

  const todayMs = dateOnlyToUtcMs(normalizeDateOnly(new Date().toISOString()));
  const dueDays = Number.isFinite(todayMs) ? Math.floor((todayMs - startMs) / (1000 * 60 * 60 * 24)) + 1 : 0;
  const maxDueCuota = Math.max(0, dueDays);
  const endCuota = Math.max(maxAllocatedCuota, maxDueCuota);
  if (endCuota <= 0) return;

  await request.query(`
    DELETE FROM cartera_saldos
    WHERE empresa_id = @cartera_empresa_id
      AND motorcycle_id = @cartera_motorcycle_id
  `);

  const table = new sql.Table('cartera_saldos');
  table.create = false;
  table.columns.add('id', sql.UniqueIdentifier, { nullable: false });
  table.columns.add('empresa_id', sql.UniqueIdentifier, { nullable: false });
  table.columns.add('motorcycle_id', sql.UniqueIdentifier, { nullable: false });
  table.columns.add('asociado_id', sql.UniqueIdentifier, { nullable: false });
  table.columns.add('cuota_num', sql.Int, { nullable: false });
  table.columns.add('cuota_fecha', sql.Date, { nullable: false });
  table.columns.add('valor_cuota', sql.Decimal(10, 2), { nullable: false });
  table.columns.add('pagado', sql.Decimal(10, 2), { nullable: false });
  table.columns.add('saldo', sql.Decimal(10, 2), { nullable: false });
  table.columns.add('estado', sql.NVarChar(20), { nullable: false });
  table.columns.add('creado_en', sql.DateTimeOffset, { nullable: false });
  table.columns.add('actualizado_en', sql.DateTimeOffset, { nullable: false });

  const now = new Date();
  for (let cuota = 1; cuota <= endCuota; cuota += 1) {
    const paidCents = allocatedCentsByCuota.get(cuota) || 0;
    const saldoCents = Math.max(0, dailyRateCents - paidCents);
    const estado = saldoCents === 0 ? 'PAGADA' : paidCents > 0 ? 'PARCIAL' : 'PENDIENTE';
    const cuotaMs = startMs + (cuota - 1) * (1000 * 60 * 60 * 24);
    const cuotaFecha = new Date(cuotaMs);
    table.rows.add(
      randomUUID(),
      empresaId,
      motorcycleId,
      asociadoId,
      cuota,
      cuotaFecha,
      Number((dailyRateCents / 100).toFixed(2)),
      Number((paidCents / 100).toFixed(2)),
      Number((saldoCents / 100).toFixed(2)),
      estado,
      now,
      now
    );
  }

  const bulkReq = new sql.Request(transaction);
  await bulkReq.bulk(table);
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
  
  const allocationModeRaw = body?.allocation_mode;
  const allocation_mode =
    allocationModeRaw === undefined || allocationModeRaw === null || allocationModeRaw === ''
      ? null
      : String(allocationModeRaw).trim().toUpperCase();

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

  if (allocation_mode !== null) {
    if (!ALLOWED_PAYMENT_ALLOCATION_MODES.has(allocation_mode)) {
      return { ok: false, status: 400, error: 'El modo de aplicación del pago no es válido' };
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
      allocation_mode,
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
      SELECT ${from && to ? '' : 'TOP (@limit)'} p.*, 
             d.id as dist_id, d.associate_amount, d.company_amount, d.created_at as dist_created_at,
             a.nombre as asociado_nombre, a.documento as asociado_documento,
             m.plate as motorcycle_plate,
             ca.erp_enviado as erp_enviado, ca.erp_enviado_en as erp_enviado_en
      FROM pagos p
      LEFT JOIN distribuciones_pagos d ON p.id = d.payment_id AND d.empresa_id = p.empresa_id
      LEFT JOIN asociados a ON p.asociado_id = a.id AND a.empresa_id = p.empresa_id
      LEFT JOIN motos m ON p.motorcycle_id = m.id AND m.empresa_id = p.empresa_id
      LEFT JOIN contable_asientos ca
        ON ca.empresa_id = p.empresa_id AND ca.origen = N'PAGO' AND ca.origen_id = p.id
      WHERE p.empresa_id = @empresa_id
    `;

    if (from && to) {
      request.input('from', sql.NVarChar(10), String(from));
      request.input('to', sql.NVarChar(10), String(to));
      query += ` AND p.payment_date >= CONVERT(date, @from) AND p.payment_date <= CONVERT(date, @to)`;
    } else {
      request.input('limit', sql.Int, 500);
    }

    query += ` ORDER BY p.payment_date DESC`;

    const result = await request.query(query);
    
    // Format result: distribution should be a nested object or separate?
    // Frontend logic:
    // const distByPaymentId = Object.fromEntries(distributionsRes.data.map(d => [d.payment_id, d]));
    // payments.map(p => ({ ...p, distribution: distByPaymentId[p.id] }))
    
    // So if I return payments with nested distribution, I can simplify frontend logic.
    const payments = result.recordset.map(row => {
      const { dist_id, associate_amount, company_amount, dist_created_at, asociado_nombre, asociado_documento, motorcycle_plate, erp_enviado, erp_enviado_en, ...payment } = row;
      return {
        ...payment,
        payment_date: normalizeDateOnly(payment.payment_date),
        erp_enviado: erp_enviado === true || erp_enviado === 1,
        erp_enviado_en: erp_enviado_en ?? null,
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

router.get('/preview-allocation', async (req, res) => {
  try {
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });

    const motorcycleId = typeof req.query?.motorcycle_id === 'string' ? req.query.motorcycle_id : '';
    const amount = Number(req.query?.amount);
    const mode = typeof req.query?.mode === 'string' ? req.query.mode : null;
    if (!motorcycleId) return res.status(400).json({ error: 'motorcycle_id es requerido' });
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'amount debe ser mayor o igual a 0' });

    const pool = await getPool();
    const request = pool.request();

    const allocation = await computeAllocationForMoto({
      request,
      empresaId,
      motorcycleId,
      amount,
      mode,
    });

    if (!allocation.ok) return res.status(allocation.status).json({ error: allocation.error });
    return res.json(allocation.data);
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
    payment_method,
    allocation_mode,
  } = validation.data;
  
  const transaction = new sql.Transaction(await getPool());
  
  try {
    await transaction.begin();
    const request = new sql.Request(transaction);
    request.input('empresa_id', sql.UniqueIdentifier, empresaId);
    
    const paymentId = randomUUID();
    const columnSupport = await getPagosColumnsSupport(request);

    if (!columnSupport.hasInstallmentNumber) {
      await transaction.rollback();
      res.status(500).json({ error: "La base de datos no está actualizada: falta la columna 'installment_number'. Ejecuta la migración 005_add_payment_installment_and_method.sql" });
      return;
    }

    const requiresMethodColumn = payment_method !== null;
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
      SELECT TOP 1 asociado_id, plan_months, daily_rate
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

    const allocation = await computeAllocationForMoto({
      request,
      empresaId,
      motorcycleId: motorcycle_id,
      amount,
      mode: allocation_mode,
    });

    if (!allocation.ok) {
      await transaction.rollback();
      res.status(allocation.status).json({ error: allocation.error });
      return;
    }

    const alloc = allocation.data;
    const maxTo = Math.max(
      Number(alloc?.en_orden?.to_cuota || 0),
      Number(alloc?.finales?.to_cuota || 0),
      Number(alloc?.cuota_actual || 0)
    );
    if (Number(moto.plan_months) > 0 && maxTo > Number(moto.plan_months)) {
      await transaction.rollback();
      res.status(400).json({ error: `El pago cubriría hasta la cuota ${maxTo}, que excede el plan de ${moto.plan_months}` });
      return;
    }

    const installmentForDb = alloc?.modo === 'ADELANTAR'
      ? Number(alloc?.en_orden?.to_cuota || alloc?.cuota_actual || 1)
      : Number(alloc?.en_orden?.to_cuota || alloc?.cuota_actual || 1);
    request.input('installment_number', sql.Int, installmentForDb);

    request.input('id', sql.UniqueIdentifier, paymentId);
    request.input('amount', sql.Decimal(10, 2), amount);
    request.input('payment_date', sql.NVarChar(10), payment_date);

    const notesLines = [];
    if (typeof notes === 'string' && notes.trim().length > 0) notesLines.push(notes.trim());
    if (alloc?.modo) notesLines.push(`Modo ${alloc.modo}`);

    if (alloc?.en_orden?.from_cuota && alloc?.en_orden?.to_cuota) {
      notesLines.push(`Cubre cuotas ${alloc.en_orden.from_cuota}-${alloc.en_orden.to_cuota}`);
      const p = alloc.en_orden.parcial;
      if (p?.cuota_num) {
        notesLines.push(`Abono cuota ${p.cuota_num}: paga ${Number(p.abono).toLocaleString()} y queda saldo ${Number(p.saldo_restante).toLocaleString()}`);
      }
    }

    if (alloc?.finales?.from_cuota && alloc?.finales?.to_cuota) {
      notesLines.push(`Cubre cuotas finales ${alloc.finales.from_cuota}-${alloc.finales.to_cuota}`);
      const p = alloc.finales.parcial;
      if (p?.cuota_num) {
        notesLines.push(`Abono cuota final ${p.cuota_num}: paga ${Number(p.abono).toLocaleString()} y queda saldo ${Number(p.saldo_restante).toLocaleString()}`);
      }
    }

    const computedNotes = notesLines.join('\n');
    request.input('notes', sql.NVarChar, computedNotes);
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
      const descripcion = (() => {
        if (alloc?.en_orden?.from_cuota && alloc?.en_orden?.to_cuota && alloc?.finales?.from_cuota && alloc?.finales?.to_cuota) {
          return `Pago cuotas ${alloc.en_orden.from_cuota}-${alloc.en_orden.to_cuota} y finales ${alloc.finales.from_cuota}-${alloc.finales.to_cuota} (${receipt_number})`;
        }
        if (alloc?.modo === 'ADELANTAR' && alloc?.en_orden?.from_cuota && alloc?.en_orden?.to_cuota) {
          const from = alloc.en_orden.from_cuota;
          const to = alloc.en_orden.to_cuota;
          const p = alloc.en_orden.parcial;
          if (from === to) {
            if (p?.cuota_num && p.saldo_restante > 0) return `Abono cuota ${from} (${receipt_number})`;
            return `Pago cuota ${from} (${receipt_number})`;
          }
          return `Pago cuotas ${from}-${to} (${receipt_number})`;
        }
        if (alloc?.modo === 'REDUCIR_PLAZO' && alloc?.finales?.from_cuota && alloc?.finales?.to_cuota) {
          const from = alloc.finales.from_cuota;
          const to = alloc.finales.to_cuota;
          const p = alloc.finales.parcial;
          if (from === to) {
            if (p?.cuota_num && p.saldo_restante > 0) return `Abono cuota final ${from} (${receipt_number})`;
            return `Pago cuota final ${from} (${receipt_number})`;
          }
          return `Pago cuotas finales ${from}-${to} (${receipt_number})`;
        }
        return `Pago cuota (${receipt_number})`;
      })();
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

    await rebuildCarteraSaldosForMoto({
      request,
      transaction,
      empresaId,
      motorcycleId: motorcycle_id,
      asociadoId: asociado_id,
    });
    
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
