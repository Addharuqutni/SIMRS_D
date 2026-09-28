import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlaskConical, ScanLine, TestTube, Plus, Eye, FileText, Upload, FileDown, CheckCircle2, XCircle } from 'lucide-react';
import {
    Button, SearchBar, FilterTabs, Pagination, Card, Modal, showToast, ConfirmDialog,
    LifecycleBadge, StatusBadge, Printable, uiStyles,
} from '../../components/ui';
import { LIFECYCLES } from '../../../shared/status';
import styles from '../registrasi/registrasi.module.css';
import {
    useCancelPenunjangOrder, useCompletePenunjangOrder, useCreatePenunjangOrder,
    usePenunjangOrders, useStartPenunjangOrder, useUploadPenunjangHasil,
} from '../../hooks/usePenunjang';
import { patientApi } from '../../lib/api/patient';
import { errorMessage } from '../../lib/api-error';
import { useDoctors } from '../../hooks/useMasterData';
import { hasilFileUrl, type Order, type OrderKind } from '../../lib/api/penunjang';

/** Per-unit copy — the only thing that differs between LIS and RIS. */
const COPY = {
    lab: {
        title: 'Laboratorium (LIS)',
        icon: <FlaskConical size={16} />,
        startLabel: 'Terima Sampel',
        completeLabel: 'Input Hasil',
        resultLabel: 'Hasil Pemeriksaan',
        jenisLabel: 'Jenis Pemeriksaan Lab',
        placeholder: 'cth: Darah Lengkap, GDS, Ureum, Kreatinin',
        flowLabel: 'Alur: order menunggu → sampel diterima (diproses) → hasil diinput & divalidasi (selesai).',
    },
    radiologi: {
        title: 'Instalasi Radiologi',
        icon: <ScanLine size={16} />,
        startLabel: 'Mulai Pemeriksaan',
        completeLabel: 'Input Expertise',
        resultLabel: 'Expertise Radiolog',
        jenisLabel: 'Jenis Pemeriksaan Radiologi',
        placeholder: 'cth: Rontgen Thorax, USG Abdomen, CT Scan Kepala',
        flowLabel: 'Alur: order menunggu → pemeriksaan dilaksanakan (diproses) → expertise diisi (selesai).',
    },
} as const;

/** Kunjungan states a new order may be placed into (mirrors the server rule). */
const OPEN_STATUSES = ['menunggu', 'pemeriksaan', 'tindakan', 'observasi'];

