import { useState } from 'react';
import { FileText, Send, AlertCircle, Clock, DollarSign, Eye } from 'lucide-react';
import { Button, SearchBar, FilterTabs, StatusBadge, Pagination, Card, Modal, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';
import { useKlaims, useUpdateKlaim } from '../../hooks/useBpjs';
import type { Klaim } from '../../lib/api/bpjs';

const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
    dibentuk: { label: 'Dibentuk', variant: 'info' },
    pending: { label: 'Pending Verif', variant: 'warning' },
    dispute: { label: 'Dispute', variant: 'danger' },
    layak: { label: 'Layak Bayar', variant: 'success' },
};

export function KlaimBpjs() {
    const { data: klaims = [] } = useKlaims();
    const updateMutation = useUpdateKlaim();

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('semua');
    const [detailModal, setDetailModal] = useState<Klaim | null>(null);

    const filtered = klaims.filter((k: Klaim) => {
        const matchSearch = search.trim() === '' ||
            k.pasien.toLowerCase().includes(search.toLowerCase()) ||
            k.noSep.includes(search) ||
            k.diagnosa.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === 'semua' || k.status === filter;
        return matchSearch && matchFilter;
    });

    const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

    const totalPotensi = klaims.filter((k: Klaim) => k.status !== 'dispute').reduce((acc: number, k: Klaim) => acc + k.tarifInaCbg, 0);

    const handleKirimKlaim = async (klaim: Klaim) => {
        try {
            await updateMutation.mutateAsync({ noSep: klaim.noSep, status: 'pending' });
            showToast(`Klaim ${klaim.noSep} dikirim ke BPJS untuk verifikasi`, 'info');
        } catch {
            showToast('Gagal mengirim klaim BPJS', 'danger');
        }
    };

    const handleResolveDispute = async (klaim: Klaim) => {
        try {
            await updateMutation.mutateAsync({ noSep: klaim.noSep, status: 'pending' });
            showToast(`Dispute ${klaim.noSep} diselesaikan dan dikirim ulang`, 'success');
        } catch {
            showToast('Gagal mengubah status klaim', 'danger');
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Klaim BPJS (INA-CBG)</h1>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '12px', color: '#3b82f6' }}><FileText size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{klaims.filter((k: Klaim) => k.status === 'dibentuk').length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Dibentuk</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '12px', color: '#d97706' }}><Clock size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{klaims.filter((k: Klaim) => k.status === 'pending').length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pending Verif</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '12px', color: '#dc2626' }}><AlertCircle size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{klaims.filter((k: Klaim) => k.status === 'dispute').length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Dispute</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '12px', color: '#16a34a' }}><DollarSign size={20} /></div>
                        <div><div style={{ fontSize: '14px', fontWeight: 700 }}>{formatRp(totalPotensi)}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Potensi Piutang</div></div>
                    </div>
                </Card>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari No. SEP, Pasien, Diagnosa..." value={search} onChange={setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: klaims.length },
                        { label: 'Dibentuk', value: 'dibentuk', count: klaims.filter((k: Klaim) => k.status === 'dibentuk').length },
                        { label: 'Pending', value: 'pending', count: klaims.filter((k: Klaim) => k.status === 'pending').length },
                        { label: 'Dispute', value: 'dispute', count: klaims.filter((k: Klaim) => k.status === 'dispute').length },
                        { label: 'Layak Bayar', value: 'layak', count: klaims.filter((k: Klaim) => k.status === 'layak').length },
                    ]}
                    active={filter} onChange={setFilter}
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead><tr><th>No. SEP</th><th>Pasien</th><th>Diagnosa</th><th>INA-CBG</th><th>Tarif RS</th><th>Tarif INA-CBG</th><th>Selisih</th><th>Status</th><th>Aksi</th></tr></thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada klaim ditemukan</td></tr>
                        ) : filtered.map((k: Klaim, i: number) => {
                            const selisih = k.tarifRs - k.tarifInaCbg;
                            return (
                                <tr key={i}>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{k.noSep}</td>
                                    <td><div className={styles.nameCell}><span className={styles.namePrimary}>{k.pasien}</span><span className={styles.nameSecondary}>RM: {k.rm}</span></div></td>
                                    <td style={{ fontSize: '13px' }}>{k.diagnosa}</td>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{k.inaCbg}</td>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{formatRp(k.tarifRs)}</td>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{formatRp(k.tarifInaCbg)}</td>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: selisih > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                        {selisih > 0 ? `-${formatRp(selisih)}` : formatRp(0)}
                                    </td>
                                    <td><StatusBadge variant={statusMap[k.status]?.variant || 'neutral'}>{statusMap[k.status]?.label || k.status}</StatusBadge></td>
                                    <td>
                                        <div className={styles.actionBtns}>
                                            <Button variant="ghost" size="sm" title="Detail Klaim" onClick={() => setDetailModal(k)}>
                                                <Eye size={14} />
                                            </Button>
                                            {k.status === 'dibentuk' && (
                                                <Button variant="primary" size="sm" onClick={() => handleKirimKlaim(k)} disabled={updateMutation.isPending}>
                                                    <Send size={12} /> Kirim
                                                </Button>
                                            )}
                                            {k.status === 'dispute' && (
                                                <Button variant="secondary" size="sm" onClick={() => handleResolveDispute(k)} disabled={updateMutation.isPending}>
                                                    Resolve
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <Pagination currentPage={1} totalPages={Math.ceil(filtered.length / 10) || 1} totalItems={filtered.length} onPageChange={() => { }} />
            </div>

            {/* Detail Modal */}
            <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title={`Detail Klaim — ${detailModal?.noSep}`} icon={<FileText size={20} />} size="md">
                {detailModal && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '14px' }}>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Pasien</strong>{detailModal.pasien}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>No. Rekam Medis</strong>{detailModal.rm}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Diagnosa</strong>{detailModal.diagnosa}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Kode INA-CBG</strong><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{detailModal.inaCbg}</span></div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Tgl Klaim</strong>{detailModal.tglKlaim}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Status</strong><StatusBadge variant={statusMap[detailModal.status].variant}>{statusMap[detailModal.status].label}</StatusBadge></div>
                        </div>
                        <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Perbandingan Tarif</h4>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                <span>Tarif Rumah Sakit</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatRp(detailModal.tarifRs)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                <span>Tarif INA-CBG</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary)' }}>{formatRp(detailModal.tarifInaCbg)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '14px' }}>
                                <span style={{ fontWeight: 600 }}>Selisih</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--danger)' }}>
                                    {formatRp(detailModal.tarifRs - detailModal.tarifInaCbg)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
