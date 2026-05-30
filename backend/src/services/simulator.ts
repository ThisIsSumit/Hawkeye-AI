import { streamManager } from './stream.js';

const HEARTBEAT_INTERVAL_MS = 15000;

class RuntimePulse {
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;

    this.heartbeatTimer = setInterval(() => {
      streamManager.heartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    console.log('[RUNTIME] Heartbeat service started (no synthetic threats enabled)');
  }

  stop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.running = false;
    console.log('[RUNTIME] Heartbeat service stopped');
  }
}

export const simulator = new RuntimePulse();
