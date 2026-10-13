import jwt from 'jsonwebtoken';

const DEV_FALLBACK = 'medbrief-dev-secret-change-in-prod';
const RAW = process.env.JWT_SECRET;

if (!RAW || RAW === DEV_FALLBACK) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] JWT_SECRET is not configured or uses the dev fallback. Set a strong JWT_SECRET before any live deployment.');
    process.exit(1);
  } else {
    console.warn('[WARN] JWT_SECRET not set or uses dev fallback â€” acceptable for local development/demo only.');
  }
}

const SECRET = RAW || DEV_FALLBACK;
export function signToken(payload: object) { return jwt.sign(payload, SECRET, { expiresIn: '7d' }); }
export function verifyToken(token: string) { return jwt.verify(token, SECRET) as any; }