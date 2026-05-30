import jwt            from 'jsonwebtoken';
import bcrypt         from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const JWT_SECRET      = process.env.JWT_SECRET ?? 'hawkeye-dev-secret-change-in-prod';
const JWT_EXPIRES_IN  = process.env.JWT_EXPIRES_IN ?? '24h';

export type Role = 'ADMIN' | 'ANALYST' | 'VIEWER';

export interface JWTPayload {
  userId: string;
  email:  string;
  role:   Role;
  name:   string;
}

// Replaced with DB lookup in Phase 4/6
interface UserRecord {
  id:           string;
  email:        string;
  name:         string;
  passwordHash: string;
  role:         Role;
  active:       boolean;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ─── User lookup (DB-backed) ──────────────────────────────────────────────────

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  if (!db) return null;
  return db.user.findUnique({ where: { email: normalizeEmail(email) } });
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  if (!db) return null;
  return db.user.findUnique({ where: { id } });
}

export async function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  role?: Role;
}): Promise<UserRecord> {
  if (!db) {
    throw new Error('Database unavailable');
  }

  return db.user.create({
    data: {
      email: normalizeEmail(input.email),
      name: input.name.trim(),
      passwordHash: input.passwordHash,
      role: input.role ?? 'VIEWER',
    },
  });
}

export async function getAllUsers(): Promise<Omit<UserRecord, 'passwordHash'>[]> {
  if (!db) return [];
  return db.user.findMany({
    select: {
      id:     true,
      email:  true,
      name:   true,
      role:   true,
      active: true,
      createdAt: true,
    }
  });
}

// ─── Express middleware ───────────────────────────────────────────────────────

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/** Require a valid JWT. Attaches req.user on success. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const token = header.slice(7);
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Token expired or invalid', code: 'TOKEN_INVALID' });
  }
}

/** Require a specific role (or higher). Role hierarchy: VIEWER < ANALYST < ADMIN */
const ROLE_RANK: Record<Role, number> = { VIEWER: 0, ANALYST: 1, ADMIN: 2 };

export function requireRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthenticated', code: 'UNAUTHORIZED' });
      return;
    }
    if (ROLE_RANK[req.user.role] < ROLE_RANK[minRole]) {
      res.status(403).json({
        success: false,
        error:   `This action requires ${minRole} role or above`,
        code:    'FORBIDDEN',
      });
      return;
    }
    next();
  };
}
