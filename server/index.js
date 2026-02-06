import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import { getPool } from './db.js';

import costCentersRouter from './routes/cost_centers.js';
import associatesRouter from './routes/associates.js';
import motorcyclesRouter from './routes/motorcycles.js';
import paymentsRouter from './routes/payments.js';
import cashReceiptsRouter from './routes/cash_receipts.js';
import notificationsRouter from './routes/notifications.js';
import deactivationsRouter from './routes/deactivations.js';
import authRouter from './routes/auth.js';

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOriginsEnv = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
const defaultOrigins = [
  'http://localhost:5173', 
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
];
const allowedOrigins = new Set([...allowedOriginsEnv, ...defaultOrigins]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin) || allowedOriginsEnv.includes('*')) return callback(null, true);
    console.log(`CORS bloqueado para origen: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}));
app.options('*', cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/centros_costo', costCentersRouter);
app.use('/api/asociados', associatesRouter);
app.use('/api/motorcycles', motorcyclesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/recibos_caja', cashReceiptsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/deactivations', deactivationsRouter);

app.listen(PORT, async () => {
  console.log(`MotoDiario API escuchando en http://localhost:${PORT}`);
  try {
    await getPool();
    console.log('Conexión exitosa a SQL Server');
  } catch (err) {
    console.error('Error conectando a SQL Server:', err.message);
  }
});
