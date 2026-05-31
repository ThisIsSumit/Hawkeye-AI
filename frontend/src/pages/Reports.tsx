import { useState } from 'react';
import { useDownloadReport, useGenerateReport, useReports } from '../hooks/useSecurityData.js';
import { SkeletonRow, EmptyState, Badge } from '../components/ui/Badge.js';
import type { Report, ReportStatus } from '../types/index.js';
import { FileText, Download, Loader2 } from 'lucide-react';

const SKELETON_ROW_KEYS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'] as const;

function ReportStatusBadge({ status }: Readonly<{ status: ReportStatus }>) {
  if (status === 'ready') return <Badge variant="success">READY</Badge>;
  if (status === 'generating') return <Badge variant="warning" className="animate-pulse">GENERATING</Badge>;
  if (status === 'failed') return <Badge variant="danger">FAILED</Badge>;
  return <Badge variant="default">UNKNOWN</Badge>;
}

export function Reports() {
  const [page, setPage] = useState(1);
  const [reportType, setReportType] = useState<Report['type']>('Daily Summary');
  const [customTitle, setCustomTitle] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);

  const { data, isLoading, isError } = useReports(page, 20);
  const generateMutation = useGenerateReport();
  const downloadMutation = useDownloadReport();

  const handleGenerateReport = () => {
    setError(null);
    setFeedback(null);

    generateMutation.mutate(
      {
        type: reportType,
        title: customTitle.trim() || undefined,
      },
      {
        onSuccess: () => {
          setFeedback('Report generation started successfully.');
          setCustomTitle('');
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : 'Could not generate report.';
          setError(message);
        },
      },
    );
  };

  const handleDownloadReport = (reportId: string) => {
    setError(null);
    setFeedback(null);
    setDownloadingReportId(reportId);

    downloadMutation.mutate(reportId, {
      onSuccess: ({ blob, filename }) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        globalThis.setTimeout(() => URL.revokeObjectURL(url), 1_000);
        setFeedback(`Downloaded ${filename}`);
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : 'Could not download report.';
        setError(message);
      },
      onSettled: () => {
        setDownloadingReportId(null);
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-on-surface tracking-tight">Intelligence Reports</h1>
          <p className="text-on-surface-variant text-sm mt-1 font-mono uppercase tracking-wider text-[11px]">Aggregated Analysis & Audit Logs</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="Optional title"
            className="px-3 py-2 text-xs border border-outline-variant/30 rounded bg-surface-lowest outline-none focus:border-primary/50 text-on-surface font-mono"
          />
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as Report['type'])}
            className="px-3 py-2 text-xs border border-outline-variant/30 rounded bg-surface-lowest outline-none focus:border-primary/50 text-on-surface font-mono"
          >
            <option value="Daily Summary">Daily Summary</option>
            <option value="Incident">Incident</option>
            <option value="Compliance">Compliance</option>
            <option value="Weekly Threat Intel">Weekly Threat Intel</option>
          </select>
          <button
            onClick={handleGenerateReport}
            disabled={generateMutation.isPending}
            className="flex items-center gap-2 bg-black text-on-primary px-4 py-2 rounded font-mono text-xs uppercase tracking-wider hover:bg-gray-700 transition-colors shadow-glow-primary disabled:opacity-50"
          >
            {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generateMutation.isPending ? 'Generating' : 'Generate Report'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="rounded border border-primary/30 bg-primary/10 px-4 py-2 text-xs text-primary font-mono">
          {feedback}
        </div>
      )}
      {error && (
        <div className="rounded border border-error/30 bg-error/10 px-4 py-2 text-xs text-error font-mono">
          {error}
        </div>
      )}

      <div className="glass-panel rounded-xl overflow-hidden flex flex-col">
        {/* Header toolbar */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-outline-variant/30 bg-surface-lowest/40 backdrop-blur-sm">
          <div className="text-xs text-on-surface-variant font-mono">
            {data ? `${data.total} reports available` : 'Loading...'}
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-lowest/50 backdrop-blur-md border-b border-outline-variant/20">
              {['Report Title', 'Type', 'Generated At', 'Author', 'Size (KB)', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && SKELETON_ROW_KEYS.map((key) => <SkeletonRow key={key} cols={7} />)}
            {isError && (
              <tr><td colSpan={7}>
                <EmptyState title="Reports Sync Failed" description="Check backend connectivity" />
              </td></tr>
            )}
            {data?.items.map(r => (
              <tr key={r.id} className="hover:bg-surface-high/20 transition-colors group">
                <td className="px-5 py-3 border-b border-outline-variant/10 text-[13px] font-medium text-on-surface relative flex items-center gap-3 w-max">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  <FileText className="w-4 h-4 text-primary/70" />
                  <span className="truncate">{r.title}</span>
                </td>
                <td className="px-5 py-3 border-b border-outline-variant/10 text-xs text-on-surface-variant font-mono">{r.type}</td>
                <td className="px-5 py-3 border-b border-outline-variant/10 text-xs text-primary/80 font-mono">
                  {new Date(r.generatedAt).toLocaleString()}
                </td>
                <td className="px-5 py-3 border-b border-outline-variant/10 text-xs text-on-surface-variant font-mono">{r.author}</td>
                <td className="px-5 py-3 border-b border-outline-variant/10 text-xs text-on-surface-variant font-mono">{r.sizeKb}</td>
                <td className="px-5 py-3 border-b border-outline-variant/10">
                  <ReportStatusBadge status={r.status} />
                </td>
                <td className="px-5 py-3 border-b border-outline-variant/10">
                  <button
                    onClick={() => handleDownloadReport(r.id)}
                    disabled={r.status !== 'ready' || downloadingReportId === r.id}
                    className="flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-primary hover:text-primary-container font-semibold transition-colors disabled:opacity-40"
                  >
                    {(r.status === 'generating' || downloadingReportId === r.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {(r.status === 'generating' || downloadingReportId === r.id) ? 'Wait' : 'Download'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination toolbar */}
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
