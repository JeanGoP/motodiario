import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import costCentersRouter from './routes/cost_centers.js';
import associatesRouter from './routes/associates.js';
import motorcyclesRouter from './routes/motorcycles.js';
import paymentsRouter from './routes/payments.js';
import cashReceiptsRouter from './routes/cash_receipts.js';
import notificationsRouter from './routes/notifications.js';
import deactivationsRouter from './routes/deactivations.js';
import authRouter from './routes/auth.js';
import { getPool } from './db.js';

const app = express();

const allowedOriginsEnv = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
const defaultOrigins = [
  'http://localhost:5173', 
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://motodiario.netlify.app'
];
const allowedOrigins = new Set([...allowedOriginsEnv, ...defaultOrigins]);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origen (como curl o apps móviles)
    if (!origin) return callback(null, true);
    
    // Permitir orígenes listados explícitamente
    if (allowedOrigins.has(origin) || allowedOriginsEnv.includes('*')) return callback(null, true);
    
    // Permitir deploy previews de Netlify (*.netlify.app)
    if (origin.endsWith('.netlify.app')) return callback(null, true);

    console.log(`CORS bloqueado para origen: ${origin}`);
    callback(new Error(`Not allowed by CORS (Origin: ${origin})`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-empresa-id'],
  optionsSuccessStatus: 204
}));
app.options('*', cors());
app.use(express.json());

// Log de depuración para ver qué ruta llega realmente a Netlify
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.path} (Original: ${req.originalUrl})`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Crear un Router para todas las rutas de la API
const apiRouter = express.Router();

let defaultEmpresaCache = { id: null, checkedAt: 0 };

const isUuid = (value) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(value || '').trim());

const getDefaultEmpresaId = async () => {
  const envEmpresaId = (process.env.DEFAULT_EMPRESA_ID || '').trim();
  if (isUuid(envEmpresaId)) return envEmpresaId;

  const now = Date.now();
  if (defaultEmpresaCache.id && now - defaultEmpresaCache.checkedAt < 60_000) return defaultEmpresaCache.id;

  try {
    const pool = await getPool();
    const exists = await pool.request().query(`SELECT OBJECT_ID('dbo.empresas') AS id`);
    if (!exists.recordset?.[0]?.id) return null;
    const r = await pool.request().query(`SELECT TOP 1 id FROM empresas ORDER BY creado_en ASC`);
    const id = r.recordset?.[0]?.id ? String(r.recordset[0].id) : null;
    defaultEmpresaCache = { id, checkedAt: now };
    return id;
  } catch {
    return null;
  }
};

apiRouter.use(async (req, res, next) => {
  const headerEmpresaId = req.get('x-empresa-id');
  const queryEmpresaId = req.query?.empresa_id;
  const candidate = isUuid(headerEmpresaId) ? String(headerEmpresaId).trim() : (isUuid(queryEmpresaId) ? String(queryEmpresaId).trim() : null);
  const resolved = candidate || (await getDefaultEmpresaId());
  req.empresaId = resolved;
  next();
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/centros_costo', costCentersRouter);
apiRouter.use('/asociados', associatesRouter);
apiRouter.use('/motorcycles', motorcyclesRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/recibos_caja', cashReceiptsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/deactivations', deactivationsRouter);

// Montar el router en /api (para desarrollo local)
app.use('/api', apiRouter);

// Montar el router en la raíz (para Netlify Functions donde el prefijo /api puede ser eliminado)
app.use('/', apiRouter);

// Ruta de diagnóstico pública para probar la BD sin autenticación
apiRouter.get('/test-db', async (req, res) => {
  try {
    const { getPool } = await import('./db.js');
    const pool = await getPool();
    const result = await pool.request().query('SELECT 1 as n');
    res.json({ 
      status: 'Conexión Exitosa', 
      server_time_utc: new Date().toISOString(),
      server_time_bogota: new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace(' ', 'T'),
      test_query: result.recordset[0] 
    });
  } catch (err) {
    res.status(500).json({ 
      error: 'Error de Conexión a BD', 
      details: err.message,
      env_check: {
        has_user: !!process.env.DB_USER,
        has_pass: !!process.env.DB_PASS,
        has_host: !!process.env.DB_HOST,
        has_db: !!process.env.DB_NAME
      }
    });
  }
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

export default app;
