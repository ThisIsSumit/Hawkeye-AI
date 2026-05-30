import { RefreshCw } from 'lucide-react';
import { useLiveStream } from '../../lib/StreamContext.js';
import type { SSEStatus } from '../../hooks/useStream.js';

const STATUS_CONFIG: Record<SSEStatus, {
  label: string;
  dotClass: string;
  textClass: string;
  icon?: React.ReactNode;
}> = {
  connected:    { label: 'Live',         dotClass: 'bg-green-500 animate-pulse', textClass: 'text-green-700' },
  connecting:   { label: 'Connecting…',  dotClass: 'bg-amber-400 animate-pulse', textClass: 'text-amber-700' },
  reconnecting: { label: 'Reconnecting…',dotClass: 'bg-amber-400 animate-pulse', textClass: 'text-amber-700' },
  error:        { label: 'Disconnected', dotClass: 'bg-red-500',                 textClass: 'text-red-700' },
  closed:       { label: 'Closed',       dotClass: 'bg-slate-400',               textClass: 'text-slate-600' },
};

export function StreamStatus() {
  const { status, clientCount, lastEventAt, reconnect } = useLiveStream();
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-2">
      {/* pill */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
        status === 'connected'
          ? 'bg-green-50 border-green-200'
          : status === 'error'
          ? 'bg-red-50 border-red-200'
          : 'bg-amber-50 border-amber-200'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
        <span className={cfg.textClass}>{cfg.label}</span>
      </div>

      {/* reconnect button on error */}
      {(status === 'error' || status === 'closed') && (
        <button
          onClick={reconnect}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      )}

      {/* last event time when connected */}
      {status === 'connected' && lastEventAt && (
        <span className="text-xs text-slate-400 hidden sm:inline">
          {clientCount} listener{clientCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
