import type {
  Threat, Alert, Severity, ThreatStatus, AttackType,
  AnalyticsSummary, TrendPoint, AttackDistPoint, TopIP,
  Report, ReportType,
} from '../types/index.js';
import { db } from '../lib/db.js';
import type { AIAnalysis } from './ai.js';

const ATTACK_TYPES: AttackType[] = [
  'SQL Injection','XSS','DDoS','Brute Force',
  'Path Traversal','SSRF','Command Injection','CSRF',
];
const ANALYSTS = ['Arjun Kumar','Priya Sharma','Dev Mehta','Unassigned'];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export interface ThreatIngestInput {
  id?: string;
  timestamp?: string;
  userId?: string;
  sourceIp: string;
  country?: string;
  countryCode?: string;
  asn?: string;
  attackType: AttackType;
  endpoint: string;
  severity: Severity;
  status?: ThreatStatus;
  attempts?: number;
  userAgent?: string;
}

export class ThreatStore {
  private threats:  Threat[]  = [];
  private alerts:   Alert[]   = [];
  private readonly reports:  Report[]  = [];
  private readonly analyses: Map<string, AIAnalysis> = new Map();
  private totalEvents  = 0;
  private blockedCount = 0;

  private threatToAlert(t: Threat): Alert {
    return {
      id: `ALT-${1000+this.alerts.length}`, threatId: t.id,
      name: `${t.attackType} — ${t.endpoint}`,
      sourceIp: t.sourceIp, endpoint: t.endpoint,
      severity: t.severity, status: t.status,
      assignedTo: pick(ANALYSTS), timestamp: t.timestamp, attackType: t.attackType,
    };
  }

  ingestThreat(input?: ThreatIngestInput): Threat {
    if (!input) {
      throw new Error('ingestThreat requires explicit threat input');
    }

    const t: Threat = {
      id:          input.id ?? `THR-${Date.now()}-${this.threats.length + 1}`,
      timestamp:   input.timestamp ?? new Date().toISOString(),
      userId:      input.userId,
      sourceIp:    input.sourceIp,
      country:     input.country ?? 'Unknown',
      countryCode: input.countryCode ?? 'UN',
      asn:         input.asn ?? 'Unknown',
      attackType:  input.attackType,
      endpoint:    input.endpoint,
      severity:    input.severity,
      status:      input.status ?? 'active',
      attempts:    input.attempts ?? 1,
      userAgent:   input.userAgent ?? '',
    };

    this.threats.unshift(t);
    this.totalEvents += 1;
    if (t.status === 'blocked') this.blockedCount++;
    if (t.severity === 'critical' || t.severity === 'high') {
      this.alerts.unshift(this.threatToAlert(t));
    }

    // Sync with DB for Phase 5 RAG FK constraints
    if (db) {
      db.threat.create({
        data: {
          id:          t.id,
          sourceIp:    t.sourceIp,
          country:     t.country,
          countryCode: t.countryCode,
          asn:         t.asn,
          attackType:  t.attackType,
          endpoint:    t.endpoint,
          severity:    t.severity,
          status:      t.status,
          attempts:    t.attempts,
          userAgent:   t.userAgent,
          timestamp:   new Date(t.timestamp),
        }
      }).catch((err: any) => console.error('[STORE] DB sync failed:', err));
    }

    return t;
  }

  ingestLiveThreat(input: ThreatIngestInput): Threat {
    return this.ingestThreat(input);
  }

  getThreats(userId?: string, page=1, pageSize=20, severity='', type='') {
    // If userId is provided, filter by that user; otherwise return all threats (system view)
    let f = userId 
      ? [...this.threats].filter(t => t.userId === userId)
      : [...this.threats];
    if (severity) f = f.filter(t => t.severity === severity);
    if (type)     f = f.filter(t => t.attackType === type);
    const total = f.length;
    const start = (page-1)*pageSize;
    return { items: f.slice(start, start+pageSize), total, page, pageSize, totalPages: Math.ceil(total/pageSize) };
  }

  getThreatById(userId?: string, id?: string): Threat | undefined {
    // Handle overloaded signature: getThreatById(id) or getThreatById(userId, id)
    let actualUserId: string | undefined;
    let actualId: string;
    
    if (id === undefined) {
      // Called as getThreatById(id) - legacy support
      actualId = userId!;
      actualUserId = undefined;  // System view
    } else {
      // Called as getThreatById(userId, id)
      actualUserId = userId;
      actualId = id;
    }
    
    const threat = this.threats.find(t => t.id === actualId);
    // If userId is provided, only return threat if it belongs to that user or is system (undefined)
    if (actualUserId) {
      return threat?.userId === actualUserId ? threat : undefined;
    }
    return threat;
  }

  getReports(page=1, pageSize=20) {
    let f = [...this.reports];
    const total = f.length;
    const start = (page-1)*pageSize;
    return { items: f.slice(start, start+pageSize), total, page, pageSize, totalPages: Math.ceil(total/pageSize) };
  }

  getReportById(id: string): Report | undefined {
    return this.reports.find((r) => r.id === id);
  }

