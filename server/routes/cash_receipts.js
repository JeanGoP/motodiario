import express from 'express';
import sql from 'mssql';
import { randomUUID } from 'crypto';
import { getPool } from '../db.js';
import { computeAsiento } from './accounting.js';

const router = express.Router();

const normalizeTipoMovimiento = (concepto) => {
  const raw = typeof concepto === 'string' ? concepto.trim() : '';
  const upper = raw.toUpperCase();
  if (upper.startsWith('ANTICIPO')) return 'ANTICIPO';
  return 'RECIBO';
};

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

  let transaction;
  try {
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    transaction = new sql.Transaction(await getPool());
    await transaction.begin();
    const request = new sql.Request(transaction);

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
    if (!asociadoCheck.recordset?.length) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Asociado inválido' });
    }

    const result = await request.query(`
      INSERT INTO recibos_caja (empresa_id, asociado_id, monto, concepto, fecha, observaciones, created_by)
      OUTPUT inserted.*
      VALUES (@empresa_id, @asociado_id, @monto, @concepto, @fecha, @observaciones, @created_by)
    `);

    const newReceipt = result.recordset[0];
    const receiptId = newReceipt?.id;

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
      const tipoMovimiento = normalizeTipoMovimiento(concepto);
      request.input('tipo_mov', sql.NVarChar(64), tipoMovimiento);
      const reglaActiva = await request.query(`
        SELECT TOP 1 id, tipo_cuota, version
        FROM contable_reglas_versiones
        WHERE empresa_id = @empresa_id AND tipo_cuota = @tipo_mov AND activa = 1
        ORDER BY version DESC
      `);
      const regla = reglaActiva.recordset?.[0] || null;
      if (!regla) {
        await transaction.rollback();
        return res.status(409).json({ error: `No existe configuración contable activa para ${tipoMovimiento}` });
      }

      request.input('regla_id', sql.UniqueIdentifier, regla.id);
      const reglaLineas = await request.query(`
        SELECT cuenta_id, movimiento, porcentaje, descripcion
        FROM contable_regla_lineas
        WHERE empresa_id = @empresa_id AND regla_version_id = @regla_id
      `);
      const computed = computeAsiento({ monto: Number(monto), lineas: reglaLineas.recordset || [] });
      if (!computed.ok) {
        await transaction.rollback();
        return res.status(computed.status || 400).json({ error: computed.error || 'Configuración contable inválida' });
      }

      const asientoId = randomUUID();
      const descripcion = `Recibo de caja (${String(concepto || '').trim() || tipoMovimiento})`;
      const asientoRequest = new sql.Request(transaction);
      asientoRequest.input('empresa_id', sql.UniqueIdentifier, empresaId);
      asientoRequest.input('asiento_id', sql.UniqueIdentifier, asientoId);
      asientoRequest.input('origen', sql.NVarChar(32), 'RECIBO_CAJA');
      asientoRequest.input('origen_id', sql.UniqueIdentifier, receiptId);
      asientoRequest.input('regla_version_id', sql.UniqueIdentifier, regla.id);
      asientoRequest.input('fecha', sql.Date, fecha);
      asientoRequest.input('descripcion', sql.NVarChar(255), descripcion);
      await asientoRequest.query(`
        INSERT INTO contable_asientos (id, empresa_id, origen, origen_id, regla_version_id, fecha, descripcion, creado_en)
        VALUES (@asiento_id, @empresa_id, @origen, @origen_id, @regla_version_id, @fecha, @descripcion, SYSDATETIMEOFFSET())
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

    // Fetch associate details for the response
    const pool = await getPool();
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
    if (transaction?.active) await transaction.rollback();
    console.error('Error creating cash receipt:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
