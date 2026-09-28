import { formatRp } from '../../lib/format';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Eye, CheckCircle, CreditCard, DollarSign } from 'lucide-react';
import { Button, SearchBar, FilterTabs, Pagination, Card, Modal, showToast, LifecycleBadge, StatusBadge } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';
import { useBillingList, usePayBilling } from '../../hooks/useBilling';
import { PAYMENT_METHODS, type Billing, type PaymentMethod } from '../../lib/api/billing';
import { errorMessage } from '../../lib/api-error';

export function BillingList() {
    const navigate = useNavigate();
    const list = useBillingList();
    const payMutation = usePayBilling();

    const [paymentTarget, setPaymentTarget] = useState<Billing | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('tunai');

    const handlePayment = async () => {
        if (!paymentTarget) return;
        try {
            await payMutation.mutateAsync({ id: paymentTarget.id, metodePembayaran: paymentMethod });
            showToast(`Pembayaran "${paymentTarget.noBilling}" berhasil dicatat`, 'success');
            setPaymentTarget(null);
        } catch (err) {
            showToast(errorMessage(err, 'Gagal memproses pembayaran'), 'danger');
        }
    };

    const summary = [
        { icon: <Wallet size={20} />, bg: '#eff6ff', fg: '#3b82f6', value: list.counts.open ?? 0, label: 'Tagihan Berjalan' },
        { icon: <CheckCircle size={20} />, bg: '#fffbeb', fg: '#d97706', value: list.counts.finalized ?? 0, label: 'Menunggu Pembayaran' },
        { icon: <DollarSign size={20} />, bg: '#f0fdf4', fg: '#16a34a', value: list.counts.paid ?? 0, label: 'Lunas' },
    ];

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Daftar Invois / Kasir</h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {summary.map((s) => (
                    <Card key={s.label}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: s.bg, padding: '10px', borderRadius: '12px', color: s.fg }}>{s.icon}</div>
                            <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{s.value}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.label}</div></div>
                        </div>
                    </Card>
                ))}
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari No. Billing / Pasien / RM..." value={list.search} onChange={list.setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: list.totalAll },
                        { label: 'Berjalan', value: 'open', count: list.counts.open ?? 0 },
                        { label: 'Menunggu Bayar', value: 'finalized', count: list.counts.finalized ?? 0 },
                        { label: 'Lunas', value: 'paid', count: list.counts.paid ?? 0 },
                    ]}
                    active={list.status} onChange={list.setStatus}
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead>
                        <tr>
                            <th>No. Billing</th><th>Tanggal</th><th>Pasien</th><th>Poli / Unit</th>
                            <th>Jaminan</th><th style={{ textAlign: 'right' }}>Total</th><th>Status</th><th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.isLoading ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat tagihan...</td></tr>
                        ) : list.isError ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--danger)' }}>{errorMessage(list.error, 'Gagal memuat tagihan')}</td></tr>
                        ) : list.rows.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada tagihan ditemukan</td></tr>
                        ) : list.rows.map((bill) => (
                            <tr key={bill.id}>
                                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{bill.noBilling}</td>
                                <td>{new Date(bill.createdAt).toLocaleDateString('id-ID')}</td>
                                <td>
                                    <div className={styles.nameCell}>
                                        <span className={styles.namePrimary}>{bill.patientName}</span>
                                        <span className={styles.nameSecondary}>RM: {bill.rm}</span>
                                    </div>
                                </td>
                                <td>{bill.poli}</td>
                                <td><StatusBadge variant="info" dot={false}>{bill.jaminan}</StatusBadge></td>
                                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatRp(bill.total)}</td>
                                <td><LifecycleBadge kind="billing" status={bill.status} /></td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        <Button variant="ghost" size="sm" title="Rincian & Cetak" style={{ color: 'var(--primary)' }}
                                            onClick={() => navigate(`/billing/${bill.id}`)}>
                                            <Eye size={14} />
                                        </Button>
                                        {bill.status === 'finalized' && (
                                            <Button variant="primary" size="sm" onClick={() => setPaymentTarget(bill)}>
                                                <DollarSign size={12} /> Bayar
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination {...list.paginationProps} />
            </div>

            <Modal open={!!paymentTarget} onClose={() => setPaymentTarget(null)}
                title={`Pembayaran Kasir — ${paymentTarget?.noBilling || ''}`} icon={<CreditCard size={20} />}
                footer={<><Button variant="secondary" onClick={() => setPaymentTarget(null)}>Batal</Button><Button variant="primary" onClick={handlePayment} disabled={payMutation.isPending}><CheckCircle size={16} /> Konfirmasi Lunas</Button></>}>
                {paymentTarget && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>{paymentTarget.patientName}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Jaminan: {paymentTarget.jaminan}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Bayar</div>
                            <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{formatRp(paymentTarget.total)}</div>
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Metode Pembayaran</label>
                            <select className={uiStyles.formSelect} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}>
                                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
