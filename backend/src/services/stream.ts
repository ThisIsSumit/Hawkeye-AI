import type { Response } from 'express';
import { v4 as uuid } from 'uuid';
import type { StreamEvent, StreamEventType } from '../types/index.js';

// ─── SSE Client ───────────────────────────────────────────────────────────────

interface SSEClient {
  id: string;
  res: Response;
  connectedAt: Date;
}

// ─── SSE Stream Manager ───────────────────────────────────────────────────────

class StreamManager {
  private clients = new Map<string, SSEClient>();

  /** Register a new SSE client and send the initial connected event */
  addClient(res: Response): string {
    const id = uuid();

    // SSE headers
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx proxy fix
    res.flushHeaders();

    const client: SSEClient = { id, res, connectedAt: new Date() };
    this.clients.set(id, client);

    // send connected confirmation
    this.sendToClient(client, {
      id:        uuid(),
      type:      'system:connected',
      timestamp: new Date().toISOString(),
      payload:   { clientId: id, clientCount: this.clients.size },
    });

    // remove on disconnect
    res.on('close', () => {
      this.clients.delete(id);
      console.log(`[SSE] client ${id} disconnected — ${this.clients.size} remaining`);
    });

    console.log(`[SSE] client ${id} connected — ${this.clients.size} total`);
    return id;
  }

  /** Broadcast an event to ALL connected clients */
  broadcast<T>(type: StreamEventType, payload: T): void {
    if (this.clients.size === 0) return;

    const event: StreamEvent<T> = {
      id:        uuid(),
      type,
      timestamp: new Date().toISOString(),
      payload,
    };

    for (const client of this.clients.values()) {
      this.sendToClient(client, event);
    }
  }

  /** Send a typed SSE event to a single client */
  private sendToClient<T>(client: SSEClient, event: StreamEvent<T>): void {
    try {
      // SSE wire format:
      //   id: <uuid>
      //   event: <type>
      //   data: <json>\n\n
      client.res.write(`id: ${event.id}\n`);
      client.res.write(`event: ${event.type}\n`);
      client.res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      // client disconnected mid-write — remove silently
      this.clients.delete(client.id);
    }
  }

  /** Send heartbeat to keep connections alive through proxies */
  heartbeat(): void {
    this.broadcast('system:heartbeat', {
      ts:          new Date().toISOString(),
      clientCount: this.clients.size,
    });
  }

  get clientCount(): number {
    return this.clients.size;
  }
}

export const streamManager = new StreamManager();
