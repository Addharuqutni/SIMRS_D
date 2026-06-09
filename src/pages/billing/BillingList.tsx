import { useState } from 'react';
import { Wallet, Eye, Printer, CheckCircle, CreditCard, DollarSign } from 'lucide-react';
import { Button, StatusBadge, SearchBar, FilterTabs, Pagination, Card, Modal, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';
import { useBillings, useBillingDetail, usePayBilling } from '../../hooks/useBilling';
import type { Billing } from '../../lib/api/billing';

const statusMap: Record<string, { label: string; variant: 'info' | 'warning' | 'success' }> = {
    open: { label: 'Terbuka', variant: 'info' },
    finalized: { label: 'Difinalisasi', variant: 'warning' },
    paid: { label: 'Lunas', variant: 'success' },
};

export function BillingList() {
    const { data: billings = [] } = useBillings();
    const payMutation = usePayBilling();

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('semua');

    // Modals
    const [detailModalId, setDetailModalId] = useState<string | null>(null);
    const { data: detailData, isFetching: detailFetching } = useBillingDetail(detailModalId || '');
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [paymentTarget, setPaymentTarget] = useState<Billing | null>(null);
    const [paymentMethod, setPaymentMethod] = useState('tunai');

    const filtered = billings.filter((b: Billing) => {
        const matchSearch = search.trim() === '' ||
            (b.patientName?.toLowerCase().includes(search.toLowerCase()) || '') ||
            (b.noBilling.toLowerCase().includes(search.toLowerCase())) ||
            (b.rm?.includes(search) || '');
        const matchFilter = filter === 'semua' || b.status === filter;
        return matchSearch && matchFilter;
    });

    const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
    const totalOpen = billings.filter((b: Billing) => b.status === 'open' || b.status === 'finalized').reduce((a: number, b2: Billing) => a + b2.total, 0);
    const totalPaid = billings.filter((b: Billing) => b.status === 'paid').reduce((a: number, b2: Billing) => a + b2.total, 0);

    const handlePayment = async () => {
        if (!paymentTarget) return;
        try {
            await payMutation.mutateAsync({ id: paymentTarget.id, metodePembayaran: paymentMethod });
            showToast(`Pembayaran "${paymentTarget.noBilling}" berhasil dicatat (${paymentMethod})`, 'success');
            setPaymentOpen(false);
            setPaymentTarget(null);
        } catch {
            showToast('Gagal memproses pembayaran kasir', 'danger');
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Daftar Invois / Kasir</h1>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '12px', color: '#3b82f6' }}><Wallet size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{billings.filter((b: Billing) => b.status === 'open').length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Draf Open</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '12px', color: '#d97706' }}><CheckCircle size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{billings.filter((b: Billing) => b.status === 'finalized').length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Menunggu Pembayaran</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '12px', color: '#16a34a' }}><DollarSign size={20} /></div>
                        <div><div style={{ fontSize: '14px', fontWeight: 700 }}>{formatRp(totalPaid)}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Lunas (Hari Ini)</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '12px', color: '#dc2626' }}><CreditCard size={20} /></div>
                        <div><div style={{ fontSize: '14px', fontWeight: 700 }}>{formatRp(totalOpen)}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Outstanding</div></div>
                    </div>
                </Card>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari No. Billing / Pasien / RM..." value={search} onChange={setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: billings.length },
                        { label: 'Menunggu', value: 'finalized', count: billings.filter((b: Billing) => b.status === 'finalized').length },
                        { label: 'Lunas', value: 'paid', count: billings.filter((b: Billing) => b.status === 'paid').length },
                    ]}
                    active={filter} onChange={setFilter}
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
                        {filtered.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada tagihan/kasir ditemukan</td></tr>
                        ) : filtered.map((bill: Billing, i: number) => (
                            <tr key={i}>
                                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{bill.noBilling}</td>
                                <td>{new Date(bill.createdAt).toLocaleDateString('id-ID')}</td>
                                <td>
                                    <div className={styles.nameCell}>
                                        <span className={styles.namePrimary}>{bill.patientName}</span>
                                        <span className={styles.nameSecondary}>RM: {bill.rm}</span>
                                    </div>
                                </td>
                                <td>
                                    <div className={styles.nameCell}>
                                        <span className={styles.namePrimary}>Asuransi Swasta / Umum / JKN</span>
                                    </div>
                                </td>
                                <td>
                                    <StatusBadge variant={'info'} dot={false}>BPJS / Umum</StatusBadge>
                                </td>
                                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatRp(bill.total)}</td>
                                <td>
                                    <StatusBadge variant={statusMap[bill.status].variant}>
                                        {statusMap[bill.status].label}
                                    </StatusBadge>
                                </td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        <Button variant="ghost" size="sm" title="Lihat Detail" style={{ color: 'var(--primary)' }}
                                            onClick={() => setDetailModalId(bill.id)}>
                                            <Eye size={14} />
                                        </Button>
                                        {bill.status === 'finalized' && (
                                            <Button variant="primary" size="sm" onClick={() => { setPaymentTarget(bill); setPaymentOpen(true); }}>
                                                <DollarSign size={12} /> Bayar
                                            </Button>
                                        )}
                                        {bill.status === 'paid' && (
                                            <Button variant="ghost" size="sm" style={{ color: 'var(--text-muted)' }}
                                                onClick={() => showToast('Mencetak kwitansi...', 'info')}>
                                                <Printer size={14} />
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination currentPage={1} totalPages={Math.ceil(filtered.length / 10) || 1} totalItems={filtered.length} onPageChange={() => { }} />
            </div>

            {/* Detail Modal */}
            <Modal open={!!detailModalId} onClose={() => setDetailModalId(null)}
                title={`Detail Invois — ${detailData?.noBilling || 'Memuat...'}`} icon={<Eye size={20} />} size="lg">
                {detailFetching ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>Memuat narasi otomatis...</div>
                ) : detailData && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '14px' }}>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Pasien</strong>{detailData.patientName} (RM: {detailData.rm})</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Status Invois</strong>{detailData.status}</div>
                        </div>

                        <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Rincian Biaya Otomatis</h4>
                        <table className={uiStyles.table}>
                            <thead><tr><th>Kategori</th><th>Item Detail</th><th style={{ textAlign: 'right' }}>Biaya</th></tr></thead>
                            <tbody>
                                {detailData.items?.map((item, id) => (
                                    <tr key={id}>
                                        <td><StatusBadge variant="neutral" dot={false}>{item.kategori}</StatusBadge></td>
                                        <td>{item.namaItem} x{item.jumlah}</td>
                                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatRp(item.subtotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Total Biaya</span>
                                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{formatRp(detailData.total)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '2px solid var(--border)', fontSize: '16px' }}>
                                <span style={{ fontWeight: 700 }}>Total Pembayaran Pribadi</span>
                                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '20px' }}>
                                    {formatRp(detailData.total)}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button variant="secondary" onClick={() => showToast('Mencetak kwitansi...', 'info')}><Printer size={14} /> Cetak Kwitansi</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Payment Modal */}
            <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)}
                title={`Pembayaran Kasir — ${paymentTarget?.noBilling || ''}`} icon={<DollarSign size={20} />}
                footer={<><Button variant="secondary" onClick={() => setPaymentOpen(false)}>Batal</Button><Button variant="primary" onClick={handlePayment} disabled={payMutation.isPending}><CheckCircle size={16} /> Konfirmasi Lunas</Button></>}>
                {paymentTarget && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>{paymentTarget.patientName}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Status: {paymentTarget.status}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Bayar</div>
                            <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                                {formatRp(paymentTarget.total)}
                            </div>
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Metode Pembayaran</label>
                            <select className={uiStyles.formSelect} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                <option value="tunai">Tunai</option>
                                <option value="debit">Kartu Debit</option>
                                <option value="kredit">Kartu Kredit</option>
                                <option value="transfer">Transfer Bank</option>
                                <option value="qris">QRIS</option>
                            </select>
                        </div>
                    </div>
                )}
            </Modal>

        </div>
    );
}
