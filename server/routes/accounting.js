import { Router } from 'express';
import { getPool, sql } from '../db.js';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

const getTokenPayload = (req) => {
  const auth = req.headers.authorization || '';
  const [, token] = auth.split(' ');
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

const getDefaultEmpresaId = async (pool) => {
  const r = await pool.request()
    .input('codigo', sql.NVarChar, 'DEFAULT')
    .query('SELECT TOP 1 id FROM empresas WHERE codigo = @codigo');
  return r.recordset?.[0]?.id ? String(r.recordset[0].id) : null;
};

const isUuid = (value) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(value || '').trim());
const isCuentaCodigo = (value) => /^[0-9]{1,50}$/.test(String(value || '').trim());

const audit = async (pool, { empresaId, userId, accion, recurso, recursoId, payload }) => {
  try {
    await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('usuario_id', sql.UniqueIdentifier, userId)
      .input('accion', sql.NVarChar(32), accion)
      .input('recurso', sql.NVarChar(64), recurso)
      .input('recurso_id', sql.UniqueIdentifier, recursoId)
      .input('payload_json', sql.NVarChar(sql.MAX), payload ? JSON.stringify(payload) : null)
      .query(`
        INSERT INTO audit_logs (empresa_id, usuario_id, accion, recurso, recurso_id, payload_json)
        VALUES (@empresa_id, @usuario_id, @accion, @recurso, @recurso_id, @payload_json)
      `);
  } catch {
    return;
  }
};

const getAuth = async (req, { intent = 'read' } = {}) => {
  const payload = getTokenPayload(req);
  if (!payload?.sub) return { ok: false, status: 401, error: 'No autorizado' };

  const empresaId = req.empresaId ? String(req.empresaId) : '';
  if (!empresaId) return { ok: false, status: 400, error: 'Falta empresa_id' };

  const pool = await getPool();
  const defaultEmpresaId = await getDefaultEmpresaId(pool);
  const userId = String(payload.sub);
  const tokenEmpresaId = payload.empresa_id ? String(payload.empresa_id) : '';

  const superCheck = defaultEmpresaId
    ? await pool.request()
      .input('id', sql.UniqueIdentifier, userId)
      .input('empresa_id', sql.UniqueIdentifier, defaultEmpresaId)
      .query(`SELECT TOP 1 1 AS ok FROM usuarios WHERE id = @id AND empresa_id = @empresa_id AND rol = N'admin' AND activo = 1`)
    : { recordset: [] };
  const isSuperAdmin = !!superCheck.recordset?.length;

  if (!isSuperAdmin && tokenEmpresaId !== empresaId) return { ok: false, status: intent === 'write' ? 400 : 403, error: intent === 'write' ? 'No puedes operar fuera de tu empresa asignada' : 'No autorizado' };

  const u = await pool.request()
    .input('id', sql.UniqueIdentifier, userId)
    .input('empresa_id', sql.UniqueIdentifier, isSuperAdmin ? defaultEmpresaId : empresaId)
    .query(`SELECT TOP 1 id, rol, activo FROM usuarios WHERE id = @id AND empresa_id = @empresa_id`);
  const row = u.recordset?.[0] || null;
  if (!row || !row.activo) return { ok: false, status: 403, error: 'No autorizado' };

  if (intent === 'write' && String(row.rol || '').toLowerCase() !== 'admin') return { ok: false, status: 403, error: 'Forbidden' };

  return { ok: true, pool, empresaId, userId, isSuperAdmin };
};

