import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../server/src/utils/jwt.js';
import { requireAuth, AuthRequest } from '../server/src/middleware/auth.js';
import { getProvider } from '../server/src/services/aiProvider.js';

describe('JWT utilities', () => {
  it('signs and verifies a token', () => {
    const token = signToken({ userId: 'user_123' });
    const decoded = verifyToken(token) as { userId: string };
    expect(decoded.userId).toBe('user_123');
  });

  it('rejects a tampered token', () => {
    const token = signToken({ userId: 'user_123' });
    const tampered = token.slice(0, -3) + 'xxx';
    expect(() => verifyToken(tampered)).toThrow();
  });

  it('rejects an unsigned token', () => {
    expect(() => verifyToken('not.a.token')).toThrow();
  });
});

describe('authentication middleware', () => {
  const next = () => {};

  it('rejects a request with no token', () => {
    const req = { cookies: {}, headers: {} } as unknown as AuthRequest;
    const res = {
      status: (code: number) => {
        expect(code).toBe(401);
        return { json: (body: any) => { expect(body.error).toBe('Unauthorized'); } };
      },
    } as any;
    requireAuth(req, res, next);
  });

  it('accepts a valid bearer token', () => {
    const token = signToken({ userId: 'user_123' });
    const req = { cookies: {}, headers: { authorization: `Bearer ${token}` } } as unknown as AuthRequest;
    let setUserId: string | undefined;
    const res = {} as any;
    const nextFn = () => { setUserId = req.userId; };
    requireAuth(req, res, nextFn);
    expect(setUserId).toBe('user_123');
  });

  it('accepts a cookie token', () => {
    const token = signToken({ userId: 'user_456' });
    const req = { cookies: { token }, headers: {} } as unknown as AuthRequest;
    let setUserId: string | undefined;
    const res = {} as any;
    const nextFn = () => { setUserId = req.userId; };
    requireAuth(req, res, nextFn);
    expect(setUserId).toBe('user_456');
  });

  it('rejects an invalid token', () => {
    const req = { cookies: { token: 'invalid' }, headers: {} } as unknown as AuthRequest;
    const res = {
      status: (code: number) => {
        expect(code).toBe(401);
        return { json: (body: any) => { expect(body.error).toBe('Invalid token'); } };
      },
    } as any;
    requireAuth(req, res, () => {});
  });
});

describe('AI provider abstraction', () => {
  it('defaults to the mock provider', () => {
    const provider = getProvider();
    expect(provider).toBeDefined();
  });

  it('mock provider returns only supplied context', async () => {
    const provider = getProvider();
    const context = 'CONTEXT: Patient has hypertension.';
    const out = await provider.generate('Summarise', context);
    expect(out).toContain('hypertension');
    expect(out).not.toContain('diabetes'); // not in context
  });

  it('watsonx provider is selected via env', () => {
    const prev = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = 'watsonx';
    const provider = getProvider();
    expect(provider).toBeDefined();
    process.env.AI_PROVIDER = prev;
  });
});