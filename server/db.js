import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true' || false, // Default false, but allow true for Azure
    trustServerCertificate: true
  },
  pool: {
    max: 10,
    min: 0, // Serverless: allow 0 idle connections
    idleTimeoutMillis: 30000
  }
};

let poolPromise;

export async function getPool() {
  if (!poolPromise) {
    console.log('Intentando conectar a SQL Server...', { 
      server: config.server, 
      database: config.database,
      user: config.user ? '***' : 'MISSING',
      encrypt: config.options.encrypt
    });
    
    poolPromise = sql.connect(config)
      .then(pool => {
        console.log('Conexión a SQL Server exitosa');
        return pool;
      })
      .catch(err => {
        console.error('Error fatal conectando a SQL Server:', err);
        poolPromise = null; // Reset promise to allow retry
        throw err;
      });
  }
  return poolPromise;
}

export { sql };
