import { useState } from 'react';
import { ScanLine, Image as ImageIcon, Plus, Eye, FileText, CheckCircle, Trash2 } from 'lucide-react';
import { Button, StatusBadge, SearchBar, FilterTabs, Pagination, Modal, Card, showToast, ConfirmDialog } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';
import { useRadiologyOrders, useCreateRadiologyOrder, useUpdateRadiologyOrder, useDeleteRadiologyOrder } from '../../hooks/usePenunjang';
import { useDoctors } from '../../hooks/useMasterData';
import type { RadiologyOrder } from '../../lib/api/penunjang';

const emptyOrder: Partial<RadiologyOrder> = {
    patientName: '',
    rm: '',
    dokterId: '',
    dokterName: '',
    jenisPemeriksaan: ''
};

export function Radiologi() {
    const { data: radList = [] } = useRadiologyOrders();
    const createMutation = useCreateRadiologyOrder();
    const updateMutation = useUpdateRadiologyOrder();
    const deleteMutation = useDeleteRadiologyOrder();
    const { data: doctors = [] } = useDoctors();

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('semua');

    // Modals
    const [addOpen, setAddOpen] = useState(false);
    const [addForm, setAddForm] = useState(emptyOrder);
    const [expertiseOpen, setExpertiseOpen] = useState(false);
    const [expertiseTarget, setExpertiseTarget] = useState<RadiologyOrder | null>(null);
    const [expertiseText, setExpertiseText] = useState('');
    const [kesanText, setKesanText] = useState(''); // Loosely mapped to catatan
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailTarget, setDetailTarget] = useState<RadiologyOrder | null>(null);

    // Delete Confirms
    const [deleteModal, setDeleteModal] = useState<{ open: boolean, id: string }>({ open: false, id: '' });

    const filtered = radList.filter(o => {
        const matchSearch = search.trim() === '' ||
            (o.patientName?.toLowerCase().includes(search.toLowerCase()) || '') ||
            (o.id.toLowerCase().includes(search.toLowerCase())) ||
            (o.rm?.includes(search) || '');
        const filterMap: Record<string, string> = { 'baru': 'menunggu', 'expertise': 'diproses', 'selesai': 'selesai' };
        const mappedStatus = filter === 'semua' ? 'semua' : filterMap[filter] || filter;
        const matchFilter = mappedStatus === 'semua' || o.status === mappedStatus;
        return matchSearch && matchFilter;
    });

    const handleLakukan = async (order: RadiologyOrder) => {
        try {
            await updateMutation.mutateAsync({ id: order.id, data: { status: 'diproses' } });
            showToast(`Pemeriksaan "${order.id}" telah dilaksanakan, menunggu expertise`, 'success');
        } catch (err) {
            showToast('Gagal memproses pemeriksaan radiologi', 'danger');
        }
    };

    const handleOpenExpertise = (order: RadiologyOrder) => {
        setExpertiseTarget(order);
        setExpertiseText(order.expertise || '');
        setKesanText(order.catatan || ''); // Demo
        setExpertiseOpen(true);
    };

    const handleSaveExpertise = async () => {
        if (!expertiseText.trim()) {
            showToast('Uraian expertise wajib diisi', 'warning');
            return;
        }
        if (expertiseTarget) {
            try {
                await updateMutation.mutateAsync({
                    id: expertiseTarget.id,
                    data: {
                        status: 'selesai',
                        expertise: expertiseText,
                        catatan: kesanText,
                        waktuSelesai: new Date().toISOString()
                    }
                });
                showToast(`Expertise "${expertiseTarget.id}" berhasil disimpan`, 'success');
            } catch (err) {
                showToast('Gagal menyimpan expertise', 'danger');
            }
        }
        setExpertiseOpen(false);
        setExpertiseTarget(null);
    };

    const handleAddOrder = async () => {
        if (!addForm.patientName || !addForm.jenisPemeriksaan) {
            showToast('Lengkapi data: Pasien dan Modalitas', 'warning');
            return;
        }
        const now = new Date();
        const payload = {
            visitId: 'DUMMY-VISIT', // For demo form
            dokterId: 'DUMMY-DOC',
            jenisPemeriksaan: addForm.jenisPemeriksaan,
            status: 'menunggu',
            catatan: 'Order Manual Radiologi RIS',
            waktuOrder: now.toISOString()
        };
        try {
            await createMutation.mutateAsync(payload);
            showToast(`Order radiologi berhasil dibuat`, 'success');
            setAddOpen(false);
            setAddForm(emptyOrder);
        } catch (error) {
            showToast(`Gagal order radiologi: ${(error as Error).message}`, 'danger');
        }
    };

    const handleViewDetail = (order: RadiologyOrder) => {
        setDetailTarget(order);
        setDetailOpen(true);
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Instalasi Radiologi</h1>
                <Button variant="primary" onClick={() => { setAddForm(emptyOrder); setAddOpen(true); }}>
                    <Plus size={16} /> Order Pemeriksaan Baru
                </Button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '12px', color: '#dc2626' }}><ScanLine size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{radList.filter(o => o.status === 'menunggu').length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Menunggu Pelaksanaan</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '12px', color: '#d97706' }}><FileText size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{radList.filter(o => o.status === 'diproses').length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Menunggu Expertise</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '12px', color: '#16a34a' }}><CheckCircle size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{radList.filter(o => o.status === 'selesai').length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Expertise Selesai</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '12px', color: '#3b82f6' }}><ImageIcon size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{radList.length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Order</div></div>
                    </div>
                </Card>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari No. Order / Pasien / RM..." value={search} onChange={setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua Order', value: 'semua', count: radList.length },
                        { label: 'Order Baru', value: 'baru', count: radList.filter(o => o.status === 'menunggu').length },
                        { label: 'Menunggu Expertise', value: 'expertise', count: radList.filter(o => o.status === 'diproses').length },
                        { label: 'Selesai', value: 'selesai', count: radList.filter(o => o.status === 'selesai').length },
                    ]}
                    active={filter} onChange={setFilter}
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead>
                        <tr>
                            <th>No. Order</th><th>Waktu</th><th>Pasien</th><th>Asal & Pengirim</th><th>Modalitas & Tindakan</th><th>Status</th><th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada order ditemukan</td></tr>
                        ) : filtered.map((order, i) => (
                            <tr key={i}>
                                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{order.id}</td>
                                <td>{new Date(order.waktuOrder).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                <td><div className={styles.nameCell}><span className={styles.namePrimary}>{order.patientName || 'Pasien Anon'}</span><span className={styles.nameSecondary}>RM: {order.rm || '-'}</span></div></td>
                                <td><div className={styles.nameCell}><span className={styles.nameSecondary}>{order.dokterName || order.dokterId}</span></div></td>
                                <td style={{ fontWeight: 500 }}>{order.jenisPemeriksaan}</td>
                                <td>
                                    <StatusBadge variant={order.status === 'menunggu' ? 'danger' : order.status === 'diproses' ? 'warning' : 'success'}>
                                        {order.status === 'menunggu' ? 'Pelaksanaan' : order.status === 'diproses' ? 'Menunggu Expertise' : 'Expertise Selesai'}
                                    </StatusBadge>
                                </td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        {order.status === 'menunggu' && (
                                            <>
                                                <Button variant="secondary" size="sm" onClick={() => handleLakukan(order)}>
                                                    <ScanLine size={12} /> Lakukan
                                                </Button>
                                                <Button variant="ghost" size="sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleteModal({ open: true, id: order.id })}>
                                                    <Trash2 size={14} />
                                                </Button>
                                            </>
                                        )}
                                        {order.status === 'diproses' && (
                                            <Button variant="primary" size="sm" onClick={() => handleOpenExpertise(order)}>
                                                <FileText size={12} /> Tulis Expertise
                                            </Button>
                                        )}
                                        {order.status === 'selesai' && (
                                            <Button variant="ghost" size="sm" style={{ color: 'var(--success)' }} onClick={() => handleViewDetail(order)}>
                                                <Eye size={14} /> Lihat Hasil
                                            </Button>
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
            <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Order Pemeriksaan Radiologi Baru" icon={<Plus size={20} />}
                footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Batal</Button><Button variant="primary" onClick={handleAddOrder}><ScanLine size={16} /> Buat Order</Button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Nama Pasien *</label>
                            <input className={uiStyles.formInput} value={addForm.patientName || ''}
                                onChange={e => setAddForm(f => ({ ...f, patientName: e.target.value }))} placeholder="Nama pasien" />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>No. RM</label>
                            <input className={uiStyles.formInput} value={addForm.rm}
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
                        <label className={uiStyles.formLabel}>Modalitas & Tindakan *</label>
                        <textarea className={uiStyles.formTextarea} rows={3} value={addForm.jenisPemeriksaan || ''}
                            onChange={e => setAddForm(f => ({ ...f, jenisPemeriksaan: e.target.value }))}
                            placeholder="cth: Rontgen Thorax AP/PA, USG Abdomen, CT Scan Head" />
                    </div>
                </div>
            </Modal>

            <Modal open={expertiseOpen} onClose={() => setExpertiseOpen(false)}
                title={`Tulis Expertise — ${expertiseTarget?.id || ''}`} icon={<FileText size={20} />} size="lg"
                footer={<><Button variant="secondary" onClick={() => setExpertiseOpen(false)}>Batal</Button><Button variant="primary" onClick={handleSaveExpertise}><CheckCircle size={16} /> Simpan Expertise</Button></>}>
                {expertiseTarget && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '14px' }}>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Pasien</strong>{expertiseTarget.patientName || '-'}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Modalitas</strong>{expertiseTarget.jenisPemeriksaan}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Dokter Pengirim</strong>{expertiseTarget.dokterName || expertiseTarget.dokterId}</div>
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Uraian / Deskripsi Expertise *</label>
                            <textarea className={uiStyles.formTextarea} rows={5} value={expertiseText}
                                onChange={e => setExpertiseText(e.target.value)}
                                placeholder="Deskripsikan temuan radiologis secara detail..." />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Kesan / Kesimpulan</label>
                            <textarea className={uiStyles.formTextarea} rows={3} value={kesanText}
                                onChange={e => setKesanText(e.target.value)}
                                placeholder="Kesimpulan dari temuan radiologis..." />
                        </div>
                    </div>
                )}
            </Modal>

            <Modal open={detailOpen} onClose={() => setDetailOpen(false)}
                title={`Hasil Radiologi — ${detailTarget?.id || ''}`} icon={<ImageIcon size={20} />} size="lg">
                {detailTarget && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '14px' }}>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Pasien</strong>{detailTarget.patientName || '-'} (RM: {detailTarget.rm || '-'})</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Modalitas</strong>{detailTarget.jenisPemeriksaan}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Dokter Pengirim</strong>{detailTarget.dokterName || detailTarget.dokterId}</div>
                        </div>

                        {/* PACS Placeholder */}
                        <div style={{ background: '#1e293b', borderRadius: 'var(--radius-md)', padding: '40px', textAlign: 'center', color: '#64748b' }}>
                            <ImageIcon size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
                            <div style={{ fontSize: '14px' }}>Gambar PACS / DICOM Viewer</div>
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>Klik untuk membuka di viewer terpisah</div>
                        </div>

                        <div style={{ borderLeft: '4px solid var(--primary)', paddingLeft: '16px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginBottom: '6px' }}>Uraian / Deskripsi</div>
                            <div style={{ fontSize: '14px', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                                {detailTarget.expertise || 'Belum ada expertise'}
                            </div>
                        </div>
                        {detailTarget.catatan && (
                            <div style={{ borderLeft: '4px solid var(--success)', paddingLeft: '16px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--success)', marginBottom: '6px' }}>Kesan / Kesimpulan</div>
                                <div style={{ fontSize: '14px', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                                    {detailTarget.catatan}
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                            <Button variant="secondary" onClick={() => showToast('Mencetak hasil expertise...', 'info')}>
                                Cetak Expertise
                            </Button>
                            <Button variant="secondary" onClick={() => showToast('Membuka PACS viewer...', 'info')}>
                                <ImageIcon size={14} /> Buka PACS
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
            {/* Tambahan: Delete Order Confirmation Modal */}
            <ConfirmDialog
                open={deleteModal.open}
                title="Hapus Order Radiologi"
                message={`Apakah Anda yakin ingin menghapus/membatalkan order radiologi ${deleteModal.id}? Data yang dihapus tidak dapat dikembalikan.`}
                onConfirm={async () => {
                    try {
                        await deleteMutation.mutateAsync(deleteModal.id);
                        showToast(`Order ${deleteModal.id} berhasil dibatalkan`, 'success');
                        setDeleteModal({ open: false, id: '' });
                    } catch (error) {
                        showToast('Gagal membatalkan order', 'danger');
                    }
                }}
                onClose={() => setDeleteModal({ open: false, id: '' })}
                variant="danger"
            />
        </div>
    );
}
