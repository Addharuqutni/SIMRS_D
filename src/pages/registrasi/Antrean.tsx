import { MonitorPlay, Users, Volume2 } from 'lucide-react';
import { Card, Button, showToast } from '../../components/ui';
import { useDisplayQueues, useNextQueue } from '../../hooks/useSchedule';
import type { AntreanItem } from '../../lib/api/schedule';
import styles from '../registrasi/registrasi.module.css';

// Utility functions for string format removed as backend handles it

export function Antrean() {
    const { data: antreanList = [] } = useDisplayQueues();
    const nextMutation = useNextQueue();

    const handlePanggil = async (index: number) => {
        const target = antreanList[index];
        if (!target || target.sisa <= 0) return;

        try {
            await nextMutation.mutateAsync(target.poli);
            showToast(`Memanggil nomor urut selanjutnya di ${target.poli}`, 'success');
        } catch (error) {
            showToast(`Gagal memanggil antrean di ${target.poli}`, 'danger');
        }
    };

    const handleLewati = (index: number) => {
        const target = antreanList[index];
        if (!target || target.sisa <= 0) return;
        showToast(`Nomor antrean dilewati di ${target.poli}`, 'warning');
        // Future: Optional backend mutation for 'dilewati' status
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Monitor Antrean Poliklinik</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button variant="secondary" onClick={() => showToast('Memanggil ulang nomor antrean...', 'info')}>
                        <Volume2 size={16} /> Panggil Ulang
                    </Button>
                    <Button variant="primary" onClick={() => showToast('Display antrean dibuka di monitor eksternal', 'info')}>
                        <MonitorPlay size={16} /> Buka Display Antrean
                    </Button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {antreanList.map((antrean: AntreanItem, i: number) => (
                    <Card key={i} className="" title={antrean.poli}>
                        <div style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                            {antrean.dokter}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '16px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Nomor Antrean Saat Ini</div>
                            <div style={{ fontSize: '48px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '2px', lineHeight: 1 }}>
                                {antrean.sedangDilayani}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--primary-50)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Users size={16} style={{ color: 'var(--primary)' }} />
                                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Sisa Antrean: <strong style={{ color: antrean.sisa === 0 ? 'var(--success)' : 'var(--text)' }}>{antrean.sisa}</strong></span>
                            </div>
                            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total: {antrean.total}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                            <Button variant="secondary" style={{ flex: 1 }} onClick={() => handleLewati(i)} disabled={antrean.sisa <= 0}>Lewati</Button>
                            <Button variant="primary" style={{ flex: 2 }} onClick={() => handlePanggil(i)} disabled={antrean.sisa <= 0}>
                                {antrean.sisa <= 0 ? 'Selesai' : 'Panggil Selanjutnya'}
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
