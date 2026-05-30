import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlerts, useAnalyzeAlert } from '../hooks/useSecurityData.js';
import { useLiveStream }              from '../lib/StreamContext.js';
import { SeverityBadge, StatusBadge, SkeletonRow, EmptyState, Badge } from '../components/ui/Badge.js';

export function Alerts() {
  const navigate = useNavigate();
  const [page,   setPage]   = useState(1);
  const [status, setStatus] = useState('');
  const { data, isLoading, isError } = useAlerts(page, 20, status);
  const analyzeMutation = useAnalyzeAlert();
  const { newAlerts }   = useLiveStream();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-on-surface tracking-tight">System Alerts</h1>
          <p className="text-on-surface-variant text-sm mt-1 font-mono uppercase tracking-wider text-[11px]">Manage and triage security anomalies</p>
        </div>
        {newAlerts.length > 0 && (
          <Badge variant="danger" className="animate-pulse shadow-glow-error">
            {newAlerts.length} live stream
          </Badge>
        )}
      </div>

      <div className="glass-panel rounded-xl overflow-hidden flex flex-col">
        {/* Filters */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-outline-variant/30 bg-surface-lowest/40 backdrop-blur-sm">
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-1.5 text-xs border border-outline-variant/30 rounded bg-surface-lowest outline-none focus:border-primary/50 text-on-surface font-mono"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="blocked">Blocked</option>
          </select>
          <div className="ml-auto text-xs text-on-surface-variant font-mono">
            {data ? `${data.total} alerts` : '…'}
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-lowest/50 backdrop-blur-md border-b border-outline-variant/20">
              {['Alert','Source IP','Severity','Assigned To','Time','Status','Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}
            {isError && (
              <tr><td colSpan={7}>
                <EmptyState title="Neural Interface Sync Failed" description="Check backend connectivity" />
              </td></tr>
            )}
            {data?.items.map(a => (
              <tr key={a.id} className="hover:bg-surface-high/20 transition-colors group">
                <td className="px-5 py-3 border-b border-outline-variant/10 text-[13px] font-medium text-on-surface max-w-[200px] relative">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="truncate">{a.attackType}</p>
                  <p className="font-mono text-on-surface-variant/70 text-[10px] truncate">{a.endpoint}</p>
                </td>
                <td className="px-5 py-3 border-b border-outline-variant/10 font-mono text-xs text-error">{a.sourceIp}</td>
                <td className="px-5 py-3 border-b border-outline-variant/10"><SeverityBadge severity={a.severity} /></td>
                <td className="px-5 py-3 border-b border-outline-variant/10 text-xs text-on-surface-variant font-mono">{a.assignedTo}</td>
                <td className="px-5 py-3 border-b border-outline-variant/10 text-xs font-mono text-primary/80">
                  {new Date(a.timestamp).toLocaleTimeString()}
                </td>
                <td className="px-5 py-3 border-b border-outline-variant/10"><StatusBadge status={a.status} /></td>
                <td className="px-5 py-3 border-b border-outline-variant/10">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        analyzeMutation.mutate(a.threatId);
                        navigate(`/investigation/${a.threatId}`);
                      }}
                      disabled={analyzeMutation.isPending}
                      className="text-xs font-mono uppercase tracking-wider text-primary hover:text-primary-container font-semibold transition-colors disabled:opacity-40"
                    >
                      Analyze
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-outline-variant/30 bg-surface-lowest/20">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
            className="px-2.5 py-1 text-xs border border-outline-variant/30 rounded bg-surface-lowest text-on-surface hover:bg-surface-high transition-colors disabled:opacity-40">←</button>
          <button onClick={() => setPage(p => Math.min(data?.totalPages??1, p+1))} disabled={page===(data?.totalPages??1)}
            className="px-2.5 py-1 text-xs border border-outline-variant/30 rounded bg-surface-lowest text-on-surface hover:bg-surface-high transition-colors disabled:opacity-40">→</button>
          <span className="ml-auto text-xs text-on-surface-variant font-mono">Page {page} of {data?.totalPages ?? 1}</span>
        </div>
      </div>
    </div>
  );
}
