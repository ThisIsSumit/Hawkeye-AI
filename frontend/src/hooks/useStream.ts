import { useEffect, useRef, useCallback, useState } from 'react';
import type {
  StreamEvent,
  Threat, Alert, AnalyticsDeltaPayload,
} from '../types/index.js';

// ─── Connection state ─────────────────────────────────────────────────────────

export type SSEStatus = 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed';

interface UseStreamOptions {
  /** Called whenever a threat:new event arrives */
  onThreatNew?:       (threat: Threat) => void;
  /** Called whenever a threat:updated event arrives */
  onThreatUpdated?:   (threat: Threat) => void;
  /** Called whenever an alert:new event arrives */
  onAlertNew?:        (alert: Alert) => void;
  /** Called whenever analytics:delta arrives */
  onAnalyticsDelta?:  (delta: AnalyticsDeltaPayload) => void;
}

interface UseStreamReturn {
  status:      SSEStatus;
  clientCount: number;
  lastEventAt: Date | null;
  reconnect:   () => void;
}

const SSE_URL            = '/api/stream';
const MAX_RETRIES        = 10;
const BASE_BACKOFF_MS    = 1000;  // 1s initial
const MAX_BACKOFF_MS     = 30000; // 30s max

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStream(options: UseStreamOptions = {}): UseStreamReturn {
  const { onThreatNew, onThreatUpdated, onAlertNew, onAnalyticsDelta } = options;

  const esRef         = useRef<EventSource | null>(null);
  const retriesRef    = useRef(0);
  const backoffTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef    = useRef(true);

  const [status,      setStatus]      = useState<SSEStatus>('connecting');
  const [clientCount, setClientCount] = useState(0);
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  // stable callback refs so connect() doesn't recreate on every render
  const onThreatNewRef      = useRef(onThreatNew);
  const onThreatUpdatedRef  = useRef(onThreatUpdated);
  const onAlertNewRef       = useRef(onAlertNew);
  const onAnalyticsDeltaRef = useRef(onAnalyticsDelta);

  useEffect(() => { onThreatNewRef.current      = onThreatNew;      }, [onThreatNew]);
  useEffect(() => { onThreatUpdatedRef.current  = onThreatUpdated;  }, [onThreatUpdated]);
  useEffect(() => { onAlertNewRef.current       = onAlertNew;       }, [onAlertNew]);
  useEffect(() => { onAnalyticsDeltaRef.current = onAnalyticsDelta; }, [onAnalyticsDelta]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // close any existing connection first
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    setStatus(retriesRef.current > 0 ? 'reconnecting' : 'connecting');

    const es = new EventSource(SSE_URL);
    esRef.current = es;

    // ── system:connected ───────────────────────────────────────────────────
    es.addEventListener('system:connected', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      retriesRef.current = 0;
      setStatus('connected');
      setLastEventAt(new Date());
      try {
        const event: StreamEvent<{ clientId: string; clientCount: number }> = JSON.parse(e.data);
        setClientCount(event.payload.clientCount);
      } catch { /* ignore parse errors */ }
    });

    // ── system:heartbeat ───────────────────────────────────────────────────
    es.addEventListener('system:heartbeat', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      setLastEventAt(new Date());
      try {
        const event: StreamEvent<{ clientCount: number }> = JSON.parse(e.data);
        setClientCount(event.payload.clientCount);
      } catch { /* ignore */ }
    });

    // ── threat:new ────────────────────────────────────────────────────────
    es.addEventListener('threat:new', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      setLastEventAt(new Date());
      try {
        const event: StreamEvent<Threat> = JSON.parse(e.data);
        onThreatNewRef.current?.(event.payload);
      } catch { /* ignore */ }
    });

    // ── threat:updated ────────────────────────────────────────────────────
    es.addEventListener('threat:updated', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      setLastEventAt(new Date());
      try {
        const event: StreamEvent<Threat> = JSON.parse(e.data);
        onThreatUpdatedRef.current?.(event.payload);
      } catch { /* ignore */ }
    });

    // ── alert:new ─────────────────────────────────────────────────────────
    es.addEventListener('alert:new', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      setLastEventAt(new Date());
      try {
        const event: StreamEvent<Alert> = JSON.parse(e.data);
        onAlertNewRef.current?.(event.payload);
      } catch { /* ignore */ }
    });

    // ── analytics:delta ───────────────────────────────────────────────────
    es.addEventListener('analytics:delta', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      setLastEventAt(new Date());
      try {
        const event: StreamEvent<AnalyticsDeltaPayload> = JSON.parse(e.data);
        onAnalyticsDeltaRef.current?.(event.payload);
      } catch { /* ignore */ }
    });

    // ── error / reconnect ─────────────────────────────────────────────────
    es.onerror = () => {
      if (!mountedRef.current) return;
      es.close();
      esRef.current = null;

      if (retriesRef.current >= MAX_RETRIES) {
        setStatus('error');
        return;
      }

      // exponential backoff with jitter
      const delay = Math.min(
        BASE_BACKOFF_MS * Math.pow(2, retriesRef.current) + Math.random() * 500,
        MAX_BACKOFF_MS,
      );
      retriesRef.current++;
      setStatus('reconnecting');
      console.warn(`[SSE] disconnected — retry ${retriesRef.current} in ${Math.round(delay)}ms`);

      backoffTimer.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };
  }, []); // stable — no deps needed, uses refs

  // initial connect + cleanup
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (backoffTimer.current) clearTimeout(backoffTimer.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      setStatus('closed');
    };
  }, [connect]);

  const reconnect = useCallback(() => {
    retriesRef.current = 0;
    connect();
  }, [connect]);

  return { status, clientCount, lastEventAt, reconnect };
}
