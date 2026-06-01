import { createHmac } from 'node:crypto';

import nodemailer from 'nodemailer';

import type { Alert, Threat } from '../types/index.js';
import { settingsService } from './settings.js';
import { redactSecret, redactUrl } from './telemetryDefaults.js';

export interface DeliveryResult {
  channel: string;
  delivered: boolean;
  skipped?: boolean;
  reason?: string;
  statusCode?: number;
}

export interface AlertDigest {
  subject: string;
  alerts: Alert[];
  generatedAt?: string;
}

type AlertPayload = {
  alert: Alert;
  threat?: Threat;
};

interface TelemetryChannelView {
  id: string;
  label: string;
  desc: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

function buildAlertSummary(payload: AlertPayload) {
  const { alert, threat } = payload;
  return {
    title: alert.name,
    severity: alert.severity,
    timestamp: alert.timestamp,
    source: threat?.sourceIp ?? alert.sourceIp,
    endpoint: alert.endpoint,
    attackType: alert.attackType,
    status: alert.status,
    alertId: alert.id,
    threatId: alert.threatId,
    appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5173',
    nodeEnv: process.env.NODE_ENV ?? 'development',
  };
}

function isCritical(alert: Alert): boolean {
  return alert.severity === 'critical';
}

function isHighOrCritical(alert: Alert): boolean {
  return alert.severity === 'high' || alert.severity === 'critical';
}

function getEnabledChannel(channels: TelemetryChannelView[], channelId: string): TelemetryChannelView | undefined {
  return channels.find((channel) => channel.id === channelId && channel.enabled);
}

function missingFieldList(values: Array<[string, boolean]>): string[] {
  const fields: string[] = [];
  for (const [field, missing] of values) {
    if (missing) {
      fields.push(field);
    }
  }
  return fields;
}

function missingConfig(channel: string, fields: string[]): DeliveryResult {
  const message = `${channel} missing env: ${fields.join(', ')}`;
  console.warn(`[Telemetry] ${message}`);
  return { channel, delivered: false, skipped: true, reason: message };
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function sendSlackAlert(payload: AlertPayload): Promise<DeliveryResult> {
  const webhookUrl = process.env.TELEMETRY_SLACK_WEBHOOK_URL?.trim();
  const channel = process.env.TELEMETRY_SLACK_CHANNEL?.trim() ?? '#security-alerts';

  if (webhookUrl === undefined || webhookUrl.length === 0) {
    const fields = ['TELEMETRY_SLACK_WEBHOOK_URL'];
    return missingConfig('slack', fields);
  }

  const summary = buildAlertSummary(payload);
  console.log(`[Telemetry] Slack delivery attempt -> ${redactUrl(webhookUrl)}`);

  const response = await postJson(webhookUrl, {
    channel,
    username: 'HawkEye',
    icon_emoji: ':shield:',
    text: `HawkEye alert: ${summary.title}`,
    attachments: [
      {
        color: summary.severity === 'critical' ? 'danger' : 'warning',
        fields: [
          { title: 'Severity', value: summary.severity, short: true },
          { title: 'Timestamp', value: summary.timestamp, short: true },
          { title: 'Source', value: summary.source, short: true },
          { title: 'Endpoint', value: summary.endpoint, short: false },
        ],
      },
    ],
  });

  if (response.ok === false) {
    const text = await response.text().catch(() => '');
    console.error(`[Telemetry] Slack delivery failed (${response.status}): ${text}`);
    return { channel: 'slack', delivered: false, statusCode: response.status, reason: text || response.statusText };
  }

  console.log('[Telemetry] Slack delivery succeeded');
  return { channel: 'slack', delivered: true, statusCode: response.status };
}

async function sendWebhookAlert(payload: AlertPayload): Promise<DeliveryResult> {
  const endpoint = process.env.TELEMETRY_WEBHOOK_URL?.trim();
  if (endpoint === undefined || endpoint.length === 0) {
    return missingConfig('webhook', ['TELEMETRY_WEBHOOK_URL']);
  }

  const secret = process.env.TELEMETRY_WEBHOOK_SECRET?.trim();
  const summary = buildAlertSummary(payload);
  const body = JSON.stringify({
    source: 'hawkeye',
    event: 'alert',
    alert: summary,
  });

  const headers: Record<string, string> = {};
  if (secret) {
    headers['X-HawkEye-Signature'] = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  }

  console.log(`[Telemetry] Webhook delivery attempt -> ${redactUrl(endpoint)}`);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body,
  });

