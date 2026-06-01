export interface TelemetryChannelState {
  id: string;
  label: string;
  desc: string;
  enabled: boolean;
  config: Record<string, unknown>;
  updatedAt: string;
  updatedBy?: string | null;
}

export function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function redactSecret(value: string | undefined, fallback = 'not-configured'): string {
  if (!value) return fallback;
  return value.length <= 8 ? '••••' : `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export function redactUrl(value: string | undefined, fallback = 'not-configured'): string {
  if (!value) return fallback;

  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return value.length <= 12 ? '••••' : `${value.slice(0, 8)}••••${value.slice(-4)}`;
  }
}

export function buildDefaultTelemetryChannels(): TelemetryChannelState[] {
  const slackChannel = process.env.TELEMETRY_SLACK_CHANNEL?.trim() || '#security-alerts';
  const smtpHost = process.env.TELEMETRY_SMTP_HOST?.trim() || 'smtp.example.invalid';
  const smtpPort = Number.parseInt(process.env.TELEMETRY_SMTP_PORT ?? '587', 10) || 587;
  const smtpUser = process.env.TELEMETRY_SMTP_USER?.trim() || 'smtp-user';
  const smtpFrom = process.env.TELEMETRY_SMTP_FROM?.trim() || 'security@hawkeye.local';
  const smtpTo = process.env.TELEMETRY_SMTP_TO?.trim() || 'security@hawkeye.local';
  const pagerDutyServiceId = process.env.TELEMETRY_PAGERDUTY_SERVICE_ID?.trim() || 'security-service';
  const webhookUrl = process.env.TELEMETRY_WEBHOOK_URL?.trim() || 'https://example.invalid/hawkeye';

  return [
    {
      id: 'slack',
      label: 'Slack Protocol',
      desc: 'Send critical intel to #security-alerts',
      enabled: parseBooleanEnv(process.env.TELEMETRY_SLACK_ENABLED, true),
      config: {
        channel: slackChannel,
        webhookUrl: redactUrl(process.env.TELEMETRY_SLACK_WEBHOOK_URL),
        webhookConfigured: Boolean(process.env.TELEMETRY_SLACK_WEBHOOK_URL),
      },
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'smtp',
      label: 'SMTP Digest',
      desc: 'Daily synthesis + immediate critical pings',
      enabled: parseBooleanEnv(process.env.TELEMETRY_SMTP_ENABLED, true),
      config: {
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        from: smtpFrom,
        to: smtpTo,
        tls: true,
        credentialsConfigured: Boolean(process.env.TELEMETRY_SMTP_HOST && process.env.TELEMETRY_SMTP_USER && process.env.TELEMETRY_SMTP_PASSWORD),
      },
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'pagerduty',
      label: 'PagerDuty Escalate',
      desc: 'On-call override for critical incidents',
      enabled: parseBooleanEnv(process.env.TELEMETRY_PAGERDUTY_ENABLED, true),
      config: {
        serviceId: pagerDutyServiceId,
        routingKeyConfigured: Boolean(process.env.TELEMETRY_PAGERDUTY_ROUTING_KEY),
      },
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'webhook',
      label: 'Webhook Terminus',
      desc: 'POST to custom origin on new signatures',
      enabled: parseBooleanEnv(process.env.TELEMETRY_WEBHOOK_ENABLED, true),
      config: {
        url: redactUrl(webhookUrl),
        method: 'POST',
        secretConfigured: Boolean(process.env.TELEMETRY_WEBHOOK_SECRET),
      },
      updatedAt: new Date().toISOString(),
    },
  ];
}

export function sanitizeTelemetryConfig(config: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config ?? {})) {
    if (typeof value === 'string' && /password|secret|token|routingkey|webhookurl|webhook_url/i.test(key)) {
      redacted[key] = '••••';
      continue;
    }

    if (typeof value === 'string' && /password|secret|token/i.test(value)) {
      redacted[key] = '••••';
      continue;
    }

    redacted[key] = value;
  }

  return redacted;
}
