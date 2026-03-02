import { useState, useEffect } from 'react';
import { Pill, CheckCircle, AlertTriangle } from 'lucide-react';
import { SearchBar, FilterTabs, StatusBadge, Button, Card, Pagination, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';
import { usePrescriptions, usePrescriptionDetail, useUpdatePrescriptionStatus } from '../../hooks/usePharmacy';
import type { Prescription, PrescriptionItem } from '../../lib/api/pharmacy';

const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
    baru: { label: 'Baru', variant: 'danger' },
    proses: { label: 'Diproses', variant: 'warning' },
    selesai: { label: 'Diserahkan', variant: 'success' },
};

export function FarmasiResep() {
    const { data: resepList = [] } = usePrescriptions();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('semua');
    const [selectedId, setSelectedId] = useState('');

    const { data: detail } = usePrescriptionDetail(selectedId);
    const updateMutation = useUpdatePrescriptionStatus();

    // Select the first item automatically if list loads and nothing selected
    useEffect(() => {
        if (!selectedId && resepList.length > 0) setSelectedId(resepList[0].id);
    }, [resepList, selectedId]);

    const filtered = resepList.filter((r: Prescription) => {
        const matchSearch = search.trim() === '' ||
            (r.patientName?.toLowerCase().includes(search.toLowerCase()) || '') ||
            (r.noResep.toLowerCase().includes(search.toLowerCase())) ||
            (r.rm?.includes(search) || '');
        const matchFilter = filter === 'semua' || r.status === filter;
        return matchSearch && matchFilter;
    });

    const handleTerima = async () => {
        try {
            await updateMutation.mutateAsync({ id: selectedId, status: 'proses' });
            showToast(`Resep ${detail?.noResep} diterima dan sedang diproses`, 'info');
        } catch (e) {
            showToast('Gagal memproses resep', 'danger');
        }
    };

    const handleSerahkan = async () => {
        try {
            await updateMutation.mutateAsync({ id: selectedId, status: 'selesai' });
            showToast(`Obat resep ${detail?.noResep} berhasil diserahkan dan mutasi stok dicatat`, 'success');
        } catch (e) {
            showToast('Gagal menyerahkan resep', 'danger');
        }
    };

    const currentResep = resepList.find((r: Prescription) => r.id === selectedId);

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Resep & Dispensing</h1>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari resep, pasien, RM..." value={search} onChange={setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: resepList.length },
                        { label: 'Baru', value: 'baru', count: resepList.filter((r: Prescription) => r.status === 'baru').length },
                        { label: 'Proses', value: 'proses', count: resepList.filter((r: Prescription) => r.status === 'proses').length },
                        { label: 'Selesai', value: 'selesai', count: resepList.filter((r: Prescription) => r.status === 'selesai').length },
                    ]}
                    active={filter} onChange={setFilter}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Left — list */}
                <div className={styles.tableWrapper}>
                    <table className={uiStyles.table}>
                        <thead>
                            <tr><th>No. Resep</th><th>Pasien</th><th>Dokter</th><th>Waktu</th><th>Status</th></tr>
                        </thead>
                        <tbody className="stagger">
                            {filtered.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada resep ditemukan</td></tr>
                            ) : filtered.map((r: Prescription) => {
                                const st = statusMap[r.status];
                                return (
                                    <tr key={r.id}
                                        style={{ cursor: 'pointer', background: selectedId === r.id ? 'var(--bg-active)' : undefined }}
                                        onClick={() => setSelectedId(r.id)}>
                                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{r.noResep}</td>
                                        <td>
                                            <div className={styles.nameCell}>
                                                <span className={styles.namePrimary}>{r.patientName}</span>
                                                <span className={styles.nameSecondary}>RM: {r.rm}</span>
                                            </div>
                                        </td>
                                        <td>{r.dokterName || r.dokterId}</td>
                                        <td>{new Date(r.waktuResep).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td><StatusBadge variant={st.variant}>{st.label}</StatusBadge></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <Pagination currentPage={1} totalPages={1} totalItems={filtered.length} onPageChange={() => { }} />
                </div>

                {/* Right — detail */}
                {detail ? (
                    <Card title={`Detail ${detail.noResep}`} icon={<Pill size={18} />}>
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                Pasien: <strong style={{ color: 'var(--text)' }}>{detail.patientName}</strong> (RM: {detail.rm})
                            </div>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                Dokter: <strong style={{ color: 'var(--text)' }}>{detail.dokterName || detail.dokterId}</strong>
                            </div>
                            {currentResep && (
                                <div style={{ marginTop: '8px' }}>
                                    <StatusBadge variant={statusMap[currentResep.status]?.variant || 'neutral'}>
                                        {statusMap[currentResep.status]?.label || currentResep.status}
                                    </StatusBadge>
                                </div>
                            )}
                        </div>

                        <table className={uiStyles.table}>
                            <thead>
                                <tr><th>Obat</th><th>Dosis</th><th>Jml</th><th>Stok</th><th>Ketersediaan</th></tr>
                            </thead>
                            <tbody>
                                {detail.items?.map((item: PrescriptionItem, i: number) => {
                                    const tersedia = item.stok >= item.jumlah;
                                    return (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 500 }}>{item.namaObat || item.obatId}</td>
                                            <td>{item.dosis}</td>
                                            <td>{item.jumlah}</td>
                                            <td>{item.stok}</td>
                                            <td>
                                                {tersedia ? (
                                                    <StatusBadge variant="success">✅ Memenuhi</StatusBadge>
                                                ) : (
                                                    <StatusBadge variant="warning">
                                                        <AlertTriangle size={10} /> Kurang
                                                    </StatusBadge>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                {updateMutation.isPending && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Menyimpan mutasi stok...</span>}
                            </div>
                            {currentResep?.status === 'baru' && (
                                <Button variant="primary" onClick={handleTerima} disabled={updateMutation.isPending}>
                                    <Pill size={14} /> Terima & Proses Resep
                                </Button>
                            )}
                            {currentResep?.status === 'proses' && (
                                <Button variant="primary" onClick={handleSerahkan} disabled={updateMutation.isPending}>
                                    <CheckCircle size={14} /> Serahkan Obat
                                </Button>
                            )}
                            {currentResep?.status === 'selesai' && (
                                <Button variant="secondary" disabled>
                                    <CheckCircle size={14} /> Telah Diserahkan
                                </Button>
                            )}
                        </div>
                    </Card>
                ) : (
                    <Card><div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Pilih resep untuk melihat detail</div></Card>
                )}
            </div>
        </div>
    );
}
