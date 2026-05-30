import type { AttackType, Severity, Threat } from '../types/index.js';
import { v4 as uuid } from 'uuid';

// ─── Raw log line type ────────────────────────────────────────────────────────

export interface RawLogLine {
  message?: unknown;
  [key: string]: unknown;
}

interface NormalizedLogLine extends RawLogLine {
  message: string;
}

// ─── Pattern definition ────────────────────────────────────────────────────────

interface ThreatPattern {
  regex?: RegExp;
  name: string;
  attackType: AttackType;
  severity: Severity;
  extract?: (message: string) => Partial<RawLogLine> | null;
}

// ─── Threat patterns ──────────────────────────────────────────────────────────

const PATTERNS: ThreatPattern[] = [
  {
    name: 'SQL Injection — UNION SELECT',
    regex: /union.*select/i,
    attackType: 'SQL Injection',
    severity: 'critical',
  },
  {
    name: 'SQL Injection — DROP TABLE',
    regex: /drop.*table/i,
    attackType: 'SQL Injection',
    severity: 'critical',
  },
  {
    name: 'SQL Injection — Time-based',
    regex: /sleep\s*\(|benchmark\s*\(/i,
    attackType: 'SQL Injection',
    severity: 'critical',
  },
  {
    name: 'Path Traversal — Directory escape',
    regex: /\.\.\//i,
    attackType: 'Path Traversal',
    severity: 'high',
  },
  {
    name: 'Path Traversal — etc/passwd',
    regex: /\/etc\/passwd/i,
    attackType: 'Path Traversal',
    severity: 'high',
  },
  {
    name: 'XSS — Script Tag',
    regex: /<script/i,
    attackType: 'XSS',
    severity: 'high',
  },
  {
    name: 'XSS — Event Handler',
    regex: /onerror\s*=/i,
    attackType: 'XSS',
    severity: 'high',
  },
  {
    name: 'Command Injection — Shell',
    regex: /(;|&&|\|\|)\s*(bash|sh|wget)/i,
    attackType: 'Command Injection',
    severity: 'critical',
  },
  {
    name: 'SSRF — Metadata Service',
    regex: /169\.254\.169\.254/i,
    attackType: 'SSRF',
    severity: 'high',
  },
  {
    name: 'SSRF — Localhost',
    regex: /localhost|127\.0\.0\.1/i,
    attackType: 'SSRF',
    severity: 'high',
  },
  {
    name: 'Brute Force — Threshold Reached',
    attackType: 'Brute Force',
    severity: 'medium',
  },
  {
    name: 'DDoS — Port Scan Tool',
    regex: /nmap|masscan|shodan/i,
    attackType: 'DDoS',
    severity: 'high',
  },
];

// ─── Parse function ───────────────────────────────────────────────────────────

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function pushDefined(target: string[], ...values: Array<string | undefined>): void {
  for (const value of values) {
    if (value) target.push(value);
  }
}

function detectSourceType(raw: RawLogLine): string {
  const fields = asRecord(raw.fields);
  const sourceCandidates = [
    asString(raw.source),
    asString(raw.logType),
    asString(raw.provider),
    asString(fields?.source),
  ];

  return sourceCandidates.find(Boolean)?.toLowerCase() ?? 'generic';
}

function normalizeRaw(raw: RawLogLine): NormalizedLogLine {
  const httpRequest = asRecord(raw.httpRequest);
  const fields = asRecord(raw.fields);

  const sourceType = detectSourceType(raw);
  const sourceIp = asString(raw.sourceIp)
    ?? asString(raw.ip)
    ?? asString(raw.client_ip)
    ?? asString(raw.remote_addr)
    ?? asString(raw.src_ip)
    ?? asString(raw.src)
    ?? asString(httpRequest?.clientIp)
    ?? asString(fields?.ip);

  const endpoint = asString(raw.path)
    ?? asString(raw.endpoint)
    ?? asString(raw.uri)
    ?? asString(raw.request_uri)
    ?? asString(httpRequest?.path);

  const method = asString(raw.method)
    ?? asString(httpRequest?.method);

  const status = asNumber(raw.status)
    ?? asNumber(raw.status_code)
    ?? asNumber(httpRequest?.status);

  const userAgent = asString(raw.ua)
    ?? asString(raw.userAgent)
    ?? asString(raw.user_agent)
    ?? asString(httpRequest?.userAgent);

  const baseMessage = asString(raw.message)
    ?? [method, endpoint, typeof status === 'number' ? String(status) : undefined].filter(Boolean).join(' ')
    ?? '';

  const parts = [baseMessage, sourceType];
  if (sourceType.includes('nginx') || sourceType.includes('apache')) {
    pushDefined(parts, asString(raw.query), asString(raw.request));
  }
  if (sourceType.includes('auth')) {
    pushDefined(parts, asString(raw.event), asString(raw.outcome), asString(raw.reason), asString(raw.username));
  }
  if (sourceType.includes('waf')) {
    pushDefined(parts, asString(raw.rule), asString(raw.action), asString(raw.attack), asString(raw.signature));
  }
  if (sourceType.includes('firewall') || sourceType.includes('ufw') || sourceType.includes('snort') || sourceType.includes('suricata') || sourceType.includes('ids')) {
    pushDefined(parts, asString(raw.action), asString(raw.proto), asString(raw.signature), asString(raw.category));
  }
  if (sourceType.includes('guardduty') || sourceType.includes('cloudtrail')) {
    pushDefined(parts, asString(raw.findingType), asString(raw.apiCall), asString(raw.serviceName), asString(raw.resource));
  }

  return {
    ...raw,
    message: parts.filter(Boolean).join(' '),
    sourceIp: sourceIp ?? raw.sourceIp,
    path: endpoint ?? raw.path,
    method: method ?? raw.method,
    status: status ?? raw.status,
    ua: userAgent ?? raw.ua,
    country: asString(raw.country) ?? asString((fields?.geo as Record<string, unknown> | undefined)?.country_name) ?? raw.country,
    countryCode: asString(raw.countryCode) ?? asString(raw.country_code) ?? raw.countryCode,
    asn: asString(raw.asn) ?? asString((fields?.geo as Record<string, unknown> | undefined)?.asn) ?? raw.asn,
    request_count: asNumber(raw.request_count) ?? raw.request_count,
    failed_logins: asNumber(raw.failed_logins) ?? raw.failed_logins,
  };
}

function detectBruteForceThreat(normalized: NormalizedLogLine, message: string): Threat | null {
  const statusReg = /(401|403)/;
  const statusMatch = statusReg.exec(message)
    ?? (typeof normalized.status === 'number' && (normalized.status === 401 || normalized.status === 403)
      ? [String(normalized.status), String(normalized.status)]
      : null);
  const authFailureSignal = /failed password|authentication failure|invalid user|login failed|token abuse/i.test(message);
  if (!statusMatch && !authFailureSignal) return null;

  const ipReg = /(\d+\.\d+\.\d+\.\d+)/;
  const msgIp = ipReg.exec(message)?.[1];
  const rawIp = typeof normalized.sourceIp === 'string' ? normalized.sourceIp : undefined;
  const sourceIp = rawIp ?? msgIp;
  if (!sourceIp) return null;

  recordFailure(sourceIp);
  const failures = getFailureCount(sourceIp);
  if (failures < 5) return null;

  const bruteForcePattern: ThreatPattern = {
    name: 'Brute Force — Threshold Reached',
    attackType: 'Brute Force',
    severity: 'medium',
  };

  return buildThreat(normalized, bruteForcePattern, {
    sourceIp,
    attempts: failures,
    status: statusMatch?.[1] ?? 'auth-failure',
  });
}

function matchSignatureThreat(normalized: NormalizedLogLine, message: string): Threat | null {
  for (const pattern of PATTERNS) {
    if (pattern.attackType === 'Brute Force') continue;
    if (!pattern.regex?.test(message)) continue;

    const extracted = pattern.extract?.(message) ?? {};
    return buildThreat(normalized, pattern, extracted);
  }

  return null;
}

export function parse(raw: RawLogLine): Threat | null {
  const normalized = normalizeRaw(raw);
  if (!normalized.message) return null;

  const message = normalized.message;
  const bruteForceThreat = detectBruteForceThreat(normalized, message);
  if (bruteForceThreat) return bruteForceThreat;

  return matchSignatureThreat(normalized, message);
}

// ─── Build threat object ──────────────────────────────────────────────────────

function resolveSourceIp(raw: RawLogLine, extracted: Partial<RawLogLine>): string {
  const candidate = extracted.sourceIp ?? raw.sourceIp;
  if (typeof candidate === 'string' && candidate && candidate !== '0.0.0.0') {
    return candidate;
  }

  const ipReg = /(\d+\.\d+\.\d+\.\d+)/;
  const ipMatch = ipReg.exec(String(raw.message));
  return ipMatch?.[1] ?? '0.0.0.0';
}

function resolveAttempts(raw: RawLogLine, extracted: Partial<RawLogLine>): number {
  if (typeof extracted.attempts === 'number') {
    return extracted.attempts;
  }

  if (typeof raw.request_count === 'number') {
    return raw.request_count;
  }

  if (typeof raw.failed_logins === 'number') {
    return raw.failed_logins;
  }

  return 1;
}

function buildThreat(
  raw: RawLogLine,
  pattern: ThreatPattern,
  extracted: Partial<RawLogLine> = {},
): Threat {
  const sourceIp = resolveSourceIp(raw, extracted);
  const attempts = resolveAttempts(raw, extracted);
  const now = new Date().toISOString();

  return {
    id: `THR-${Date.now()}-${uuid().slice(0, 8)}`,
    timestamp: now,
    sourceIp,
    country: typeof raw.country === 'string' ? raw.country : 'Unknown',
    countryCode: typeof raw.countryCode === 'string' ? raw.countryCode : 'UN',
    asn: typeof raw.asn === 'string' ? raw.asn : 'Unknown',
    attackType: pattern.attackType,
    endpoint: typeof raw.path === 'string' ? raw.path : '/unknown',
    severity: pattern.severity,
    status: 'active',
    attempts,
    userAgent: typeof raw.ua === 'string' ? raw.ua : '',
  };
}

/**
 * Heuristic: count failed logins/401s per IP in time window
 * (simple in-memory cache for demo; use Redis in production)
 */
const failureCache = new Map<string, { count: number; timestamp: number }>();

export function recordFailure(ip: string): void {
  const now = Date.now();
  const cached = failureCache.get(ip);

  if (cached && now - cached.timestamp < 60000) {
    // Within 60s window
    cached.count++;
  } else {
    failureCache.set(ip, { count: 1, timestamp: now });
  }

  // Clean old entries every 1000 calls
  if (failureCache.size > 1000) {
    for (const [key, val] of failureCache.entries()) {
      if (now - val.timestamp > 300000) {
        failureCache.delete(key);
      }
    }
  }
}

export function getFailureCount(ip: string): number {
  const cached = failureCache.get(ip);
  if (!cached) return 0;
  if (Date.now() - cached.timestamp > 60000) {
    failureCache.delete(ip);
    return 0;
  }
  return cached.count;
}

export function resetParserStateForTests(): void {
  failureCache.clear();
}