export function validateReglaLineas(lineas) {
  const rows = Array.isArray(lineas) ? lineas : [];
  if (!rows.length) return { ok: false, status: 400, error: 'La regla debe tener líneas contables' };

  let sumDeb = 0;
  let sumCred = 0;

  for (const [i, l] of rows.entries()) {
    const cuenta_id = typeof l?.cuenta_id === 'string' ? l.cuenta_id : '';
    const movimiento = typeof l?.movimiento === 'string' ? l.movimiento.trim().toUpperCase() : '';
    const porcentaje = Number(l?.porcentaje);
    const descripcion = typeof l?.descripcion === 'string' ? l.descripcion.trim() : '';
    if (!isUuid(cuenta_id)) return { ok: false, status: 400, error: `cuenta_id inválido en línea ${i + 1}` };
    if (movimiento !== 'DEBITO' && movimiento !== 'CREDITO') return { ok: false, status: 400, error: `movimiento inválido en línea ${i + 1}` };
    if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) return { ok: false, status: 400, error: `porcentaje inválido en línea ${i + 1}` };
    if (descripcion && descripcion.length > 255) return { ok: false, status: 400, error: `descripcion muy larga en línea ${i + 1} (máx 255)` };
    if (movimiento === 'DEBITO') sumDeb += porcentaje;
    else sumCred += porcentaje;
  }

  const round = (n) => Math.round(n * 10_000) / 10_000;
  if (round(sumDeb) !== 100) return { ok: false, status: 400, error: 'Los porcentajes de DÉBITO deben sumar 100%' };
  if (round(sumCred) !== 100) return { ok: false, status: 400, error: 'Los porcentajes de CRÉDITO deben sumar 100%' };

  return {
    ok: true,
    data: rows.map((l) => ({
      cuenta_id: String(l.cuenta_id),
      movimiento: String(l.movimiento).trim().toUpperCase(),
      porcentaje: Number(l.porcentaje),
      descripcion: (typeof l?.descripcion === 'string' && l.descripcion.trim()) ? l.descripcion.trim() : null
    }))
  };
}

export function computeAsiento({ monto, lineas }) {
  const amount = Number(monto);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, status: 400, error: 'Monto inválido' };
  const validated = validateReglaLineas(lineas);
  if (!validated.ok) return validated;

  const rawLines = validated.data.map((l) => ({
    ...l,
    valor: Math.round((amount * l.porcentaje)) / 100,
  }));

  const sumDeb = rawLines.filter((l) => l.movimiento === 'DEBITO').reduce((a, b) => a + b.valor, 0);
  const sumCred = rawLines.filter((l) => l.movimiento === 'CREDITO').reduce((a, b) => a + b.valor, 0);

  const round2 = (n) => Math.round(n * 100) / 100;
  const d = round2(sumDeb);
  const c = round2(sumCred);
  if (d !== c) {
    const diff = round2(d - c);
    const targetMovimiento = diff > 0 ? 'CREDITO' : 'DEBITO';
    const targetLine = rawLines.find((l) => l.movimiento === targetMovimiento);
    if (!targetLine) return { ok: false, status: 400, error: 'Partida doble inválida (no se puede ajustar redondeo)' };
    targetLine.valor = round2(targetLine.valor + Math.abs(diff));
  }

  const finalDeb = round2(rawLines.filter((l) => l.movimiento === 'DEBITO').reduce((a, b) => a + b.valor, 0));
  const finalCred = round2(rawLines.filter((l) => l.movimiento === 'CREDITO').reduce((a, b) => a + b.valor, 0));
  if (finalDeb !== finalCred) return { ok: false, status: 400, error: 'Partida doble inválida (débito != crédito)' };

  return { ok: true, data: rawLines.map((l) => ({ ...l, valor: round2(l.valor) })) };
}

