import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getPool, sql } from './server/db.js';

const CODIGOS_PATHS = [
  path.resolve(process.cwd(), 'mssql', 'codigos.dev'),
  path.resolve(process.cwd(), '..', 'mssql', 'codigos.dev'),
];

const readCodigos = async () => {
  let lastErr = null;
  for (const p of CODIGOS_PATHS) {
    try {
      const raw = await readFile(p, 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`No se pudo leer codigos.dev: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
};

const flatten = (parsed) => {
  const items = [];
  for (const [departamento, municipios] of Object.entries(parsed || {})) {
    if (!Array.isArray(municipios)) continue;
    for (const m of municipios) {
      const municipio = typeof m?.municipio === 'string' ? m.municipio.trim() : '';
      const codigo = typeof m?.codigo === 'string' ? m.codigo.trim() : '';
      if (!municipio || !codigo) continue;
      items.push({ departamento: String(departamento).trim(), municipio, codigo });
    }
  }
  items.sort((a, b) => {
    const dep = a.departamento.localeCompare(b.departamento, 'es');
    if (dep !== 0) return dep;
    return a.municipio.localeCompare(b.municipio, 'es');
  });
  return items;
};

const main = async () => {
  const pool = await getPool();
  const parsed = await readCodigos();
  const items = flatten(parsed);

  if (!items.length) {
    console.log('No se encontraron municipios para insertar.');
    process.exit(0);
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    await tx.request().query(`DELETE FROM dbo.municipios_dane;`);

    const batchSize = 250;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const req = tx.request();

      const values = batch
        .map((_, idx) => `(@codigo${idx}, @municipio${idx}, @departamento${idx})`)
        .join(', ');

      batch.forEach((m, idx) => {
        req.input(`codigo${idx}`, sql.NVarChar(16), m.codigo);
        req.input(`municipio${idx}`, sql.NVarChar(128), m.municipio);
        req.input(`departamento${idx}`, sql.NVarChar(128), m.departamento);
      });

      await req.query(`
        INSERT INTO dbo.municipios_dane (codigo, municipio, departamento)
        VALUES ${values};
      `);
    }

    await tx.commit();

    const count = await pool.request().query(`SELECT COUNT(1) AS n FROM dbo.municipios_dane;`);
    console.log(`OK. Insertados: ${Number(count.recordset?.[0]?.n || 0)}`);
  } catch (e) {
    try { await tx.rollback(); } catch {}
    throw e;
  }
};

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});