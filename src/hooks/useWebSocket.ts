/**
 * Native browser WebSocket hook for real-time queue updates.
 *
 * Connects to the SIMRS backend at ws(s)://<api host>/ws. Every server message
 * is `{ type, data, timestamp }` (see server/src/utils/websocket.ts).
 * Reconnects with exponential backoff (1s → 10s) after a drop.
 */
import { useEffect, useRef, useState } from 'react';

export type QueueEvent =
    | { type: 'queue:update'; data: { poli: string; data: Record<string, unknown> }; timestamp: string }
    | { type: 'queue:called'; data: { poli: string; code: string; loket?: string }; timestamp: string }
    | { type: 'connected'; data: { message: string }; timestamp: string };

function buildWsUrl(): string {
    const api = new URL(import.meta.env.VITE_API_URL || 'http://localhost:3000', window.location.href);
    api.protocol = api.protocol === 'https:' ? 'wss:' : 'ws:';
    api.pathname = '/ws';
    return api.toString();
}

const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 10_000;

export function useQueueSocket() {
    const [lastEvent, setLastEvent] = useState<QueueEvent | null>(null);
    const [connected, setConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        let backoff = MIN_BACKOFF_MS;

        const connect = () => {
            const ws = new WebSocket(buildWsUrl());
            wsRef.current = ws;

            ws.onopen = () => {
                if (cancelled) return;
                backoff = MIN_BACKOFF_MS;
                setConnected(true);
            };

            ws.onmessage = (ev) => {
                try {
                    setLastEvent(JSON.parse(ev.data) as QueueEvent);
                } catch {
                    /* ignore malformed */
                }
            };

            ws.onclose = () => {
                if (cancelled) return;
                setConnected(false);
                reconnectTimer.current = window.setTimeout(connect, backoff);
                backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
            };

            ws.onerror = () => ws.close();
        };

        connect();

        return () => {
            cancelled = true;
            if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
            wsRef.current?.close();
        };
    }, []);

    return { lastEvent, connected };
}
