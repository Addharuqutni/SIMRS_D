import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Stethoscope, Play, CheckCircle } from 'lucide-react';
import { SearchBar, FilterTabs, StatusBadge, Pagination, Button, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useRawatJalanList, useUpdateRawatJalanStatus } from '../../hooks/useClinical';
import type { RawatJalanPatient } from '../../lib/api/clinical';
import styles from '../registrasi/registrasi.module.css';

const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
    pemeriksaan: { label: 'Sedang Periksa', variant: 'info' },
    menunggu: { label: 'Menunggu', variant: 'warning' },
    selesai: { label: 'Selesai', variant: 'success' },
};

export function RawatJalanList() {
    const navigate = useNavigate();
    const { data: dbPatients = [], isLoading } = useRawatJalanList();
    const updateVisitStatus = useUpdateRawatJalanStatus();

    // Process server UTC times to local time formatting if necessary
    const patients = (dbPatients as RawatJalanPatient[]).map(p => ({
        ...p,
        waktu: new Date(p.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    }));

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('semua');

    const filtered = patients.filter((p) => {
        const matchFilter = filter === 'semua' ||
            (filter === 'menunggu' && p.status === 'menunggu') ||
            (filter === 'periksa' && p.status === 'pemeriksaan') ||
            (filter === 'selesai' && p.status === 'selesai');
        const matchSearch = search === '' ||
            p.nama.toLowerCase().includes(search.toLowerCase()) ||
            p.id.includes(search) ||
            p.poli.toLowerCase().includes(search.toLowerCase());
        return matchFilter && matchSearch;
    });

    const handleStartPeriksa = async (patient: RawatJalanPatient) => {
        try {
            await updateVisitStatus.mutateAsync({ id: patient.id, status: 'pemeriksaan' });
            showToast(`Pemeriksaan dimulai untuk ${patient.nama}`, 'info');
        } catch (error) {
            showToast('Gagal merubah status pasien', 'danger');
        }
    };

    const handleSelesai = async (patient: RawatJalanPatient) => {
        try {
            await updateVisitStatus.mutateAsync({ id: patient.id, status: 'selesai' });
            showToast(`Pemeriksaan ${patient.nama} telah selesai`, 'success');
        } catch (error) {
            showToast('Gagal menyelesaikan pemeriksaan', 'danger');
        }
    };

    return (
        <div className={styles.page}>
            {isLoading && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', zIndex: 50, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: 'white', padding: '16px 24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <span style={{ color: 'var(--primary)', fontWeight: 500 }}>Memuat daftar rawat jalan...</span>
                    </div>
                </div>
            )}
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Rawat Jalan</h1>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari pasien, poli..." value={search} onChange={setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: patients.length },
                        { label: 'Menunggu', value: 'menunggu', count: patients.filter(p => p.status === 'menunggu').length },
                        { label: 'Sedang Periksa', value: 'periksa', count: patients.filter(p => p.status === 'pemeriksaan').length },
                        { label: 'Selesai', value: 'selesai', count: patients.filter(p => p.status === 'selesai').length },
                    ]}
                    active={filter} onChange={setFilter}
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead>
                        <tr>
                            <th>No. RM</th><th>Nama Pasien</th><th>Poli</th>
                            <th>Dokter</th><th>Waktu</th><th>Status</th><th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="stagger">
                        {filtered.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada pasien ditemukan</td></tr>
                        ) : filtered.map((p) => {
                            const st = statusMap[p.status];
                            return (
                                <tr key={p.id}>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{p.id}</td>
                                    <td style={{ fontWeight: 500 }}>{p.nama}</td>
                                    <td>{p.poli}</td>
                                    <td>{p.dokter}</td>
                                    <td>{p.waktu}</td>
                                    <td><StatusBadge variant={st.variant}>{st.label}</StatusBadge></td>
                                    <td>
                                        <div className={styles.actionBtns}>
                                            {p.status === 'menunggu' && (
                                                <Button variant="primary" size="sm" onClick={() => handleStartPeriksa(p)}>
                                                    <Play size={12} /> Mulai Periksa
                                                </Button>
                                            )}
                                            {p.status === 'pemeriksaan' && (
                                                <Button variant="secondary" size="sm" onClick={() => handleSelesai(p)}>
                                                    <CheckCircle size={12} /> Selesai
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="sm" onClick={() => navigate(`/rawat-jalan/${p.id}`, { state: p })}>
                                                <Stethoscope size={14} />
                                            </Button>
                                            <Button variant="ghost" size="sm">
                                                <Eye size={14} />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <Pagination currentPage={1} totalPages={Math.ceil(filtered.length / 10) || 1} totalItems={filtered.length} onPageChange={() => { }} />
            </div>
        </div>
    );
}
