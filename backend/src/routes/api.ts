import { Router, type Response } from 'express';
import { store }         from '../services/store.js';
import { streamManager } from '../services/stream.js';
import { aiService }     from '../services/ai.js';
import { queueService }  from '../services/queue.js';
import { ragService }    from '../services/ragService.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import type { ApiResponse, ApiError } from '../types/index.js';
import PDFDocument from 'pdfkit';

export const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok<T>(res: Response, data: T, status = 200): void {
  const body: ApiResponse<T> = { success: true, data, timestamp: new Date().toISOString() };
  res.status(status).json(body);
}

function err(res: Response, message: string, code: string, status = 400): void {
  const body: ApiError = { success: false, error: message, code, timestamp: new Date().toISOString() };
  res.status(status).json(body);
}

function queryString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return fallback;
}

function queryNumber(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(queryString(value, String(fallback)), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

// ─── Health (public) ──────────────────────────────────────────────────────────

router.get('/health', (_req, res) => {
  ok(res, {
    status:     'ok',
    uptime:     process.uptime(),
    sseClients: streamManager.clientCount,
    queue:      queueService.getStats(),
    ai:         aiService.isLive ? 'claude-live' : 'local-fallback',
    ts:         new Date().toISOString(),
  });
});

// ─── SSE Stream (public — auth via query param for EventSource) ───────────────

router.get('/stream', (req, res) => {
  streamManager.addClient(res);
});

// ─── Analytics ────────────────────────────────────────────────────────────────

router.get('/analytics/summary', requireAuth, async (req, res) => {
  ok(res, await store.getAnalytics(req.user!.userId));
});

// ─── Threats ──────────────────────────────────────────────────────────────────

router.get('/threats', requireAuth, (req, res) => {
  const page     = Math.max(1, queryNumber(req.query.page, 1));
  const pageSize = Math.min(100, queryNumber(req.query.pageSize, 20));
  const severity = queryString(req.query.severity);
  const type     = queryString(req.query.type);
  ok(res, store.getThreats(req.user!.userId, page, pageSize, severity, type));
});

router.get('/threats/:id', requireAuth, (req, res) => {
  const threat = store.getThreatById(req.user!.userId, req.params.id);
  if (!threat) { err(res, `Threat ${req.params.id} not found`, 'THREAT_NOT_FOUND', 404); return; }
  ok(res, threat);
});

router.post('/threats/:id/actions/block-ip', requireAuth, requireRole('ANALYST'), (req, res) => {
  const threat = store.getThreatById(req.user!.userId, req.params.id);
  if (!threat) { err(res, `Threat ${req.params.id} not found`, 'THREAT_NOT_FOUND', 404); return; }
  const success = store.blockThreat(req.params.id);
  if (!success) { err(res, `Threat ${req.params.id} not found`, 'THREAT_NOT_FOUND', 404); return; }
  const updated = store.getThreatById(req.user!.userId, req.params.id)!;
  streamManager.broadcast('threat:updated', updated);
  ok(res, { message: `IP ${updated.sourceIp} blocked`, threat: updated });
});

router.post('/threats/:id/actions/resolve', requireAuth, requireRole('ANALYST'), (req, res) => {
  const threat = store.getThreatById(req.user!.userId, req.params.id);
  if (!threat) { err(res, `Threat ${req.params.id} not found`, 'THREAT_NOT_FOUND', 404); return; }
  const success = store.resolveThreat(req.params.id);
  if (!success) { err(res, `Threat ${req.params.id} not found`, 'THREAT_NOT_FOUND', 404); return; }
  const updated = store.getThreatById(req.user!.userId, req.params.id)!;
  streamManager.broadcast('threat:updated', updated);
  ok(res, { message: `Threat ${req.params.id} resolved`, threat: updated });
});

router.post('/threats', requireAuth, requireRole('ANALYST'), async (req, res) => {
  const {
    sourceIp,
    country,
    countryCode,
    asn,
    attackType,
    endpoint,
    severity,
    status,
    attempts,
    userAgent,
    logMessage,
  } = req.body as {
    sourceIp?: string;
    country?: string;
    countryCode?: string;
    asn?: string;
    attackType?: string;
    endpoint?: string;
    severity?: string;
    status?: string;
    attempts?: number;
    userAgent?: string;
    logMessage?: string;
  };

  const validAttackTypes = ['SQL Injection','XSS','DDoS','Brute Force','Path Traversal','SSRF','Command Injection','CSRF'] as const;
  const validSeverities = ['low', 'medium', 'high', 'critical'] as const;
  const validStatuses = ['active', 'blocked', 'resolved', 'investigating'] as const;

  if (!sourceIp || !attackType || !endpoint || !severity) {
    err(res, 'sourceIp, attackType, endpoint and severity are required', 'VALIDATION_ERROR', 400);
    return;
  }

  if (!validAttackTypes.includes(attackType as any)) {
    err(res, `attackType must be one of: ${validAttackTypes.join(', ')}`, 'VALIDATION_ERROR', 400);
    return;
  }

  if (!validSeverities.includes(severity as any)) {
    err(res, `severity must be one of: ${validSeverities.join(', ')}`, 'VALIDATION_ERROR', 400);
    return;
  }

  if (status && !validStatuses.includes(status as any)) {
    err(res, `status must be one of: ${validStatuses.join(', ')}`, 'VALIDATION_ERROR', 400);
    return;
  }

  const threat = store.ingestThreat({
    sourceIp,
    country,
    countryCode,
    asn,
    attackType: attackType as any,
    endpoint,
    severity: severity as any,
    status: status as any,
    attempts,
    userAgent,
    userId: req.user!.userId,
  });

  const message = logMessage ?? `Real threat ingested: ${threat.attackType} from ${threat.sourceIp} targeting ${threat.endpoint}. Severity: ${threat.severity.toUpperCase()}.`;
  await ragService.indexLog(threat.id, message);

  streamManager.broadcast('threat:new', threat);
  if (threat.severity === 'critical' || threat.severity === 'high') {
    const alerts = store.getAlerts(1, 1);
    if (alerts.items.length > 0) {
      streamManager.broadcast('alert:new', alerts.items[0]);
    }
  }

  const analytics = await store.getAnalytics(req.user!.userId);
  streamManager.broadcast('analytics:delta', {
    totalEvents: analytics.totalEvents,
    activeThreats: analytics.activeThreats,
    criticalAlerts: analytics.criticalAlerts,
    blockedIPs: analytics.blockedIPs,
  });

  ok(res, threat, 201);
});

// ─── Alerts ───────────────────────────────────────────────────────────────────

router.get('/alerts', requireAuth, (req, res) => {
  const page     = Math.max(1, queryNumber(req.query.page, 1));
  const pageSize = Math.min(100, queryNumber(req.query.pageSize, 20));
  const status   = queryString(req.query.status);
  ok(res, store.getAlerts(page, pageSize, status));
});

// ─── Reports ──────────────────────────────────────────────────────────────────

router.get('/reports', requireAuth, (req, res) => {
  const page     = Math.max(1, queryNumber(req.query.page, 1));
  const pageSize = Math.min(100, queryNumber(req.query.pageSize, 20));
  ok(res, store.getReports(page, pageSize));
});

router.post('/reports/generate', requireAuth, requireRole('ANALYST'), (req, res) => {
  const { type, title } = req.body as { type?: string; title?: string };
  
  const validReportTypes = ['Daily Summary', 'Incident', 'Compliance', 'Weekly Threat Intel'] as const;
  if (!type || !validReportTypes.includes(type as any)) {
    err(res, 'type must be one of: Daily Summary, Incident, Compliance, Weekly Threat Intel', 'VALIDATION_ERROR', 400);
    return;
  }

  const report = store.generateReport(type as any, title);
  ok(res, report, 201);
});

router.get('/reports/:id/download', requireAuth, async (req, res) => {
  const reportId = req.params.id;
  const report = store.getReportById(reportId);

  if (!report) {
    err(res, `Report ${reportId} not found`, 'REPORT_NOT_FOUND', 404);
    return;
  }

  const analytics = await store.getAnalytics(req.user!.userId);
  const threatSample = store.getThreats(req.user!.userId, 1, 8).items;
  const generatedAt = new Date().toISOString();
  const safeId = report.id.replaceAll(/[^a-zA-Z0-9_-]/g, '_');

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  doc.on('error', () => {
    if (!res.headersSent) {
      err(res, `Failed to generate report ${reportId}`, 'REPORT_GENERATION_FAILED', 500);
    }
  });
  doc.on('end', () => {
    const pdfBuffer = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeId}.pdf"`);
    res.status(200).send(pdfBuffer);
  });

  doc.fontSize(22).font('Helvetica-Bold').text('HawkEye Security Report');
  doc.moveDown(0.2);
  doc.fontSize(11).font('Helvetica').fillColor('#555')
    .text(`Report ID: ${report.id}`)
    .text(`Title: ${report.title}`)
    .text(`Type: ${report.type}`)
    .text(`Author: ${report.author}`)
    .text(`Generated At: ${generatedAt}`);

  doc.moveDown();
  doc.fillColor('#000').fontSize(14).font('Helvetica-Bold').text('Summary');
  doc.moveDown(0.4);
  doc.fontSize(11).font('Helvetica')
    .text(`Total Events: ${analytics.totalEvents}`)
    .text(`Active Threats: ${analytics.activeThreats}`)
    .text(`Critical Alerts: ${analytics.criticalAlerts}`)
    .text(`Blocked IPs: ${analytics.blockedIPs}`)
    .text(`Block Rate: ${analytics.blockRate}%`);

  doc.moveDown();
  doc.fontSize(14).font('Helvetica-Bold').text('Top Attacking IPs');
  doc.moveDown(0.4);
  doc.fontSize(10).font('Helvetica');
  analytics.topAttackingIPs.forEach((ip, idx) => {
    doc.text(`${idx + 1}. ${ip.ip} (${ip.country})   attempts=${ip.attempts}   severity=${ip.severity}`);
  });

  doc.moveDown();
  doc.fontSize(14).font('Helvetica-Bold').text('Recent Threat Sample');
  doc.moveDown(0.4);
  doc.fontSize(9).font('Helvetica');
  threatSample.forEach((t) => {
    const line = `${t.id} | ${new Date(t.timestamp).toLocaleString()} | ${t.sourceIp} | ${t.attackType} | ${t.severity.toUpperCase()} | ${t.status.toUpperCase()}`;
    doc.text(line, { width: 500 });
  });

  doc.moveDown();
  doc.fillColor('#666').fontSize(9).text('Generated by HawkEye API', { align: 'right' });
  doc.end();
});

// ─── Phase 2 — AI Analysis (real Claude API + BullMQ queue) ──────────────────

router.post('/alerts/:id/analyze', requireAuth, requireRole('ANALYST'), async (req, res) => {
  // id here is a threat id
  const threat = store.getThreatById(req.params.id);
  if (!threat) { err(res, `Threat ${req.params.id} not found`, 'THREAT_NOT_FOUND', 404); return; }

  // Check cache first
  const cached = store.getAnalysis?.(req.params.id);
  if (cached) { ok(res, { cached: true, analysis: cached }); return; }

  // Enqueue — BullMQ when Redis available, inline fallback when not
  const jobId = await queueService.enqueueAnalysis(threat);

  ok(res, {
    message:  jobId ? `Analysis queued (job ${jobId})` : 'Analysis running inline',
    jobId,
    threatId: threat.id,
    queued:   !!jobId,
  }, 202);
});

router.get('/alerts/:id/analysis', requireAuth, (req, res) => {
  const analysis = store.getAnalysis?.(req.params.id);
  if (!analysis) { err(res, 'Analysis not ready yet', 'ANALYSIS_PENDING', 404); return; }
  ok(res, analysis);
});

// ─── Phase 3 — Queue stats (ADMIN only) ──────────────────────────────────────

router.get('/queue/stats', requireAuth, requireRole('ADMIN'), (_req, res) => {
  ok(res, queueService.getStats());
});

// ─── Phase 5 — RAG natural language log query ─────────────────────────────────

router.post('/logs/query', requireAuth, async (req, res) => {
  const { question, history } = req.body as { question?: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> };
  if (!question?.trim()) { err(res, 'question is required', 'VALIDATION_ERROR'); return; }
  const result = await ragService.query(question.trim(), history);
  ok(res, result);
});
