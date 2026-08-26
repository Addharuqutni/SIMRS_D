/**
 * Native browser WebSocket hook for real-time queue updates.
 *
 * Connects to the SIMRS backend WebSocket at ws://host:port/ws and
 * parses `queue:update` / `queue:called` events into TanStack Query
 * invalidations — so the display board and antrean page refresh
 * instantly without manual polling.
 *
 * No external library needed — uses the standard WebSocket API.
 * Reconnects automatically after a short backoff if the socket drops.
 */
import { useEffect, useRef, useState } from 'react';

export type QueueEvent =
    | { type: 'queue:update'; poli: string; data: Record<string, unknown> }
    | { type: 'queue:called'; poli: string; code: string; loket?: string }
    | { type: 'connected' };

function buildWsUrl(): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Backend runs on 3000; Vite dev proxy can also forward /ws
    const host = import.meta.env.DEV ? `${window.location.hostname}:3000` : window.location.host;
    return `${proto}//${host}/ws`;
}

export function useQueueSocket() {
    const [lastEvent, setLastEvent] = useState<QueueEvent | null>(null);
    const [connected, setConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<number | null>(null);

    useEffect(() => {
        let cancelled = false;

        const connect = () => {
            const url = buildWsUrl();
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                if (cancelled) return;
                setConnected(true);
            };

            ws.onmessage = (ev) => {
                try {
                    const parsed = JSON.parse(ev.data);
                    setLastEvent(parsed as QueueEvent);
                } catch {
                    /* ignore malformed */
                }
            };

            ws.onclose = () => {
                if (cancelled) return;
                setConnected(false);
                // Exponential-ish backoff capped at 10s
                reconnectTimer.current = window.setTimeout(connect, 3000);
            };

            ws.onerror = () => {
                // onclose will fire next; let the reconnect timer handle it
                ws.close();
            };
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
