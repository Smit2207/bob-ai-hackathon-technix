import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'MedBrief AI' }));
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  if (err.message === 'Unsupported file type') return res.status(400).json({ error: err.message });
  res.status(500).json({ error: 'Internal error' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`MedBrief server on http://0.0.0.0:${PORT}`));
