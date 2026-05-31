import { streamManager } from './stream.js';
import { store } from './store.js';
import { ragService } from './ragService.js';
import { v4 as uuid } from 'uuid';

const HEARTBEAT_INTERVAL_MS = 15000;
const THREAT_INTERVAL_MS = 3500;

const ATTACK_TYPES = [
  'SQL Injection','XSS','DDoS','Brute Force',
  'Path Traversal','SSRF','Command Injection','CSRF',
];
const SEVERITIES = ['low','medium','high','critical'];
const ENDPOINTS = ['/login','/api/data','/admin','/search','/upload','/profile'];
const COUNTRIES = [
  { country: 'India', code: 'IN' },
  { country: 'USA', code: 'US' },
  { country: 'Germany', code: 'DE' },
  { country: 'Brazil', code: 'BR' },
  { country: 'Singapore', code: 'SG' },
  { country: 'UK', code: 'GB' },
];
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomIp() {
  return `${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*256)}`;
}
function randomUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'curl/7.68.0',
    'python-requests/2.25.1',
    'PostmanRuntime/7.29.0',
    'Go-http-client/1.1',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  ];
  return pick(agents);
}

class RuntimePulse {
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private threatTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;

    // Heartbeat
    this.heartbeatTimer = setInterval(() => {
      streamManager.heartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    // Synthetic threat generator
    this.threatTimer = setInterval(() => {
      const attackType = pick(ATTACK_TYPES) as import('../types/index.js').AttackType;
      const severity = pick(SEVERITIES) as import('../types/index.js').Severity;
      const endpoint = pick(ENDPOINTS);
      const { country, code } = pick(COUNTRIES);
      const threat = store.ingestThreat({
        sourceIp: randomIp(),
        country,
        countryCode: code,
        asn: `AS${Math.floor(Math.random()*10000)}`,
        attackType,
        endpoint,
        severity,
        status: 'active',
        attempts: Math.floor(Math.random()*10)+1,
        userAgent: randomUserAgent(),
      });

      const logMessage = `Simulator threat generated: ${threat.attackType} from ${threat.sourceIp} targeting ${threat.endpoint} with ${threat.severity.toUpperCase()} severity.`;
      void ragService.indexLog(threat.id, logMessage);

      streamManager.broadcast('threat:new', threat);
      if (threat.severity === 'critical' || threat.severity === 'high') {
        const alert = store.getAlerts(1, 1).items[0];
        if (alert) {
          streamManager.broadcast('alert:new', alert);
        }
      }

      void store.getAnalytics().then((analytics) => {
        streamManager.broadcast('analytics:delta', {
          totalEvents: analytics.totalEvents,
          activeThreats: analytics.activeThreats,
          criticalAlerts: analytics.criticalAlerts,
          blockedIPs: analytics.blockedIPs,
        });
      });
    }, THREAT_INTERVAL_MS);

    console.log('[RUNTIME] Simulator started: heartbeats + synthetic threats + log indexing enabled');
  }

  stop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.threatTimer) clearInterval(this.threatTimer);
    this.running = false;
    console.log('[RUNTIME] Simulator stopped');
  }
}

export const simulator = new RuntimePulse();
