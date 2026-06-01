import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, rmSync } from 'node:fs';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

import { db } from '../lib/db.js';
import type { JWTPayload } from '../lib/auth.js';

export const DEFAULT_THRESHOLDS = {
  sql_injection: 75,
  brute_force: 50,
  ddos: 85,
  anomaly_cutoff: 60,
  xss: 70,
} as const;

export type ThresholdSettings = Record<keyof typeof DEFAULT_THRESHOLDS, number>;
export type TelemetryConfig = Record<string, unknown>;

const LOCAL_SETTINGS_FILE = path.join(process.cwd(), '.data', 'telemetry-settings.json');

interface TokenRecord {
  id: string;
  name: string;
  tokenHash: string;
  valueMasked: string;
  environment: 'production' | 'staging';
  active: boolean;
  createdAt: string;
  revokedAt?: string | null;
  createdBy?: string | null;
}

interface TelemetryChannelRecord {
  id: string;
  label: string;
  desc: string;
  enabled: boolean;
  config: TelemetryConfig;
  updatedAt: string;
  updatedBy?: string | null;
}

interface AuditRecord {
  id: string;
  action: string;
  actorId?: string | null;
  actorRole?: string | null;
  targetType: string;
  targetId?: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

let memoryTokens: TokenRecord[] = [];
let memoryThresholds: ThresholdSettings = { ...DEFAULT_THRESHOLDS };
let memoryTelemetry: TelemetryChannelRecord[] = cloneTelemetry(buildDefaultTelemetryChannels());
let localTelemetryLoaded = false;

export function resetSettingsStoreForTests(): void {
  memoryTokens = [];
  memoryThresholds = { ...DEFAULT_THRESHOLDS };
  memoryTelemetry = cloneTelemetry(buildDefaultTelemetryChannels());
  localTelemetryLoaded = false;
  try {
    rmSync(LOCAL_SETTINGS_FILE, { force: true });
  } catch {
    // ignore test cleanup errors
  }
}

resetSettingsStoreForTests();

function cloneTelemetry(channels: TelemetryChannelRecord[]): TelemetryChannelRecord[] {
  return channels.map((channel) => ({ ...channel, config: { ...channel.config } }));
}

function parseBooleanEnv(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parseNumberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function maskUrl(value?: string): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return 'configured';
  }
}

function redactConfigValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactConfigValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (/(secret|password|token|key|routingKey)/i.test(key)) {
        return [key, '***REDACTED***'];
      }

      return [key, redactConfigValue(entry)];
    }));
  }

  return value;
}

