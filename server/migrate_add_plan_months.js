import { getPool } from './db.js';

async function migrate() {
  try {
    const pool = await getPool();
    console.log('Connected to SQL Server');

    // Check if column exists
    const checkResult = await pool.request().query(`
      SELECT 1 
      FROM sys.columns 
      WHERE Name = N'plan_months' 
      AND Object_ID = Object_ID(N'motos')
    `);

    if (checkResult.recordset.length === 0) {
      console.log('Adding plan_months column to motos table...');
      await pool.request().query(`
        ALTER TABLE motos
        ADD plan_months INT DEFAULT 0;
      `);
      console.log('Column plan_months added successfully.');
    } else {
      console.log('Column plan_months already exists.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();