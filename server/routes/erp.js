import { Router } from 'express';
import { getPool, sql } from '../db.js';
import jwt from 'jsonwebtoken';

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

const isUuid = (value) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(value || '').trim());

const getDefaultEmpresaId = async (pool) => {
  const r = await pool.request()
    .input('codigo', sql.NVarChar, 'DEFAULT')
    .query('SELECT TOP 1 id FROM empresas WHERE codigo = @codigo');
  return r.recordset?.[0]?.id ? String(r.recordset[0].id) : null;
};

const isSuperAdmin = async (pool, userId, defaultEmpresaId) => {
  if (!userId || !defaultEmpresaId) return false;
  const r = await pool.request()
    .input('id', sql.UniqueIdentifier, userId)
    .input('empresa_id', sql.UniqueIdentifier, defaultEmpresaId)
    .query(`SELECT TOP 1 1 AS ok FROM usuarios WHERE id = @id AND empresa_id = @empresa_id AND rol = N'admin' AND activo = 1`);
  return !!r.recordset?.length;
};

const ensureUserActiveInEmpresa = async (pool, userId, empresaId) => {
  const r = await pool.request()
    .input('id', sql.UniqueIdentifier, userId)
    .input('empresa_id', sql.UniqueIdentifier, empresaId)
    .query(`SELECT TOP 1 1 AS ok FROM usuarios WHERE id = @id AND empresa_id = @empresa_id AND activo = 1`);
  return !!r.recordset?.length;
};

const resolveEmpresaForRequest = async (pool, payload, reqEmpresaId) => {
  const tokenEmpresaId = payload?.empresa_id ? String(payload.empresa_id) : '';
  const defaultEmpresaId = await getDefaultEmpresaId(pool);
  const superOk = await isSuperAdmin(pool, String(payload.sub), defaultEmpresaId);
  if (superOk) return { ok: true, empresaId: reqEmpresaId, isSuperAdmin: true };
  if (tokenEmpresaId && tokenEmpresaId !== reqEmpresaId) {
    return { ok: false, status: 403, error: 'La empresa seleccionada no coincide con la empresa del usuario. Cierra sesión e inicia sesión en la empresa correcta.' };
  }
  return { ok: true, empresaId: reqEmpresaId, isSuperAdmin: false };
};

const buildErpUrl = ({ baseUrl, token, endpoint }) => {
  const trimmed = String(baseUrl || '').trim();
  if (!trimmed) return null;
  const base = trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  let u;
  try {
    u = new URL(String(endpoint || '').trim(), base);
  } catch {
    return null;
  }
  u.searchParams.set('token', String(token || '').trim());
  return u.toString();
};

const parseUpstreamResponse = async (upstream) => {
  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') || '';
  let responseData = text;
  if (contentType.includes('application/json')) {
    try { responseData = JSON.parse(text || 'null'); } catch {}
  }
  const isErpBusinessError = (() => {
    if (!responseData || typeof responseData !== 'object') return false;
    const r = responseData;
    if (typeof r?.Error === 'boolean') return r.Error;
    if (typeof r?.error === 'boolean') return r.error;
    if (typeof r?.Error === 'string') return r.Error.trim().toLowerCase() === 'true';
    if (typeof r?.error === 'string') return r.error.trim().toLowerCase() === 'true';
    return false;
  })();

  const mensaje = (() => {
    if (!responseData || typeof responseData !== 'object') return '';
    const r = responseData;
    if (typeof r?.Mensaje === 'string') return r.Mensaje;
    if (typeof r?.mensaje === 'string') return r.mensaje;
    return '';
  })();

  return { text, contentType, responseData, isErpBusinessError, mensaje };
};

const isTerceroNoExiste = (mensaje) => {
  const m = String(mensaje || '').toLowerCase();
  return m.includes('tercero') && m.includes('no existe');
};

const normalizeErpCode = (value) => String(value ?? '')
  .trim()
  .replace(/\s+/g, '')
  .replace(/[\u200B-\u200D\uFEFF]/g, '');

const escapeXmlAttr = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/'/g, '&apos;');

