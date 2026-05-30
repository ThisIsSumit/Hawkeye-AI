import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, Search } from 'lucide-react';
import { useThreats, useBlockIp } from '../hooks/useSecurityData.js';
import { SeverityBadge, StatusBadge, SkeletonRow, EmptyState } from '../components/ui/Badge.js';

export function Threats() {
  const navigate = useNavigate();
  const [page,     setPage]     = useState(1);
  const [severity, setSeverity] = useState('');
  const [type,     setType]     = useState('');

  const { data, isLoading, isError } = useThreats(page, 20, severity, type);
  const blockMutation = useBlockIp();

  const totalPages = data?.totalPages ?? 1;
  

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-on-surface tracking-tight">Threat Feed</h1>
          <p className="text-on-surface-variant text-sm mt-1 font-mono uppercase tracking-wider text-[11px]">All detected anomalies across infrastructure</p>
        </div>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden flex flex-col">
        {/* Filter bar */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-outline-variant/30 flex-wrap bg-surface-lowest/40 backdrop-blur-sm">
          <div className="relative group">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search Parameters…"
              className="pl-8 pr-3 py-1.5 text-xs border border-outline-variant/30 rounded bg-surface-lowest outline-none focus:border-primary/50 focus:shadow-glow text-on-surface font-mono w-44 placeholder-on-surface-variant/30 transition-all"
            />
          </div>
          <select
            value={severity}
            onChange={e => { setSeverity(e.target.value); setPage(1); }}
            className="px-3 py-1.5 text-xs border border-outline-variant/30 rounded bg-surface-lowest outline-none focus:border-primary/50 text-on-surface font-mono cursor-pointer"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={type}
            onChange={e => { setType(e.target.value); setPage(1); }}
            className="px-3 py-1.5 text-xs border border-outline-variant/30 rounded bg-surface-lowest outline-none focus:border-primary/50 text-on-surface font-mono cursor-pointer"
          >
            <option value="">All Vectors</option>
            {['SQL Injection','XSS','DDoS','Brute Force','Path Traversal','SSRF','Command Injection','CSRF'].map(t => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <div className="ml-auto text-xs text-on-surface-variant font-mono">
            {data ? `${data.total} threats` : '…'}
          </div>
        </div>

        {/* Table */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-lowest/50 backdrop-blur-md border-b border-outline-variant/20">
              {['Timestamp','Source IP','Attack Type','Endpoint','Severity','Status','Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}
            {isError && (
              <tr><td colSpan={7}>
                <EmptyState title="Sync Error" description="Unable to fetch telemetry" />
              </td></tr>
            )}
            {data?.items.map(t => (
              <tr key={t.id} className="hover:bg-surface-high/20 transition-colors group">
                <td className="px-5 py-3 border-b border-outline-variant/10 font-mono text-xs text-on-surface-variant/70 whitespace-nowrap relative">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                  {new Date(t.timestamp).toLocaleString()}
                </td>
                <td className="px-5 py-3 border-b border-outline-variant/10 font-mono text-xs text-error font-medium">
                  {t.sourceIp}
                </td>
                <td className="px-5 py-3 border-b border-outline-variant/10 text-xs text-on-surface max-w-[200px] truncate">{t.attackType}</td>
                <td className="px-5 py-3 border-b border-outline-variant/10 font-mono text-xs text-on-surface-variant/70 truncate max-w-[150px]">{t.endpoint}</td>
                <td className="px-5 py-3 border-b border-outline-variant/10"><SeverityBadge severity={t.severity} /></td>
                <td className="px-5 py-3 border-b border-outline-variant/10"><StatusBadge status={t.status} /></td>
                <td className="px-5 py-3 border-b border-outline-variant/10">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigate(`/investigation/${t.id}`)}
                      className="text-xs font-mono uppercase tracking-wider text-primary hover:text-primary-container transition-colors font-semibold disabled:opacity-40"
                    >
                      Analyze
                    </button>
                    <button
                      onClick={() => blockMutation.mutate(t.id)}
                      disabled={blockMutation.isPending || t.status === 'blocked'}
                      className="flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-error hover:shadow-glow-error transition-all font-semibold disabled:opacity-40"
                    >
                      <Ban className="w-3 h-3" />
                      Block
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-outline-variant/30 bg-surface-lowest/20">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-2.5 py-1 text-xs border border-outline-variant/30 rounded bg-surface-lowest text-on-surface hover:bg-surface-high transition-colors disabled:opacity-40 font-mono"
          >
            ←
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-7 h-7 text-xs rounded border transition-colors font-mono ${
                p === page
                  ? 'bg-primary/20 text-primary border-primary/30 shadow-glow'
                  : 'border-outline-variant/30 bg-surface-lowest text-on-surface hover:bg-surface-high'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-2.5 py-1 text-xs border border-outline-variant/30 rounded bg-surface-lowest text-on-surface hover:bg-surface-high transition-colors disabled:opacity-40 font-mono"
          >
            →
          </button>
          <span className="ml-auto text-[10px] text-on-surface-variant font-mono uppercase tracking-widest">
            Page {page} of {totalPages}
          </span>
        </div>
      </div>
    </div>
  );
}
