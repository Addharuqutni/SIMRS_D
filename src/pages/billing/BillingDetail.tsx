import { formatRp } from '../../lib/format';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, User, CreditCard } from 'lucide-react';
import { Button, StatusBadge, ConfirmDialog, showToast, Printable, LifecycleBadge } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';
import { useBillingDetail, useFinalizeBilling } from '../../hooks/useBilling';
import { PAYMENT_METHODS } from '../../lib/api/billing';
import { errorMessage } from '../../lib/api-error';

export function BillingDetail() {
    const navigate = useNavigate();
    const { id = '' } = useParams();
    const { data: bill, isLoading, error } = useBillingDetail(id);
    const finalizeMutation = useFinalizeBilling();
    const [confirmOpen, setConfirmOpen] = useState(false);

    const handleFinalize = async () => {
        if (!bill) return;
        try {
            await finalizeMutation.mutateAsync(bill.visitId);
            showToast('Billing berhasil difinalisasi', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal memfinalisasi billing'), 'danger');
        } finally {
            setConfirmOpen(false);
        }
    };

    const back = (
        <button
            onClick={() => navigate('/billing')}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px',
                background: 'none', border: 'none', cursor: 'pointer',
            }}
        >
            <ArrowLeft size={16} /> Kembali ke Daftar Billing
        </button>
    );

    if (isLoading) return <div className={styles.formPage}>{back}<p>Memuat tagihan...</p></div>;
    if (!bill) return <div className={styles.formPage}>{back}<p style={{ color: 'var(--danger)' }}>{errorMessage(error, 'Tagihan tidak ditemukan')}</p></div>;

    const metode = PAYMENT_METHODS.find((m) => m.value === bill.metodePembayaran)?.label;

    return (
        <div className={styles.formPage}>
            {back}

            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Billing {bill.noBilling}</h1>
                <LifecycleBadge kind="billing" status={bill.status} />
            </div>

            <Printable title={`Kuitansi ${bill.noBilling} - ${bill.patientName}`} buttonText="Cetak Kwitansi">
                <div className={styles.formSection}>
                    <h3 className={styles.formSectionTitle}><User size={18} /> Informasi Pasien</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', fontSize: '14px' }}>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Nama Pasien</div>
                            <div style={{ fontWeight: 600 }}>{bill.patientName}</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No. Rekam Medis</div>
                            <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{bill.rm}</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Jaminan</div>
                            <div><StatusBadge variant="info" dot={false}>{bill.jaminan}</StatusBadge></div>
                        </div>
                    </div>
                </div>

                <div className={styles.formSection}>
                    <h3 className={styles.formSectionTitle}><CreditCard size={18} /> Rincian Biaya</h3>
                    <table className={uiStyles.table}>
                        <thead>
                            <tr>
                                <th>Kategori</th><th>Item</th>
                                <th style={{ textAlign: 'right' }}>Harga</th><th style={{ textAlign: 'right' }}>Jml</th>
                                <th style={{ textAlign: 'right' }}>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(bill.items ?? []).length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada layanan yang ditagihkan</td></tr>
                            ) : bill.items!.map((item) => (
                                <tr key={item.id}>
                                    <td><StatusBadge variant="neutral" dot={false}>{item.kategori}</StatusBadge></td>
                                    <td>{item.namaItem}</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatRp(item.harga)}</td>
                                    <td style={{ textAlign: 'right' }}>{item.jumlah}</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatRp(item.subtotal)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{
                        marginTop: '20px', padding: '16px', background: 'var(--bg)',
                        borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                        display: 'flex', justifyContent: 'space-between', fontSize: '16px',
                    }}>
                        <span style={{ fontWeight: 700 }}>Total{metode ? ` (dibayar: ${metode})` : ''}</span>
                        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '20px' }}>{formatRp(bill.total)}</span>
                    </div>
                </div>
            </Printable>

            {bill.status === 'open' && (
                <div className={styles.formActions} style={{ marginTop: '24px' }}>
                    <Button variant="primary" onClick={() => setConfirmOpen(true)} disabled={finalizeMutation.isPending}>
                        <CheckCircle size={16} /> Finalisasi Billing
                    </Button>
                </div>
            )}

            <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleFinalize}
                title="Finalisasi Billing?" message="Setelah difinalisasi, layanan baru tidak dapat ditagihkan ke kunjungan ini."
                variant="warning" confirmLabel="Ya, Finalisasi" />
        </div>
    );
}
