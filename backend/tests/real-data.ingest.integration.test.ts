import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { signToken } from '../src/lib/auth.js';
import { router } from '../src/routes/api.js';
import { ingestRouter } from '../src/routes/ingest.js';
import { queueService } from '../src/services/queue.js';
import { ragService } from '../src/services/ragService.js';
import { store } from '../src/services/store.js';
import { streamManager } from '../src/services/stream.js';
import { ingestTestToken } from './fixtures/rawLogs.js';

const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'dummy-logs.jsonl');
const realLogs = fs.readFileSync(fixturePath, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line) as Record<string, unknown>);

function buildPublicIngestApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', ingestRouter);
  return app;
}

function buildAuthenticatedApiApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', router);
  return app;
}

describe('real fixture ingestion', () => {
  beforeEach(() => {
    process.env.INGEST_API_TOKEN = ingestTestToken;
    vi.spyOn(queueService, 'enqueueAnalysis').mockResolvedValue('real-data-job');
    vi.spyOn(ragService, 'indexLog').mockResolvedValue();
    vi.spyOn(streamManager, 'broadcast').mockImplementation(() => undefined);
  });

  it('replays every checked-in real log fixture through the production ingest route', async () => {
    const app = buildPublicIngestApp();
    const expectedStatuses = [201, 204, 201, 204, 201, 201];
    const responses = [];

    for (const log of realLogs) {
      responses.push(await request(app)
        .post('/api/ingest')
        .set('x-ingest-token', ingestTestToken)
        .send(log));
    }

    expect(responses.map((response) => response.status)).toEqual(expectedStatuses);
    expect(responses[0].body.data.attackType).toBe('SQL Injection');
    expect(responses[2].body.data.attackType).toBe('XSS');
    expect(responses[4].body.data.attackType).toBe('DDoS');
    expect(responses[5].body.data.attackType).toBe('SSRF');
    expect(store.getThreatById(undefined, responses[0].body.data.threatId)).toMatchObject({
      sourceIp: '44.55.66.77',
      endpoint: '/api/users?id=1 union select password from users',
      severity: 'critical',
    });
  });

  it('accepts a real Filebeat ECS event and persists normalized threat data', async () => {
    const app = buildAuthenticatedApiApp();
    const token = signToken({
      userId: 'filebeat-test-user',
      email: 'filebeat@test.local',
      role: 'ANALYST',
      name: 'Filebeat Test',
    });

    const response = await request(app)
      .post('/api/ingest')
      .set('Authorization', `Bearer ${token}`)
      .send({
        '@timestamp': '2026-04-10T18:30:10Z',
        event: {
          category: ['web-application-attack'],
          severity: 4,
          type: 'sql_injection',
        },
        source: {
          ip: '44.55.66.77',
          geo: { country_name: 'United States', country_iso_code: 'US' },
          as: { organization: 'Example Security Network' },
        },
        url: { path: '/api/users' },
        user_agent: { original: 'curl/8.0' },
      });

    expect(response.status).toBe(200);
    expect(response.body.data.ingested).toBe(1);
    expect(response.body.data.ids).toHaveLength(1);
    expect(store.getThreatById(undefined, response.body.data.ids[0])).toMatchObject({
      sourceIp: '44.55.66.77',
      country: 'United States',
      countryCode: 'US',
      asn: 'Example Security Network',
      attackType: 'SQL Injection',
      endpoint: '/api/users',
      severity: 'critical',
      userAgent: 'curl/8.0',
      userId: 'filebeat-test-user',
    });
  });
});