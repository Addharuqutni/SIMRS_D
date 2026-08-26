import { useRef, useState } from 'react';
import { FlaskConical, TestTube, CheckCircle, Clock, Plus, Eye, FileText, Trash2, Upload, FileDown } from 'lucide-react';
import { Button, StatusBadge, SearchBar, FilterTabs, Pagination, Modal, Card, showToast, ConfirmDialog } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';
import { useLabOrders, useCreateLabOrder, useUpdateLabOrder, useDeleteLabOrder, useUploadLabHasil } from '../../hooks/usePenunjang';
import { hasilFileUrl } from '../../lib/api/penunjang';
import { useDoctors } from '../../hooks/useMasterData';
import type { LabOrder } from '../../lib/api/penunjang';

const emptyOrder: Partial<LabOrder> = {
    patientName: '',
    rm: '',
    dokterId: '',
    dokterName: '',
    jenisPemeriksaan: ''
};

export function Laboratorium() {
    const { data: labList = [] } = useLabOrders();
    const createMutation = useCreateLabOrder();
    const updateMutation = useUpdateLabOrder();
    const deleteMutation = useDeleteLabOrder();
    const uploadMutation = useUploadLabHasil();
    const { data: doctors = [] } = useDoctors();

    // Hasil PDF upload (single hidden input, target tracked in state)
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTarget, setUploadTarget] = useState<LabOrder | null>(null);

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('semua');

    // Modals
    const [addOpen, setAddOpen] = useState(false);
    const [addForm, setAddForm] = useState(emptyOrder);
    const [inputHasilOpen, setInputHasilOpen] = useState(false);
    const [inputTarget, setInputTarget] = useState<LabOrder | null>(null);
    const [hasilText, setHasilText] = useState('');
    const [nilaiNormalText, setNilaiNormalText] = useState(''); // Maps loosely to catatan
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailTarget, setDetailTarget] = useState<LabOrder | null>(null);

    // Delete Confirms
    const [deleteModal, setDeleteModal] = useState<{ open: boolean, id: string }>({ open: false, id: '' });

    const filtered = labList.filter(o => {
        const matchSearch = search.trim() === '' ||
            (o.patientName?.toLowerCase().includes(search.toLowerCase()) || '') ||
            (o.id.toLowerCase().includes(search.toLowerCase())) ||
            (o.rm?.includes(search) || '');
        const filterMap: Record<string, string> = { 'baru': 'menunggu', 'proses': 'diproses', 'selesai': 'selesai' };
        const mappedStatus = filter === 'semua' ? 'semua' : filterMap[filter] || filter;
        const matchFilter = mappedStatus === 'semua' || o.status === mappedStatus;
        return matchSearch && matchFilter;
    });

    const handleTerimaSampel = async (order: LabOrder) => {
        try {
            await updateMutation.mutateAsync({ id: order.id, data: { status: 'diproses' } });
            showToast(`Sampel "${order.id}" telah diterima & diproses`, 'success');
        } catch {
            showToast('Gagal memproses order', 'danger');
        }
    };

    const handleOpenInputHasil = (order: LabOrder) => {
        setInputTarget(order);
        setHasilText(order.hasilTeks || '');
        setNilaiNormalText(order.catatan || '');
        setInputHasilOpen(true);
    };

    const handleSaveHasil = async () => {
        if (!hasilText.trim()) {
            showToast('Hasil pemeriksaan wajib diisi', 'warning');
            return;
        }
        if (inputTarget) {
            try {
                await updateMutation.mutateAsync({
                    id: inputTarget.id,
                    data: {
                        status: 'selesai',
                        hasilTeks: hasilText,
                        catatan: nilaiNormalText, // Storing ref values in catatan loosely for demo
                        waktuSelesai: new Date().toISOString()
                    }
                });
                showToast(`Hasil lab "${inputTarget.id}" berhasil diinput & divalidasi`, 'success');
            } catch {
                showToast('Gagal menyimpan hasil lab', 'danger');
            }
        }
        setInputHasilOpen(false);
        setInputTarget(null);
    };

    const handleAddOrder = async () => {
        if (!addForm.patientName || !addForm.jenisPemeriksaan) {
            showToast('Lengkapi data: Pasien dan Pemeriksaan', 'warning');
            return;
        }
        const now = new Date();
        const payload = {
            visitId: 'DUMMY-VISIT', // For demo form, usually populated automatically from caller
            dokterId: 'DUMMY-DOC',
            jenisPemeriksaan: addForm.jenisPemeriksaan,
            status: 'menunggu',
            catatan: 'Order Manual Lab LIS',
            waktuOrder: now.toISOString()
        };
        try {
            await createMutation.mutateAsync(payload);
            showToast(`Order lab baru berhasil dibuat`, 'success');
            setAddOpen(false);
            setAddForm(emptyOrder);
        } catch {
            showToast('Gagal menambah order lab', 'danger');
        }
    };

    const handleViewDetail = (order: LabOrder) => {
        setDetailTarget(order);
        setDetailOpen(true);
    };

    const handleUploadClick = (order: LabOrder) => {
        setUploadTarget(order);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadTarget) return;

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
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
            showToast(`Hasil PDF "${uploadTarget.id}" berhasil diunggah`, 'success');
        } catch {
            showToast('Gagal mengunggah hasil PDF', 'danger');
        }
        setUploadTarget(null);
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Laboratorium (LIS)</h1>
                <Button variant="primary" onClick={() => { setAddForm(emptyOrder); setAddOpen(true); }}>
                    <Plus size={16} /> Order Pemeriksaan Baru
                </Button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '12px', color: '#dc2626' }}><TestTube size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{labList.filter(o => o.status === 'menunggu').length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Order Baru</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '12px', color: '#d97706' }}><FlaskConical size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{labList.filter(o => o.status === 'diproses').length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Sedang Diproses</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '12px', color: '#16a34a' }}><CheckCircle size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{labList.filter(o => o.status === 'selesai').length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Selesai Validasi</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '12px', color: '#3b82f6' }}><FileText size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{labList.length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Order</div></div>
                    </div>
                </Card>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari No. Order / Pasien / RM..." value={search} onChange={setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua Order', value: 'semua', count: labList.length },
                        { label: 'Order Baru (Menunggu)', value: 'baru', count: labList.filter(o => o.status === 'menunggu').length },
                        { label: 'Sedang Diproses', value: 'proses', count: labList.filter(o => o.status === 'diproses').length },
                        { label: 'Selesai', value: 'selesai', count: labList.filter(o => o.status === 'selesai').length },
                    ]}
                    active={filter} onChange={setFilter}
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead>
                        <tr>
                            <th>No. Order</th><th>Waktu</th><th>Pasien</th><th>Asal & Pengirim</th><th>Item Pemeriksaan</th><th>Status</th><th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada order ditemukan</td></tr>
                        ) : filtered.map((order, i) => (
                            <tr key={i}>
                                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{order.id}</td>
                                <td><Clock size={12} style={{ display: 'inline', marginRight: 4, color: 'var(--text-muted)' }} />{new Date(order.waktuOrder).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                <td><div className={styles.nameCell}><span className={styles.namePrimary}>{order.patientName || 'Pasien Anon'}</span><span className={styles.nameSecondary}>RM: {order.rm || '-'}</span></div></td>
                                <td><div className={styles.nameCell}><span className={styles.nameSecondary}>{order.dokterName || order.dokterId}</span></div></td>
                                <td style={{ maxWidth: '250px', whiteSpace: 'normal', fontSize: '13px' }}>{order.jenisPemeriksaan}</td>
                                <td>
                                    <StatusBadge variant={order.status === 'menunggu' ? 'danger' : order.status === 'diproses' ? 'warning' : 'success'}>
                                        {order.status === 'menunggu' ? 'Menunggu' : order.status === 'diproses' ? 'Diproses' : 'Selesai Validation'}
                                    </StatusBadge>
                                </td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        {order.status === 'menunggu' && (
                                            <>
                                                <Button variant="secondary" size="sm" onClick={() => handleTerimaSampel(order)}>
                                                    <TestTube size={12} /> Terima Sampel
                                                </Button>
                                                <Button variant="ghost" size="sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleteModal({ open: true, id: order.id })}>
                                                    <Trash2 size={14} />
                                                </Button>
                                            </>
                                        )}
                                        {order.status === 'diproses' && (
                                            <Button variant="primary" size="sm" onClick={() => handleOpenInputHasil(order)}>
                                                <FlaskConical size={12} /> Input Hasil
                                            </Button>
                                        )}
                                        {order.status === 'selesai' && (
                                            <Button variant="ghost" size="sm" style={{ color: 'var(--success)' }} onClick={() => handleViewDetail(order)}>
                                                <Eye size={14} /> Lihat Hasil
                                            </Button>
                                        )}
                                        <Button variant="secondary" size="sm" onClick={() => handleUploadClick(order)} disabled={uploadMutation.isPending}>
                                            <Upload size={12} /> Upload Hasil
                                        </Button>
                                        {order.hasilUrl && (
                                            <a
                                                href={hasilFileUrl(order.hasilUrl)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                    height: '30px', padding: '0 12px', fontSize: '13px', fontWeight: 500,
                                                    borderRadius: 'var(--radius-md)', textDecoration: 'none',
                                                    color: 'var(--primary)', background: 'transparent', border: 'none',
                                                }}
                                            >
                                                <FileDown size={14} /> Lihat PDF
                                            </a>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination currentPage={1} totalPages={Math.ceil(filtered.length / 10) || 1} totalItems={filtered.length} onPageChange={() => { }} />
            </div>

            {/* Tambah Order Modal */}
            <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Order Pemeriksaan Lab Baru" icon={<Plus size={20} />}
                footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Batal</Button><Button variant="primary" onClick={handleAddOrder}><TestTube size={16} /> Buat Order</Button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Nama Pasien *</label>
                            <input className={uiStyles.formInput} value={addForm.patientName || ''}
                                onChange={e => setAddForm(f => ({ ...f, patientName: e.target.value }))} placeholder="Nama pasien" />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>No. RM</label>
                            <input className={uiStyles.formInput} value={addForm.rm || ''}
                                onChange={e => setAddForm(f => ({ ...f, rm: e.target.value }))} placeholder="Auto-generate" />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Dokter Pengirim *</label>
                            <select className={uiStyles.formSelect} value={addForm.dokterId || ''}
                                onChange={e => {
                                    const doc = doctors.find(d => d.id === e.target.value);
                                    setAddForm(f => ({ ...f, dokterId: e.target.value, dokterName: doc?.nama || '' }));
                                }}>
                                <option value="">Pilih Dokter...</option>
                                {doctors.map(d => (
                                    <option key={d.id} value={d.id}>{d.nama}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Item Pemeriksaan *</label>
                        <textarea className={uiStyles.formTextarea} rows={3} value={addForm.jenisPemeriksaan}
                            onChange={e => setAddForm(f => ({ ...f, jenisPemeriksaan: e.target.value }))}
                            placeholder="cth: Hematologi Lengkap, GDS, Ureum, Kreatinin" />
                    </div>
                </div>
            </Modal>

            <Modal open={inputHasilOpen} onClose={() => setInputHasilOpen(false)}
                title={`Input Hasil Lab — ${inputTarget?.id || ''}`} icon={<FlaskConical size={20} />} size="lg"
                footer={<><Button variant="secondary" onClick={() => setInputHasilOpen(false)}>Batal</Button><Button variant="primary" onClick={handleSaveHasil}><CheckCircle size={16} /> Simpan & Validasi</Button></>}>
                {inputTarget && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '14px' }}>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Pasien</strong>{inputTarget.patientName || '-'}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>RM</strong>{inputTarget.rm || '-'}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Pemeriksaan</strong>{inputTarget.jenisPemeriksaan}</div>
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Hasil Pemeriksaan *</label>
                            <textarea className={uiStyles.formTextarea} rows={4} value={hasilText}
                                onChange={e => setHasilText(e.target.value)}
                                placeholder="cth: WBC: 7.2 | RBC: 5.1 | HGB: 14.2 | PLT: 245" />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Nilai Normal / Referensi</label>
                            <textarea className={uiStyles.formTextarea} rows={3} value={nilaiNormalText}
                                onChange={e => setNilaiNormalText(e.target.value)}
                                placeholder="cth: WBC: 4-11 | RBC: 4.5-5.5 | HGB: 13-17" />
                        </div>
                    </div>
                )}
            </Modal>

            <Modal open={detailOpen} onClose={() => setDetailOpen(false)}
                title={`Hasil Lab — ${detailTarget?.id || ''}`} icon={<FileText size={20} />} size="lg">
                {detailTarget && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '14px' }}>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Pasien</strong>{detailTarget.patientName} (RM: {detailTarget.rm})</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Dokter Pengirim</strong>{detailTarget.dokterName || detailTarget.dokterId}</div>
                        </div>
                        <div style={{ padding: '12px 16px', background: '#eff6ff', borderRadius: 'var(--radius-md)', color: '#1e3a8a' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jenis Pemeriksaan Lab</div>
                            <div style={{ fontSize: '16px', fontWeight: 700 }}>{detailTarget.jenisPemeriksaan}</div>
                        </div>
                        <div style={{ borderLeft: '4px solid var(--primary)', paddingLeft: '16px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginBottom: '6px' }}>Hasil Pemeriksaan</div>
                            <div style={{ fontSize: '14px', lineHeight: 1.8, fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' }}>
                                {detailTarget.hasilTeks || detailTarget.hasilUrl || 'Belum ada hasil'}
                            </div>
                        </div>
                        {detailTarget.catatan && (
                            <div style={{ borderLeft: '4px solid var(--success)', paddingLeft: '16px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--success)', marginBottom: '6px' }}>Nilai Normal / Referensi</div>
                                <div style={{ fontSize: '14px', lineHeight: 1.8, fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' }}>
                                    {detailTarget.catatan}
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                            <Button variant="secondary" onClick={() => showToast('Mencetak hasil lab...', 'info')}>
                                Cetak Hasil
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
            {/* Tambahan: Delete Order Confirmation Modal */}
            <ConfirmDialog
                open={deleteModal.open}
                title="Hapus Order Lab"
                message={`Apakah Anda yakin ingin menghapus/membatalkan order lab ${deleteModal.id}? Data yang dihapus tidak dapat dikembalikan.`}
                onConfirm={async () => {
                    try {
                        await deleteMutation.mutateAsync(deleteModal.id);
                        showToast(`Order ${deleteModal.id} berhasil dibatalkan`, 'success');
                        setDeleteModal({ open: false, id: '' });
                    } catch {
                        showToast('Gagal membatalkan order', 'danger');
                    }
                }}
                onClose={() => setDeleteModal({ open: false, id: '' })}
                variant="danger"
            />

            {/* Hidden input for hasil PDF upload */}
            <input ref={fileInputRef} type="file" accept=".pdf" hidden onChange={handleFileSelected} />
        </div>
    );
}
