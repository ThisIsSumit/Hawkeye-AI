import {
  createContext, useContext, useReducer, useCallback,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStream, type SSEStatus } from '../hooks/useStream.js';
import { QK } from '../hooks/useSecurityData.js';
import type { Threat, Alert, AnalyticsDeltaPayload } from '../types/index.js';

// ─── State ────────────────────────────────────────────────────────────────────

const MAX_LIVE_EVENTS = 50; // keep last 50 in the live feed

interface LiveState {
  events:     Threat[];         // live activity feed (newest first)
  newAlerts:  Alert[];          // alerts that arrived via SSE
  kpiDelta:   AnalyticsDeltaPayload | null;
}

type LiveAction =
  | { type: 'THREAT_NEW';      payload: Threat }
  | { type: 'THREAT_UPDATED';  payload: Threat }
  | { type: 'ALERT_NEW';       payload: Alert }
  | { type: 'ANALYTICS_DELTA'; payload: AnalyticsDeltaPayload };

function reducer(state: LiveState, action: LiveAction): LiveState {
  switch (action.type) {
    case 'THREAT_NEW':
      return {
        ...state,
        events: [action.payload, ...state.events].slice(0, MAX_LIVE_EVENTS),
      };
    case 'THREAT_UPDATED':
      return {
        ...state,
        events: state.events.map(e =>
          e.id === action.payload.id ? action.payload : e
        ),
      };
    case 'ALERT_NEW':
      return {
        ...state,
        newAlerts: [action.payload, ...state.newAlerts].slice(0, 20),
      };
    case 'ANALYTICS_DELTA':
      return { ...state, kpiDelta: action.payload };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface StreamContextValue {
  status:      SSEStatus;
  clientCount: number;
  lastEventAt: Date | null;
  reconnect:   () => void;
  liveEvents:  Threat[];
  newAlerts:   Alert[];
  kpiDelta:    AnalyticsDeltaPayload | null;
}

const StreamContext = createContext<StreamContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StreamProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, dispatch] = useReducer(reducer, {
    events:    [],
    newAlerts: [],
    kpiDelta:  null,
  });

  const onThreatNew = useCallback((threat: Threat) => {
    dispatch({ type: 'THREAT_NEW', payload: threat });
    // also invalidate the threats list query so tables stay fresh
    qc.invalidateQueries({ queryKey: ['threats'] });
  }, [qc]);

  const onThreatUpdated = useCallback((threat: Threat) => {
    dispatch({ type: 'THREAT_UPDATED', payload: threat });
    qc.invalidateQueries({ queryKey: ['threats'] });
    qc.invalidateQueries({ queryKey: QK.threat(threat.id) });
  }, [qc]);

  const onAlertNew = useCallback((alert: Alert) => {
    dispatch({ type: 'ALERT_NEW', payload: alert });
    qc.invalidateQueries({ queryKey: ['alerts'] });
  }, [qc]);

  const onAnalyticsDelta = useCallback((delta: AnalyticsDeltaPayload) => {
    dispatch({ type: 'ANALYTICS_DELTA', payload: delta });
    qc.invalidateQueries({ queryKey: QK.analytics });
  }, [qc]);

  const { status, clientCount, lastEventAt, reconnect } = useStream({
    onThreatNew,
    onThreatUpdated,
    onAlertNew,
    onAnalyticsDelta,
  });

  return (
    <StreamContext.Provider value={{
      status, clientCount, lastEventAt, reconnect,
      liveEvents: state.events,
      newAlerts:  state.newAlerts,
      kpiDelta:   state.kpiDelta,
    }}>
      {children}
    </StreamContext.Provider>
  );
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

export function useLiveStream(): StreamContextValue {
  const ctx = useContext(StreamContext);
  if (!ctx) throw new Error('useLiveStream must be used inside <StreamProvider>');
  return ctx;
}
