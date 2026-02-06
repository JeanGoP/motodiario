import sql from 'mssql';
import { getPool } from './db.js';

async function migrate() {
  console.log('Iniciando migración de recibos de caja...');
  
  try {
    const pool = await getPool();
    
    // Crear tabla recibos_caja
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='recibos_caja' AND xtype='U')
      BEGIN
        CREATE TABLE recibos_caja (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          asociado_id UNIQUEIDENTIFIER NOT NULL,
          monto DECIMAL(10, 2) NOT NULL,
          concepto NVARCHAR(255) NOT NULL,
          fecha DATE NOT NULL,
          observaciones NVARCHAR(MAX),
          created_by NVARCHAR(255),
          created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
          CONSTRAINT FK_recibos_caja_asociados FOREIGN KEY (asociado_id) REFERENCES asociados(id)
        );
        PRINT 'Tabla recibos_caja creada exitosamente.';
      END
      ELSE
      BEGIN
        PRINT 'La tabla recibos_caja ya existe.';
      END
    `);

    console.log('Migración completada exitosamente.');
  } catch (error) {
    console.error('Error durante la migración:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