  if (response.ok === false) {
    const text = await response.text().catch(() => '');
    console.error(`[Telemetry] Webhook delivery failed (${response.status}): ${text}`);
    return { channel: 'webhook', delivered: false, statusCode: response.status, reason: text || response.statusText };
  }

  console.log('[Telemetry] Webhook delivery succeeded');
  return { channel: 'webhook', delivered: true, statusCode: response.status };
}

async function sendPagerDutyAlert(payload: AlertPayload): Promise<DeliveryResult> {
  const routingKey = process.env.TELEMETRY_PAGERDUTY_ROUTING_KEY?.trim();
  const serviceId = process.env.TELEMETRY_PAGERDUTY_SERVICE_ID?.trim();
  if (routingKey === undefined || routingKey.length === 0 || serviceId === undefined || serviceId.length === 0) {
    const fields = missingFieldList([
      ['TELEMETRY_PAGERDUTY_ROUTING_KEY', routingKey === undefined || routingKey.length === 0],
      ['TELEMETRY_PAGERDUTY_SERVICE_ID', serviceId === undefined || serviceId.length === 0],
    ]);
    return missingConfig('pagerduty', fields);
  }

  const summary = buildAlertSummary(payload);
  const endpoint = 'https://events.pagerduty.com/v2/enqueue';
  console.log(`[Telemetry] PagerDuty delivery attempt -> service ${redactSecret(serviceId)}`);

  const response = await postJson(endpoint, {
    routing_key: routingKey,
    event_action: 'trigger',
    dedup_key: summary.alertId,
    payload: {
      summary: summary.title,
      source: summary.source,
      severity: summary.severity,
      timestamp: summary.timestamp,
      component: 'HawkEye',
      group: 'Security Alerts',
      custom_details: {
        endpoint: summary.endpoint,
        attackType: summary.attackType,
        service_id: serviceId,
        appBaseUrl: summary.appBaseUrl,
      },
    },
  });

  if (response.ok === false) {
    const text = await response.text().catch(() => '');
    console.error(`[Telemetry] PagerDuty delivery failed (${response.status}): ${text}`);
    return { channel: 'pagerduty', delivered: false, statusCode: response.status, reason: text || response.statusText };
  }

  console.log('[Telemetry] PagerDuty delivery succeeded');
  return { channel: 'pagerduty', delivered: true, statusCode: response.status };
}

async function sendCriticalEmailAlert(payload: AlertPayload): Promise<DeliveryResult> {
  const host = process.env.TELEMETRY_SMTP_HOST?.trim();
  const port = Number.parseInt(process.env.TELEMETRY_SMTP_PORT ?? '587', 10);
  const user = process.env.TELEMETRY_SMTP_USER?.trim();
  const password = process.env.TELEMETRY_SMTP_PASSWORD?.trim();
  const from = process.env.TELEMETRY_SMTP_FROM?.trim();
  const to = process.env.TELEMETRY_SMTP_TO?.trim();

  if (host === undefined || host.length === 0 || user === undefined || user.length === 0 || password === undefined || password.length === 0 || from === undefined || from.length === 0 || to === undefined || to.length === 0) {
    const fields = missingFieldList([
      ['TELEMETRY_SMTP_HOST', host === undefined || host.length === 0],
      ['TELEMETRY_SMTP_USER', user === undefined || user.length === 0],
      ['TELEMETRY_SMTP_PASSWORD', password === undefined || password.length === 0],
      ['TELEMETRY_SMTP_FROM', from === undefined || from.length === 0],
      ['TELEMETRY_SMTP_TO', to === undefined || to.length === 0],
    ]);
    return missingConfig('smtp', fields);
  }

  const summary = buildAlertSummary(payload);
  const transport = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure: Number.isFinite(port) && port === 465,
    auth: { user, pass: password },
    requireTLS: false,
    tls: { rejectUnauthorized: false },
  });

  console.log(`[Telemetry] SMTP alert delivery attempt -> ${from} to ${to}`);
  await transport.sendMail({
    from,
    to,
    subject: `[HawkEye] Critical alert: ${summary.title}`,
    text: JSON.stringify(summary, null, 2),
  });

  console.log('[Telemetry] SMTP alert delivery succeeded');
  return { channel: 'smtp', delivered: true };
}

