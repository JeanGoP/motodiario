import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import costCentersRouter from './routes/cost_centers.js';
import associatesRouter from './routes/associates.js';
import authRouter from './routes/auth.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/centros_costo', costCentersRouter);
app.use('/api/asociados', associatesRouter);

app.listen(PORT, () => {
  console.log(`MotoDiario API escuchando en http://localhost:${PORT}`);
});
