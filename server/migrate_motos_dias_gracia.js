import { getPool } from './db.js';

async function migrate() {
  try {
    const pool = await getPool();
    console.log('Connected to SQL Server');

    // 1. Add dias_gracia to motos table
    const checkResult = await pool.request().query(`
      SELECT 1 
      FROM sys.columns 
      WHERE Name = N'dias_gracia' 
      AND Object_ID = Object_ID(N'motos')
    `);

    if (checkResult.recordset.length === 0) {
      console.log('Adding dias_gracia column to motos table...');
      await pool.request().query(`
        ALTER TABLE motos
        ADD dias_gracia INT DEFAULT 0;
      `);
      console.log('Column dias_gracia added successfully.');
    } else {
      console.log('Column dias_gracia already exists in motos.');
    }

    // 2. Create table dias_gracia_motos
    const checkTable = await pool.request().query(`
      SELECT 1 
      FROM sys.tables 
      WHERE Name = N'dias_gracia_motos'
    `);

    if (checkTable.recordset.length === 0) {
      console.log('Creating table dias_gracia_motos...');
      await pool.request().query(`
        CREATE TABLE dias_gracia_motos (
          id INT IDENTITY(1,1) PRIMARY KEY,
          moto_id UNIQUEIDENTIFIER NOT NULL,
          anio INT NOT NULL,
          mes INT NOT NULL,
          dia INT NOT NULL,
          creado_en DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
          FOREIGN KEY (moto_id) REFERENCES motos(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_dias_gracia_motos_moto_anio_mes ON dias_gracia_motos(moto_id, anio, mes);
      `);
      console.log('Table dias_gracia_motos created successfully.');
    } else {
      console.log('Table dias_gracia_motos already exists.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
