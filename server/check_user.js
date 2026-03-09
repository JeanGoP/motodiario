import sql from 'mssql';
import { getPool } from './db.js';

async function checkUser() {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar, 'admin@tpv.com')
      .query('SELECT id, nombre, correo, rol FROM usuarios WHERE correo = @email');
    
    if (result.recordset.length > 0) {
      console.log('Usuario encontrado:', result.recordset[0]);
    } else {
      console.log('Usuario admin@tpv.com NO encontrado.');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkUser();
