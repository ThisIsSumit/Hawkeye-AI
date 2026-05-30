// ─── Core domain types ──────────────────────────────────────────────────────

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type ThreatStatus = 'active' | 'blocked' | 'resolved' | 'investigating';
export type AttackType =
  | 'SQL Injection'
  | 'XSS'
  | 'DDoS'
  | 'Brute Force'
  | 'Path Traversal'
  | 'SSRF'
  | 'Command Injection'
  | 'CSRF';

export type ReportType = 'Daily Summary' | 'Incident' | 'Compliance' | 'Weekly Threat Intel';
export type ReportStatus = 'ready' | 'generating' | 'failed';

export interface Report {
  id: string;
  title: string;
  type: ReportType;
  status: ReportStatus;
  generatedAt: string;
  author: string;
  sizeKb: number;
}

export interface Threat {
  id: string;
  timestamp: string;        // ISO-8601
  userId?: string;          // User who submitted this threat (empty if system/seeded)
  sourceIp: string;
  country: string;
  countryCode: string;
  attackType: AttackType;
  endpoint: string;
  severity: Severity;
  status: ThreatStatus;
  attempts: number;
  asn: string;
  userAgent: string;
}

export interface Alert {
  id: string;
  threatId: string;
  name: string;
  sourceIp: string;
  endpoint: string;
  severity: Severity;
  status: ThreatStatus;
  assignedTo: string;
  timestamp: string;
  attackType: AttackType;
}

export interface AnalyticsSummary {
  totalEvents: number;
  activeThreats: number;
  criticalAlerts: number;
  blockedIPs: number;
  blockRate: number;
  trendData: TrendPoint[];
  attackDistribution: AttackDistPoint[];
  topAttackingIPs: TopIP[];
}

export interface TrendPoint {
  label: string;
  critical: number;
  high: number;
  medium: number;
}

export interface AttackDistPoint {
  type: AttackType;
  count: number;
  percentage: number;
}

export interface TopIP {
  ip: string;
  country: string;
  countryCode: string;
  attempts: number;
  lastSeen: string;
  severity: Severity;
}

// ─── SSE / WebSocket event types ────────────────────────────────────────────

export type StreamEventType =
  | 'threat:new'
  | 'threat:updated'
  | 'alert:new'
  | 'alert:updated'
  | 'analytics:delta'
  | 'system:heartbeat'
  | 'system:connected';

export interface StreamEvent<T = unknown> {
  id: string;
  type: StreamEventType;
  timestamp: string;
  payload: T;
}

export interface ThreatNewPayload extends Threat {}
export interface AlertNewPayload extends Alert {}
export interface AnalyticsDeltaPayload {
  totalEvents: number;
  activeThreats: number;
  criticalAlerts: number;
  blockedIPs: number;
}

// ─── HTTP API response wrappers ──────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: string;
  code: string;
  timestamp: string;
}
