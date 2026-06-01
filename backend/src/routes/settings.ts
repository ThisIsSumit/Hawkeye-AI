import { Router, type Request, type Response } from 'express';

import { requireAuth, requireRole } from '../lib/auth.js';
import { settingsService } from '../services/settings.js';
import type { ApiResponse, ApiError } from '../types/index.js';

export const settingsRouter = Router();

function ok<T>(res: Response, data: T, status = 200): void {
  const body: ApiResponse<T> = { success: true, data, timestamp: new Date().toISOString() };
  res.status(status).json(body);
}

function err(res: Response, message: string, code: string, status = 400): void {
  const body: ApiError = { success: false, error: message, code, timestamp: new Date().toISOString() };
  res.status(status).json(body);
}

function readBodyObject(req: Request): Record<string, unknown> {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return {};
  }

  return req.body as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readEnvironment(value: unknown): 'production' | 'staging' | undefined {
  if (value === 'production' || value === 'staging') {
    return value;
  }

  return undefined;
}

// ─── API Tokens ──────────────────────────────────────────────────────────────

settingsRouter.get('/tokens', requireAuth, requireRole('ADMIN'), async (_req: Request, res: Response) => {
  ok(res, { tokens: await settingsService.listTokens() });
});

settingsRouter.post('/tokens', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  const body = readBodyObject(req);
  const name = readString(body.name);
  const environment = readEnvironment(body.environment) ?? 'production';

  if (!name) {
    err(res, 'name is required', 'VALIDATION_ERROR', 400);
    return;
  }

  const created = await settingsService.createToken(name, environment, req.user);
  ok(res, created, 201);
});

async function revokeTokenHandler(req: Request, res: Response): Promise<void> {
  const revoked = await settingsService.revokeToken(req.params.id, req.user);

  if (!revoked) {
    err(res, `Token ${req.params.id} not found`, 'TOKEN_NOT_FOUND', 404);
    return;
  }

  ok(res, { success: true });
}

settingsRouter.post('/tokens/:id/revoke', requireAuth, requireRole('ADMIN'), revokeTokenHandler);
settingsRouter.delete('/tokens/:id', requireAuth, requireRole('ADMIN'), revokeTokenHandler);

// ─── Thresholds ─────────────────────────────────────────────────────────────

async function listThresholds(_req: Request, res: Response): Promise<void> {
  ok(res, await settingsService.getThresholds());
}

async function updateThresholds(req: Request, res: Response): Promise<void> {
  const body = readBodyObject(req);

  try {
    const thresholds = await settingsService.updateThresholds(body, req.user);
    ok(res, { success: true, thresholds });
  } catch (error) {
    err(res, error instanceof Error ? error.message : 'Invalid thresholds payload', 'VALIDATION_ERROR', 400);
  }
}

settingsRouter.get('/settings/thresholds', requireAuth, requireRole('ANALYST'), listThresholds);
settingsRouter.put('/settings/thresholds', requireAuth, requireRole('ANALYST'), updateThresholds);
settingsRouter.post('/settings/thresholds', requireAuth, requireRole('ANALYST'), updateThresholds);

// ─── Telemetry ───────────────────────────────────────────────────────────────

settingsRouter.get('/settings/telemetry', requireAuth, requireRole('ANALYST'), async (_req: Request, res: Response) => {
  ok(res, { channels: await settingsService.listTelemetry() });
});

async function updateTelemetry(req: Request, res: Response): Promise<void> {
  const body = readBodyObject(req);
  const enabled = typeof body.enabled === 'boolean' ? body.enabled : undefined;
  const config = body.config && typeof body.config === 'object' && !Array.isArray(body.config)
    ? (body.config as Record<string, unknown>)
    : undefined;

  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
    err(res, 'enabled must be boolean when provided', 'VALIDATION_ERROR', 400);
    return;
  }

  if (body.config !== undefined && !config) {
    err(res, 'config must be an object when provided', 'VALIDATION_ERROR', 400);
    return;
  }

  const channel = await settingsService.updateTelemetry(req.params.id, { enabled, config }, req.user);
  if (!channel) {
    err(res, `Telemetry channel ${req.params.id} not found`, 'TELEMETRY_NOT_FOUND', 404);
    return;
  }

  ok(res, { success: true, channel });
}

settingsRouter.put('/settings/telemetry/:id', requireAuth, requireRole('ANALYST'), updateTelemetry);
settingsRouter.post('/settings/telemetry/:id', requireAuth, requireRole('ANALYST'), updateTelemetry);