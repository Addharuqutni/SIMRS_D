/**
 * Lightweight WebSocket server for real-time queue updates.
 *
 * Uses the built-in `http` upgrade mechanism — no external socket.io
 * dependency. Clients connect to ws://host:port/ws and receive JSON
 * `event` messages. The server also exposes `emitQueueUpdate()` so
 * any Express route can broadcast a queue change to all connected
 * display boards / loket clients instantly.
 *
 * Message shape (server → client):
 *   { "type": "queue:update", "poli": "UMU", "data": { ... } }
 *   { "type": "queue:called", "poli": "UMU", "code": "A-005", "loket": "Loket 1" }
 *
 * Message shape (client → server): none required (server-push only).
 * A heartbeat ping keeps the connection alive through proxies.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import { logger } from './logger';

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

/**
 * Attach the WebSocket server to an existing HTTP server.
 * Called once from src/index.ts after the Express app is ready.
 */
export function initWebSocket(server: Server): WebSocketServer {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        clients.add(ws);
        const ip = req.socket.remoteAddress || 'unknown';
        logger.info(`WS client connected from ${ip} (${clients.size} total)`);

        ws.on('message', (raw: Buffer) => {
            // Clients may send a "subscribe" message to filter by poli, but
            // for simplicity we broadcast to everyone (small client count).
            try {
                const msg = JSON.parse(raw.toString());
                logger.debug(`WS inbound: ${JSON.stringify(msg)}`);
            } catch {
                /* ignore malformed */
            }
        });

        ws.on('close', () => {
            clients.delete(ws);
            logger.info(`WS client disconnected (${clients.size} remaining)`);
        });

        ws.on('error', (err: Error) => {
            logger.error(`WS client error: ${err.message}`);
            clients.delete(ws);
        });

        // Heartbeat: send ping every 30s; browser keeps connection alive.
        ws.send(JSON.stringify({ type: 'connected', message: 'SIMRS WebSocket connected' }));
    });

    return wss;
}

/**
 * Broadcast a JSON event to all connected WebSocket clients.
 * Silently no-ops if no clients are connected (e.g. no display board running).
 */
export function broadcast(type: string, data: unknown): void {
    if (!wss || clients.size === 0) return;

    const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}

/**
 * Convenience: broadcast a queue update event (called by the schedule
 * module whenever a queue is called/finished/reset).
 */
export function emitQueueUpdate(poli: string, data: unknown): void {
    broadcast('queue:update', { poli, data });
}

/**
 * Convenience: broadcast a queue-called event (with audio-cue info for
 * the display board's TTS announcement).
 */
export function emitQueueCalled(poli: string, code: string, loket?: string): void {
    broadcast('queue:called', { poli, code, loket });
}