router.get('/cuentas', async (req, res) => {
  try {
    const auth = await getAuth(req, { intent: 'read' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { pool, empresaId } = auth;

    const r = await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .query(`
        SELECT id, codigo, nombre, activo, creado_en, actualizado_en
        FROM contable_cuentas
        WHERE empresa_id = @empresa_id
        ORDER BY codigo ASC
      `);
    res.json(r.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cuentas', async (req, res) => {
  try {
    const auth = await getAuth(req, { intent: 'write' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { pool, empresaId, userId } = auth;

    const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo.trim() : '';
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    const activo = req.body?.activo === undefined ? true : Boolean(req.body.activo);
    if (!codigo) return res.status(400).json({ error: 'Falta código de cuenta' });
    if (!isCuentaCodigo(codigo)) return res.status(400).json({ error: 'Código de cuenta inválido (solo dígitos)' });
    if (!nombre) return res.status(400).json({ error: 'Falta nombre de cuenta' });

    const id = randomUUID();
    const request = pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('codigo', sql.NVarChar(50), codigo)
      .input('nombre', sql.NVarChar(255), nombre)
      .input('activo', sql.Bit, !!activo);
    const ins = await request.query(`
      INSERT INTO contable_cuentas (id, empresa_id, codigo, nombre, activo, creado_en, actualizado_en)
      OUTPUT inserted.id, inserted.codigo, inserted.nombre, inserted.activo, inserted.creado_en, inserted.actualizado_en
      VALUES (@id, @empresa_id, @codigo, @nombre, @activo, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET())
    `);
    await audit(pool, { empresaId, userId, accion: 'CREATE', recurso: 'contable_cuentas', recursoId: id, payload: { codigo, nombre, activo } });
    res.status(201).json(ins.recordset[0]);
  } catch (err) {
    if (String(err?.message || '').includes('UQ_contable_cuentas_empresa_codigo')) return res.status(409).json({ error: 'Ya existe una cuenta con ese código' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/cuentas/:id', async (req, res) => {
  try {
    const auth = await getAuth(req, { intent: 'write' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { pool, empresaId, userId } = auth;
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ error: 'id inválido' });

    const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo.trim() : '';
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    const activo = req.body?.activo === undefined ? true : Boolean(req.body.activo);
    if (!codigo) return res.status(400).json({ error: 'Falta código de cuenta' });
    if (!isCuentaCodigo(codigo)) return res.status(400).json({ error: 'Código de cuenta inválido (solo dígitos)' });
    if (!nombre) return res.status(400).json({ error: 'Falta nombre de cuenta' });

    const request = pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('codigo', sql.NVarChar(50), codigo)
      .input('nombre', sql.NVarChar(255), nombre)
      .input('activo', sql.Bit, !!activo);
    const upd = await request.query(`
      UPDATE contable_cuentas
      SET codigo = @codigo, nombre = @nombre, activo = @activo, actualizado_en = SYSDATETIMEOFFSET()
      WHERE id = @id AND empresa_id = @empresa_id;

      SELECT id, codigo, nombre, activo, creado_en, actualizado_en
      FROM contable_cuentas
      WHERE id = @id AND empresa_id = @empresa_id;
    `);
    await audit(pool, { empresaId, userId, accion: 'UPDATE', recurso: 'contable_cuentas', recursoId: id, payload: { codigo, nombre, activo } });
    res.json(upd.recordset[0] || null);
  } catch (err) {
    if (String(err?.message || '').includes('UQ_contable_cuentas_empresa_codigo')) return res.status(409).json({ error: 'Ya existe una cuenta con ese código' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/cuentas/:id', async (req, res) => {
  try {
    const auth = await getAuth(req, { intent: 'write' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { pool, empresaId, userId } = auth;
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ error: 'id inválido' });

    const inUse = await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('cuenta_id', sql.UniqueIdentifier, id)
      .query(`SELECT TOP 1 1 AS ok FROM contable_regla_lineas WHERE empresa_id = @empresa_id AND cuenta_id = @cuenta_id`);
    if (inUse.recordset?.length) return res.status(409).json({ error: 'La cuenta está en uso en una regla contable' });

    await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('id', sql.UniqueIdentifier, id)
      .query(`DELETE FROM contable_cuentas WHERE id = @id AND empresa_id = @empresa_id`);
    await audit(pool, { empresaId, userId, accion: 'DELETE', recurso: 'contable_cuentas', recursoId: id, payload: null });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reglas/activa', async (req, res) => {
  try {
    const auth = await getAuth(req, { intent: 'read' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { pool, empresaId } = auth;
    const tipo = typeof req.query?.tipo_cuota === 'string' ? req.query.tipo_cuota.trim().toUpperCase() : 'CUOTA';
    if (!tipo) return res.status(400).json({ error: 'Falta tipo_cuota' });

    const regla = await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('tipo_cuota', sql.NVarChar(64), tipo)
      .query(`
        SELECT TOP 1 id, tipo_cuota, version, activa, creada_por, creada_en, comentario
        FROM contable_reglas_versiones
        WHERE empresa_id = @empresa_id AND tipo_cuota = @tipo_cuota AND activa = 1
        ORDER BY version DESC
      `);
    const head = regla.recordset?.[0] || null;
    if (!head) return res.json(null);

    const lines = await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('regla_version_id', sql.UniqueIdentifier, head.id)
      .query(`
        SELECT l.id, l.cuenta_id, c.codigo AS cuenta_codigo, c.nombre AS cuenta_nombre, l.movimiento, l.porcentaje, l.descripcion
        FROM contable_regla_lineas l
        INNER JOIN contable_cuentas c ON c.id = l.cuenta_id AND c.empresa_id = l.empresa_id
        WHERE l.empresa_id = @empresa_id AND l.regla_version_id = @regla_version_id
        ORDER BY l.movimiento DESC, c.codigo ASC
      `);

    res.json({ ...head, lineas: lines.recordset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reglas', async (req, res) => {
  try {
    const auth = await getAuth(req, { intent: 'read' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { pool, empresaId } = auth;
    const tipo = typeof req.query?.tipo_cuota === 'string' ? req.query.tipo_cuota.trim().toUpperCase() : 'CUOTA';
    if (!tipo) return res.status(400).json({ error: 'Falta tipo_cuota' });

    const r = await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('tipo_cuota', sql.NVarChar(64), tipo)
      .query(`
        SELECT id, tipo_cuota, version, activa, creada_por, creada_en, comentario
        FROM contable_reglas_versiones
        WHERE empresa_id = @empresa_id AND tipo_cuota = @tipo_cuota
        ORDER BY version DESC
      `);
    res.json(r.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reglas', async (req, res) => {
  try {
    const auth = await getAuth(req, { intent: 'write' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { pool, empresaId, userId } = auth;

    const tipo = typeof req.body?.tipo_cuota === 'string' ? req.body.tipo_cuota.trim().toUpperCase() : 'CUOTA';
    const comentario = typeof req.body?.comentario === 'string' ? req.body.comentario.trim() : null;
    const lineas = req.body?.lineas;
    if (!tipo) return res.status(400).json({ error: 'Falta tipo_cuota' });

    const validated = validateReglaLineas(lineas);
    if (!validated.ok) return res.status(validated.status).json({ error: validated.error });

    const tx = pool.transaction();
    await tx.begin();
    const request = tx.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('tipo_cuota', sql.NVarChar(64), tipo);
    const maxV = await request.query(`
      SELECT ISNULL(MAX(version), 0) AS v
      FROM contable_reglas_versiones
      WHERE empresa_id = @empresa_id AND tipo_cuota = @tipo_cuota
    `);
    const nextV = Number(maxV.recordset?.[0]?.v || 0) + 1;
    const reglaId = randomUUID();

    await tx.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('tipo_cuota', sql.NVarChar(64), tipo)
      .query(`UPDATE contable_reglas_versiones SET activa = 0 WHERE empresa_id = @empresa_id AND tipo_cuota = @tipo_cuota AND activa = 1`);

    await tx.request()
      .input('id', sql.UniqueIdentifier, reglaId)
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('tipo_cuota', sql.NVarChar(64), tipo)
      .input('version', sql.Int, nextV)
      .input('activa', sql.Bit, 1)
      .input('creada_por', sql.UniqueIdentifier, userId)
      .input('comentario', sql.NVarChar(255), comentario)
      .query(`
        INSERT INTO contable_reglas_versiones (id, empresa_id, tipo_cuota, version, activa, creada_por, comentario)
        VALUES (@id, @empresa_id, @tipo_cuota, @version, @activa, @creada_por, @comentario)
      `);

    for (const l of validated.data) {
      await tx.request()
        .input('id', sql.UniqueIdentifier, randomUUID())
        .input('empresa_id', sql.UniqueIdentifier, empresaId)
        .input('regla_version_id', sql.UniqueIdentifier, reglaId)
        .input('cuenta_id', sql.UniqueIdentifier, l.cuenta_id)
        .input('movimiento', sql.NVarChar(7), l.movimiento)
        .input('porcentaje', sql.Decimal(9, 4), l.porcentaje)
        .input('descripcion', sql.NVarChar(255), l.descripcion)
        .query(`
          INSERT INTO contable_regla_lineas (id, empresa_id, regla_version_id, cuenta_id, movimiento, porcentaje, descripcion)
          VALUES (@id, @empresa_id, @regla_version_id, @cuenta_id, @movimiento, @porcentaje, @descripcion)
        `);
    }

    await tx.commit();
    await audit(pool, { empresaId, userId, accion: 'CREATE', recurso: 'contable_reglas_versiones', recursoId: reglaId, payload: { tipo_cuota: tipo, version: nextV, lineas: validated.data } });

    res.status(201).json({ id: reglaId, empresa_id: empresaId, tipo_cuota: tipo, version: nextV, activa: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/preview', async (req, res) => {
  const monto = req.body?.monto;
  const lineas = req.body?.lineas;
  const computed = computeAsiento({ monto, lineas });
  if (!computed.ok) return res.status(computed.status).json({ error: computed.error });
  res.json(computed.data);
});

router.get('/asientos', async (req, res) => {
  try {
    const auth = await getAuth(req, { intent: 'read' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { pool, empresaId } = auth;
    const origen = typeof req.query?.origen === 'string' ? req.query.origen.trim().toUpperCase() : '';
    const origenId = typeof req.query?.origen_id === 'string' ? req.query.origen_id.trim() : '';
    const request = pool.request().input('empresa_id', sql.UniqueIdentifier, empresaId);
    let q = `
      SELECT TOP 200 id, origen, origen_id, regla_version_id, fecha, descripcion, creado_en
      FROM contable_asientos
      WHERE empresa_id = @empresa_id
    `;
    if (origen) {
      request.input('origen', sql.NVarChar(32), origen);
      q += ` AND origen = @origen`;
    }
    if (isUuid(origenId)) {
      request.input('origen_id', sql.UniqueIdentifier, origenId);
      q += ` AND origen_id = @origen_id`;
    }
    q += ` ORDER BY fecha DESC, id DESC`;
    const r = await request.query(q);
    res.json(r.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/asientos/:id/lineas', async (req, res) => {
  try {
    const auth = await getAuth(req, { intent: 'read' });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { pool, empresaId } = auth;
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ error: 'id inválido' });
    const r = await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('asiento_id', sql.UniqueIdentifier, id)
      .query(`
        SELECT l.id, l.cuenta_id, c.codigo AS cuenta_codigo, c.nombre AS cuenta_nombre, l.movimiento, l.porcentaje, l.valor, l.descripcion
        FROM contable_asiento_lineas l
        INNER JOIN contable_cuentas c ON c.id = l.cuenta_id AND c.empresa_id = l.empresa_id
        WHERE l.empresa_id = @empresa_id AND l.asiento_id = @asiento_id
        ORDER BY l.movimiento DESC, c.codigo ASC
      `);
    res.json(r.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
