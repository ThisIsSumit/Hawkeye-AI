import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ingestRouter } from '../src/routes/ingest.js';
import { store } from '../src/services/store.js';
import { queueService } from '../src/services/queue.js';
import { ragService } from '../src/services/ragService.js';
import { streamManager } from '../src/services/stream.js';
import { resetParserStateForTests } from '../src/services/threatParser.js';
import { authFailedLoginLog, ingestTestToken, rawLogs } from './fixtures/rawLogs.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', ingestRouter);
  return app;
}

describe('POST /api/ingest integration tests', () => {
  const app = buildApp();

  beforeEach(() => {
    resetParserStateForTests();
    process.env.INGEST_API_TOKEN = ingestTestToken;
    process.env.OPENROUTER_API_KEY = '';

    vi.spyOn(queueService, 'enqueueAnalysis').mockResolvedValue('job-test-1');
    vi.spyOn(ragService, 'indexLog').mockResolvedValue();
    vi.spyOn(streamManager, 'broadcast').mockImplementation(() => undefined);
  });

  it('returns 401 when token is missing', async () => {
    const res = await request(app)
      .post('/api/ingest')
      .send({ message: 'GET /index 200', sourceIp: '1.1.1.1' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 204 for non-threat logs', async () => {
    const queueSpy = vi.spyOn(queueService, 'enqueueAnalysis');

    const res = await request(app)
      .post('/api/ingest')
      .set('x-ingest-token', ingestTestToken)
      .send(rawLogs.nginxBenign);

    expect(res.status).toBe(204);
    expect(queueSpy).not.toHaveBeenCalled();
  });

  it('ingests SQLi log and queues analysis with same persisted threat id', async () => {
    const queueSpy = vi.spyOn(queueService, 'enqueueAnalysis');

    const res = await request(app)
      .post('/api/ingest')
      .set('x-ingest-token', ingestTestToken)
      .send(rawLogs.nginxSqli);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.attackType).toBe('SQL Injection');
    expect(res.body.data.severity).toBe('critical');

    await vi.waitFor(() => {
      expect(queueSpy).toHaveBeenCalledTimes(1);
    });

    const queuedThreat = queueSpy.mock.calls[0][0];
    const responseThreatId = res.body.data.threatId as string;

    expect(queuedThreat.id).toBe(responseThreatId);
    expect(store.getThreatById(undefined, responseThreatId)).toBeDefined();
  });

  it('triggers brute-force on fifth failed auth log from same ip', async () => {
    const ip = '101.102.103.104';
    const queueSpy = vi.spyOn(queueService, 'enqueueAnalysis');

    for (let i = 0; i < 4; i += 1) {
      const r = await request(app)
        .post('/api/ingest')
        .set('x-ingest-token', ingestTestToken)
        .send(authFailedLoginLog(ip));

      expect(r.status).toBe(204);
    }

    const fifth = await request(app)
      .post('/api/ingest')
      .set('x-ingest-token', ingestTestToken)
      .send(authFailedLoginLog(ip));

    expect(fifth.status).toBe(201);
    expect(fifth.body.data.attackType).toBe('Brute Force');
    expect(fifth.body.data.severity).toBe('medium');

    await vi.waitFor(() => {
      expect(queueSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('ingests IDS scan log as DDoS/high', async () => {
    const res = await request(app)
      .post('/api/ingest')
      .set('x-ingest-token', ingestTestToken)
      .send(rawLogs.idsPortScan);

    expect(res.status).toBe(201);
    expect(res.body.data.attackType).toBe('DDoS');
    expect(res.body.data.severity).toBe('high');
  });

  it('ingests WAF XSS log as XSS/high', async () => {
    const res = await request(app)
      .post('/api/ingest')
      .set('x-ingest-token', ingestTestToken)
      .send(rawLogs.wafXss);

    expect(res.status).toBe(201);
    expect(res.body.data.attackType).toBe('XSS');
    expect(res.body.data.severity).toBe('high');
  });
});
