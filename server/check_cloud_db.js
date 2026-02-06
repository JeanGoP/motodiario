import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

console.log('--- Iniciando Prueba de Conexión a Base de Datos Nube ---');
console.log('Leyendo credenciales del archivo .env...');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: true, // Forzamos encriptación como lo haría Azure
    trustServerCertificate: true
  }
};

console.log(`Servidor: ${config.server}`);
console.log(`Base de Datos: ${config.database}`);
console.log(`Usuario: ${config.user ? 'Configurado' : 'Faltante'}`);
console.log(`Puerto: ${config.port}`);

async function testConnection() {
  try {
    console.log('Conectando...');
    await sql.connect(config);
    console.log('¡ÉXITO! Conexión establecida correctamente.');
    
    const result = await sql.query`SELECT @@VERSION as version`;
    console.log('Versión del servidor:', result.recordset[0].version);
    
    await sql.close();
  } catch (err) {
    console.error('¡FALLÓ LA CONEXIÓN!');
    console.error('Mensaje de error:', err.message);
    if (err.code === 'ELOGIN') {
      console.error('Posible causa: Usuario o contraseña incorrectos.');
    } else if (err.code === 'ESOCKET') {
      console.error('Posible causa: Servidor no encontrado o puerto bloqueado (Firewall).');
    }
  }
}

testConnection();
