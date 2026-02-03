import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function checkColumns() {
  try {
    await sql.connect(config);
    
    // Check columns for distribuciones_pagos
    const distCols = await sql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'distribuciones_pagos'");
    console.log('Distribuciones columns:', distCols.recordset.map(r => r.COLUMN_NAME));

    // Check triggers on PAGOS
    const triggers = await sql.query(`
      SELECT name, object_id, parent_id 
      FROM sys.triggers 
      WHERE parent_id = OBJECT_ID('pagos')
    `);
    console.log('Triggers on pagos:', triggers.recordset);

    process.exit(0);
  } catch (err) {
    console.error('Check failed:', err);
    process.exit(1);
  }
}

checkColumns();
