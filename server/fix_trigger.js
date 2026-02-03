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

async function fixTrigger() {
  try {
    await sql.connect(config);
    console.log('Connected to SQL Server');

    // 1. Drop existing trigger
    console.log('Dropping old trigger...');
    try {
        await sql.query(`DROP TRIGGER IF EXISTS [dbo].[tr_create_payment_distribution]`);
    } catch (e) {
        console.log('Trigger might not exist or error dropping:', e.message);
    }

    // 2. Create new trigger
    console.log('Creating new trigger...');
    await sql.query(`
      CREATE TRIGGER [dbo].[tr_create_payment_distribution]
      ON [dbo].[pagos]
      AFTER INSERT
      AS
      BEGIN
        SET NOCOUNT ON;
        INSERT INTO [dbo].[distribuciones_pagos] (payment_id, associate_amount, company_amount)
        SELECT i.id, CONVERT(decimal(10,2), i.amount * 0.70), CONVERT(decimal(10,2), i.amount * 0.30)
        FROM inserted i;
      END
    `);

    console.log('Trigger updated successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Fix failed:', err);
    process.exit(1);
  }
}

fixTrigger();
