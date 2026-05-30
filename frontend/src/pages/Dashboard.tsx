import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, Ban, Shield,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import { useAnalytics, useThreats } from '../hooks/useSecurityData.js';
import { useLiveStream }            from '../lib/StreamContext.js';
import { LiveFeed }                 from '../components/ui/LiveFeed.js';
import { SeverityBadge, StatusBadge, Skeleton, SkeletonRow, Badge } from '../components/ui/Badge.js';
import { ThreatTrendsChart }        from '../components/charts/ThreatTrendsChart.js';
import { AttackDistChart }          from '../components/charts/AttackDistChart.js';

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, subUp, icon: Icon, iconClass,
}: {
  label: string; value: string | number; sub: string; subUp: boolean;
  icon: React.ElementType; iconClass: string;
}) {
  return (
    <div className="glass-panel rounded-xl p-5 hover:bg-surface-high/30 transition-all flex flex-col justify-between group overflow-hidden relative">
      {/* Background glow hover effect */}
      <div className="absolute inset-x-0 -bottom-10 h-20 bg-gradient-to-t from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <div className="flex items-start justify-between mb-4 relative z-10">
        <p className="text-[11px] font-bold font-display text-on-surface-variant uppercase tracking-[0.1em]">{label}</p>
        <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center border border-outline-variant/30 backdrop-blur-md ${iconClass}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-3xl font-mono font-semibold tracking-tight text-on-surface">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className={`text-xs font-mono mt-2 flex items-center gap-1 ${subUp ? 'text-error' : 'text-secondary'}`}>
          {subUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {sub}
        </p>
      </div>
    </div>
  );
}

// ─── Top IPs table ────────────────────────────────────────────────────────────

function TopIPsTable() {
  const { data, isLoading } = useAnalytics();

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-surface-lowest/50 backdrop-blur-md border-b border-outline-variant/20">
          {['IP Address', 'Country', 'Attempts', 'Last Seen', 'Severity'].map(h => (
            <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
          : data?.topAttackingIPs.map(ip => (
            <tr key={ip.ip} className="hover:bg-surface-high/20 transition-colors group">
              <td className="px-5 py-3 border-b border-outline-variant/10 font-mono text-xs text-error font-semibold relative">
                {/* Active hover indicator */}
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                {ip.ip}
              </td>
              <td className="px-5 py-3 border-b border-outline-variant/10 text-xs text-on-surface-variant">
                {ip.country}
              </td>
              <td className="px-5 py-3 border-b border-outline-variant/10 text-xs font-mono text-on-surface">
                {ip.attempts.toLocaleString()}
              </td>
              <td className="px-5 py-3 border-b border-outline-variant/10 text-xs font-mono text-primary/80">
                {new Date(ip.lastSeen).toLocaleTimeString()}
              </td>
              <td className="px-5 py-3 border-b border-outline-variant/10">
                <SeverityBadge severity={ip.severity} />
              </td>
            </tr>
          ))
        }
      </tbody>
    </table>
  );
}

// ─── Recent alerts table ──────────────────────────────────────────────────────

function RecentAlertsTable() {
  const navigate = useNavigate();
  const { data: threats, isLoading } = useThreats(1, 6);

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-surface-lowest/50 backdrop-blur-md border-b border-outline-variant/20">
          {['Alert', 'Source IP', 'Endpoint', 'Severity', 'Time', 'Status', ''].map(h => (
            <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
          : threats?.items.map(t => (
            <tr key={t.id} className="hover:bg-surface-high/20 transition-colors group">
              <td className="px-5 py-3 border-b border-outline-variant/10 text-[13px] font-medium text-on-surface max-w-[180px] truncate relative">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                {t.attackType}
              </td>
              <td className="px-5 py-3 border-b border-outline-variant/10 font-mono text-xs text-error">{t.sourceIp}</td>
              <td className="px-5 py-3 border-b border-outline-variant/10 font-mono text-xs text-on-surface-variant">{t.endpoint}</td>
              <td className="px-5 py-3 border-b border-outline-variant/10"><SeverityBadge severity={t.severity} /></td>
              <td className="px-5 py-3 border-b border-outline-variant/10 text-xs font-mono text-primary/80">
                {new Date(t.timestamp).toLocaleTimeString()}
              </td>
              <td className="px-5 py-3 border-b border-outline-variant/10"><StatusBadge status={t.status} /></td>
              <td className="px-5 py-3 border-b border-outline-variant/10">
                <button
                  onClick={() => navigate(`/investigation/${t.id}`)}
                  className="text-xs font-mono uppercase tracking-wider text-primary hover:text-primary-container transition-colors font-semibold"
                >
                  Analyze
                </button>
              </td>
            </tr>
          ))
        }
      </tbody>
    </table>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export function Dashboard() {
  const { data: analytics, isLoading } = useAnalytics();
  const { kpiDelta }                    = useLiveStream();

  // merge SSE delta over query data for real-time KPI numbers
  const totalEvents    = kpiDelta?.totalEvents    ?? analytics?.totalEvents    ?? 0;
  const activeThreats  = kpiDelta?.activeThreats  ?? analytics?.activeThreats  ?? 0;
  const criticalAlerts = kpiDelta?.criticalAlerts ?? analytics?.criticalAlerts ?? 0;
  const blockedIPs     = kpiDelta?.blockedIPs     ?? analytics?.blockedIPs     ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-on-surface tracking-tight">Terminal Command</h1>
          <p className="text-on-surface-variant text-sm mt-1 font-mono uppercase tracking-wider text-[11px]">System Status: Nominal · Live Telemetry Enabled</p>
        </div>
        <Badge variant="success" className="animate-pulse shadow-glow-secondary">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary mr-2" />
          Synchronized
        </Badge>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4 md:gap-6">
          <KpiCard label="Total Events"    value={totalEvents}    sub="↑ 14.2% from yesterday" subUp={true}  icon={Activity}       iconClass="bg-primary/20 text-primary border-primary/30" />
          <KpiCard label="Active Threats"  value={activeThreats}  sub="↑ 3 new in last hour"   subUp={true}  icon={AlertTriangle}  iconClass="bg-error/20 text-error border-error/30" />
          <KpiCard label="Critical Alerts" value={criticalAlerts} sub="5 unresolved"            subUp={true}  icon={Shield}         iconClass="bg-tertiary/20 text-tertiary border-tertiary/30" />
          <KpiCard label="Blocked IPs"     value={blockedIPs}     sub={`${analytics?.blockRate ?? 99.2}% block rate`} subUp={false} icon={Ban} iconClass="bg-secondary/20 text-secondary border-secondary/30" />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 md:gap-6">
        <div className="glass-panel rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/30 bg-surface-lowest/40 backdrop-blur-sm">
            <p className="text-xs font-bold font-display tracking-widest uppercase text-on-surface">Threat Vectors</p>
            <Badge variant="info" className="shadow-[0_0_10px_rgba(165,200,255,0.15)]"><span className="w-1.5 h-1.5 rounded-full bg-primary mr-1 animate-pulse" /> Live</Badge>
          </div>
          <div className="p-5 flex-1 relative">
             {/* Chart styling needs to inherit dark mode config - ensure Chart.js applies dark text if configured */}
            {analytics && analytics.trendData && <ThreatTrendsChart data={analytics.trendData} />}
          </div>
        </div>
        <div className="glass-panel rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/30 bg-surface-lowest/40 backdrop-blur-sm">
            <p className="text-xs font-bold font-display tracking-widest uppercase text-on-surface">Vector Distribution</p>
          </div>
          <div className="p-5 flex-1 relative">
            {analytics && analytics.attackDistribution && <AttackDistChart data={analytics.attackDistribution} />}
          </div>
        </div>
      </div>

      {/* Top IPs + Live Feed */}
      <div className="grid grid-cols-[1fr_360px] gap-4 md:gap-6">
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/30 bg-surface-lowest/40 backdrop-blur-sm">
            <p className="text-xs font-bold font-display tracking-widest uppercase text-on-surface">Hostile Entities</p>
            <Badge variant="danger" className="shadow-glow-error">Priority Targets</Badge>
          </div>
          <TopIPsTable />
        </div>
        <div className="glass-panel rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/30 bg-surface-lowest/40 backdrop-blur-sm">
            <p className="text-xs font-bold font-display tracking-widest uppercase text-on-surface">Event Stream</p>
            <span className="flex items-center gap-1.5 text-[9px] font-bold font-mono text-error uppercase tracking-[0.2em]">
              <span className="w-1.5 h-1.5 rounded-full bg-error shadow-[0_0_8px_#ffb4ab] animate-pulse" />
              Live
            </span>
          </div>
          <div className="flex-1 bg-surface-lowest/20">
            <LiveFeed maxItems={8} />
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/30 bg-surface-lowest/40 backdrop-blur-sm">
          <p className="text-xs font-bold font-display tracking-widest uppercase text-on-surface">System Alerts</p>
          <button
            onClick={() => window.location.href = '/alerts'}
            className="text-[11px] font-mono uppercase tracking-widest text-primary hover:text-primary-container font-semibold transition-colors flex items-center gap-1"
          >
            Access Logs <span className="text-lg leading-none">→</span>
          </button>
        </div>
        <RecentAlertsTable />
      </div>
    </div>
  );
}
