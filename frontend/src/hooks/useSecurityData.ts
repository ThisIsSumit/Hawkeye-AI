import {
  useQuery, useMutation, useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from '../lib/api.js';
import type {
  Threat, Alert, AnalyticsSummary, Report, AIAnalysis,
  PaginatedResponse,
} from '../types/index.js';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const QK = {
  analytics:  ['analytics', 'summary']         as const,
  threats:    (p: number, ps: number, sev: string, type: string) =>
              ['threats', p, ps, sev, type]     as const,
  threat:     (id: string) => ['threat', id]   as const,
  alerts:     (p: number, ps: number, st: string) =>
              ['alerts', p, ps, st]             as const,
  reports:    (p: number, ps: number) =>
              ['reports', p, ps]                as const,
  analysis:   (threatId: string) =>
              ['analysis', threatId]            as const,
} as const;

// ─── Analytics ────────────────────────────────────────────────────────────────

export function useAnalytics(): UseQueryResult<AnalyticsSummary> {
  return useQuery({
    queryKey:        QK.analytics,
    queryFn:         api.analytics.summary,
    staleTime:       10_000,   // 10s — SSE keeps it fresher anyway
    refetchInterval: 30_000,   // fallback poll every 30s
  });
}

// ─── Threats ─────────────────────────────────────────────────────────────────

export function useThreats(
  page     = 1,
  pageSize = 20,
  severity = '',
  type     = '',
): UseQueryResult<PaginatedResponse<Threat>> {
  return useQuery({
    queryKey: QK.threats(page, pageSize, severity, type),
    queryFn:  () => api.threats.list(page, pageSize, severity, type),
    staleTime: 5_000,
  });
}

export function useThreat(id: string): UseQueryResult<Threat> {
  return useQuery({
    queryKey: QK.threat(id),
    queryFn:  () => api.threats.byId(id),
    enabled:  !!id,
    staleTime: 5_000,
  });
}

export function useBlockIp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.threats.blockIp(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['threats'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useResolveThreat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.threats.resolve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['threats'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export function useAlerts(
  page     = 1,
  pageSize = 20,
  status   = '',
): UseQueryResult<PaginatedResponse<Alert>> {
  return useQuery({
    queryKey: QK.alerts(page, pageSize, status),
    queryFn:  () => api.alerts.list(page, pageSize, status),
    staleTime: 5_000,
  });
}

/** Trigger AI analysis — sends the THREAT ID (not alert ID) */
export function useAnalyzeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threatId: string) => api.alerts.analyze(threatId),
    onSuccess: (_data, threatId) => {
      // invalidate analysis cache so polling picks up the new result
      qc.invalidateQueries({ queryKey: QK.analysis(threatId) });
    },
  });
}

/**
 * Poll for AI analysis results.
 * Polls every 2s while analysis is pending (404 → retry).
 * Stops once data arrives or after reaching the retry limit.
 */
export function useAnalysis(
  threatId: string,
  enabled = true,
): UseQueryResult<AIAnalysis> {
  return useQuery({
    queryKey: QK.analysis(threatId),
    queryFn:  () => api.alerts.analysis(threatId),
    enabled:  !!threatId && enabled,
    staleTime: 60_000,         // cache for 1 minute once fetched
    retry: 10,                 // keep retrying (analysis may take a few seconds)
    retryDelay: 2000,          // poll every 2s
  });
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function useReports(
  page     = 1,
  pageSize = 20,
): UseQueryResult<PaginatedResponse<Report>> {
  return useQuery({
    queryKey: QK.reports(page, pageSize),
    queryFn:  () => api.reports.list(page, pageSize),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { type: Report['type']; title?: string }) => api.reports.generate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDownloadReport() {
  return useMutation({
    mutationFn: (reportId: string) => api.reports.download(reportId),
  });
}
