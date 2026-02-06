import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '1433'),
  connectionTimeout: 8000, // 8 segundos para fallar antes de que Netlify mate el proceso (10s limit)
  options: {
    // Encriptación activada por defecto (necesaria para Azure/Cloud), desactivar solo si se especifica 'false'
    encrypt: process.env.DB_ENCRYPT !== 'false', 
    trustServerCertificate: true // Confiar en certificados auto-firmados
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise;

export async function getPool() {
  if (!poolPromise) {
    console.log('Intentando conectar a SQL Server...', { 
      server: config.server, 
      port: config.port,
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
        poolPromise = null; // Resetear promesa para reintentar
        throw err;
      });
  }
  return poolPromise;
}

export { sql };
