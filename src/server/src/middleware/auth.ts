import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
export interface AuthRequest extends Request { userId?: string; }
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { const decoded = verifyToken(token); req.userId = decoded.userId; next(); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
}
