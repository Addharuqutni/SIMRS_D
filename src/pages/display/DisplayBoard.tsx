import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '../../lib/api/settings';
import { useDisplayQueues } from '../../hooks/useSchedule';
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

/**
 * Papan Antrian Poliklinik — fullscreen kiosk board for the hospital lobby TV.
 * Renders standalone (outside AppLayout) and is always dark, independent of the app theme.
 */
export function DisplayBoard() {
    const [now, setNow] = useState(() => new Date());

    // Live queue per poli; the hook refreshes the cache on every server queue event.
    const { data: antrean = [], lastEvent, connected } = useDisplayQueues();

    useEffect(() => {
        const id = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(id);
    }, []);

    const { data: publicSettings } = useQuery({
        queryKey: ['public-settings'],
        queryFn: settingsApi.getPublicSettings,
        staleTime: 5 * 60_000,
    });

    // Voice announcement: speak once per `queue:called` server event, using the event
    // payload (poli + called code + loket) instead of diffing the board state.
    const lastAnnounced = useRef<string | null>(null);
    useEffect(() => {
        if (!lastEvent || lastEvent.type !== 'queue:called') return;
        if (lastAnnounced.current === lastEvent.timestamp) return;
        lastAnnounced.current = lastEvent.timestamp;

        if (!('speechSynthesis' in window)) return;
        const { code, poli, loket } = lastEvent.data;
        const text = `Nomor antrian ${queueCodeToSpeech(code)}, ${poli}${loket ? `, silakan menuju ${loket}` : ''}`;

        // Cancel anything still speaking so rapid calls don't queue up.
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        window.speechSynthesis.speak(utterance);
    }, [lastEvent]);

    return (
        <div className={styles.board}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Papan Antrian Poliklinik</h1>
                    <p className={styles.subtitle}>{publicSettings?.namaRS ?? 'SIMRS Tipe D'}</p>
                </div>
                <div className={styles.clockBlock}>
                    <time className={styles.clock}>
                        {[now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')}
                    </time>
                    <p className={styles.date}>
                        {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
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
                            <p className={styles.dokter}>{q.dokter ?? ''}</p>
                        </div>
                        <div className={styles.serving}>
                            <span className={styles.servingLabel}>Sedang Dilayani</span>
                            <span className={styles.servingNumber}>{q.sedangDilayani ?? '—'}</span>
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
