import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'cheap-ai-dev-secret-change-in-production';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: 'super_admin' | 'admin' | 'member';
  plan: string;
  banned: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): { sub: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string };
  } catch {
    return null;
  }
}

function loadUser(userId: string): AuthUser | null {
  const db = getDb();
  const user = db.prepare('SELECT id, email, username, role, plan, banned FROM users WHERE id = ?').get(userId) as {
    id: string; email: string; username: string; role: string; plan: string; banned: number;
  } | undefined;

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role as AuthUser['role'],
    plan: user.plan,
    banned: user.banned === 1,
  };
}

function loadUserByCliToken(token: string): AuthUser | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT u.id, u.email, u.username, u.role, u.plan, u.banned
    FROM cli_tokens t JOIN users u ON t.user_id = u.id
    WHERE t.token = ?
  `).get(token) as { id: string; email: string; username: string; role: string; plan: string; banned: number } | undefined;

  if (!row) return null;

  db.prepare("UPDATE cli_tokens SET last_used = datetime('now') WHERE token = ?").run(token);

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role as AuthUser['role'],
    plan: row.plan,
    banned: row.banned === 1,
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Authorization required' });
    return;
  }

  const [scheme, token] = authHeader.split(' ');

  let user: AuthUser | null = null;

  if (scheme === 'Bearer') {
    const payload = verifyToken(token);
    if (payload) {
      user = loadUser(payload.sub);
    }
  } else if (scheme === 'Token') {
    user = loadUserByCliToken(token);
  }

  if (!user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  if (user.banned) {
    res.status(403).json({ error: 'Your account has been suspended' });
    return;
  }

  req.user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    next();
  });
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'super_admin') {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }
    next();
  });
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) { next(); return; }

  const [scheme, token] = authHeader.split(' ');
  if (scheme === 'Bearer') {
    const payload = verifyToken(token);
    if (payload) req.user = loadUser(payload.sub) || undefined;
  } else if (scheme === 'Token') {
    req.user = loadUserByCliToken(token) || undefined;
  }
  next();
}

export function socketAuth(token: string): AuthUser | null {
  if (!token) return null;

  const [scheme, value] = token.split(' ');
  if (scheme === 'Bearer') {
    const payload = verifyToken(value);
    if (!payload) return null;
    return loadUser(payload.sub);
  } else if (scheme === 'Token') {
    return loadUserByCliToken(value);
  }
  return null;
}
