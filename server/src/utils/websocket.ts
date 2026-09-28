/**
 * Lightweight WebSocket server for real-time queue updates.
 *
 * Clients connect to ws://host:port/ws and receive JSON messages; routes call
 * `emitQueueUpdate()` / `emitQueueCalled()` to push queue changes to every
 * display board and loket screen.
 *
 * Message shape (server → client), always `{ type, data, timestamp }`:
 *   { type: "queue:update", data: { poli, data: {...} }, timestamp }
 *   { type: "queue:called", data: { poli, code, loket? }, timestamp }
 *   { type: "connected",    data: { message }, timestamp }
 *
 * The server pings every 30s and drops clients that stop answering.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import { logger } from './logger';

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();
const alive = new WeakMap<WebSocket, boolean>();
const HEARTBEAT_MS = 30_000;

/**
 * Attach the WebSocket server to an existing HTTP server.
 * Called once from src/index.ts after the Express app is ready.
 */
export function initWebSocket(server: Server): WebSocketServer {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        clients.add(ws);
        alive.set(ws, true);
        ws.on('pong', () => alive.set(ws, true));
        const ip = req.socket.remoteAddress || 'unknown';
        logger.info(`WS client connected from ${ip} (${clients.size} total)`);

        ws.on('close', () => {
            clients.delete(ws);
            logger.info(`WS client disconnected (${clients.size} remaining)`);
        });

        ws.on('error', (err: Error) => {
            logger.error(`WS client error: ${err.message}`);
            clients.delete(ws);
        });

        ws.send(JSON.stringify({ type: 'connected', data: { message: 'SIMRS WebSocket connected' }, timestamp: new Date().toISOString() }));
    });

    const heartbeat = setInterval(() => {
        for (const ws of clients) {
            if (!alive.get(ws)) {
                clients.delete(ws);
                ws.terminate();
                continue;
            }
            alive.set(ws, false);
            ws.ping();
        }
    }, HEARTBEAT_MS);
    wss.on('close', () => clearInterval(heartbeat));

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
