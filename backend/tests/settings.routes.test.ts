import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { signToken } from '../src/lib/auth.js';
import { authRouter } from '../src/routes/auth.js';
import { settingsRouter } from '../src/routes/settings.js';
import { resetSettingsStoreForTests } from '../src/services/settings.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api', settingsRouter);
  return app;
}

function authHeader(role: 'ADMIN' | 'ANALYST' | 'VIEWER') {
  const token = signToken({
    userId: `user-${role.toLowerCase()}`,
    email: `${role.toLowerCase()}@hawkeye.test`,
    role,
    name: `${role} User`,
  });

  return { Authorization: `Bearer ${token}` };
}

describe('settings routes', () => {
  const app = buildApp();

  beforeEach(() => {
    resetSettingsStoreForTests();
  });

  it('lets admin create, list, and revoke api tokens', async () => {
    const create = await request(app)
      .post('/api/tokens')
      .set(authHeader('ADMIN'))
      .send({ name: 'Production Interface', environment: 'staging' });

    expect(create.status).toBe(201);
    expect(create.body.success).toBe(true);
    expect(create.body.data.token).toMatch(/^hk_stag_/);

    const listBeforeRevoke = await request(app)
      .get('/api/tokens')
      .set(authHeader('ADMIN'));

    expect(listBeforeRevoke.status).toBe(200);
    expect(listBeforeRevoke.body.data.tokens).toHaveLength(1);
    expect(listBeforeRevoke.body.data.tokens[0].valueMasked).not.toBe(create.body.data.token);
    expect(listBeforeRevoke.body.data.tokens[0].active).toBe(true);

    const revoke = await request(app)
      .post(`/api/tokens/${create.body.data.id}/revoke`)
      .set(authHeader('ADMIN'));

    expect(revoke.status).toBe(200);
    expect(revoke.body.data.success).toBe(true);

    const listAfterRevoke = await request(app)
      .get('/api/tokens')
      .set(authHeader('ADMIN'));

    expect(listAfterRevoke.body.data.tokens[0].active).toBe(false);
  });

  it('lets analysts read and update thresholds', async () => {
    const read = await request(app)
      .get('/api/settings/thresholds')
      .set(authHeader('ANALYST'));

    expect(read.status).toBe(200);
    expect(read.body.data.sql_injection).toBe(75);

    const update = await request(app)
      .put('/api/settings/thresholds')
      .set(authHeader('ANALYST'))
      .send({
        sql_injection: 90,
        brute_force: 45,
        ddos: 80,
        anomaly_cutoff: 55,
        xss: 65,
      });

    expect(update.status).toBe(200);
    expect(update.body.data.success).toBe(true);
    expect(update.body.data.thresholds.sql_injection).toBe(90);

    const after = await request(app)
      .get('/api/settings/thresholds')
      .set(authHeader('ANALYST'));

    expect(after.body.data.sql_injection).toBe(90);
  });

  it('lets analysts read and update telemetry channels', async () => {
    const read = await request(app)
      .get('/api/settings/telemetry')
      .set(authHeader('ANALYST'));

    expect(read.status).toBe(200);
    expect(read.body.data.channels).toHaveLength(4);

    const update = await request(app)
      .put('/api/settings/telemetry/slack')
      .set(authHeader('ANALYST'))
      .send({ enabled: false, config: { channel: '#alerts' } });

    expect(update.status).toBe(200);
    expect(update.body.data.success).toBe(true);
    expect(update.body.data.channel.enabled).toBe(false);
    expect(update.body.data.channel.config.channel).toBe('#alerts');
  });

  it('blocks insufficient roles', async () => {
    const response = await request(app)
      .get('/api/tokens')
      .set(authHeader('VIEWER'));

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });
});