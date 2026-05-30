import { Queue, Worker, type Job } from 'bullmq';
import { getRedis }     from '../lib/redis.js';
import { aiService }    from './ai.js';
import { store }        from './store.js';
import { streamManager } from './stream.js';
import type { Threat }  from '../types/index.js';

// ─── Queue names ─────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  ALERT_ANALYSIS: 'alert-analysis',
  REMEDIATION:    'auto-remediation',
} as const;

// ─── Job payload types ────────────────────────────────────────────────────────

export interface AlertAnalysisJob {
  threatId:  string;
  requestId: string;
  priority:  number;
}

export interface RemediationJob {
  threatId:  string;
  ipAddress: string;
  rule:      string;
}

// ─── Queue service ────────────────────────────────────────────────────────────

class QueueService {
  private alertQueue:       Queue | null = null;
  private remediationQueue: Queue | null = null;
  private alertWorker:      Worker | null = null;
  private remWorker:        Worker | null = null;
  private running = false;

  // Stats for observability
  readonly stats = {
    processed:   0,
    autoResolved: 0,
    failed:      0,
    retried:     0,
  };

  start(): void {
    const redis = getRedis();
    if (!redis) {
      console.log('[Queue] Redis unavailable — AI analysis runs inline (no queue)');
      return;
    }

    const connection = { host: redis.options.host ?? 'localhost', port: redis.options.port ?? 6379 };

    // ── Queues ───────────────────────────────────────────────────────────────
    this.alertQueue = new Queue(QUEUE_NAMES.ALERT_ANALYSIS, {
      connection,
      defaultJobOptions: {
        attempts:    3,
        backoff:     { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail:     { count: 50  },
      },
    });

    this.remediationQueue = new Queue(QUEUE_NAMES.REMEDIATION, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff:  { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 50 },
      },
    });

    // ── Alert analysis worker ────────────────────────────────────────────────
    this.alertWorker = new Worker(
      QUEUE_NAMES.ALERT_ANALYSIS,
      async (job: Job<AlertAnalysisJob>) => {
        const { threatId } = job.data;
        const threat = store.getThreatById(undefined, threatId);  // System view
        if (!threat) throw new Error(`Threat ${threatId} not found`);

        console.log(`[Queue] Analyzing threat ${threatId} (attempt ${job.attemptsMade + 1})`);

        const analysis = await aiService.analyzeThreat(threat);
        store.storeAnalysis(threatId, analysis);
        this.stats.processed++;

        // If AI decided this can be auto-resolved — queue remediation
        if (analysis.autoResolved && (threat.severity === 'low' || threat.severity === 'medium')) {
          this.stats.autoResolved++;
          await this.remediationQueue?.add(QUEUE_NAMES.REMEDIATION, {
            threatId,
            ipAddress: threat.sourceIp,
            rule:      analysis.firewallRule,
          } satisfies RemediationJob, { priority: this.getSeverityPriority(threat) });
        }

        // Broadcast updated analysis to all SSE clients
        streamManager.broadcast('threat:updated', {
          ...threat,
          status: analysis.autoResolved ? 'resolved' : threat.status,
        });

        return analysis;
      },
      { connection, concurrency: 3 },
    );

    // ── Remediation worker ───────────────────────────────────────────────────
    this.remWorker = new Worker(
      QUEUE_NAMES.REMEDIATION,
      async (job: Job<RemediationJob>) => {
        const { threatId, ipAddress, rule } = job.data;
        console.log(`[Queue] Auto-remediating: blocking ${ipAddress}`);

        // Apply remediation (in prod: call firewall API / WAF API)
        const success = store.blockThreat(threatId);
        if (!success) throw new Error(`Could not resolve threat ${threatId}`);

        const threat = store.getThreatById(undefined, threatId);
        if (threat) {
          streamManager.broadcast('threat:updated', threat);
          streamManager.broadcast('analytics:delta', {
            ...await store.getAnalytics(),
          });
        }

        console.log(`[Queue] Remediated ${threatId} — rule applied:\n${rule}`);
        return { success: true, ipAddress };
      },
      { connection, concurrency: 5 },
    );

    // ── Worker events ────────────────────────────────────────────────────────
    this.alertWorker.on('failed', (job, err) => {
      this.stats.failed++;
      console.error(`[Queue] Job ${job?.id} failed (${job?.attemptsMade} attempts):`, err.message);
    });

    this.alertWorker.on('stalled', (jobId) => {
      this.stats.retried++;
      console.warn(`[Queue] Job ${jobId} stalled — will retry`);
    });

    this.running = true;
    console.log('[Queue] BullMQ workers started (alert-analysis + auto-remediation)');
  }

  async enqueueAnalysis(threat: Threat): Promise<string | null> {
    if (!this.alertQueue) {
      // Fallback: run inline when no Redis
      const analysis = await aiService.analyzeThreat(threat);
      store.storeAnalysis(threat.id, analysis);
      if (analysis.autoResolved && (threat.severity === 'low' || threat.severity === 'medium')) {
        store.blockThreat(threat.id);
      }
      streamManager.broadcast('threat:updated', store.getThreatById(undefined, threat.id) ?? threat);
      return null;
    }

    const job = await this.alertQueue.add(
      QUEUE_NAMES.ALERT_ANALYSIS,
      { threatId: threat.id, requestId: threat.id, priority: this.getSeverityPriority(threat) } satisfies AlertAnalysisJob,
      { priority: this.getSeverityPriority(threat) },
    );

    return job.id ?? null;
  }

  private getSeverityPriority(threat: Threat): number {
    return { critical: 1, high: 2, medium: 3, low: 4 }[threat.severity] ?? 3;
  }

  async stop(): Promise<void> {
    await this.alertWorker?.close();
    await this.remWorker?.close();
    await this.alertQueue?.close();
    await this.remediationQueue?.close();
    this.running = false;
    console.log('[Queue] BullMQ workers stopped');
  }

  getStats() {
    return { ...this.stats, running: this.running };
  }
}

export const queueService = new QueueService();