  generateReport(type: ReportType, title?: string): Report {
    const id = `REP-${Date.now()}-${this.reports.length + 1}`;
    const report: Report = {
      id,
      title: title || `${type} — ${new Date().toISOString().split('T')[0]}`,
      type,
      status: 'ready',
      generatedAt: new Date().toISOString(),
      author: pick(ANALYSTS),
      sizeKb: 0,
    };
    this.reports.unshift(report);
    return report;
  }

  getAlerts(page=1, pageSize=20, status='') {
    let f = [...this.alerts];
    if (status) f = f.filter(a => a.status === status);
    const total = f.length;
    const start = (page-1)*pageSize;
    return { items: f.slice(start, start+pageSize), total, page, pageSize, totalPages: Math.ceil(total/pageSize) };
  }

  storeAnalysis(threatId: string, analysis: AIAnalysis): void {
    this.analyses.set(threatId, analysis);
  }

  getAnalysis(threatId: string): AIAnalysis | undefined {
    return this.analyses.get(threatId);
  }

  async getAnalytics(userId?: string): Promise<AnalyticsSummary> {
    // If userId is provided, filter to only that user's threats; otherwise return system-wide analytics
    const userThreats = userId 
      ? this.threats.filter(t => t.userId === userId)
      : [...this.threats];
    const userAlerts = this.alerts.filter(a => userThreats.some(t => t.id === a.threatId));

    const trendData: TrendPoint[] = [];
    const now = new Date();
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
      const next = new Date(day);
      next.setUTCDate(next.getUTCDate() + 1);

      const dayThreats = userThreats.filter((t) => {
        const ts = new Date(t.timestamp);
        return ts >= day && ts < next;
      });

      trendData.push({
        label: day.toLocaleDateString('en-US', { weekday: 'short' }),
        critical: dayThreats.filter((t) => t.severity === 'critical').length,
        high: dayThreats.filter((t) => t.severity === 'high').length,
        medium: dayThreats.filter((t) => t.severity === 'medium').length,
      });
    }

    let totalEvents = userThreats.length;
    let blockedIPs  = userThreats.filter(t => t.status === 'blocked').length;
    let activeThreats = userThreats.filter(t => t.status==='active').length;

    const counts = ATTACK_TYPES.reduce((acc,type) => {
      acc[type] = userThreats.filter(t => t.attackType === type).length; return acc;
    }, {} as Record<string,number>);
    const total = Object.values(counts).reduce((a,b) => a+b, 0) || 1;
    const attackDistribution: AttackDistPoint[] = ATTACK_TYPES.map(type => ({
      type, count: counts[type]??0, percentage: total > 0 ? Math.round((counts[type]??0)/total*100) : 0,
    }));
    const ipMap = new Map<string,{count:number;threat:Threat}>();
    for (const t of userThreats) {
      const ex = ipMap.get(t.sourceIp);
      if (!ex || t.attempts > ex.count) ipMap.set(t.sourceIp,{count:t.attempts,threat:t});
    }
    const topAttackingIPs: TopIP[] = [...ipMap.entries()]
      .sort((a,b) => b[1].count-a[1].count).slice(0,5)
      .map(([ip,{count,threat:t}]) => ({
        ip, country:t.country, countryCode:t.countryCode,
        attempts:count, lastSeen:t.timestamp, severity:t.severity,
      }));
    return {
      totalEvents,
      activeThreats,
      criticalAlerts: userAlerts.filter(a => a.severity==='critical').length,
      blockedIPs,
      blockRate:      totalEvents > 0 ? Number(((blockedIPs / totalEvents) * 100).toFixed(2)) : 0,
      trendData, attackDistribution, topAttackingIPs,
    };
  }

  blockThreat(id: string): boolean {
    const t = this.threats.find(t => t.id===id); if (!t) return false;
    t.status = 'blocked'; this.blockedCount++;
    const a = this.alerts.find(a => a.threatId===id); if (a) a.status='blocked';
    return true;
  }

  resolveThreat(id: string): boolean {
    const t = this.threats.find(t => t.id===id); if (!t) return false;
    t.status = 'resolved';
    const a = this.alerts.find(a => a.threatId===id); if (a) a.status='resolved';
    return true;
  }

  getRecentThreats(limit=6) { return this.threats.slice(0,limit); }

  async hydrate(): Promise<void> {
    if (!db) {
      console.log('[STORE] No DB connection — waiting for incoming ingest events');
      return;
    }

    const rows = await db.threat.findMany({
      orderBy: { timestamp: 'desc' },
      take: 500,
    });

    this.threats = rows.map((row: any) => ({
      id: row.id,
      timestamp: new Date(row.timestamp).toISOString(),
      sourceIp: row.sourceIp,
      country: row.country,
      countryCode: row.countryCode,
      asn: row.asn,
      attackType: row.attackType,
      endpoint: row.endpoint,
      severity: row.severity,
      status: row.status,
      attempts: row.attempts,
      userAgent: row.userAgent,
      userId: undefined,
    }));

    this.alerts = this.threats
      .filter((t) => t.severity === 'critical' || t.severity === 'high')
      .map((t) => this.threatToAlert(t));

    this.totalEvents = this.threats.length;
    this.blockedCount = this.threats.filter((t) => t.status === 'blocked').length;
    console.log(`[STORE] Hydrated ${this.threats.length} threats from DB`);
  }
}

export const store = new ThreatStore();
