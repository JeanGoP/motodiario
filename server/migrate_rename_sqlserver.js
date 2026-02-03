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

async function runMigration() {
  try {
    console.log('Connecting to SQL Server...');
    await sql.connect(config);
    console.log('Connected.');

    // 1. Rename columns in 'motos'
    const checkMotoCol = await sql.query("SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'motos' AND COLUMN_NAME = 'client_id'");
    if (checkMotoCol.recordset.length > 0) {
      console.log("Renaming 'motos.client_id' to 'asociado_id'...");
      await sql.query("EXEC sp_rename 'motos.client_id', 'asociado_id', 'COLUMN'");
    } else {
      console.log("'motos.client_id' not found (maybe already renamed)");
    }

    // 2. Rename columns in 'pagos'
    const checkPayCol = await sql.query("SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'pagos' AND COLUMN_NAME = 'client_id'");
    if (checkPayCol.recordset.length > 0) {
        console.log("Renaming 'pagos.client_id' to 'asociado_id'...");
        await sql.query("EXEC sp_rename 'pagos.client_id', 'asociado_id', 'COLUMN'");
    } else {
      console.log("'pagos.client_id' not found (maybe already renamed)");
    }
    
    // 3. Rename columns in 'desactivaciones'
    const checkDeactCol = await sql.query("SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'desactivaciones' AND COLUMN_NAME = 'client_id'");
    if (checkDeactCol.recordset.length > 0) {
        console.log("Renaming 'desactivaciones.client_id' to 'asociado_id'...");
        await sql.query("EXEC sp_rename 'desactivaciones.client_id', 'asociado_id', 'COLUMN'");
    }

    // 4. Rename columns in 'notificaciones'
    const checkNotifCol = await sql.query("SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'notificaciones' AND COLUMN_NAME = 'client_id'");
    if (checkNotifCol.recordset.length > 0) {
        console.log("Renaming 'notificaciones.client_id' to 'asociado_id'...");
        await sql.query("EXEC sp_rename 'notificaciones.client_id', 'asociado_id', 'COLUMN'");
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
