import type { ReactNode } from 'react';
import type { Severity, ThreatStatus } from '../../types/index.js';

// ─── Severity badge ───────────────────────────────────────────────────────────

const SEV_STYLES: Record<Severity, string> = {
  critical: 'bg-error/20 text-error border border-error/30 shadow-[0_0_8px_rgba(255,180,171,0.2)]',
  high:     'bg-tertiary/20 text-tertiary border border-tertiary/30',
  medium:   'bg-primary/20 text-primary border border-primary/30',
  low:      'bg-secondary/20 text-secondary border border-secondary/30',
};

const SEV_DOT: Record<Severity, string> = {
  critical: 'bg-error shadow-glow-error animate-pulse',
  high:     'bg-tertiary',
  medium:   'bg-primary',
  low:      'bg-secondary',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${SEV_STYLES[severity]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${SEV_DOT[severity]}`} />
      {severity}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STA_STYLES: Record<ThreatStatus, string> = {
  active:        'bg-error/20 text-error border border-error/30',
  blocked:       'bg-surface-high/50 text-on-surface-variant border border-outline-variant/30',
  resolved:      'bg-secondary/20 text-secondary border border-secondary/30',
  investigating: 'bg-tertiary/20 text-tertiary border border-tertiary/30',
};

export function StatusBadge({
  status,
  children,
  className = '',
}: {
  status?: ThreatStatus;
  children?: ReactNode;
  className?: string;
}) {
  const label   = children ?? status ?? '';
  const styleKey = status ?? 'resolved';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${STA_STYLES[styleKey as ThreatStatus] ?? ''} ${className}`}>
      {label}
    </span>
  );
}

// ─── Generic badge ────────────────────────────────────────────────────────────

export function Badge({
  children,
  variant = 'default',
  className = '',
}: {
  children: ReactNode;
  variant?: 'default' | 'info' | 'success' | 'danger' | 'warning';
  className?: string;
}) {
  const styles: Record<string, string> = {
    default: 'bg-surface-highest text-on-surface-variant border border-outline-variant/30',
    info:    'bg-primary/20 text-primary border border-primary/30',
    success: 'bg-secondary/20 text-secondary border border-secondary/30',
    danger:  'bg-error/20 text-error border border-error/30',
    warning: 'bg-tertiary/20 text-tertiary border border-tertiary/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-widest ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-surface-high/50 rounded ${className}`} />
  );
}

export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-3 border-b border-outline-variant/10">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-3 text-on-surface-variant">{icon}</div>}
      <p className="text-sm font-semibold font-display text-on-surface uppercase tracking-widest">{title}</p>
      {description && (
        <p className="mt-2 text-xs font-mono text-on-surface-variant/70">{description}</p>
      )}
    </div>
  );
}
