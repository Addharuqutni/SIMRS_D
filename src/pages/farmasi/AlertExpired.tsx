import { useState } from 'react';
import { AlertTriangle, Clock, Trash2, Package, RefreshCcw } from 'lucide-react';
import { Button, StatusBadge, SearchBar, FilterTabs, Pagination, Card, ConfirmDialog, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';

interface ExpiredItem {
    kode: string; nama: string; kategori: string; bentuk: string;
    stok: number; ed: string; status: 'expired' | 'warning' | 'aman';
    supplier: string;
}

const initialItems: ExpiredItem[] = [];

export function AlertExpired() {
    const [items, setItems] = useState<ExpiredItem[]>(initialItems);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('semua');
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<ExpiredItem | null>(null);

    const filtered = items.filter(item => {
        const matchSearch = search.trim() === '' ||
            item.nama.toLowerCase().includes(search.toLowerCase()) ||
            item.kode.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === 'semua' ||
            (filter === 'expired' && item.status === 'expired') ||
            (filter === 'warning' && item.status === 'warning');
        return matchSearch && matchFilter;
    });

    const expiredCount = items.filter(i => i.status === 'expired').length;
    const warningCount = items.filter(i => i.status === 'warning').length;

    const handleMusnahkan = () => {
        if (!deleteTarget) return;
        setItems(prev => prev.filter(i => i.kode !== deleteTarget.kode));
        showToast(`Item "${deleteTarget.nama}" (${deleteTarget.stok} ${deleteTarget.bentuk}) dimusnahkan dan dicatat`, 'success');
    };

    const handleReturnSupplier = (item: ExpiredItem) => {
        setItems(prev => prev.filter(i => i.kode !== item.kode));
        showToast(`Retur ${item.stok} ${item.bentuk} "${item.nama}" ke ${item.supplier} berhasil dicatat`, 'info');
    };

    const getDaysUntilExpiry = (ed: string) => {
        const today = new Date();
        const expiry = new Date(ed);
        const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Alert Expired & Near-Expiry</h1>
                <Button variant="secondary" onClick={() => showToast('Laporan obat kadaluarsa diekspor ke Excel', 'info')}>
                    <RefreshCcw size={16} /> Ekspor Laporan
                </Button>
            </div>

            {/* Alert Banner */}
            {expiredCount > 0 && (
                <div style={{
                    background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 'var(--radius-md)',
                    padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                    <AlertTriangle size={24} style={{ color: '#dc2626', flexShrink: 0 }} />
                    <div>
                        <div style={{ fontWeight: 700, color: '#991b1b' }}>⚠ {expiredCount} Item Telah Kadaluarsa!</div>
                        <div style={{ fontSize: '13px', color: '#b91c1c' }}>Segera lakukan penarikan dan pemusnahan sesuai prosedur.</div>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '12px', color: '#dc2626' }}><AlertTriangle size={24} /></div>
                        <div><div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>{expiredCount}</div><div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Telah Kadaluarsa</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fffbeb', padding: '12px', borderRadius: '12px', color: '#d97706' }}><Clock size={24} /></div>
                        <div><div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706' }}>{warningCount}</div><div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Mendekati ED (&lt;3 bulan)</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '12px', color: '#3b82f6' }}><Package size={24} /></div>
                        <div><div style={{ fontSize: '24px', fontWeight: 700 }}>{items.length}</div><div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Alert Aktif</div></div>
                    </div>
                </Card>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari nama obat, kode..." value={search} onChange={setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua Alert', value: 'semua', count: items.length },
                        { label: 'Kadaluarsa', value: 'expired', count: expiredCount },
                        { label: 'Mendekati ED', value: 'warning', count: warningCount },
                    ]}
                    active={filter} onChange={setFilter}
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead>
                        <tr>
                            <th>Kode</th><th>Nama Obat/Alkes</th><th>Kategori</th>
                            <th style={{ textAlign: 'right' }}>Stok</th><th>Exp. Date</th>
                            <th>Status</th><th>Supplier</th><th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada alert ditemukan 🎉</td></tr>
                        ) : filtered.map((item, i) => {
                            const daysLeft = getDaysUntilExpiry(item.ed);
                            return (
                                <tr key={i} style={{ background: item.status === 'expired' ? '#fef2f233' : undefined }}>
                                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{item.kode}</td>
                                    <td style={{ fontWeight: 600 }}>{item.nama}</td>
                                    <td><StatusBadge variant="neutral" dot={false}>{item.kategori}</StatusBadge></td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{item.stok.toLocaleString('id-ID')}</td>
                                    <td>
                                        <span style={{ color: item.status === 'expired' ? '#dc2626' : '#d97706', fontWeight: 600 }}>
                                            {item.ed}
                                        </span>
                                        <div style={{ fontSize: '11px', color: item.status === 'expired' ? '#dc2626' : '#d97706' }}>
                                            {daysLeft <= 0 ? `Kadaluarsa ${Math.abs(daysLeft)} hari lalu` : `${daysLeft} hari lagi`}
                                        </div>
                                    </td>
                                    <td>
                                        <StatusBadge variant={item.status === 'expired' ? 'danger' : 'warning'}>
                                            {item.status === 'expired' ? '❌ Kadaluarsa' : '⚠ Mendekati ED'}
                                        </StatusBadge>
                                    </td>
                                    <td style={{ fontSize: '13px' }}>{item.supplier}</td>
                                    <td>
                                        <div className={styles.actionBtns}>
                                            {item.status === 'expired' && (
                                                <>
                                                    <Button variant="danger" size="sm" onClick={() => { setDeleteTarget(item); setDeleteOpen(true); }}>
                                                        <Trash2 size={12} /> Musnahkan
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleReturnSupplier(item)}>
                                                        Retur
                                                    </Button>
                                                </>
                                            )}
                                            {item.status === 'warning' && (
                                                <Button variant="secondary" size="sm" onClick={() => {
                                                    showToast(`Pengingat dikirim ke bagian pengadaan untuk "${item.nama}"`, 'info');
                                                }}>
                                                    Ingatkan Pengadaan
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <Pagination currentPage={1} totalPages={1} totalItems={filtered.length} onPageChange={() => { }} />
            </div>

            {/* Delete Confirm */}
            <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleMusnahkan}
                title="Pemusnahan Obat Kadaluarsa"
                message={`Item "${deleteTarget?.nama}" (${deleteTarget?.stok} ${deleteTarget?.bentuk}) akan dicatat sebagai dimusnahkan. Tindakan ini tidak dapat dibatalkan.`}
                variant="danger" confirmLabel="Ya, Musnahkan" />
        </div>
    );
}