function buildDefaultTelemetryChannels(): TelemetryChannelRecord[] {
  const slackWebhookUrl = process.env.TELEMETRY_SLACK_WEBHOOK_URL?.trim();
  const slackChannel = process.env.TELEMETRY_SLACK_CHANNEL?.trim() || '#security-alerts';
  const smtpHost = process.env.TELEMETRY_SMTP_HOST?.trim();
  const smtpPort = parseNumberEnv(process.env.TELEMETRY_SMTP_PORT, 587);
  const smtpUser = process.env.TELEMETRY_SMTP_USER?.trim() || '';
  const smtpFrom = process.env.TELEMETRY_SMTP_FROM?.trim() || '';
  const smtpTo = process.env.TELEMETRY_SMTP_TO?.trim() || '';
  const pagerDutyRoutingKey = process.env.TELEMETRY_PAGERDUTY_ROUTING_KEY?.trim();
  const pagerDutyServiceId = process.env.TELEMETRY_PAGERDUTY_SERVICE_ID?.trim() || '';
  const webhookUrl = process.env.TELEMETRY_WEBHOOK_URL?.trim();
  const webhookSecretSet = Boolean(process.env.TELEMETRY_WEBHOOK_SECRET?.trim());

  return [
    {
      id: 'slack',
      label: 'Slack Protocol',
      desc: 'Send critical intel to #security-alerts',
      enabled: parseBooleanEnv(process.env.TELEMETRY_SLACK_ENABLED, false),
      config: {
        channel: slackChannel,
        webhookUrl: maskUrl(slackWebhookUrl),
        webhookUrlSet: Boolean(slackWebhookUrl),
      },
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'smtp',
      label: 'SMTP Digest',
      desc: 'Daily synthesis + immediate critical pings',
      enabled: parseBooleanEnv(process.env.TELEMETRY_SMTP_ENABLED, false),
      config: {
        host: smtpHost || '',
        port: smtpPort,
        user: smtpUser,
        from: smtpFrom,
        to: smtpTo,
        secure: smtpPort === 465,
        passwordSet: Boolean(process.env.TELEMETRY_SMTP_PASSWORD?.trim()),
      },
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'pagerduty',
      label: 'PagerDuty Escalate',
      desc: 'On-call override for critical incidents',
      enabled: parseBooleanEnv(process.env.TELEMETRY_PAGERDUTY_ENABLED, false),
      config: {
        routingKeySet: Boolean(pagerDutyRoutingKey),
        serviceId: pagerDutyServiceId,
      },
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'webhook',
      label: 'Webhook Terminus',
      desc: 'POST to custom origin on new signatures',
      enabled: parseBooleanEnv(process.env.TELEMETRY_WEBHOOK_ENABLED, false),
      config: {
        url: maskUrl(webhookUrl),
        urlSet: Boolean(webhookUrl),
        secretSet: webhookSecretSet,
      },
      updatedAt: new Date().toISOString(),
    },
  ];
}

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function maskToken(value: string): string {
  if (value.length <= 12) {
    return `${value.slice(0, 4)}••••${value.slice(-2)}`;
  }

  return `${value.slice(0, 12)}••••${value.slice(-4)}`;
}

function normalizeEnvironment(environment?: string): 'production' | 'staging' {
  return environment === 'staging' ? 'staging' : 'production';
}

function isThresholdKey(key: string): key is keyof typeof DEFAULT_THRESHOLDS {
  return key in DEFAULT_THRESHOLDS;
}

function validateThresholds(input: Record<string, unknown>): ThresholdSettings {
  const keys = Object.keys(DEFAULT_THRESHOLDS);
  const providedKeys = Object.keys(input);

  if (providedKeys.length !== keys.length || !keys.every((key) => key in input)) {
    throw new Error(`thresholds must include: ${keys.join(', ')}`);
  }

  const validated = {} as ThresholdSettings;

  for (const key of keys) {
    const raw = input[key];
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > 100) {
      throw new Error(`${key} must be an integer between 0 and 100`);
    }
    if (isThresholdKey(key)) {
      validated[key] = raw;
    }
  }

  return validated;
}

function publicToken(token: TokenRecord) {
  return {
    id: token.id,
    name: token.name,
    valueMasked: token.valueMasked,
    active: token.active,
    createdAt: token.createdAt,
  };
}

function toPublicChannel(channel: TelemetryChannelRecord) {
  return {
    id: channel.id,
    label: channel.label,
    desc: channel.desc,
    enabled: channel.enabled,
    config: redactConfigValue(channel.config) as TelemetryConfig,
  };
}

