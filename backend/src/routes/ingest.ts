import { Router, type Request, type Response } from 'express';
import { parse, type RawLogLine } from '../services/threatParser.js';
import { store } from '../services/store.js';
import { streamManager } from '../services/stream.js';
import { queueService } from '../services/queue.js';
import { ragService } from '../services/ragService.js';

export const ingestRouter = Router();

// ─── Shared response helpers ──────────────────────────────────────────────────

function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
}

function err(res: Response, message: string, code: string, status = 400): void {
  res.status(status).json({ success: false, error: message, code, timestamp: new Date().toISOString() });
}

// ─── Ingest endpoint (public, token-protected) ────────────────────────────────

ingestRouter.post('/ingest', async (req: Request, res: Response) => {
  // Token validation (optional, if INGEST_API_TOKEN is set in env)
  const ingestToken = process.env.INGEST_API_TOKEN?.trim();
  if (ingestToken) {
    const headerToken = typeof req.headers['x-ingest-token'] === 'string'
      ? req.headers['x-ingest-token']
      : undefined;
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined;

    if (headerToken !== ingestToken && bearer !== ingestToken) {
      err(res, 'Invalid ingest token', 'UNAUTHORIZED', 401);
      return;
    }
  }

  const raw = req.body as RawLogLine;

  // Parse the raw log into a structured Threat
  const threat = parse(raw);

  if (!threat) {
    // Not a threat — just noise, skip it with 204 No Content
    res.status(204).send();
    return;
  }

  // Ingest into store (in-memory + DB) and use persisted object downstream
  const storedThreat = store.ingestLiveThreat({
    id: threat.id,
    sourceIp: threat.sourceIp,
    country: threat.country,
    countryCode: threat.countryCode,
    asn: threat.asn,
    attackType: threat.attackType,
    endpoint: threat.endpoint,
    severity: threat.severity,
    attempts: threat.attempts,
    userAgent: threat.userAgent,
    status: 'active',
    timestamp: threat.timestamp,
  });

  // Broadcast real-time update to all SSE clients (fire-and-forget)
  streamManager.broadcast('threat:new', storedThreat);
  if (storedThreat.severity === 'critical' || storedThreat.severity === 'high') {
    const alerts = store.getAlerts(1, 1);
    if (alerts.items.length > 0) {
      streamManager.broadcast('alert:new', alerts.items[0]);
    }
  }

  // Index for RAG + queue for AI (fire-and-forget, don't await)
  setImmediate(async () => {
    try {
      const ragMessage = [
        `[${storedThreat.severity.toUpperCase()}] ${storedThreat.attackType}`,
        `from ${storedThreat.sourceIp} (${storedThreat.country})`,
        `targeting ${storedThreat.endpoint}`,
      ].join(' ');
      await ragService.indexLog(storedThreat.id, ragMessage);
      await queueService.enqueueAnalysis(storedThreat);
    } catch (e) {
      console.error('[Ingest] Background task failed:', e);
    }
  });

  // Broadcast analytics delta (fire-and-forget)
  setImmediate(async () => {
    try {
      const analytics = await store.getAnalytics();
      streamManager.broadcast('analytics:delta', {
        totalEvents: analytics.totalEvents,
        activeThreats: analytics.activeThreats,
        criticalAlerts: analytics.criticalAlerts,
        blockedIPs: analytics.blockedIPs,
      });
    } catch (e) {
      console.error('[Ingest] Analytics broadcast failed:', e);
    }
  });

  // Return 201 Created with threat details (immediate, non-blocking)
  ok(res, {
    accepted: true,
    threatId: storedThreat.id,
    attackType: storedThreat.attackType,
    severity: storedThreat.severity,
    queued: true,
  }, 201);
});