export async function sendSmtpDigest(digest: AlertDigest): Promise<DeliveryResult> {
  const host = process.env.TELEMETRY_SMTP_HOST?.trim();
  const port = Number.parseInt(process.env.TELEMETRY_SMTP_PORT ?? '587', 10);
  const user = process.env.TELEMETRY_SMTP_USER?.trim();
  const password = process.env.TELEMETRY_SMTP_PASSWORD?.trim();
  const from = process.env.TELEMETRY_SMTP_FROM?.trim();
  const to = process.env.TELEMETRY_SMTP_TO?.trim();

  if (host === undefined || host.length === 0 || user === undefined || user.length === 0 || password === undefined || password.length === 0 || from === undefined || from.length === 0 || to === undefined || to.length === 0) {
    const fields = missingFieldList([
      ['TELEMETRY_SMTP_HOST', host === undefined || host.length === 0],
      ['TELEMETRY_SMTP_USER', user === undefined || user.length === 0],
      ['TELEMETRY_SMTP_PASSWORD', password === undefined || password.length === 0],
      ['TELEMETRY_SMTP_FROM', from === undefined || from.length === 0],
      ['TELEMETRY_SMTP_TO', to === undefined || to.length === 0],
    ]);
    return missingConfig('smtp', fields);
  }

  const transport = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure: Number.isFinite(port) && port === 465,
    auth: { user, pass: password },
    requireTLS: false,
    tls: { rejectUnauthorized: false },
  });

  const lines = digest.alerts.map((alert) => `- [${alert.severity}] ${alert.name} @ ${alert.endpoint} from ${alert.sourceIp}`).join('\n');
  await transport.sendMail({
    from,
    to,
    subject: digest.subject,
    text: [
      `Generated: ${digest.generatedAt ?? new Date().toISOString()}`,
      '',
      lines || 'No alerts in digest window.',
    ].join('\n'),
  });

  return { channel: 'smtp', delivered: true };
}

export async function deliverTelemetryForAlert(payload: AlertPayload): Promise<DeliveryResult[]> {
  const channels = await settingsService.listTelemetry();
  const results: DeliveryResult[] = [];

  if (!isHighOrCritical(payload.alert)) {
    console.log('[Telemetry] Alert below delivery threshold — skipping external notifications');
    return results;
  }

  const slack = getEnabledChannel(channels, 'slack');
  if (slack) {
    results.push(await sendSlackAlert(payload));
  }

  const webhook = getEnabledChannel(channels, 'webhook');
  if (webhook) {
    results.push(await sendWebhookAlert(payload));
  }

  const pagerDuty = getEnabledChannel(channels, 'pagerduty');
  if (pagerDuty && isCritical(payload.alert)) {
    results.push(await sendPagerDutyAlert(payload));
  }

  const smtp = getEnabledChannel(channels, 'smtp');
  if (smtp && isCritical(payload.alert)) {
    results.push(await sendCriticalEmailAlert(payload));
  }

  return results;
}
