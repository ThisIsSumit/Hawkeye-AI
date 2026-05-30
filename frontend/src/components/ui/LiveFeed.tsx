import { useLiveStream } from '../../lib/StreamContext.js';
import { SeverityBadge } from './Badge.js';
import type { Threat } from '../../types/index.js';

function timeAgo(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5)  return 'just now';
  if (diff < 60) return `${diff}s ago`;
  return `${Math.round(diff / 60)}m ago`;
}

const DOT_COLOR: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-amber-500',
  low:      'bg-green-500',
};

function LiveEvent({ threat }: { threat: Threat }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group animate-[slideIn_0.2s_ease]">
      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${DOT_COLOR[threat.severity]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-800 truncate">
          {threat.attackType} detected
        </p>
        <p className="text-xs text-slate-500 mt-0.5 truncate font-mono">
          {threat.sourceIp} → {threat.endpoint}
        </p>
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <SeverityBadge severity={threat.severity} />
        <span className="text-[10px] text-slate-400">{timeAgo(threat.timestamp)}</span>
      </div>
    </div>
  );
}

interface LiveFeedProps {
  maxItems?: number;
}

export function LiveFeed({ maxItems = 8 }: LiveFeedProps) {
  const { liveEvents, status } = useLiveStream();
  const visible = liveEvents.slice(0, maxItems);

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
        <div className={`w-2 h-2 rounded-full mb-3 ${
          status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'
        }`} />
        <p className="text-xs text-slate-500">
          {status === 'connected'
            ? 'Waiting for threat events…'
            : 'Connecting to live stream…'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {visible.map(threat => (
        <LiveEvent key={`${threat.id}-${threat.timestamp}`} threat={threat} />
      ))}
    </div>
  );
}
