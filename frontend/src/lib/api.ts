import { getToken, clearAuth } from './auth.ts';
import type {
  ApiResponse, PaginatedResponse,
  Threat, Alert, AnalyticsSummary, Report, AIAnalysis,
} from '../types/index.ts';

const BASE = '/api';

// ─── Fetch with auth header ───────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (options.headers) Object.assign(headers, options.headers);

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  // Token expired / invalid → force logout
  if (res.status === 401) {
    clearAuth();
    globalThis.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API error ${res.status}`);
  }

  const body: ApiResponse<T> = await res.json();
  if (!body.success) throw new Error('API returned success: false');
  return body.data;
}

async function requestRaw(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (options.headers) Object.assign(headers, options.headers);

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearAuth();
    globalThis.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API error ${res.status}`);
  }

  return res;
}

function get<T>(path: string)               { return request<T>(path); }
function post<T>(path: string, body?: unknown) {
  return request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

function getFilenameFromContentDisposition(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const simpleMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
  if (simpleMatch?.[1]) {
    return simpleMatch[1];
  }

  return fallback;
}

// ─── API surface ──────────────────────────────────────────────────────────────

export const api = {
  auth: {
    me:      ()                         => get<{ userId: string; email: string; role: string; name: string }>('/auth/me'),
    refresh: ()                         => post<{ token: string }>('/auth/refresh'),
    users:   ()                         => get<unknown[]>('/auth/users'),
  },

  threats: {
    list:    (page = 1, pageSize = 20, severity = '', type = '') =>
      get<PaginatedResponse<Threat>>(`/threats?page=${page}&pageSize=${pageSize}&severity=${severity}&type=${type}`),
    byId:    (id: string)               => get<Threat>(`/threats/${id}`),
    blockIp: (id: string)               => post<{ message: string; threat: Threat }>(`/threats/${id}/actions/block-ip`),
    resolve: (id: string)               => post<{ message: string; threat: Threat }>(`/threats/${id}/actions/resolve`),
  },

  alerts: {
    list:     (page = 1, pageSize = 20, status = '') =>
      get<PaginatedResponse<Alert>>(`/alerts?page=${page}&pageSize=${pageSize}&status=${status}`),
    analyze:  (threatId: string)        => post<{ jobId: string | null; queued: boolean; threatId: string }>(`/alerts/${threatId}/analyze`),
    analysis: (threatId: string)        => get<AIAnalysis>(`/alerts/${threatId}/analysis`),
  },

  reports: {
    list:     (page = 1, pageSize = 20) =>
      get<PaginatedResponse<Report>>(`/reports?page=${page}&pageSize=${pageSize}`),
    generate: (payload: { type: Report['type']; title?: string }) =>
      post<Report | { report: Report } | { jobId: string; reportId?: string }>('/reports/generate', payload),
    download: async (id: string) => {
      const res = await requestRaw(`/reports/${id}/download`);
      const blob = await res.blob();
      const filename = getFilenameFromContentDisposition(
        res.headers.get('content-disposition'),
        `report-${id}.pdf`,
      );
      return { blob, filename };
    },
  },

  analytics: {
    summary: ()                         => get<AnalyticsSummary>('/analytics/summary'),
  },

  queue: {
    stats: ()                           => get<unknown>('/queue/stats'),
  },

  // Phase 5 — RAG
  logs: {
    query: (question: string, history: Array<{ role: 'user' | 'assistant'; content: string }> = []) =>
      post<{ answer: string; sources: unknown[]; mode: string }>('/logs/query', { question, history }),
  },
};
