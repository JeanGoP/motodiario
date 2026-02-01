import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const dir = path.resolve(__dirname, '../mssql/migrations');
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  const pool = await getPool();

  // Create migrations table if not exists
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[_migrations]') AND type in (N'U'))
    BEGIN
      CREATE TABLE [dbo].[_migrations] (
        [id] int IDENTITY(1,1) NOT NULL,
        [name] nvarchar(255) NOT NULL,
        [applied_at] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [PK__migrations] PRIMARY KEY ([id]),
        CONSTRAINT [UQ__migrations_name] UNIQUE ([name])
      );
    END
  `);

  // Check if we are in a legacy state (asociados exists but no migrations recorded)
  const checkAsociados = await pool.request().query(`SELECT OBJECT_ID('dbo.asociados') AS id`);
  const asociadosExists = checkAsociados.recordset[0]?.id !== null;
  
  const checkMigrations = await pool.request().query(`SELECT COUNT(*) as count FROM _migrations`);
  const migrationCount = checkMigrations.recordset[0].count;

  if (asociadosExists && migrationCount === 0) {
    console.log('Detectado estado legado: tabla asociados existe pero no hay historial de migraciones.');
    console.log('Marcando migraciones 001-008 como aplicadas...');
    const legacyMigrations = [
      '001_init.sql',
      '002_renombres.sql',
      '003_usuarios.sql',
      '004_dias_gracia_clientes.sql',
      '005_rutas.sql',
      '006_rutas_codigo.sql',
      '007_drop_rutas.sql',
      '008_renombrar_clientes_a_asociados.sql'
    ];
    
    for (const name of legacyMigrations) {
       await pool.request()
        .input('name', name)
        .query(`INSERT INTO _migrations (name) VALUES (@name)`);
    }
  } else if (migrationCount === 0) {
      // Check for clientes table for older legacy state
      const checkClientes = await pool.request().query(`SELECT OBJECT_ID('dbo.clientes') AS id`);
      const clientesExists = checkClientes.recordset[0]?.id !== null;
      if (clientesExists) {
         // This shouldn't happen based on user context, but good to handle?
         // If clientes exists, maybe 001-007 are applied.
         // But let's assume if asociados doesn't exist, we start from scratch or 001 check handles it.
         // Actually 001 check in original code was: "if centros_costo exists, skip 001".
         // Let's keep it simple: if _migrations is empty, we just run whatever hasn't been "marked".
         // But since we want to skip 001 if tables exist...
         const checkCC = await pool.request().query(`SELECT OBJECT_ID('dbo.centros_costo') AS id`);
         if (checkCC.recordset[0]?.id !== null) {
             // Mark 001 as applied if it's not in DB
             // Actually, better to just let the standard logic flow:
             // Get applied migrations, filter.
         }
      }
  }

  // Get applied migrations
  const appliedResult = await pool.request().query(`SELECT name FROM _migrations`);
  const applied = new Set(appliedResult.recordset.map(r => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    
    // Legacy check for 001 if not in _migrations (double safety)
    if (file === '001_init.sql') {
        const checkCC = await pool.request().query(`SELECT OBJECT_ID('dbo.centros_costo') AS id`);
        if (checkCC.recordset[0]?.id !== null) {
            console.log(`Saltando ${file} (tablas ya existen)`);
            await pool.request().input('name', file).query(`INSERT INTO _migrations (name) VALUES (@name)`);
            continue;
        }
    }

    const script = fs.readFileSync(path.join(dir, file), 'utf-8');
    const batches = script.split(/\r?\nGO\r?\n/i);
    
    console.log(`Aplicando migración: ${file}...`);
    try {
        for (const batch of batches) {
        const trimmed = batch.trim();
        if (!trimmed) continue;
        await pool.request().batch(trimmed);
        }
        await pool.request().input('name', file).query(`INSERT INTO _migrations (name) VALUES (@name)`);
        console.log(`Migración aplicada: ${file}`);
    } catch (err) {
        console.error(`Error aplicando migración ${file}:`, err);
        process.exit(1);
    }
  }
  console.log('Migraciones aplicadas correctamente');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
