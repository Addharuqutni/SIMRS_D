import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, FileText, Printer, Trash2 } from 'lucide-react';
import { Button, SearchBar, FilterTabs, StatusBadge, Pagination, Modal, showToast, ConfirmDialog } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useVisits } from '../../hooks/usePatient';
import { patientApi } from '../../lib/api/patient';
import { useQueryClient } from '@tanstack/react-query';
import styles from './registrasi.module.css';

export interface Registration {
    id: string; nama: string; nik: string; jaminan: string;
    poli: string; dokter: string; status: string; waktu: string;
    rm: string;
}

const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
    sep: { label: 'SEP Dibuat', variant: 'success' },
    antrean: { label: 'Antrean', variant: 'warning' },
    belum: { label: 'Belum Proses', variant: 'danger' },
    selesai: { label: 'Selesai', variant: 'neutral' },
};

export function RegistrasiList() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Fetch visits accurately from Postgres database
    const { data: dbVisits } = useVisits();
    const patients = (dbVisits as Registration[]) || [];

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('semua');
    const [detailModal, setDetailModal] = useState<Registration | null>(null);
    const [deleteModal, setDeleteModal] = useState<Registration | null>(null);

    const filtered = patients.filter((p) => {
        const matchFilter = filter === 'semua' ||
            (filter === 'bpjs' && p.jaminan === 'BPJS') ||
            (filter === 'umum' && p.jaminan === 'Umum') ||
            (filter === 'belum' && p.status === 'belum');
        const matchSearch = search === '' ||
            p.nama.toLowerCase().includes(search.toLowerCase()) ||
            p.id.includes(search) ||
            p.nik.includes(search);
        return matchFilter && matchSearch;
    });

    const bpjsCount = patients.filter(p => (p.jaminan || '').includes('BPJS')).length;
    const umumCount = patients.filter(p => p.jaminan === 'Umum / Mandiri').length;
    const belumCount = patients.filter(p => p.status === 'belum').length;

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Registrasi Pasien</h1>
                <Button variant="primary" onClick={() => navigate('/registrasi/baru')}>
                    <Plus size={16} /> Pasien Baru
                </Button>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari No.RM / Nama / NIK..." value={search} onChange={setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: patients.length },
                        { label: 'BPJS', value: 'bpjs', count: bpjsCount },
                        { label: 'Umum', value: 'umum', count: umumCount },
                        { label: 'Belum Dilayani', value: 'belum', count: belumCount },
                    ]}
                    active={filter} onChange={setFilter}
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead>
                        <tr>
                            <th>No. RM</th><th>Nama Pasien</th><th>Jaminan</th>
                            <th>Poli</th><th>Dokter</th><th>Waktu</th><th>Status</th><th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="stagger">
                        {filtered.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada data ditemukan</td></tr>
                        ) : filtered.map((patient) => {
                            const st = statusMap[patient.status];
                            return (
                                <tr key={patient.id}>
                                    <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{patient.rm || patient.id.split('-')[1]}</span></td>
                                    <td>
                                        <div className={styles.nameCell}>
                                            <span className={styles.namePrimary}>{patient.nama}</span>
                                            <span className={styles.nameSecondary}>NIK: {patient.nik}</span>
                                        </div>
                                    </td>
                                    <td><StatusBadge variant={(patient.jaminan || '').includes('BPJS') ? 'info' : 'neutral'}>{patient.jaminan}</StatusBadge></td>
                                    <td>{patient.poli}</td>
                                    <td>{patient.dokter}</td>
                                    <td>{patient.waktu}</td>
                                    <td><StatusBadge variant={st.variant}>{st.label}</StatusBadge></td>
                                    <td>
                                        <div className={styles.actionBtns}>
                                            <Button variant="ghost" size="sm" title="Lihat Detail"
                                                onClick={() => setDetailModal(patient)}>
                                                <Eye size={14} />
                                            </Button>
                                            <Button variant="ghost" size="sm" title="Lihat SEP"
                                                onClick={() => showToast(`Membuka SEP untuk ${patient.nama}...`, 'info')}>
                                                <FileText size={14} />
                                            </Button>
                                            <Button variant="ghost" size="sm" title="Cetak Bukti"
                                                onClick={() => showToast(`Mencetak bukti registrasi ${patient.rm}...`, 'info')}>
                                                <Printer size={14} />
                                            </Button>
                                            <Button variant="ghost" size="sm" title="Hapus"
                                                style={{ color: 'var(--danger)' }}
                                                onClick={() => setDeleteModal(patient)}>
                                                <Trash2 size={14} />
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

            {/* Detail Modal */}
            <Modal
                open={!!detailModal}
                onClose={() => setDetailModal(null)}
                title={`Detail Registrasi — ${detailModal?.nama}`}
                icon={<Eye size={20} />}
                size="md"
            >
                {detailModal && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>No. Rekam Medis</strong>{detailModal.rm}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>NIK</strong>{detailModal.nik}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Poli Tujuan</strong>{detailModal.poli}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Dokter</strong>{detailModal.dokter}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Jaminan</strong><StatusBadge variant={(detailModal.jaminan || '').includes('BPJS') ? 'info' : 'neutral'}>{detailModal.jaminan}</StatusBadge></div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Waktu Daftar</strong>{detailModal.waktu}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Status Saat Ini:</span>
                            <StatusBadge variant={statusMap[detailModal.status].variant}>{statusMap[detailModal.status].label}</StatusBadge>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Confirm Dialog */}
            <ConfirmDialog
                open={!!deleteModal}
                title="Hapus Registrasi"
                message={`Apakah Anda yakin ingin menghapus data kunjungan/registrasi untuk Pasien ${deleteModal?.nama} ?`}
                confirmLabel="Ya, Hapus"
                onConfirm={async () => {
                    if (!deleteModal) return;
                    try {
                        await patientApi.deleteVisit(deleteModal.id);
                        queryClient.invalidateQueries({ queryKey: ['visits'] });
                        showToast('Data kunjungan berhasil dihapus', 'success');
                    } catch (error: any) {
                        showToast(error.response?.data?.details ? `Gagal: ${error.response?.data?.details}` : 'Gagal menghapus kunjungan', 'danger');
                    } finally {
                        setDeleteModal(null);
                    }
                }}
                onClose={() => setDeleteModal(null)}
                variant="danger"
            />
        </div>
    );
}
