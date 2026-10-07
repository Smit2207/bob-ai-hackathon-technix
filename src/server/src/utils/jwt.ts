import jwt from 'jsonwebtoken';
const SECRET = process.env.JWT_SECRET || 'medbrief-dev-secret-change-in-prod';
export function signToken(payload: object) { return jwt.sign(payload, SECRET, { expiresIn: '7d' }); }
export function verifyToken(token: string) { return jwt.verify(token, SECRET) as any; }
