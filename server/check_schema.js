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

async function checkSchema() {
  try {
    await sql.connect(config);
    console.log('Connected to SQL Server');

    // Check tables
    const tables = await sql.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'");
    console.log('Tables:', tables.recordset.map(r => r.TABLE_NAME));

    // Check columns for motorcycles
    const motoCols = await sql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'motorcycles'");
    console.log('Motorcycles columns:', motoCols.recordset.map(r => r.COLUMN_NAME));
    
    // Check columns for asociados (or clients)
    const asocCols = await sql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'asociados'");
    console.log('Asociados columns:', asocCols.recordset.map(r => r.COLUMN_NAME));

    process.exit(0);
  } catch (err) {
    console.error('Check failed:', err);
    process.exit(1);
  }
}

checkSchema();
