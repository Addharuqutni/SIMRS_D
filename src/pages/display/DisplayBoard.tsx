import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { scheduleApi } from '../../lib/api/schedule';
import { settingsApi } from '../../lib/api/settings';
import { useQueueSocket } from '../../hooks/useWebSocket';
import styles from './display.module.css';

const DIGIT_WORDS = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];

/**
 * Spell a queue code for the Indonesian TTS: 'A-005' -> 'A, nol nol lima'.
 * Letters are read as letters, digits digit-by-digit, '-' becomes a pause.
 */
function queueCodeToSpeech(code: string): string {
    return code
        .split('')
        .map((ch) => (/\d/.test(ch) ? DIGIT_WORDS[Number(ch)] : ch === '-' ? ',' : ch.toUpperCase()))
        .join(' ');
}

function formatClock(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDate(date: Date): string {
    return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

/**
 * Papan Antrian Poliklinik — fullscreen kiosk board for the hospital lobby TV.
 * Renders standalone (outside AppLayout) and is always dark, independent of the app theme.
 */
export function DisplayBoard() {
    const [now, setNow] = useState(() => new Date());
    const queryClient = useQueryClient();
    const { lastEvent, connected } = useQueueSocket();

    useEffect(() => {
        const id = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(id);
    }, []);

    const { data: antrean = [] } = useQuery({
        queryKey: ['queues-display'],
        queryFn: scheduleApi.getDisplayQueues,
        refetchInterval: 5000, // Polling fallback — WS accelerates when available
    });

    // Real-time: invalidate the cache when a queue event arrives so the
    // board refreshes instantly instead of waiting for the next 5s poll.
    useEffect(() => {
        if (!lastEvent) return;
        if (lastEvent.type === 'queue:called' || lastEvent.type === 'queue:update') {
            queryClient.invalidateQueries({ queryKey: ['queues-display'] });
        }
    }, [lastEvent, queryClient]);

    const { data: publicSettings } = useQuery({
        queryKey: ['public-settings'],
        queryFn: settingsApi.getPublicSettings,
        staleTime: 5 * 60_000,
    });

    // Voice announcement: speak when a poli's sedangDilayani changes to a new non-empty value.
    // prev map is skipped on first load (prev === undefined) so we never announce stale numbers.
    const prevServing = useRef<Map<string, string>>(new Map());
    useEffect(() => {
        if (!('speechSynthesis' in window)) return;

        const announcements: string[] = [];
        const next = new Map<string, string>();
        for (const q of antrean) {
            next.set(q.poli, q.sedangDilayani);
            const prev = prevServing.current.get(q.poli);
            if (q.sedangDilayani && prev !== undefined && prev !== q.sedangDilayani) {
                announcements.push(`Nomor antrian ${queueCodeToSpeech(q.sedangDilayani)}, ${q.poli}`);
            }
        }
        prevServing.current = next;

        if (announcements.length === 0) return;
        // Cancel anything still speaking so rapid changes don't queue up.
        window.speechSynthesis.cancel();
        for (const text of announcements) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'id-ID';
            window.speechSynthesis.speak(utterance);
        }
    }, [antrean]);

    return (
        <div className={styles.board}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Papan Antrian Poliklinik</h1>
                    <p className={styles.subtitle}>{publicSettings?.namaRS ?? 'SIMRS Tipe D'}</p>
                </div>
                <div className={styles.clockBlock}>
                    <time className={styles.clock}>{formatClock(now)}</time>
                    <p className={styles.date}>{formatDate(now)}</p>
                    <span style={{ fontSize: '11px', opacity: 0.6 }}>
                        {connected ? '● Real-time' : '○ Polling 5s'}
                    </span>
                </div>
            </header>

            <main className={styles.grid}>
                {antrean.map((q, i) => (
                    <section key={`${q.poli}-${i}`} className={styles.card}>
                        <div className={styles.cardTop}>
                            <h2 className={styles.poli}>{q.poli}</h2>
                            <p className={styles.dokter}>{q.dokter}</p>
                        </div>
                        <div className={styles.serving}>
                            <span className={styles.servingLabel}>Sedang Dilayani</span>
                            <span className={styles.servingNumber}>{q.sedangDilayani}</span>
                        </div>
                        <div className={styles.meta}>
                            <span>Sisa: <strong>{q.sisa}</strong></span>
                            <span>Total: <strong>{q.total}</strong></span>
                        </div>
                    </section>
                ))}
                {antrean.length === 0 && (
                    <p className={styles.empty}>Menyiapkan data antrean...</p>
                )}
            </main>

            <footer className={styles.footer}>
                Mohon menunggu nomor antrean Anda dipanggil petugas
            </footer>
        </div>
    );
}
