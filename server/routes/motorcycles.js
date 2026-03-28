import express from 'express';
import sql from 'mssql';
import { getPool } from '../db.js';

const router = express.Router();

export function preferRecurringDiasGracia(recurringDias, monthDias) {
  return Array.isArray(recurringDias) && recurringDias.length > 0 ? recurringDias : (monthDias || []);
}

const parseBogotaDateInput = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map((p) => Number(p));
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d, 5, 0, 0, 0));
  }
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

router.get('/', async (req, res) => {
  try {
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const pool = await getPool();
    const result = await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .query(`
      SELECT m.*, 
             a.nombre as asociado_nombre, a.documento as asociado_documento
      FROM motos m
      LEFT JOIN asociados a ON m.asociado_id = a.id AND a.empresa_id = m.empresa_id
      WHERE m.empresa_id = @empresa_id
      ORDER BY m.created_at DESC
    `);
    
    // Map result to match expected frontend format
    // Although frontend does manual mapping, returning clean data is good.
    // The frontend expects fields like 'brand', 'model', etc. which match DB columns.
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { asociado_id, brand, model, year, plate, daily_rate, status, created_at, plan_months } = req.body;
  try {
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const allowedPlans = new Set([12, 15, 18, 24]);
    const planMonthsValue =
      plan_months === undefined || plan_months === null || plan_months === ''
        ? 12
        : Number(plan_months);
    if (!Number.isFinite(planMonthsValue) || !allowedPlans.has(planMonthsValue)) {
      res.status(400).json({ error: 'plan_months inválido. Valores permitidos: 12, 15, 18, 24' });
      return;
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('empresa_id', sql.UniqueIdentifier, empresaId);
    request.input('asociado_id', sql.UniqueIdentifier, asociado_id);
    request.input('brand', sql.NVarChar, brand);
    request.input('model', sql.NVarChar, model);
    request.input('year', sql.Int, year);
    request.input('plate', sql.NVarChar, plate);
    request.input('daily_rate', sql.Decimal(10, 2), daily_rate);
    request.input('status', sql.NVarChar, status);
    request.input('plan_months', sql.Int, planMonthsValue);
    request.input('dias_gracia', sql.Int, req.body.dias_gracia || 0);
    
    // Use provided created_at or default to current time
    // If created_at is provided, we cast it to DateTimeOffset or let SQL handle the string if valid
    const createdAtValue = parseBogotaDateInput(created_at) || new Date();
    request.input('created_at', sql.DateTimeOffset, createdAtValue);

    const asociadoCheck = await request.query(`
      SELECT TOP 1 1 AS ok
      FROM asociados
      WHERE id = @asociado_id AND empresa_id = @empresa_id
    `);
    if (!asociadoCheck.recordset?.length) {
      res.status(400).json({ error: 'Asociado inválido' });
      return;
    }

    const result = await request.query(`
      INSERT INTO motos (empresa_id, asociado_id, brand, model, year, plate, daily_rate, status, plan_months, dias_gracia, created_at, updated_at)
      OUTPUT inserted.*
      VALUES (@empresa_id, @asociado_id, @brand, @model, @year, @plate, @daily_rate, @status, @plan_months, @dias_gracia, @created_at, SYSDATETIMEOFFSET())
    `);
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { asociado_id, brand, model, year, plate, daily_rate, status, created_at, plan_months } = req.body;
  try {
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const shouldUpdatePlan = !(plan_months === undefined || plan_months === null || plan_months === '');
    const allowedPlans = new Set([12, 15, 18, 24]);
    const planMonthsValue = shouldUpdatePlan ? Number(plan_months) : null;
    if (shouldUpdatePlan && (!Number.isFinite(planMonthsValue) || !allowedPlans.has(planMonthsValue))) {
      res.status(400).json({ error: 'plan_months inválido. Valores permitidos: 12, 15, 18, 24' });
      return;
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('id', sql.UniqueIdentifier, id);
    request.input('empresa_id', sql.UniqueIdentifier, empresaId);
    request.input('asociado_id', sql.UniqueIdentifier, asociado_id);
    request.input('brand', sql.NVarChar, brand);
    request.input('model', sql.NVarChar, model);
    request.input('year', sql.Int, year);
    request.input('plate', sql.NVarChar, plate);
    request.input('daily_rate', sql.Decimal(10, 2), daily_rate);
    request.input('status', sql.NVarChar, status);
    request.input('dias_gracia', sql.Int, req.body.dias_gracia || 0);

    const asociadoCheck = await request.query(`
      SELECT TOP 1 1 AS ok
      FROM asociados
      WHERE id = @asociado_id AND empresa_id = @empresa_id
    `);
    if (!asociadoCheck.recordset?.length) {
      res.status(400).json({ error: 'Asociado inválido' });
      return;
    }
    
    // Handle created_at update if provided
    let query = `
      UPDATE motos
      SET asociado_id = @asociado_id, 
          brand = @brand, 
          model = @model, 
          year = @year, 
          plate = @plate, 
          daily_rate = @daily_rate, 
          status = @status,
          dias_gracia = @dias_gracia,
          updated_at = SYSDATETIMEOFFSET()
    `;

    if (shouldUpdatePlan) {
      request.input('plan_months', sql.Int, planMonthsValue);
      query += `, plan_months = @plan_months`;
    }

    if (created_at) {
      const createdAtValue = parseBogotaDateInput(created_at);
      if (createdAtValue) {
        request.input('created_at', sql.DateTimeOffset, createdAtValue);
        query += `, created_at = @created_at`;
      }
    }

    query += `
      WHERE id = @id AND empresa_id = @empresa_id;
      SELECT * FROM motos WHERE id = @id AND empresa_id = @empresa_id;
    `;

    const result = await request.query(query);
    res.json(result.recordset[0]);
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
    await request.query('DELETE FROM motos WHERE id = @id AND empresa_id = @empresa_id');
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
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const pool = await getPool();
    const motoExists = await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .query(`SELECT TOP 1 1 AS ok FROM motos WHERE id = @id AND empresa_id = @empresa_id`);
    if (!motoExists.recordset?.length) return res.status(404).json({ error: 'Not found' });

    const reqBase = pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('empresa_id', sql.UniqueIdentifier, empresaId);

    const recurring = await reqBase.query(`
      SELECT dia FROM dias_gracia_motos
      WHERE moto_id = @id AND empresa_id = @empresa_id AND anio = 0 AND mes = 0
      ORDER BY dia ASC
    `);

    if (recurring.recordset.length > 0) {
      return res.json(preferRecurringDiasGracia(recurring.recordset.map(d => d.dia), []));
    }

    const r = await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('anio', sql.Int, Number(anio))
      .input('mes', sql.Int, Number(mes))
      .query(`
        SELECT dia FROM dias_gracia_motos
        WHERE moto_id = @id AND empresa_id = @empresa_id AND anio = @anio AND mes = @mes
        ORDER BY dia ASC
      `);
    return res.json(preferRecurringDiasGracia([], r.recordset.map(d => d.dia)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/dias_gracia', async (req, res) => {
  const { id } = req.params;
  const { anio, mes, dias, recurring } = req.body;
  const isRecurring = Boolean(recurring);
  if (!Array.isArray(dias)) return res.status(400).json({ error: 'Datos inválidos' });
  if (!isRecurring && (!anio || !mes)) return res.status(400).json({ error: 'Datos inválidos' });
  try {
    const empresaId = req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'Falta empresa_id' });
    const pool = await getPool();
    const motoExists = await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .query(`SELECT TOP 1 1 AS ok FROM motos WHERE id = @id AND empresa_id = @empresa_id`);
    if (!motoExists.recordset?.length) return res.status(404).json({ error: 'Not found' });

    const tx = new sql.Transaction(await getPool());
    await tx.begin();
    const anioDb = isRecurring ? 0 : Number(anio);
    const mesDb = isRecurring ? 0 : Number(mes);

    const reqDel = new sql.Request(tx);
    reqDel.input('id', sql.UniqueIdentifier, id);
    reqDel.input('empresa_id', sql.UniqueIdentifier, empresaId);

    if (isRecurring) {
      await reqDel.query(`DELETE FROM dias_gracia_motos WHERE moto_id = @id AND empresa_id = @empresa_id`);
    } else {
      reqDel.input('anio', sql.Int, anioDb);
      reqDel.input('mes', sql.Int, mesDb);
      await reqDel.query(`DELETE FROM dias_gracia_motos WHERE moto_id = @id AND empresa_id = @empresa_id AND anio = @anio AND mes = @mes`);
    }

    for (const dia of dias) {
      const reqIns = new sql.Request(tx);
      reqIns.input('id', sql.UniqueIdentifier, id);
      reqIns.input('empresa_id', sql.UniqueIdentifier, empresaId);
      reqIns.input('anio', sql.Int, anioDb);
      reqIns.input('mes', sql.Int, mesDb);
      reqIns.input('dia', sql.Int, Number(dia));
      await reqIns.query(`
          INSERT INTO dias_gracia_motos (empresa_id, moto_id, anio, mes, dia, creado_en)
          VALUES (@empresa_id, @id, @anio, @mes, @dia, SYSDATETIMEOFFSET())
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