async function loadLocalTelemetryState(): Promise<void> {
  if (db || localTelemetryLoaded) {
    return;
  }

  localTelemetryLoaded = true;
  try {
    if (!existsSync(LOCAL_SETTINGS_FILE)) {
      return;
    }

    const raw = await readFile(LOCAL_SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as { telemetry?: TelemetryChannelRecord[] };
    if (Array.isArray(parsed.telemetry)) {
      memoryTelemetry = cloneTelemetry(parsed.telemetry.map((channel) => ({
        ...channel,
        config: typeof channel.config === 'object' && channel.config ? { ...(channel.config as Record<string, unknown>) } : {},
      })));
    }
  } catch (error) {
    console.warn('[SETTINGS] Could not load local telemetry state:', error instanceof Error ? error.message : String(error));
  }
}

async function persistLocalTelemetryState(): Promise<void> {
  if (db) {
    return;
  }

  const dir = path.dirname(LOCAL_SETTINGS_FILE);
  await mkdir(dir, { recursive: true });
  const tmpFile = `${LOCAL_SETTINGS_FILE}.tmp`;
  const payload = JSON.stringify({ telemetry: memoryTelemetry }, null, 2);
  await writeFile(tmpFile, payload, 'utf8');
  await rename(tmpFile, LOCAL_SETTINGS_FILE);
}

async function audit(action: string, actor: JWTPayload | undefined, targetType: string, targetId?: string, details: Record<string, unknown> = {}): Promise<void> {
  const record: AuditRecord = {
    id: randomUUID(),
    action,
    actorId: actor?.userId ?? null,
    actorRole: actor?.role ?? null,
    targetType,
    targetId: targetId ?? null,
    details,
    createdAt: new Date().toISOString(),
  };

  console.info('[AUDIT]', record.action, record.targetType, record.targetId ?? '', record.actorId ?? 'system');

  if (!db) {
    return;
  }

  await db.$executeRawUnsafe(
    `INSERT INTO settings_audit_logs (id, action, actor_id, actor_role, target_type, target_id, details, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz)`,
    record.id,
    record.action,
    record.actorId,
    record.actorRole,
    record.targetType,
    record.targetId,
    JSON.stringify(record.details),
    record.createdAt,
  );
}

async function queryTokens(): Promise<Array<ReturnType<typeof publicToken>>> {
  if (!db) {
    return [...memoryTokens]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(publicToken);
  }

  const rows = (await db.$queryRawUnsafe(
    `SELECT id, name, value_masked AS "valueMasked", active, created_at AS "createdAt"
     FROM api_tokens
     ORDER BY created_at DESC`,
  )) as Array<{ id: string; name: string; valueMasked: string; active: boolean; createdAt: Date | string }>;

  return rows.map((row: { id: string; name: string; valueMasked: string; active: boolean; createdAt: Date | string }) => ({
    id: row.id,
    name: row.name,
    valueMasked: row.valueMasked,
    active: row.active,
    createdAt: new Date(row.createdAt).toISOString(),
  }));
}

async function createTokenRecord(name: string, environment: 'production' | 'staging', actor: JWTPayload | undefined) {
  const id = randomUUID();
  const rawToken = `hk_${environment === 'production' ? 'prod' : 'stag'}_${randomBytes(24).toString('hex')}`;
  const createdAt = new Date().toISOString();
  const token: TokenRecord = {
    id,
    name,
    tokenHash: hashToken(rawToken),
    valueMasked: maskToken(rawToken),
    environment,
    active: true,
    createdAt,
    createdBy: actor?.userId ?? null,
  };

  if (db) {
    await db.$executeRawUnsafe(
      `INSERT INTO api_tokens (id, name, token_hash, value_masked, environment, active, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7::timestamptz)`,
      token.id,
      token.name,
      token.tokenHash,
      token.valueMasked,
      token.environment,
      token.createdBy,
      token.createdAt,
    );
  } else {
    memoryTokens.unshift(token);
  }

  await audit('settings.token.created', actor, 'api_token', token.id, { name, environment });

  return {
    id: token.id,
    name: token.name,
    token: rawToken,
    createdAt: token.createdAt,
  };
}

async function revokeTokenRecord(id: string, actor: JWTPayload | undefined): Promise<boolean> {
  if (db) {
    const rows = (await db.$queryRawUnsafe(
      `UPDATE api_tokens
       SET active = false, revoked_at = now()
       WHERE id = $1
       RETURNING id`,
      id,
    )) as Array<{ id: string }>;

    if (rows.length === 0) {
      return false;
    }
  } else {
    const token = memoryTokens.find((entry) => entry.id === id);
    if (!token) {
      return false;
    }
    token.active = false;
    token.revokedAt = new Date().toISOString();
  }

  await audit('settings.token.revoked', actor, 'api_token', id);
  return true;
}

async function getThresholdSettings(): Promise<ThresholdSettings> {
  if (!db) {
    return { ...memoryThresholds };
  }

  const rows = (await db.$queryRawUnsafe(
    `SELECT thresholds FROM setting_thresholds WHERE id = 'global' LIMIT 1`,
  )) as Array<{ thresholds: ThresholdSettings }>;

  if (rows.length === 0 || !rows[0]?.thresholds) {
    return { ...DEFAULT_THRESHOLDS };
  }

  return rows[0].thresholds;
}

async function updateThresholdSettings(input: Record<string, unknown>, actor: JWTPayload | undefined): Promise<ThresholdSettings> {
  const thresholds = validateThresholds(input);

  if (db) {
    await db.$executeRawUnsafe(
      `INSERT INTO setting_thresholds (id, thresholds, updated_by, updated_at)
       VALUES ('global', $1::jsonb, $2, now())
       ON CONFLICT (id)
       DO UPDATE SET thresholds = EXCLUDED.thresholds, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      JSON.stringify(thresholds),
      actor?.userId ?? null,
    );
  } else {
    memoryThresholds = thresholds;
  }

  await audit('settings.thresholds.updated', actor, 'thresholds', 'global', thresholds);
  return thresholds;
}

async function listTelemetryChannels(): Promise<Array<{ id: string; label: string; desc: string; enabled: boolean; config: TelemetryConfig }>> {
  if (!db) {
    await loadLocalTelemetryState();
    return memoryTelemetry.map(toPublicChannel);
  }

  const rows = (await db.$queryRawUnsafe(
    `SELECT id, label, description AS "desc", enabled, config
     FROM telemetry_channels
     ORDER BY label ASC`,
  )) as Array<{ id: string; label: string; desc: string; enabled: boolean; config: TelemetryConfig }>;

  return rows.map((row: { id: string; label: string; desc: string; enabled: boolean; config: TelemetryConfig }) => ({
    id: row.id,
    label: row.label,
    desc: row.desc,
    enabled: row.enabled,
    config: row.config ?? {},
  }));
}

async function updateTelemetryChannel(id: string, payload: { enabled?: boolean; config?: TelemetryConfig }, actor: JWTPayload | undefined) {
  let channel: TelemetryChannelRecord | undefined;

  if (db) {
    const rows = (await db.$queryRawUnsafe(
      `SELECT id, label, description AS "desc", enabled, config, updated_at AS "updatedAt", updated_by AS "updatedBy"
       FROM telemetry_channels
       WHERE id = $1
       LIMIT 1`,
      id,
    )) as Array<TelemetryChannelRecord>;

    channel = rows[0];
  } else {
    await loadLocalTelemetryState();
    channel = memoryTelemetry.find((entry) => entry.id === id);
  }

  if (!channel) {
    return null;
  }

  const nextEnabled = typeof payload.enabled === 'boolean' ? payload.enabled : channel.enabled;
  const nextConfig = payload.config ? { ...channel.config, ...payload.config } : channel.config;
  const updatedAt = new Date().toISOString();

  if (db) {
    const rows = (await db.$queryRawUnsafe(
      `UPDATE telemetry_channels
       SET enabled = $2, config = $3::jsonb, updated_by = $4, updated_at = now()
       WHERE id = $1
       RETURNING id, label, description AS "desc", enabled, config, updated_at AS "updatedAt", updated_by AS "updatedBy"`,
      id,
      nextEnabled,
      JSON.stringify(nextConfig),
      actor?.userId ?? null,
    )) as Array<TelemetryChannelRecord>;

    channel = rows[0];
  } else {
    channel.enabled = nextEnabled;
    channel.config = nextConfig;
    channel.updatedAt = updatedAt;
    channel.updatedBy = actor?.userId ?? null;
    await persistLocalTelemetryState();
  }

  await audit('settings.telemetry.updated', actor, 'telemetry_channel', id, { enabled: nextEnabled, config: nextConfig });

  return channel
    ? {
        id: channel.id,
        label: channel.label,
        desc: channel.desc,
        enabled: channel.enabled,
        config: channel.config,
      }
    : null;
}

export const settingsService = {
  listTokens: queryTokens,
  createToken: createTokenRecord,
  revokeToken: revokeTokenRecord,
  getThresholds: getThresholdSettings,
  updateThresholds: updateThresholdSettings,
  listTelemetry: listTelemetryChannels,
  updateTelemetry: updateTelemetryChannel,
};