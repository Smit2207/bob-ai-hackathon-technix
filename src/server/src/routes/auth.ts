import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma.js';
import { signToken } from '../utils/jwt.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const r = Router();

r.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
  if (password.length < 6) return res.status(400).json({ error: 'Password too short' });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, password: hash, name } });
  const token = signToken({ userId: user.id });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7*24*60*60*1000 });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

r.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken({ userId: user.id });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7*24*60*60*1000 });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

r.post('/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

r.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

export default r;
