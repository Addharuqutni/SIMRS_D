import { useState } from 'react';
import { AlertTriangle, Clock, Trash2, Package, Undo2 } from 'lucide-react';
import { Button, StatusBadge, SearchBar, FilterTabs, Card, ConfirmDialog, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useDisposeBatch, useExpiringBatches } from '../../hooks/useInventory';
import type { ExpiringBatch } from '../../lib/api/inventory';
import { errorMessage } from '../../lib/api-error';
import { NEAR_EXPIRY_DAYS } from '../../../shared/inventory';
import styles from '../registrasi/registrasi.module.css';

const daysUntil = (ed: string) => Math.ceil((new Date(ed).getTime() - Date.now()) / 86_400_000);

export function AlertExpired() {
    const { data: batches = [], isLoading } = useExpiringBatches();
    const dispose = useDisposeBatch();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('semua');
    const [target, setTarget] = useState<{ batch: ExpiringBatch; jenis: 'MUSNAH' | 'RETUR' } | null>(null);

    const needle = search.trim().toLowerCase();
    const filtered = batches.filter((b) =>
        (filter === 'semua' || (filter === 'expired') === b.expired) &&
        (needle === '' || b.nama.toLowerCase().includes(needle) || b.kodeObat.toLowerCase().includes(needle) || b.noBatch.toLowerCase().includes(needle)));

    const expiredCount = batches.filter((b) => b.expired).length;
    const warningCount = batches.length - expiredCount;

    const confirm = async () => {
        if (!target) return;
        const { batch, jenis } = target;
        try {
            await dispose.mutateAsync({ id: batch.id, jenis });
            showToast(`${batch.qtySisa} ${batch.satuan ?? ''} "${batch.nama}" batch ${batch.noBatch} ${jenis === 'MUSNAH' ? 'dimusnahkan' : 'diretur'} dan dicatat di kartu stok`, 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal mencatat pengeluaran batch'), 'danger');
        } finally {
            setTarget(null);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.page}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: 'var(--text-secondary)' }}>
                    Memuat data batch...
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Alert Expired & Near-Expiry</h1>
            </div>

            {expiredCount > 0 && (
                <div style={{
                    background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 'var(--radius-md)',
                    padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                    <AlertTriangle size={24} style={{ color: '#dc2626', flexShrink: 0 }} />
                    <div>
                        <div style={{ fontWeight: 700, color: '#991b1b' }}>{expiredCount} Batch Telah Kadaluarsa!</div>
                        <div style={{ fontSize: '13px', color: '#b91c1c' }}>Batch kadaluarsa tidak lagi dipakai untuk dispensing. Musnahkan atau retur sesuai prosedur.</div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {[
                    { icon: <AlertTriangle size={24} />, bg: '#fef2f2', fg: '#dc2626', value: expiredCount, label: 'Batch Kadaluarsa' },
                    { icon: <Clock size={24} />, bg: '#fffbeb', fg: '#d97706', value: warningCount, label: `Mendekati ED (< ${NEAR_EXPIRY_DAYS} hari)` },
                    { icon: <Package size={24} />, bg: '#eff6ff', fg: '#3b82f6', value: batches.length, label: 'Total Alert Aktif' },
                ].map((c) => (
                    <Card key={c.label}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: c.bg, padding: '12px', borderRadius: '12px', color: c.fg }}>{c.icon}</div>
                            <div><div style={{ fontSize: '24px', fontWeight: 700, color: c.fg }}>{c.value}</div><div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{c.label}</div></div>
                        </div>
                    </Card>
                ))}
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari nama obat, kode, batch..." value={search} onChange={setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua Alert', value: 'semua', count: batches.length },
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
                            <th>Kode</th><th>Nama Obat/Alkes</th><th>Batch</th>
                            <th style={{ textAlign: 'right' }}>Sisa</th><th>Exp. Date</th>
                            <th>Status</th><th>Supplier</th><th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada alert ditemukan</td></tr>
                        ) : filtered.map((b) => {
                            const daysLeft = daysUntil(b.expiredDate);
                            const color = b.expired ? '#dc2626' : '#d97706';
                            return (
                                <tr key={b.id} style={{ background: b.expired ? '#fef2f233' : undefined }}>
                                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{b.kodeObat}</td>
                                    <td style={{ fontWeight: 600 }}>{b.nama}</td>
                                    <td style={{ fontFamily: 'var(--font-mono)' }}>{b.noBatch}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{b.qtySisa.toLocaleString('id-ID')} {b.satuan}</td>
                                    <td>
                                        <span style={{ color, fontWeight: 600 }}>{b.expiredDate}</span>
                                        <div style={{ fontSize: '11px', color }}>
                                            {daysLeft <= 0 ? `Kadaluarsa ${Math.abs(daysLeft)} hari lalu` : `${daysLeft} hari lagi`}
                                        </div>
                                    </td>
                                    <td>
                                        <StatusBadge variant={b.expired ? 'danger' : 'warning'}>{b.expired ? 'Kadaluarsa' : 'Mendekati ED'}</StatusBadge>
                                    </td>
                                    <td style={{ fontSize: '13px' }}>{b.supplier ?? '-'}</td>
                                    <td>
                                        <div className={styles.actionBtns}>
                                            {b.expired && (
                                                <Button variant="danger" size="sm" onClick={() => setTarget({ batch: b, jenis: 'MUSNAH' })}>
                                                    <Trash2 size={12} /> Musnahkan
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="sm" onClick={() => setTarget({ batch: b, jenis: 'RETUR' })}>
                                                <Undo2 size={12} /> Retur
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <ConfirmDialog open={!!target} onClose={() => setTarget(null)} onConfirm={confirm}
                title={target?.jenis === 'MUSNAH' ? 'Pemusnahan Obat Kadaluarsa' : 'Retur ke Supplier'}
                message={target ? `Seluruh sisa batch ${target.batch.noBatch} "${target.batch.nama}" (${target.batch.qtySisa} ${target.batch.satuan ?? ''}) akan dikeluarkan dari stok dan dicatat sebagai ${target.jenis === 'MUSNAH' ? 'dimusnahkan' : 'diretur'}. Tindakan ini tidak dapat dibatalkan.` : ''}
                variant="danger" confirmLabel="Ya, Catat" />
        </div>
    );
}
