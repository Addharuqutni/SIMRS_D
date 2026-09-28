import { useNavigate } from 'react-router-dom';
import { Stethoscope, Play, CheckCircle } from 'lucide-react';
import { SearchBar, FilterTabs, Pagination, Button, showToast, LifecycleBadge } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useRawatJalanList, useUpdateRawatJalanStatus } from '../../hooks/useClinical';
import type { RawatJalanPatient } from '../../lib/api/clinical';
import { errorMessage } from '../../lib/api-error';
import styles from '../registrasi/registrasi.module.css';

export function RawatJalanList() {
    const navigate = useNavigate();
    const list = useRawatJalanList();
    const updateVisitStatus = useUpdateRawatJalanStatus();

    const move = async (p: RawatJalanPatient, status: 'pemeriksaan' | 'selesai') => {
        try {
            await updateVisitStatus.mutateAsync({ id: p.id, status });
            showToast(status === 'pemeriksaan' ? `Pemeriksaan dimulai untuk ${p.nama}` : `Pemeriksaan ${p.nama} telah selesai`, status === 'selesai' ? 'success' : 'info');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal mengubah status kunjungan'), 'danger');
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Rawat Jalan</h1>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari nama, RM, poli..." value={list.search} onChange={list.setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: list.totalAll },
                        { label: 'Menunggu', value: 'menunggu', count: list.counts.menunggu ?? 0 },
                        { label: 'Sedang Periksa', value: 'pemeriksaan', count: list.counts.pemeriksaan ?? 0 },
                        { label: 'Selesai', value: 'selesai', count: list.counts.selesai ?? 0 },
                        { label: 'Batal', value: 'batal', count: list.counts.batal ?? 0 },
                    ]}
                    active={list.status} onChange={list.setStatus}
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
                        {list.isLoading ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat daftar rawat jalan...</td></tr>
                        ) : list.rows.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada pasien ditemukan</td></tr>
                        ) : list.rows.map((p) => (
                            <tr key={p.id}>
                                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{p.rm}</td>
                                <td style={{ fontWeight: 500 }}>{p.nama}</td>
                                <td>{p.poli}</td>
                                <td>{p.dokter}</td>
                                <td>{new Date(p.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                                <td><LifecycleBadge kind="kunjungan" status={p.status} /></td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        {p.status === 'menunggu' && (
                                            <Button variant="primary" size="sm" onClick={() => move(p, 'pemeriksaan')}>
                                                <Play size={12} /> Mulai Periksa
                                            </Button>
                                        )}
                                        {p.status === 'pemeriksaan' && (
                                            <Button variant="secondary" size="sm" onClick={() => move(p, 'selesai')}>
                                                <CheckCircle size={12} /> Selesai
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" title="Buka EMR" onClick={() => navigate(`/rawat-jalan/${p.id}`)}>
                                            <Stethoscope size={14} />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination {...list.paginationProps} />
            </div>
        </div>
    );
}
