import app from './app.js';
import { getPool } from './db.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, async () => {
  console.log(`MotoDiario API escuchando en http://localhost:${PORT}`);
  try {
    await getPool();
    console.log('Conexión exitosa a SQL Server');
  } catch (err) {
    console.error('Error conectando a SQL Server:', err.message);
  }
});
