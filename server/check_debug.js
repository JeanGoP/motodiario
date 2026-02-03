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

async function checkTables() {
  try {
    await sql.connect(config);
    console.log('Connected to SQL Server');

    const result = await sql.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
    `);
    
    console.log('Tables:', result.recordset.map(r => r.TABLE_NAME));
    
    // Check if trigger exists and its definition
    const triggerDef = await sql.query(`
      SELECT OBJECT_DEFINITION(OBJECT_ID('tr_create_payment_distribution')) AS definition
    `);
    console.log('Trigger Definition:', triggerDef.recordset[0]?.definition);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkTables();
