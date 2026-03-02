import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, CheckCircle, User, CreditCard } from 'lucide-react';
import { Button, StatusBadge, ConfirmDialog, showToast, Printable } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';

const billingItems = [
    { kategori: 'Jasa Dokter', item: 'Konsultasi Sp. Penyakit Dalam', biaya: 150000 },
    { kategori: 'Tindakan', item: 'Injeksi IV (99.29)', biaya: 50000 },
    { kategori: 'Obat & BHP', item: 'Paracetamol 500mg x10', biaya: 35000 },
    { kategori: 'Obat & BHP', item: 'Ambroxol 30mg x10', biaya: 25000 },
    { kategori: 'Obat & BHP', item: 'Cetirizine 10mg x5', biaya: 25000 },
    { kategori: 'Laboratorium', item: 'Hematologi Lengkap', biaya: 120000 },
];

export function BillingDetail() {
    const navigate = useNavigate();
    const [finalized, setFinalized] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const total = billingItems.reduce((acc, item) => acc + item.biaya, 0);
    const bpjsCover = total;
    const patientPay = 0;

    const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

    const handleFinalize = () => {
        setFinalized(true);
        showToast('Billing berhasil difinalisasi ✅', 'success');
    };

    return (
        <div className={styles.formPage}>
            <button
                className={styles.backLink}
                onClick={() => navigate('/billing')}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px',
                    background: 'none', border: 'none', cursor: 'pointer',
                }}
            >
                <ArrowLeft size={16} /> Kembali ke Daftar Billing
            </button>

            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Billing Pasien</h1>
                <StatusBadge variant={finalized ? 'success' : 'info'}>
                    {finalized ? '✅ Difinalisasi' : 'BPJS Kesehatan'}
                </StatusBadge>
            </div>

            {/* Main Wrapping for Printing */}
            <Printable title={`Kuitansi ${finalized ? 'Final' : 'Draf'} - Ahmad Sudrajat`} buttonText="Cetak Kwitansi">
                {/* Patient Info */}
                <div className={styles.formSection}>
                    <h3 className={styles.formSectionTitle}><User size={18} /> Informasi Pasien</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', fontSize: '14px' }}>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Nama Pasien</div>
                            <div style={{ fontWeight: 600 }}>Ahmad Sudrajat</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No. Rekam Medis</div>
                            <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>001234</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Jaminan</div>
                            <div><StatusBadge variant="info">BPJS Aktif</StatusBadge></div>
                        </div>
                    </div>
                </div>

                {/* Cost Breakdown */}
                <div className={styles.formSection}>
                    <h3 className={styles.formSectionTitle}><CreditCard size={18} /> Rincian Biaya</h3>
                    <table className={uiStyles.table}>
                        <thead>
                            <tr>
                                <th>Kategori</th>
                                <th>Item</th>
                                <th style={{ textAlign: 'right' }}>Biaya</th>
                            </tr>
                        </thead>
                        <tbody>
                            {billingItems.map((item, i) => (
                                <tr key={i}>
                                    <td><StatusBadge variant="neutral" dot={false}>{item.kategori}</StatusBadge></td>
                                    <td>{item.item}</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatRp(item.biaya)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{
                        marginTop: '20px', padding: '16px', background: 'var(--bg)',
                        borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Total Biaya</span>
                            <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{formatRp(total)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                            <span style={{ color: 'var(--success)' }}>Ditanggung BPJS</span>
                            <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>({formatRp(bpjsCover)})</span>
                        </div>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', paddingTop: '12px',
                            borderTop: '2px solid var(--border)', fontSize: '16px',
                        }}>
                            <span style={{ fontWeight: 700 }}>Bayar Pasien</span>
                            <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '20px' }}>{formatRp(patientPay)}</span>
                        </div>
                    </div>
                </div>
            </Printable>

            {/* Actions */}
            <div className={styles.formActions} style={{ marginTop: '24px' }}>
                <Button variant="secondary" onClick={() => showToast('Mencetak kwitansi...', 'info')}>
                    <Printer size={16} /> Cetak Kwitansi
                </Button>
                {!finalized ? (
                    <Button variant="primary" onClick={() => setConfirmOpen(true)}>
                        <CheckCircle size={16} /> Finalisasi Billing
                    </Button>
                ) : (
                    <Button variant="secondary" disabled>
                        <CheckCircle size={16} /> Billing Selesai
                    </Button>
                )}
            </div>

            <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleFinalize}
                title="Finalisasi Billing?" message="Setelah difinalisasi, billing ini tidak dapat diubah lagi. Pastikan semua item sudah benar."
                variant="warning" confirmLabel="Ya, Finalisasi" />
        </div>
    );
}
