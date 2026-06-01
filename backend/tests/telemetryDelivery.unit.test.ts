import { beforeEach, describe, expect, it, vi } from 'vitest';

const nodemailerMock = vi.hoisted(() => {
  const sendMail = vi.fn();
  const createTransport = vi.fn(() => ({ sendMail }));
  return { sendMail, createTransport };
});

vi.mock('nodemailer', () => ({
  default: {
    createTransport: nodemailerMock.createTransport,
  },
}));

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

async function loadTelemetryModule() {
  vi.resetModules();
  const telemetry = await import('../src/services/telemetry.js');
  const settings = await import('../src/services/settings.js');
  return { telemetry, settings };
}

function buildAlert(severity: 'high' | 'critical' = 'critical') {
  return {
    id: 'alert-1',
    threatId: 'threat-1',
    name: 'SQL Injection in /login',
    sourceIp: 'scanner-host.local',
    endpoint: '/login',
    severity,
    status: 'active' as const,
    assignedTo: 'Arjun Kumar',
    timestamp: '2026-06-01T00:00:00.000Z',
    attackType: 'SQL Injection' as const,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  nodemailerMock.sendMail.mockReset();

  process.env.TELEMETRY_SLACK_ENABLED = 'true';
  process.env.TELEMETRY_SLACK_WEBHOOK_URL = 'https://hooks.slack.test/services/abc';
  process.env.TELEMETRY_SLACK_CHANNEL = '#security-alerts';

  process.env.TELEMETRY_SMTP_ENABLED = 'true';
  process.env.TELEMETRY_SMTP_HOST = 'smtp.test.local';
  process.env.TELEMETRY_SMTP_PORT = '465';
  process.env.TELEMETRY_SMTP_USER = 'mailer';
  process.env.TELEMETRY_SMTP_PASSWORD = 'mail-secret';
  process.env.TELEMETRY_SMTP_FROM = 'security@hawkeye.local';
  process.env.TELEMETRY_SMTP_TO = 'security@hawkeye.local';

  process.env.TELEMETRY_PAGERDUTY_ENABLED = 'true';
  process.env.TELEMETRY_PAGERDUTY_ROUTING_KEY = 'pd-routing-key';
  process.env.TELEMETRY_PAGERDUTY_SERVICE_ID = 'svc-123';

  process.env.TELEMETRY_WEBHOOK_ENABLED = 'true';
  process.env.TELEMETRY_WEBHOOK_URL = 'https://hooks.example.test/telemetry';
  process.env.TELEMETRY_WEBHOOK_SECRET = 'webhook-secret';

  process.env.APP_BASE_URL = 'http://localhost:5173';
  process.env.NODE_ENV = 'test';
});

describe('telemetry delivery', () => {
  it('delivers alert notifications to slack, smtp, pagerduty, and webhook', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const { telemetry, settings } = await loadTelemetryModule();
    settings.resetSettingsStoreForTests();

    const results = await telemetry.deliverTelemetryForAlert({ alert: buildAlert('critical') });

    expect(results.map((result: { channel: string }) => result.channel).sort((left, right) => left.localeCompare(right))).toEqual(['pagerduty', 'slack', 'smtp', 'webhook']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(nodemailerMock.createTransport).toHaveBeenCalledTimes(1);
    expect(nodemailerMock.sendMail).toHaveBeenCalledTimes(1);

    const slackRequest = fetchMock.mock.calls[0][1] as RequestInit;
    expect(typeof slackRequest.body).toBe('string');
    expect(JSON.parse(slackRequest.body as string)).toMatchObject({
      channel: '#security-alerts',
      text: 'HawkEye alert: SQL Injection in /login',
    });
  });

  it('skips disabled channels without calling external clients', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const { telemetry, settings } = await loadTelemetryModule();
    settings.resetSettingsStoreForTests();
    await settings.settingsService.updateTelemetry('slack', { enabled: false }, undefined);

    const results = await telemetry.deliverTelemetryForAlert({ alert: buildAlert('critical') });

    expect(results.some((result: { channel: string }) => result.channel === 'slack')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(nodemailerMock.sendMail).toHaveBeenCalledTimes(1);
  });

  it('returns skipped results when delivery env vars are missing', async () => {
    delete process.env.TELEMETRY_SLACK_WEBHOOK_URL;
    delete process.env.TELEMETRY_SMTP_HOST;
    delete process.env.TELEMETRY_SMTP_USER;
    delete process.env.TELEMETRY_SMTP_PASSWORD;
    delete process.env.TELEMETRY_SMTP_FROM;
    delete process.env.TELEMETRY_SMTP_TO;
    delete process.env.TELEMETRY_PAGERDUTY_ROUTING_KEY;
    delete process.env.TELEMETRY_PAGERDUTY_SERVICE_ID;
    delete process.env.TELEMETRY_WEBHOOK_URL;
    delete process.env.TELEMETRY_WEBHOOK_SECRET;

    const { telemetry, settings } = await loadTelemetryModule();
    settings.resetSettingsStoreForTests();

    const results = await telemetry.deliverTelemetryForAlert({ alert: buildAlert('critical') });

    expect(results.every((result: { delivered: boolean; skipped?: boolean }) => result.delivered === false && result.skipped === true)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(nodemailerMock.sendMail).not.toHaveBeenCalled();
  });
});