export function PenunjangPage({ kind }: { kind: OrderKind }) {
    const copy = COPY[kind];
    const list = usePenunjangOrders(kind);
    const createMutation = useCreatePenunjangOrder(kind);
    const startMutation = useStartPenunjangOrder(kind);
    const completeMutation = useCompletePenunjangOrder(kind);
    const cancelMutation = useCancelPenunjangOrder(kind);
    const uploadMutation = useUploadPenunjangHasil(kind);
    const { data: doctors = [] } = useDoctors();

    const [addOpen, setAddOpen] = useState(false);
    const [visitQuery, setVisitQuery] = useState('');
    const [addForm, setAddForm] = useState({ visitId: '', dokterId: '', jenisPemeriksaan: '', catatan: '' });

    const [completeTarget, setCompleteTarget] = useState<Order | null>(null);
    const [resultText, setResultText] = useState('');
    const [detailTarget, setDetailTarget] = useState<Order | null>(null);
    const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

    // Hidden file input shared by every row's Upload button.
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTarget, setUploadTarget] = useState<Order | null>(null);

    // Open Kunjungan picker — a real visit, searched by patient / RM.
    const visitSearch = useQuery({
        queryKey: ['penunjang-visits', visitQuery],
        queryFn: () => patientApi.listVisits({ q: visitQuery.trim() || undefined, limit: 20 }),
        enabled: addOpen,
    });
    const openVisits = useMemo(
        () => (visitSearch.data?.data ?? []).filter((v) => OPEN_STATUSES.includes(v.status)),
        [visitSearch.data],
    );
    const selectedVisit = openVisits.find((v) => v.id === addForm.visitId)
        ?? (visitSearch.data?.data ?? []).find((v) => v.id === addForm.visitId);

    const openAdd = () => {
        setAddForm({ visitId: '', dokterId: '', jenisPemeriksaan: '', catatan: '' });
        setVisitQuery('');
        setAddOpen(true);
    };

    const handleCreate = async () => {
        if (!addForm.visitId) {
            showToast('Pilih kunjungan pasien terlebih dahulu', 'warning');
            return;
        }
        if (!addForm.dokterId) {
            showToast('Pilih dokter pengirim', 'warning');
            return;
        }
        if (!addForm.jenisPemeriksaan.trim()) {
            showToast('Isi jenis pemeriksaan', 'warning');
            return;
        }
        try {
            const order = await createMutation.mutateAsync({
                visitId: addForm.visitId,
                dokterId: addForm.dokterId,
                jenisPemeriksaan: addForm.jenisPemeriksaan.trim(),
                catatan: addForm.catatan.trim() || null,
            });
            showToast(`Order ${order.id} dibuat dan ditagihkan ke kunjungan`, 'success');
            setAddOpen(false);
        } catch (err) {
            showToast(errorMessage(err, 'Gagal membuat order'), 'danger');
        }
    };

    const handleStart = async (order: Order) => {
        try {
            await startMutation.mutateAsync(order.id);
            showToast(`Order ${order.id} masuk proses`, 'info');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal memproses order'), 'danger');
        }
    };

    const openComplete = (order: Order) => {
        setCompleteTarget(order);
        setResultText((kind === 'lab' ? order.hasilTeks : order.expertise) ?? '');
    };

    const handleComplete = async () => {
        if (!completeTarget) return;
        if (!resultText.trim()) {
            showToast(kind === 'lab' ? 'Hasil pemeriksaan wajib diisi' : 'Uraian expertise wajib diisi', 'warning');
            return;
        }
        try {
            await completeMutation.mutateAsync({
                id: completeTarget.id,
                data: kind === 'lab' ? { hasilTeks: resultText } : { expertise: resultText },
            });
            showToast(`Order ${completeTarget.id} selesai`, 'success');
            setCompleteTarget(null);
            setResultText('');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal menyimpan hasil'), 'danger');
        }
    };

    const handleCancel = async () => {
        if (!cancelTarget) return;
        try {
            await cancelMutation.mutateAsync(cancelTarget.id);
            showToast(`Order ${cancelTarget.id} dibatalkan & tagihannya ditarik`, 'warning');
            setCancelTarget(null);
        } catch (err) {
            showToast(errorMessage(err, 'Gagal membatalkan order'), 'danger');
        }
    };

    const handleUploadClick = (order: Order) => {
        setUploadTarget(order);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadTarget) return;
        if (file.type !== 'application/pdf') {
            showToast('Hanya file PDF yang diizinkan', 'warning');
            setUploadTarget(null);
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('Ukuran file maksimal 5MB', 'warning');
            setUploadTarget(null);
            return;
        }
        try {
            await uploadMutation.mutateAsync({ id: uploadTarget.id, file });
            showToast(`Hasil PDF order ${uploadTarget.id} tersimpan`, 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal mengunggah hasil PDF'), 'danger');
        }
        setUploadTarget(null);
    };

    const summary = [
        { label: 'Menunggu', value: list.counts.menunggu ?? 0, bg: '#fef2f2', fg: '#dc2626', icon: <TestTube size={20} /> },
        { label: 'Diproses', value: list.counts.diproses ?? 0, bg: '#fffbeb', fg: '#d97706', icon: copy.icon },
        { label: 'Selesai', value: list.counts.selesai ?? 0, bg: '#f0fdf4', fg: '#16a34a', icon: <CheckCircle2 size={20} /> },
        { label: 'Total Order', value: list.totalAll, bg: '#eff6ff', fg: '#3b82f6', icon: <FileText size={20} /> },
    ];

    const detailResult = detailTarget ? (kind === 'lab' ? detailTarget.hasilTeks : detailTarget.expertise) : null;

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>{copy.title}</h1>
                <Button variant="primary" onClick={openAdd}>
                    <Plus size={16} /> Order Pemeriksaan Baru
                </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {summary.map((s) => (
                    <Card key={s.label}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: s.bg, padding: '10px', borderRadius: '12px', color: s.fg }}>{s.icon}</div>
                            <div>
                                <div style={{ fontSize: '22px', fontWeight: 700 }}>{s.value}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.label}</div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari Pasien / RM / Jenis Pemeriksaan..." value={list.search} onChange={list.setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: list.totalAll },
                        { label: 'Menunggu', value: 'menunggu', count: list.counts.menunggu ?? 0 },
                        { label: 'Diproses', value: 'diproses', count: list.counts.diproses ?? 0 },
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
                            <th>No. Order</th><th>Waktu</th><th>Pasien</th><th>Dokter Pengirim</th>
                            <th>{copy.jenisLabel}</th><th>Status</th><th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.isLoading ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat order...</td></tr>
                        ) : list.isError ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--danger)' }}>{errorMessage(list.error, 'Gagal memuat order')}</td></tr>
                        ) : list.rows.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada order ditemukan</td></tr>
                        ) : list.rows.map((order) => (
                            <tr key={order.id}>
                                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '12px' }}>{order.id}</td>
                                <td style={{ fontSize: '13px' }}>{new Date(order.waktuOrder).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                <td>
                                    <div className={styles.nameCell}>
                                        <span className={styles.namePrimary}>{order.patientName ?? '-'}</span>
                                        <span className={styles.nameSecondary}>RM: {order.rm ?? '-'}</span>
                                    </div>
                                </td>
                                <td style={{ fontSize: '13px' }}>{order.dokterName ?? order.dokterId}</td>
                                <td style={{ maxWidth: '240px', whiteSpace: 'normal', fontSize: '13px' }}>{order.jenisPemeriksaan}</td>
                                <td><LifecycleBadge kind="order" status={order.status} /></td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        {LIFECYCLES.order.canTransition(order.status, 'diproses') && (
                                            <Button variant="secondary" size="sm" onClick={() => handleStart(order)} disabled={startMutation.isPending}>
                                                <TestTube size={12} /> {copy.startLabel}
                                            </Button>
                                        )}
                                        {LIFECYCLES.order.canTransition(order.status, 'selesai') && (
                                            <Button variant="primary" size="sm" onClick={() => openComplete(order)}>
                                                {copy.icon} {copy.completeLabel}
                                            </Button>
                                        )}
                                        {order.status === 'selesai' && (
                                            <Button variant="ghost" size="sm" style={{ color: 'var(--success)' }} onClick={() => setDetailTarget(order)}>
                                                <Eye size={14} /> Lihat Hasil
                                            </Button>
                                        )}
                                        {(order.status === 'menunggu' || order.status === 'diproses') && (
                                            <>
                                                <Button variant="secondary" size="sm" onClick={() => handleUploadClick(order)} disabled={uploadMutation.isPending}>
                                                    <Upload size={12} /> Upload Hasil
                                                </Button>
                                                <Button variant="ghost" size="sm" style={{ color: 'var(--danger)' }} title="Batalkan order"
                                                    onClick={() => setCancelTarget(order)}>
                                                    <XCircle size={14} />
                                                </Button>
                                            </>
                                        )}
                                        {order.hasilUrl && (
                                            <a href={hasilFileUrl(order.hasilUrl)} target="_blank" rel="noopener noreferrer"
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                    height: '30px', padding: '0 10px', fontSize: '13px', fontWeight: 500,
                                                    borderRadius: 'var(--radius-md)', textDecoration: 'none',
                                                    color: 'var(--primary)', background: 'transparent',
                                                }}>
                                                <FileDown size={14} /> Lihat PDF
                                            </a>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination {...list.paginationProps} />
            </div>

            {/* Order Form — picks a real open Kunjungan and a real doctor */}
            <Modal open={addOpen} onClose={() => setAddOpen(false)} title={`Order ${copy.title} Baru`} icon={copy.icon} size="lg"
                footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Batal</Button>
                    <Button variant="primary" onClick={handleCreate} disabled={createMutation.isPending}>
                        {copy.icon} Buat Order
                    </Button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Cari Kunjungan Pasien (berjalan) *</label>
                        <input className={uiStyles.formInput} value={visitQuery} onChange={(e) => setVisitQuery(e.target.value)}
                            placeholder="Nama pasien atau No. RM — hanya kunjungan aktif yang tampil" />
                        {visitSearch.isLoading ? (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Memuat kunjungan...</span>
                        ) : visitSearch.isError ? (
                            <span style={{ fontSize: '12px', color: 'var(--danger)' }}>{errorMessage(visitSearch.error, 'Gagal memuat kunjungan')}</span>
                        ) : openVisits.length === 0 ? (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tidak ada kunjungan aktif yang cocok.</span>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '190px', overflowY: 'auto' }}>
                                {openVisits.map((v) => (
                                    <button key={v.id} type="button" onClick={() => setAddForm((f) => ({ ...f, visitId: v.id }))}
                                        style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
                                            padding: '8px 12px', cursor: 'pointer', textAlign: 'left', fontSize: '13px',
                                            borderRadius: 'var(--radius-md)', background: 'var(--bg)',
                                            border: `1px solid ${addForm.visitId === v.id ? 'var(--primary)' : 'var(--border)'}`,
                                        }}>
                                        <span>
                                            <strong>{v.nama}</strong> <span style={{ color: 'var(--text-muted)' }}>({v.rm})</span>
                                            <br />
                                            <span style={{ color: 'var(--text-secondary)' }}>{v.poli} · {v.tipe} · {v.waktu ? new Date(v.waktu).toLocaleDateString('id-ID') : ''}</span>
                                        </span>
                                        <StatusBadge variant="info" dot={false}>{v.status}</StatusBadge>
                                    </button>
                                ))}
                            </div>
                        )}
                        {selectedVisit && (
                            <span style={{ fontSize: '12px', color: 'var(--primary)' }}>
                                Terpilih: {selectedVisit.nama} ({selectedVisit.rm}) — {selectedVisit.poli}
                            </span>
                        )}
                    </div>

                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Dokter Pengirim *</label>
                        <select className={uiStyles.formSelect} value={addForm.dokterId}
                            onChange={(e) => setAddForm((f) => ({ ...f, dokterId: e.target.value }))}>
                            <option value="">Pilih Dokter...</option>
                            {doctors.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
                        </select>
                    </div>

                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>{copy.jenisLabel} *</label>
                        <textarea className={uiStyles.formTextarea} rows={3} value={addForm.jenisPemeriksaan}
                            onChange={(e) => setAddForm((f) => ({ ...f, jenisPemeriksaan: e.target.value }))}
                            placeholder={copy.placeholder} />
                    </div>

                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Catatan Klinis</label>
                        <input className={uiStyles.formInput} value={addForm.catatan}
                            onChange={(e) => setAddForm((f) => ({ ...f, catatan: e.target.value }))}
                            placeholder="Indikasi / catatan untuk unit penunjang (opsional)" />
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{copy.flowLabel}</div>
                </div>
            </Modal>

            {/* Complete Modal */}
            <Modal open={!!completeTarget} onClose={() => setCompleteTarget(null)}
                title={`${copy.completeLabel} — ${completeTarget?.id ?? ''}`} icon={copy.icon} size="lg"
                footer={<><Button variant="secondary" onClick={() => setCompleteTarget(null)}>Batal</Button>
                    <Button variant="primary" onClick={handleComplete} disabled={completeMutation.isPending}>
                        <CheckCircle2 size={16} /> Simpan & Selesaikan
                    </Button></>}>
                {completeTarget && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '14px' }}>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Pasien</strong>{completeTarget.patientName ?? '-'} (RM: {completeTarget.rm ?? '-'})</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Pemeriksaan</strong>{completeTarget.jenisPemeriksaan}</div>
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>{copy.resultLabel} *</label>
                            <textarea className={uiStyles.formTextarea} rows={6} value={resultText}
                                onChange={(e) => setResultText(e.target.value)}
                                placeholder={kind === 'lab'
                                    ? 'cth: WBC: 7.2 | RBC: 5.1 | HGB: 14.2 | PLT: 245'
                                    : 'cth: Corakan bronkovaskular normal, tidak tampak infiltrat'} />
                        </div>
                    </div>
                )}
            </Modal>

            {/* Result sheet — real printable document, plus the uploaded PDF */}
            <Modal open={!!detailTarget} onClose={() => setDetailTarget(null)}
                title={`${copy.resultLabel} — ${detailTarget?.id ?? ''}`} icon={<FileText size={20} />} size="lg">
                {detailTarget && (
                    <Printable title={`${copy.title} — ${detailTarget.id}`} buttonText="Cetak Hasil" variant="secondary">
                        <div style={{ borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '16px' }}>
                            <div style={{ fontSize: '18px', fontWeight: 700 }}>{copy.title}</div>
                            <div style={{ fontSize: '13px' }}>Hasil Pemeriksaan Penunjang</div>
                        </div>
                        <table style={{ width: '100%', fontSize: '14px', marginBottom: '16px', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr><td style={{ padding: '4px 0', width: '180px' }}>No. Order</td><td>: {detailTarget.id}</td></tr>
                                <tr><td style={{ padding: '4px 0' }}>Pasien</td><td>: {detailTarget.patientName ?? '-'}</td></tr>
                                <tr><td style={{ padding: '4px 0' }}>No. Rekam Medis</td><td>: {detailTarget.rm ?? '-'}</td></tr>
                                <tr><td style={{ padding: '4px 0' }}>Dokter Pengirim</td><td>: {detailTarget.dokterName ?? detailTarget.dokterId}</td></tr>
                                <tr><td style={{ padding: '4px 0' }}>Pemeriksaan</td><td>: {detailTarget.jenisPemeriksaan}</td></tr>
                                <tr><td style={{ padding: '4px 0' }}>Waktu Order</td><td>: {new Date(detailTarget.waktuOrder).toLocaleString('id-ID')}</td></tr>
                                <tr><td style={{ padding: '4px 0' }}>Waktu Selesai</td><td>: {detailTarget.waktuSelesai ? new Date(detailTarget.waktuSelesai).toLocaleString('id-ID') : '-'}</td></tr>
                            </tbody>
                        </table>
                        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>{copy.resultLabel}</div>
                        <div style={{ fontSize: '14px', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', border: '1px solid #000', padding: '12px', minHeight: '80px' }}>
                            {detailResult || 'Belum ada hasil tercatat.'}
                        </div>
                        {detailTarget.catatan && (
                            <>
                                <div style={{ fontSize: '14px', fontWeight: 600, margin: '16px 0 6px' }}>Catatan</div>
                                <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{detailTarget.catatan}</div>
                            </>
                        )}
                        {detailTarget.hasilUrl && (
                            <div style={{ fontSize: '13px', marginTop: '16px' }} className="no-print">
                                Lampiran PDF: <a href={hasilFileUrl(detailTarget.hasilUrl)} target="_blank" rel="noopener noreferrer">buka berkas</a>
                            </div>
                        )}
                    </Printable>
                )}
            </Modal>

            <ConfirmDialog
                open={!!cancelTarget}
                title={`Batalkan Order ${cancelTarget?.id ?? ''}`}
                message="Order akan dibatalkan dan tagihannya ditarik dari billing kunjungan. Lanjutkan?"
                confirmLabel="Ya, Batalkan"
                onConfirm={handleCancel}
                onClose={() => setCancelTarget(null)}
            />

            <input ref={fileInputRef} type="file" accept=".pdf" hidden onChange={handleFileSelected} />
        </div>
    );
}

export const Laboratorium = () => <PenunjangPage kind="lab" />;
export const Radiologi = () => <PenunjangPage kind="radiologi" />;
