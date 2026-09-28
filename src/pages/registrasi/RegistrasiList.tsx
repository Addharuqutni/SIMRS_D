import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, FileText, XCircle } from 'lucide-react';
import { Button, SearchBar, FilterTabs, StatusBadge, Pagination, Modal, showToast, ConfirmDialog, LifecycleBadge } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useCancelVisit, useVisitList } from '../../hooks/usePatient';
import type { VisitWithPatient } from '../../lib/api/patient';
import { errorMessage } from '../../lib/api-error';
import { LIFECYCLES } from '../../../shared/status';
import styles from './registrasi.module.css';

const TIPE_LABEL: Record<VisitWithPatient['tipe'], string> = { rawat_jalan: 'Rawat Jalan', igd: 'IGD', rawat_inap: 'Rawat Inap' };

export function RegistrasiList() {
    const navigate = useNavigate();
    const list = useVisitList();
    const cancelVisit = useCancelVisit();
    const [detailModal, setDetailModal] = useState<VisitWithPatient | null>(null);
    const [cancelTarget, setCancelTarget] = useState<VisitWithPatient | null>(null);

    const confirmCancel = async () => {
        if (!cancelTarget) return;
        try {
            await cancelVisit.mutateAsync(cancelTarget.id);
            showToast('Kunjungan dibatalkan', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal membatalkan kunjungan'), 'danger');
        } finally {
            setCancelTarget(null);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Registrasi Pasien</h1>
                <Button variant="primary" onClick={() => navigate('/registrasi/baru')}>
                    <Plus size={16} /> Registrasi Baru
                </Button>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari No.RM / Nama / NIK..." value={list.search} onChange={list.setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: list.totalAll },
                        { label: 'Menunggu', value: 'menunggu', count: list.counts.menunggu ?? 0 },
                        { label: 'Dilayani', value: 'pemeriksaan', count: list.counts.pemeriksaan ?? 0 },
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
                            <th>No. RM</th><th>Nama Pasien</th><th>Jaminan</th>
                            <th>Unit</th><th>Dokter</th><th>Antrean</th><th>Waktu</th><th>Status</th><th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="stagger">
                        {list.isLoading ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat...</td></tr>
                        ) : list.rows.length === 0 ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada data ditemukan</td></tr>
                        ) : list.rows.map((v) => (
                            <tr key={v.id}>
                                <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v.rm}</span></td>
                                <td>
                                    <div className={styles.nameCell}>
                                        <span className={styles.namePrimary}>{v.nama}</span>
                                        <span className={styles.nameSecondary}>NIK: {v.nik ?? '-'}</span>
                                    </div>
                                </td>
                                <td><StatusBadge variant={v.jaminan === 'BPJS Kesehatan' ? 'info' : 'neutral'}>{v.jaminan}</StatusBadge></td>
                                <td>{v.poli}</td>
                                <td>{v.dokter ?? '-'}</td>
                                <td style={{ fontFamily: 'var(--font-mono)' }}>{v.queueCode ?? '-'}</td>
                                <td>{new Date(v.waktu).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                <td><LifecycleBadge kind="kunjungan" status={v.status} /></td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        <Button variant="ghost" size="sm" title="Lihat Detail" onClick={() => setDetailModal(v)}>
                                            <Eye size={14} />
                                        </Button>
                                        {v.jaminan === 'BPJS Kesehatan' && (
                                            <Button variant="ghost" size="sm" title="Buat / Lihat SEP"
                                                onClick={() => navigate(`/sep?visitId=${encodeURIComponent(v.id)}`)}>
                                                <FileText size={14} />
                                            </Button>
                                        )}
                                        {LIFECYCLES.kunjungan.canTransition(v.status, 'batal') && (
                                            <Button variant="ghost" size="sm" title="Batalkan Kunjungan" style={{ color: 'var(--danger)' }}
                                                onClick={() => setCancelTarget(v)}>
                                                <XCircle size={14} />
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

            <Modal open={!!detailModal} onClose={() => setDetailModal(null)}
                title={`Detail Registrasi — ${detailModal?.nama}`} icon={<Eye size={20} />} size="md">
                {detailModal && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {[
                            ['No. Rekam Medis', detailModal.rm],
                            ['NIK', detailModal.nik ?? '-'],
                            ['Jenis Kunjungan', TIPE_LABEL[detailModal.tipe]],
                            ['Unit Tujuan', detailModal.poli],
                            ['Dokter', detailModal.dokter ?? '-'],
                            ['Nomor Antrean', detailModal.queueCode ?? '-'],
                            ['Jaminan', detailModal.jaminan],
                            ['Waktu Daftar', new Date(detailModal.waktu).toLocaleString('id-ID')],
                        ].map(([label, value]) => (
                            <div key={label}><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</strong>{value}</div>
                        ))}
                        <div style={{ gridColumn: '1 / -1' }}><LifecycleBadge kind="kunjungan" status={detailModal.status} /></div>
                    </div>
                )}
            </Modal>

            <ConfirmDialog
                open={!!cancelTarget}
                title="Batalkan Kunjungan"
                message={`Kunjungan ${cancelTarget?.nama} akan dibatalkan dan nomor antreannya dihapus dari layar antrean.`}
                confirmLabel="Ya, Batalkan"
                onConfirm={confirmCancel}
                onClose={() => setCancelTarget(null)}
                variant="danger"
            />
        </div>
    );
}
