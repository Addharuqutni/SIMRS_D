import { MonitorPlay, Users, Volume2, Wifi, WifiOff } from 'lucide-react';
import { Card, Button, StatusBadge, showToast } from '../../components/ui';
import { useDisplayQueues, useNextQueue, useRecallQueue, useSkipQueue } from '../../hooks/useSchedule';
import type { AntreanItem } from '../../lib/api/schedule';
import { errorMessage } from '../../lib/api-error';
import styles from '../registrasi/registrasi.module.css';

export function Antrean() {
    const { data: antreanList = [], isLoading, connected } = useDisplayQueues();
    const next = useNextQueue();
    const skip = useSkipQueue();
    const recall = useRecallQueue();
    const busy = next.isPending || skip.isPending || recall.isPending;

    const run = async (label: string, fn: () => Promise<unknown>) => {
        try {
            await fn();
            showToast(label, 'success');
        } catch (err) {
            showToast(errorMessage(err, `Gagal: ${label}`), 'danger');
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Monitor Antrean Poliklinik</h1>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <StatusBadge variant={connected ? 'success' : 'warning'}>
                        {connected ? <><Wifi size={12} /> Real-time</> : <><WifiOff size={12} /> Menyambung ulang...</>}
                    </StatusBadge>
                    <Button variant="primary" onClick={() => window.open('/display', '_blank', 'noopener')}>
                        <MonitorPlay size={16} /> Buka Display Antrean
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div style={{ color: 'var(--text-muted)' }}>Memuat antrean...</div>
            ) : antreanList.length === 0 ? (
                <Card><div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Belum ada antrean hari ini</div></Card>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    {antreanList.map((a: AntreanItem) => (
                        <Card key={a.poli} title={a.poli}>
                            <div style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                                {a.dokter ?? 'Belum ada dokter terjadwal hari ini'}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '16px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Nomor Antrean Saat Ini</div>
                                <div style={{ fontSize: '48px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '2px', lineHeight: 1 }}>
                                    {a.sedangDilayani ?? '—'}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--primary-50)', borderRadius: 'var(--radius-md)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Users size={16} style={{ color: 'var(--primary)' }} />
                                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Sisa Antrean: <strong style={{ color: a.sisa === 0 ? 'var(--success)' : 'var(--text)' }}>{a.sisa}</strong></span>
                                </div>
                                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total: {a.total}</span>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                <Button variant="ghost" title="Panggil Ulang" disabled={busy || !a.sedangDilayani}
                                    onClick={() => run(`Memanggil ulang ${a.sedangDilayani}`, () => recall.mutateAsync(a.poli))}>
                                    <Volume2 size={14} />
                                </Button>
                                <Button variant="secondary" style={{ flex: 1 }} disabled={busy || !a.sedangDilayani}
                                    onClick={() => run(`${a.sedangDilayani} dilewati`, () => skip.mutateAsync(a.poli))}>
                                    Lewati
                                </Button>
                                <Button variant="primary" style={{ flex: 2 }} disabled={busy || a.sisa <= 0}
                                    onClick={() => run(`Memanggil nomor berikutnya di ${a.poli}`, () => next.mutateAsync(a.poli))}>
                                    {a.sisa <= 0 ? 'Tidak ada antrean' : 'Panggil Selanjutnya'}
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
