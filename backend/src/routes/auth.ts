import { Router, type Request, type Response } from 'express';
import { findUserByEmail, verifyPassword, signToken, getAllUsers, requireAuth, requireRole, normalizeEmail, hashPassword, createUser } from '../lib/auth.js';

export const authRouter = Router();

// ─── POST /api/auth/register ─────────────────────────────────────────────────

authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string };

  if (!email || !password || !name) {
    res.status(400).json({ success: false, error: 'name, email and password required', code: 'VALIDATION_ERROR' });
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    res.status(409).json({ success: false, error: 'Email already registered', code: 'EMAIL_EXISTS' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({ email: normalizedEmail, name, passwordHash, role: 'VIEWER' });
  const token = signToken({ userId: user.id, email: user.email, role: user.role, name: user.name });

  res.status(201).json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ success: false, error: 'email and password required', code: 'VALIDATION_ERROR' });
    return;
  }

  const user = await findUserByEmail(normalizeEmail(email));
  if (!user) {
    res.status(401).json({ success: false, error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ success: false, error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role, name: user.name });

  res.json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ success: true, data: req.user, timestamp: new Date().toISOString() });
});

// ─── GET /api/auth/users (ADMIN only) ────────────────────────────────────────

authRouter.get('/users', requireAuth, requireRole('ADMIN'), async (_req: Request, res: Response) => {
  res.json({ success: true, data: await getAllUsers(), timestamp: new Date().toISOString() });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

authRouter.post('/refresh', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const token = signToken({ userId: user.userId, email: user.email, role: user.role, name: user.name });
  res.json({ success: true, data: { token }, timestamp: new Date().toISOString() });
});