const formatXmlDate = (v) => {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const validateAsociadoForTerceroERP = (asociado) => {
  const missing = [];
  const s = (v) => String(v ?? '').trim();
  const fechaExp = formatXmlDate(asociado?.fechaexpedicion);
  const fechaNac = formatXmlDate(asociado?.fechanacimiento);
  const docRaw = s(asociado?.documento);
  const digFromDoc = docRaw.includes('-') ? s(docRaw.split('-', 2)[1]) : '';
  const dv = s(asociado?.digverificacion) || digFromDoc;

  if (!s(asociado?.nombre)) missing.push('nombre');
  if (!docRaw) missing.push('documento');
  if (!s(asociado?.telefono)) missing.push('telefono');
  if (!s(asociado?.correo)) missing.push('correo');
  if (!s(asociado?.direccion)) missing.push('direccion');
  if (!s(asociado?.municipio_dane)) missing.push('municipio_dane');
  if (!dv) missing.push('digverificacion');
  if (!fechaExp) missing.push('fechaexpedicion');
  if (!fechaNac) missing.push('fechanacimiento');
  if (!s(asociado?.nombrecontacto)) missing.push('nombrecontacto');
  if (!s(asociado?.telefonocontacto)) missing.push('telefonocontacto');
  if (!s(asociado?.emailcontacto)) missing.push('emailcontacto');

  return { ok: missing.length === 0, missing };
};

const buildTerceroXmlFromAsociado = ({
  nombre,
  documento,
  telefono,
  correo,
  direccion,
  digverificacion: digverificacionFromDb,
  fechaexpedicion,
  fechanacimiento,
  municipio_dane,
  nombrecontacto,
  telefonocontacto,
  emailcontacto
}, overrides = {}) => {
  const fullName = String(nombre || '').trim();
  const parts = fullName ? fullName.split(/\s+/).filter(Boolean) : [];
  const primernombre = parts[0] || 'N/A';
  const segundonombre = parts.length >= 4 ? (parts[1] || '') : (parts.length === 3 ? (parts[1] || '') : '');
  const primerapellido = parts.length >= 2 ? (parts.length >= 4 ? (parts[2] || 'N/A') : (parts[1] || 'N/A')) : 'N/A';
  const segundoapellido = parts.length >= 4 ? (parts.slice(3).join(' ') || '') : (parts.length > 4 ? parts.slice(2).join(' ') : '');

  const docRaw = String(documento || '').trim();
  const [identificacion, digverificacionParsed] = docRaw.includes('-')
    ? docRaw.split('-', 2).map((s) => String(s || '').trim())
    : [docRaw, ''];
  const digverificacion = String(digverificacionFromDb || '').trim() || digverificacionParsed;
  const fechaexpedicionXml = formatXmlDate(fechaexpedicion);
  const fechanacimientoXml = formatXmlDate(fechanacimiento);

  const overridesObj = (overrides && typeof overrides === 'object') ? { ...overrides } : {};
  delete overridesObj.tipocliente;
  delete overridesObj.tipopersoneria;
  delete overridesObj.categoriafiscal;
  delete overridesObj.esReponsableiva;
  delete overridesObj.tipoidentificacion;

  const merged = {
    tipocliente: '45',
    tipopersoneria: '33',
    categoriafiscal: '1',
    esReponsableiva: '7',
    tipoidentificacion: '9',
    identificacion,
    digverificacion,
    fechaexpedicion: fechaexpedicionXml,
    primernombre,
    segundonombre,
    primerapellido,
    segundoapellido,
    municipio_dane: String(municipio_dane || '').trim() || '05002',
    telefono: String(telefono || '').trim(),
    celular: String(telefono || '').trim(),
    fechanacimiento: fechanacimientoXml,
    direccion: String(direccion || '').trim(),
    email: String(correo || '').trim(),
    nombrecontacto: String(nombrecontacto || '').trim(),
    telefonocontacto: String(telefonocontacto || '').trim(),
    emailcontacto: String(emailcontacto || '').trim(),
    id_user: '1',
    ...overridesObj,
    tipocliente: '45',
    tipopersoneria: '33',
    categoriafiscal: '1',
    esReponsableiva: '7',
    tipoidentificacion: '9',
  };

  const orderedKeys = [
    'tipocliente',
    'tipopersoneria',
    'categoriafiscal',
    'esReponsableiva',
    'tipoidentificacion',
    'identificacion',
    'digverificacion',
    'fechaexpedicion',
    'primernombre',
    'segundonombre',
    'primerapellido',
    'segundoapellido',
    'municipio_dane',
    'telefono',
    'celular',
    'fechanacimiento',
    'direccion',
    'email',
    'nombrecontacto',
    'telefonocontacto',
    'emailcontacto',
    'id_user',
  ];

  const requiredPresenceKeys = new Set([
    'tipocliente',
    'tipopersoneria',
    'categoriafiscal',
    'esReponsableiva',
    'tipoidentificacion',
    'identificacion',
    'digverificacion',
    'fechaexpedicion',
    'primernombre',
    'segundonombre',
    'primerapellido',
    'segundoapellido',
    'municipio_dane',
    'telefono',
    'celular',
    'fechanacimiento',
    'direccion',
    'email',
    'nombrecontacto',
    'telefonocontacto',
    'emailcontacto',
    'id_user',
  ]);

  const xmlEntries = [];
  for (const k of orderedKeys) {
    const v = merged[k];
    if (String(v ?? '').trim() !== '' || requiredPresenceKeys.has(k)) {
      xmlEntries.push([k, v ?? '']);
    }
  }
  for (const [k, v] of Object.entries(merged)) {
    if (requiredPresenceKeys.has(k)) continue;
    if (String(v ?? '').trim() === '') continue;
    xmlEntries.push([k, v]);
  }

  const xmlAttrs = xmlEntries
    .map(([k, v]) => `${k}="${escapeXmlAttr(String(v))}"`)
    .join(' ');

  return `<SintesisCloud>\n<Tercero ${xmlAttrs}>\n</Tercero>\n</SintesisCloud>`;
};

router.post('/crear-comprobante', async (req, res) => {
  const payload = getTokenPayload(req);
  if (!payload?.sub) return res.status(401).json({ error: 'No autorizado' });

  const empresaId = req.empresaId ? String(req.empresaId) : '';
  if (!isUuid(empresaId)) return res.status(400).json({ error: 'Falta empresa_id' });

  try {
    const pool = await getPool();
    const scope = await resolveEmpresaForRequest(pool, payload, empresaId);
    if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

    if (!scope.isSuperAdmin) {
      const userOk = await ensureUserActiveInEmpresa(pool, String(payload.sub), empresaId);
      if (!userOk) return res.status(403).json({ error: 'Usuario no pertenece a la empresa seleccionada o está inactivo' });
    }

    const cfg = await pool.request()
      .input('id', sql.UniqueIdentifier, empresaId)
      .query(`
        SELECT TOP 1 erp_sync, erp_api_url, erp_api_token
        FROM empresas
        WHERE id = @id
      `);
    const row = cfg.recordset?.[0] || null;
    if (!row) return res.status(404).json({ error: 'Empresa no existe' });
    if (!row.erp_sync) return res.status(400).json({ error: 'ERP no está habilitado para esta empresa' });
    if (!row.erp_api_url || !row.erp_api_token) return res.status(400).json({ error: 'Configuración ERP incompleta (URL/Token)' });

    const url = buildErpUrl({ baseUrl: row.erp_api_url, token: row.erp_api_token, endpoint: 'CrearComprobante' });
    if (!url) return res.status(400).json({ error: 'URL ERP inválida' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let upstream;
    try {
      upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body ?? {}),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const parsed = await parseUpstreamResponse(upstream);
    if (parsed.contentType.includes('application/json')) {
      if (!upstream.ok) return res.status(upstream.status).json({ error: 'Error del ERP', payload: req.body ?? {}, details: parsed.responseData });
      if (parsed.isErpBusinessError) return res.status(502).json({ error: 'Error del ERP', payload: req.body ?? {}, details: parsed.responseData });
      return res.status(upstream.status).json(parsed.responseData);
    }
    return res.status(upstream.status).send(parsed.text);
  } catch (err) {
    if (String(err?.name) === 'AbortError') return res.status(504).json({ error: 'Tiempo de espera agotado al contactar ERP' });
    res.status(500).json({ error: err.message });
  }
});

router.post('/crear-tercero/:asociadoId', async (req, res) => {
  const { asociadoId } = req.params;
  const payload = getTokenPayload(req);
  if (!payload?.sub) return res.status(401).json({ error: 'No autorizado' });

  const empresaId = req.empresaId ? String(req.empresaId) : '';
  if (!isUuid(empresaId)) return res.status(400).json({ error: 'Falta empresa_id' });
  if (!isUuid(asociadoId)) return res.status(400).json({ error: 'ID de asociado inválido' });

  try {
    const pool = await getPool();
    const scope = await resolveEmpresaForRequest(pool, payload, empresaId);
    if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

    if (!scope.isSuperAdmin) {
      const userOk = await ensureUserActiveInEmpresa(pool, String(payload.sub), empresaId);
      if (!userOk) return res.status(403).json({ error: 'Usuario no pertenece a la empresa seleccionada o está inactivo' });
    }

    const cfg = await pool.request()
      .input('id', sql.UniqueIdentifier, empresaId)
      .query(`
        SELECT TOP 1 erp_sync, erp_api_url, erp_api_token
        FROM empresas
        WHERE id = @id
      `);
    const row = cfg.recordset?.[0] || null;
    if (!row) return res.status(404).json({ error: 'Empresa no existe' });
    if (!row.erp_sync) return res.status(400).json({ error: 'ERP no está habilitado para esta empresa' });
    if (!row.erp_api_url || !row.erp_api_token) return res.status(400).json({ error: 'Configuración ERP incompleta (URL/Token)' });

    const asociadoResult = await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('id', sql.UniqueIdentifier, asociadoId)
      .query(`
        SELECT TOP 1 nombre, documento, telefono, correo, direccion,
               digverificacion, fechaexpedicion, fechanacimiento, municipio_dane,
               nombrecontacto, telefonocontacto, emailcontacto
        FROM asociados
        WHERE empresa_id = @empresa_id AND id = @id
      `);
    const asociado = asociadoResult.recordset?.[0] || null;
    if (!asociado) return res.status(404).json({ error: 'Asociado no encontrado' });

    const check = validateAsociadoForTerceroERP(asociado);
    if (!check.ok) {
      return res.status(400).json({
        error: `Faltan datos del asociado para crear el tercero en el ERP: ${check.missing.join(', ')}`,
        missing: check.missing
      });
    }

    const xml = buildTerceroXmlFromAsociado(asociado, req.body && typeof req.body === 'object' ? req.body : {});
    const preview = String(req.query?.preview || '').trim().toLowerCase();
    if (preview === '1' || preview === 'true') {
      return res.status(200).json({ success: true, preview: true, payload: xml });
    }

    const url = buildErpUrl({ baseUrl: row.erp_api_url, token: row.erp_api_token, endpoint: 'AsignarTerceros' });
    if (!url) return res.status(400).json({ error: 'URL ERP inválida' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let upstream;
    try {
      upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: xml,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const parsed = await parseUpstreamResponse(upstream);
    if (!upstream.ok || parsed.isErpBusinessError) {
      return res.status(!upstream.ok ? upstream.status : 502).json({ error: 'Error del ERP', payload: xml, details: parsed.responseData });
    }

    return res.status(200).json({ success: true, payload: xml, erpResponse: parsed.responseData });
  } catch (err) {
    if (String(err?.name) === 'AbortError') return res.status(504).json({ error: 'Tiempo de espera agotado al contactar ERP' });
    res.status(500).json({ error: err.message });
  }
});

router.post('/contabilizar-recibo/:id', async (req, res) => {
  const { id } = req.params;
  const payload = getTokenPayload(req);
  if (!payload?.sub) return res.status(401).json({ error: 'No autorizado' });

  const empresaId = req.empresaId ? String(req.empresaId) : '';
  if (!isUuid(empresaId)) return res.status(400).json({ error: 'Falta empresa_id' });
  if (!isUuid(id)) return res.status(400).json({ error: 'ID de recibo inválido' });

  try {
    const pool = await getPool();
    const scope = await resolveEmpresaForRequest(pool, payload, empresaId);
    if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

    if (!scope.isSuperAdmin) {
      const userOk = await ensureUserActiveInEmpresa(pool, String(payload.sub), empresaId);
      if (!userOk) return res.status(403).json({ error: 'Usuario no pertenece a la empresa seleccionada o está inactivo' });
    }

    const terceroOverride = String(req.query?.tercero || '').trim();

    const cfg = await pool.request()
      .input('id', sql.UniqueIdentifier, empresaId)
      .query(`
        SELECT TOP 1 erp_sync, erp_api_url, erp_api_token
        FROM empresas
        WHERE id = @id
      `);
    const row = cfg.recordset?.[0] || null;
    if (!row) return res.status(404).json({ error: 'Empresa no existe' });
    if (!row.erp_sync) return res.status(400).json({ error: 'ERP no está habilitado para esta empresa' });
    if (!row.erp_api_url || !row.erp_api_token) return res.status(400).json({ error: 'Configuración ERP incompleta (URL/Token)' });

    const url = buildErpUrl({ baseUrl: row.erp_api_url, token: row.erp_api_token, endpoint: 'CrearComprobante' });
    if (!url) return res.status(400).json({ error: 'URL ERP inválida' });

    // 1. Obtener asiento del recibo
    const asientoResult = await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('origen_id', sql.UniqueIdentifier, id)
      .query(`
        SELECT TOP 1 id, fecha, descripcion
        FROM contable_asientos
        WHERE empresa_id = @empresa_id AND origen_id = @origen_id AND origen = 'RECIBO_CAJA'
        ORDER BY creado_en DESC
      `);
    const asiento = asientoResult.recordset?.[0];
    if (!asiento) return res.status(404).json({ error: 'No se encontró el asiento contable para este recibo' });

    // 2. Obtener lineas del asiento
    const lineasResult = await pool.request()
      .input('empresa_id', sql.UniqueIdentifier, empresaId)
      .input('asiento_id', sql.UniqueIdentifier, asiento.id)
      .query(`
        SELECT
          l.id as linea_id,
          l.asociado_id,
          l.cuenta_id,
          l.movimiento,
          l.valor,
          l.descripcion,
          c.codigo as cuenta_codigo,
          asoc.documento as tercero_documento,
          cc.codigo as centro_costo_codigo
        FROM contable_asiento_lineas l
        JOIN contable_cuentas c ON l.cuenta_id = c.id AND c.empresa_id = l.empresa_id
        LEFT JOIN asociados asoc ON l.asociado_id = asoc.id AND asoc.empresa_id = l.empresa_id
        LEFT JOIN centros_costo cc ON asoc.centro_costo_id = cc.id AND cc.empresa_id = l.empresa_id
        WHERE l.empresa_id = @empresa_id AND l.asiento_id = @asiento_id
        ORDER BY CASE WHEN l.movimiento = 'DEBITO' THEN 0 ELSE 1 END, l.creado_en ASC
      `);
    const lineas = lineasResult.recordset || [];
    if (!lineas.length) return res.status(400).json({ error: 'El asiento no tiene líneas configuradas' });
    const missingCuenta = lineas.find((l) => !String(l.cuenta_codigo || '').trim());
    if (missingCuenta) {
      return res.status(409).json({
        error: 'Falta el código contable de una cuenta usada en el asiento',
        details: { cuenta_id: String(missingCuenta.cuenta_id || '') }
      });
    }

    if (!terceroOverride) {
      const missingTercero = lineas.find((l) => !String(l.tercero_documento || '').trim());
      if (missingTercero) {
        return res.status(409).json({
          error: 'Falta el tercero (documento) en una línea del asiento',
          details: {
            linea_id: String(missingTercero.linea_id || ''),
            asociado_id: missingTercero.asociado_id ? String(missingTercero.asociado_id) : null
          }
        });
      }
    }

    // 3. Formar JSON ERP
    const centroCostoDocumento = "01";
    const payloadERP = {
      TipoDocumento: "NOTA CONTABLE",
      CentroCosto: centroCostoDocumento,
      FechaDoc: new Date(asiento.fecha).toISOString().split('T')[0],
      Descripcion: asiento.descripcion || "Contabilización de recibo",
      Detalle: lineas.map(l => ({
        CentroCosto: normalizeErpCode(l.centro_costo_codigo || centroCostoDocumento || ''),
        Concepto: "",
        Cuenta: normalizeErpCode(l.cuenta_codigo || ""),
        Tercero: normalizeErpCode(terceroOverride || String(l.tercero_documento || "")),
        Factura: "",
        Vencimiento: "",
        Valor: (String(l.movimiento || '').toUpperCase() === 'DEBITO'
          ? 1
          : -1) * Math.abs(Number.isFinite(Number(l.valor)) ? Number(l.valor) : 0),
        Detalle: String(l.descripcion || '').trim() || (l.movimiento === 'DEBITO' ? 'Pago capital' : 'Salida banco')
      }))
    };

    const preview = String(req.query?.preview || '').trim().toLowerCase();
    if (preview === '1' || preview === 'true') {
      return res.status(200).json({ success: true, preview: true, payload: payloadERP });
    }

    // 4. Enviar a ERP
    const sendComprobante = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      let upstream;
      try {
        upstream = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadERP),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      const parsed = await parseUpstreamResponse(upstream);
      return { upstream, parsed };
    };

    const firstAttempt = await sendComprobante();
    const firstFailed = !firstAttempt.upstream.ok || firstAttempt.parsed.isErpBusinessError;
    if (firstFailed && isTerceroNoExiste(firstAttempt.parsed.mensaje)) {
      const asociadoIdToCreate = lineas.find((l) => l.asociado_id)?.asociado_id ? String(lineas.find((l) => l.asociado_id).asociado_id) : '';
      if (asociadoIdToCreate && isUuid(asociadoIdToCreate)) {
        const asociadoResult = await pool.request()
          .input('empresa_id', sql.UniqueIdentifier, empresaId)
          .input('id', sql.UniqueIdentifier, asociadoIdToCreate)
          .query(`
            SELECT TOP 1 nombre, documento, telefono, correo, direccion,
                   digverificacion, fechaexpedicion, fechanacimiento, municipio_dane,
                   nombrecontacto, telefonocontacto, emailcontacto
            FROM asociados
            WHERE empresa_id = @empresa_id AND id = @id
          `);
        const asociado = asociadoResult.recordset?.[0] || null;
        if (asociado) {
          const xml = buildTerceroXmlFromAsociado(asociado);
          const urlTercero = buildErpUrl({ baseUrl: row.erp_api_url, token: row.erp_api_token, endpoint: 'AsignarTerceros' });
          if (urlTercero) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20_000);
            let upstreamTercero;
            try {
              upstreamTercero = await fetch(urlTercero, {
                method: 'POST',
                headers: { 'Content-Type': 'application/xml' },
                body: xml,
                signal: controller.signal,
              });
            } finally {
              clearTimeout(timeout);
            }
            const parsedTercero = await parseUpstreamResponse(upstreamTercero);
            const terceroFailed = !upstreamTercero.ok || parsedTercero.isErpBusinessError;
            if (!terceroFailed) {
              const secondAttempt = await sendComprobante();
              const secondFailed = !secondAttempt.upstream.ok || secondAttempt.parsed.isErpBusinessError;
              if (secondFailed) {
                return res.status(!secondAttempt.upstream.ok ? secondAttempt.upstream.status : 502).json({
                  error: 'Error del ERP',
                  payload: payloadERP,
                  details: secondAttempt.parsed.responseData,
                  terceroCreado: { payload: xml, erpResponse: parsedTercero.responseData }
                });
              }
              return res.status(200).json({
                success: true,
                payload: payloadERP,
                erpResponse: secondAttempt.parsed.responseData,
                terceroCreado: { payload: xml, erpResponse: parsedTercero.responseData }
              });
            }
            return res.status(!upstreamTercero.ok ? upstreamTercero.status : 502).json({
              error: 'Error del ERP',
              payload: payloadERP,
              details: firstAttempt.parsed.responseData,
              terceroCreado: { error: 'Error del ERP', payload: xml, details: parsedTercero.responseData }
            });
          }
        }
      }
    }

    if (!firstAttempt.upstream.ok) {
      return res.status(firstAttempt.upstream.status).json({
        error: 'Error del ERP',
        payload: payloadERP,
        details: firstAttempt.parsed.responseData,
        cuentasEnviadas: Array.from(new Set((payloadERP.Detalle || []).map((d) => String(d?.Cuenta || '').trim()).filter(Boolean)))
      });
    }

    if (firstAttempt.parsed.isErpBusinessError) {
      return res.status(502).json({
        error: 'Error del ERP',
        payload: payloadERP,
        details: firstAttempt.parsed.responseData,
        cuentasEnviadas: Array.from(new Set((payloadERP.Detalle || []).map((d) => String(d?.Cuenta || '').trim()).filter(Boolean)))
      });
    }

    return res.status(200).json({ success: true, payload: payloadERP, erpResponse: firstAttempt.parsed.responseData });

  } catch (err) {
    if (String(err?.name) === 'AbortError') return res.status(504).json({ error: 'Tiempo de espera agotado al contactar ERP' });
    res.status(500).json({ error: err.message });
  }
});

export default router;
