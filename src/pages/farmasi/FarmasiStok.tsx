import { useState } from 'react';
import { Package, AlertTriangle, ArrowDown, ArrowUp, RefreshCcw, Plus, Eye, Edit, Trash2, Clock } from 'lucide-react';
import { Button, StatusBadge, SearchBar, FilterTabs, Pagination, Card, Modal, ConfirmDialog, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useMedicines, useCreateMedicine, useUpdateMedicine, useDeleteMedicine } from '../../hooks/useInventory';
import type { ObatItem } from '../../lib/api/inventory';
import styles from '../registrasi/registrasi.module.css';

const emptyItem = { nama: '', kategori: 'Analgesik', bentuk: 'Tablet', min: 100, ed: '', harga: 0, supplier: '' };

interface MutasiLog {
    tanggal: string; tipe: 'masuk' | 'keluar'; jumlah: number; keterangan: string;
}

export function FarmasiStok() {
    const { data: dbObat = [], isLoading } = useMedicines();
    const createMedicine = useCreateMedicine();
    const updateMedicine = useUpdateMedicine();
    const deleteMedicine = useDeleteMedicine();

    const currentList = dbObat;

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('semua');

    // Mutasi modal
    const [mutasiModal, setMutasiModal] = useState<{ open: boolean; type: 'masuk' | 'keluar'; item: ObatItem | null }>({ open: false, type: 'masuk', item: null });
    const [jumlah, setJumlah] = useState(0);
    const [keterangan, setKeterangan] = useState('');

    // Add item modal
    const [addOpen, setAddOpen] = useState(false);
    const [addForm, setAddForm] = useState(emptyItem);

    // Edit item modal
    const [editOpen, setEditOpen] = useState(false);
    const [editItem, setEditItem] = useState<ObatItem | null>(null);

    // Kartu stok modal
    const [kartuOpen, setKartuOpen] = useState(false);
    const [kartuItem, setKartuItem] = useState<ObatItem | null>(null);

    // Penerimaan barang modal
    const [penerimaanOpen, setPenerimaanOpen] = useState(false);
    const [penerimaanForm, setPenerimaanForm] = useState({ noFaktur: '', supplier: '', items: '' });

    // Delete confirm
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<ObatItem | null>(null);

    const filtered = currentList.filter((o: ObatItem) => {
        const matchSearch = search.trim() === '' ||
            o.nama.toLowerCase().includes(search.toLowerCase()) ||
            o.kode.toLowerCase().includes(search.toLowerCase()) ||
            o.kategori.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === 'semua' ||
            (filter === 'obat' && o.kode.startsWith('OB')) ||
            (filter === 'alkes' && o.kode.startsWith('AL')) ||
            (filter === 'kritis' && o.stok <= o.min);
        return matchSearch && matchFilter;
    });

    const kritisCount = currentList.filter((o: ObatItem) => o.stok <= o.min).length;
    const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

    // Mutasi handler
    const handleMutasi = () => {
        if (!mutasiModal.item || jumlah <= 0) {
            showToast('Masukkan jumlah yang valid', 'warning');
            return;
        }
        // Mutasi will require Phase 4 transaction table integration
        // For now simulate success:
        showToast(`Mutasi ${mutasiModal.type} ${jumlah} unit "${mutasiModal.item.nama}" berhasil`, 'success');
        setMutasiModal({ open: false, type: 'masuk', item: null });
        setJumlah(0);
        setKeterangan('');
    };

    // Add item handler
    const handleAddItem = async () => {
        if (!addForm.nama || !addForm.supplier) {
            showToast('Lengkapi nama obat dan supplier', 'warning');
            return;
        }
        const prefix = addForm.kategori.includes('Alkes') ? 'AL' : 'OB';
        const newItem: ObatItem = {
            kode: `${prefix}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
            nama: addForm.nama,
            kategori: addForm.kategori,
            bentuk: addForm.bentuk,
            stok: 0,
            min: addForm.min,
            ed: addForm.ed || '2028-01-01',
            harga: addForm.harga,
            supplier: addForm.supplier,
        };
        try {
            await createMedicine.mutateAsync(newItem);
            showToast(`Item "${addForm.nama}" berhasil ditambahkan`, 'success');
            setAddOpen(false);
            setAddForm(emptyItem);
        } catch {
            showToast('Gagal menambahkan item inventaris', 'danger');
        }
    };

    // Edit item handler
    const handleEditSave = async () => {
        if (!editItem) return;
        try {
            await updateMedicine.mutateAsync({ kode: editItem.kode, data: editItem });
            showToast(`Item "${editItem.nama}" berhasil diperbarui`, 'success');
            setEditOpen(false);
            setEditItem(null);
        } catch {
            showToast('Gagal memperbarui item inventaris', 'danger');
        }
    };

    // Delete handler
    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteMedicine.mutateAsync(deleteTarget.kode);
            showToast(`Item "${deleteTarget.nama}" berhasil dihapus`, 'success');
            setDeleteOpen(false);
            setDeleteTarget(null);
        } catch {
            showToast('Gagal menghapus item inventaris', 'danger');
        }
    };

    // Penerimaan barang handler
    const handlePenerimaan = () => {
        if (!penerimaanForm.noFaktur || !penerimaanForm.supplier) {
            showToast('Lengkapi No. Faktur dan Supplier', 'warning');
            return;
        }
        showToast(`Penerimaan barang faktur "${penerimaanForm.noFaktur}" berhasil dicatat`, 'success');
        setPenerimaanOpen(false);
        setPenerimaanForm({ noFaktur: '', supplier: '', items: '' });
    };

    // Mock kartu stok data
    const kartuStokLog: MutasiLog[] = [
        { tanggal: '27/02/2026 10:30', tipe: 'keluar', jumlah: 10, keterangan: 'Resep R-0456 (Ahmad Sudrajat)' },
        { tanggal: '27/02/2026 08:15', tipe: 'masuk', jumlah: 500, keterangan: 'PO-2026-0045 (PT Kimia Farma)' },
        { tanggal: '26/02/2026 14:20', tipe: 'keluar', jumlah: 15, keterangan: 'Resep R-0448 (Siti Aminah)' },
        { tanggal: '25/02/2026 09:00', tipe: 'masuk', jumlah: 200, keterangan: 'PO-2026-0042 (PT Kimia Farma)' },
        { tanggal: '24/02/2026 11:45', tipe: 'keluar', jumlah: 8, keterangan: 'Resep R-0440 (Budi Hartono)' },
    ];

    if (isLoading) {
        return (
            <div className={styles.page}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: 'var(--text-secondary)' }}>
                    Memuat data obat...
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Stok Obat & Alkes</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button variant="secondary" onClick={() => {
                        showToast('Stok opname dimulai — silahkan verifikasi stok fisik', 'info');
                    }}><RefreshCcw size={16} /> Stok Opname</Button>
                    <Button variant="secondary" onClick={() => setPenerimaanOpen(true)}>
                        <Package size={16} /> Penerimaan Barang
                    </Button>
                    <Button variant="primary" onClick={() => { setAddForm(emptyItem); setAddOpen(true); }}>
                        <Plus size={16} /> Tambah Item Baru
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'var(--primary-100)', color: 'var(--primary)', padding: '12px', borderRadius: '12px' }}><Package size={24} /></div>
                        <div><div style={{ fontSize: '24px', fontWeight: 700 }}>{currentList.length}</div><div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Item Aktif</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '12px' }}><AlertTriangle size={24} /></div>
                        <div><div style={{ fontSize: '24px', fontWeight: 700 }}>{kritisCount}</div><div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Stok Kritis</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '12px' }}><Clock size={24} /></div>
                        <div><div style={{ fontSize: '24px', fontWeight: 700 }}>{currentList.filter(o => o.ed < '2026-06-01').length}</div><div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Mendekati ED</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '12px', borderRadius: '12px' }}><Package size={24} /></div>
                        <div><div style={{ fontSize: '14px', fontWeight: 700 }}>{formatRp(currentList.reduce((a, o) => a + o.stok * o.harga, 0))}</div><div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Nilai Inventaris</div></div>
                    </div>
                </Card>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari nama obat, kode, kategori..." value={search} onChange={setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua Item', value: 'semua', count: currentList.length },
                        { label: 'Obat', value: 'obat', count: currentList.filter(o => o.kode.startsWith('OB')).length },
                        { label: 'Alkes', value: 'alkes', count: currentList.filter(o => o.kode.startsWith('AL')).length },
                        { label: 'Stok Kritis', value: 'kritis', count: kritisCount },
                    ]}
                    active={filter} onChange={setFilter}
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead>
                        <tr>
                            <th>Kode Item</th><th>Nama Obat/Alkes</th><th>Kategori</th><th>Bentuk</th>
                            <th style={{ textAlign: 'right' }}>Stok</th><th style={{ textAlign: 'right' }}>Min.</th>
                            <th>Exp. Date</th><th style={{ textAlign: 'right' }}>Harga</th><th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada item ditemukan</td></tr>
                        ) : filtered.map((obat: ObatItem, i: number) => (
                            <tr key={i}>
                                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{obat.kode}</td>
                                <td style={{ fontWeight: 600 }}>{obat.nama}</td>
                                <td><StatusBadge variant="neutral" dot={false}>{obat.kategori}</StatusBadge></td>
                                <td>{obat.bentuk}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: obat.stok <= obat.min ? '#dc2626' : 'inherit' }}>
                                    {obat.stok.toLocaleString('id-ID')}
                                    {obat.stok <= obat.min && <AlertTriangle size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} />}
                                </td>
                                <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{obat.min.toLocaleString('id-ID')}</td>
                                <td><span style={{ color: obat.ed < '2026-06-01' ? '#dc2626' : 'inherit' }}>{obat.ed}</span></td>
                                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{formatRp(obat.harga)}</td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        <Button variant="ghost" size="sm" title="Kartu Stok" style={{ color: 'var(--primary)' }}
                                            onClick={() => { setKartuItem(obat); setKartuOpen(true); }}>
                                            <Eye size={14} />
                                        </Button>
                                        <Button variant="ghost" size="sm" title="Edit Item" style={{ color: 'var(--warning)' }}
                                            onClick={() => { setEditItem({ ...obat }); setEditOpen(true); }}>
                                            <Edit size={14} />
                                        </Button>
                                        <Button variant="ghost" size="sm" title="Mutasi Masuk" style={{ color: 'var(--success)' }}
                                            onClick={() => { setMutasiModal({ open: true, type: 'masuk', item: obat }); setJumlah(0); setKeterangan(''); }}>
                                            <ArrowDown size={14} />
                                        </Button>
                                        <Button variant="ghost" size="sm" title="Mutasi Keluar" style={{ color: 'var(--danger)' }}
                                            onClick={() => { setMutasiModal({ open: true, type: 'keluar', item: obat }); setJumlah(0); setKeterangan(''); }}>
                                            <ArrowUp size={14} />
                                        </Button>
                                        <Button variant="ghost" size="sm" title="Hapus Item" style={{ color: '#9ca3af' }}
                                            onClick={() => { setDeleteTarget(obat); setDeleteOpen(true); }}>
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination currentPage={1} totalPages={Math.ceil(filtered.length / 10) || 1} totalItems={filtered.length} onPageChange={() => { }} />
            </div>

            {/* Mutasi Modal */}
            <Modal open={mutasiModal.open} onClose={() => setMutasiModal({ open: false, type: 'masuk', item: null })}
                title={`Mutasi ${mutasiModal.type === 'masuk' ? 'Masuk' : 'Keluar'}`}
                icon={mutasiModal.type === 'masuk' ? <ArrowDown size={20} /> : <ArrowUp size={20} />} size="sm"
                footer={<><Button variant="secondary" onClick={() => setMutasiModal({ open: false, type: 'masuk', item: null })}>Batal</Button><Button variant="primary" onClick={handleMutasi}>Simpan Mutasi</Button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{mutasiModal.item?.nama}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Stok saat ini: <strong>{mutasiModal.item?.stok.toLocaleString('id-ID')}</strong> {mutasiModal.item?.bentuk}</div>
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Jumlah {mutasiModal.type === 'masuk' ? 'Masuk' : 'Keluar'} *</label>
                        <input className={uiStyles.formInput} type="number" min="1" value={jumlah || ''} onChange={e => setJumlah(+e.target.value)} placeholder="Masukkan jumlah..." />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Keterangan</label>
                        <input className={uiStyles.formInput} value={keterangan} onChange={e => setKeterangan(e.target.value)} placeholder="cth: PO-2026-001 / Resep R-0456" />
                    </div>
                </div>
            </Modal>

            {/* Tambah Item Modal */}
            <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Tambah Item Baru" icon={<Plus size={20} />}
                footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Batal</Button><Button variant="primary" onClick={handleAddItem}><Plus size={16} /> Tambah</Button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Nama Obat/Alkes *</label>
                        <input className={uiStyles.formInput} value={addForm.nama} onChange={e => setAddForm(f => ({ ...f, nama: e.target.value }))} placeholder="cth: Paracetamol 500mg Tab" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Kategori</label>
                            <select className={uiStyles.formSelect} value={addForm.kategori} onChange={e => setAddForm(f => ({ ...f, kategori: e.target.value }))}>
                                <option>Analgesik</option><option>Antibiotik</option><option>Antasida</option>
                                <option>Mukolitik</option><option>Vitamin</option><option>Alkes Habis Pakai</option>
                            </select>
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Bentuk Sediaan</label>
                            <select className={uiStyles.formSelect} value={addForm.bentuk} onChange={e => setAddForm(f => ({ ...f, bentuk: e.target.value }))}>
                                <option>Tablet</option><option>Kapsul</option><option>Sirup</option>
                                <option>Vial</option><option>Ampul</option><option>Pcs</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Min. Stok</label>
                            <input className={uiStyles.formInput} type="number" value={addForm.min} onChange={e => setAddForm(f => ({ ...f, min: +e.target.value }))} />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Harga Satuan</label>
                            <input className={uiStyles.formInput} type="number" value={addForm.harga || ''} onChange={e => setAddForm(f => ({ ...f, harga: +e.target.value }))} placeholder="Rp" />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Exp. Date</label>
                            <input className={uiStyles.formInput} type="date" value={addForm.ed} onChange={e => setAddForm(f => ({ ...f, ed: e.target.value }))} />
                        </div>
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Supplier *</label>
                        <input className={uiStyles.formInput} value={addForm.supplier} onChange={e => setAddForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Nama PBF / Supplier" />
                    </div>
                </div>
            </Modal>

            {/* Edit Item Modal */}
            <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit — ${editItem?.nama}`} icon={<Edit size={20} />}
                footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Batal</Button><Button variant="primary" onClick={handleEditSave}>Simpan Perubahan</Button></>}>
                {editItem && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Nama Obat/Alkes</label>
                            <input className={uiStyles.formInput} value={editItem.nama} onChange={e => setEditItem(prev => prev ? { ...prev, nama: e.target.value } : prev)} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className={uiStyles.formGroup}>
                                <label className={uiStyles.formLabel}>Kategori</label>
                                <select className={uiStyles.formSelect} value={editItem.kategori} onChange={e => setEditItem(prev => prev ? { ...prev, kategori: e.target.value } : prev)}>
                                    <option>Analgesik</option><option>Antibiotik</option><option>Antasida</option>
                                    <option>Mukolitik</option><option>Vitamin</option><option>Alkes Habis Pakai</option>
                                </select>
                            </div>
                            <div className={uiStyles.formGroup}>
                                <label className={uiStyles.formLabel}>Bentuk Sediaan</label>
                                <select className={uiStyles.formSelect} value={editItem.bentuk} onChange={e => setEditItem(prev => prev ? { ...prev, bentuk: e.target.value } : prev)}>
                                    <option>Tablet</option><option>Kapsul</option><option>Sirup</option>
                                    <option>Vial</option><option>Ampul</option><option>Pcs</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                            <div className={uiStyles.formGroup}>
                                <label className={uiStyles.formLabel}>Min. Stok</label>
                                <input className={uiStyles.formInput} type="number" value={editItem.min} onChange={e => setEditItem(prev => prev ? { ...prev, min: +e.target.value } : prev)} />
                            </div>
                            <div className={uiStyles.formGroup}>
                                <label className={uiStyles.formLabel}>Harga Satuan</label>
                                <input className={uiStyles.formInput} type="number" value={editItem.harga} onChange={e => setEditItem(prev => prev ? { ...prev, harga: +e.target.value } : prev)} />
                            </div>
                            <div className={uiStyles.formGroup}>
                                <label className={uiStyles.formLabel}>Exp. Date</label>
                                <input className={uiStyles.formInput} type="date" value={editItem.ed} onChange={e => setEditItem(prev => prev ? { ...prev, ed: e.target.value } : prev)} />
                            </div>
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Supplier</label>
                            <input className={uiStyles.formInput} value={editItem.supplier} onChange={e => setEditItem(prev => prev ? { ...prev, supplier: e.target.value } : prev)} />
                        </div>
                    </div>
                )}
            </Modal>

            {/* Kartu Stok Modal */}
            <Modal open={kartuOpen} onClose={() => setKartuOpen(false)}
                title={`Kartu Stok — ${kartuItem?.nama}`} icon={<Eye size={20} />} size="lg">
                {kartuItem && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '14px' }}>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Kode</strong>{kartuItem.kode}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Stok Saat Ini</strong><span style={{ fontWeight: 700, color: kartuItem.stok <= kartuItem.min ? '#dc2626' : 'var(--success)' }}>{kartuItem.stok}</span></div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Supplier</strong>{kartuItem.supplier}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Harga Satuan</strong>{formatRp(kartuItem.harga)}</div>
                        </div>
                        <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Riwayat Mutasi Terakhir</h4>
                        <table className={uiStyles.table}>
                            <thead><tr><th>Tanggal</th><th>Tipe</th><th style={{ textAlign: 'right' }}>Jumlah</th><th>Keterangan</th></tr></thead>
                            <tbody>
                                {kartuStokLog.map((log, i) => (
                                    <tr key={i}>
                                        <td style={{ fontSize: '13px' }}>{log.tanggal}</td>
                                        <td><StatusBadge variant={log.tipe === 'masuk' ? 'success' : 'danger'} dot={false}>{log.tipe === 'masuk' ? '↓ Masuk' : '↑ Keluar'}</StatusBadge></td>
                                        <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{log.tipe === 'masuk' ? '+' : '-'}{log.jumlah}</td>
                                        <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{log.keterangan}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button variant="secondary" onClick={() => showToast('Mencetak kartu stok...', 'info')}>Cetak Kartu Stok</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Penerimaan Barang Modal */}
            <Modal open={penerimaanOpen} onClose={() => setPenerimaanOpen(false)} title="Penerimaan Barang" icon={<Package size={20} />}
                footer={<><Button variant="secondary" onClick={() => setPenerimaanOpen(false)}>Batal</Button><Button variant="primary" onClick={handlePenerimaan}>Simpan Penerimaan</Button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>No. Faktur / PO *</label>
                            <input className={uiStyles.formInput} value={penerimaanForm.noFaktur} onChange={e => setPenerimaanForm(f => ({ ...f, noFaktur: e.target.value }))} placeholder="PO-2026-xxxx" />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Supplier *</label>
                            <select className={uiStyles.formSelect} value={penerimaanForm.supplier} onChange={e => setPenerimaanForm(f => ({ ...f, supplier: e.target.value }))}>
                                <option value="">Pilih Supplier...</option>
                                <option>PT Kimia Farma</option>
                                <option>PT Dexa Medica</option>
                                <option>PT Kalbe Farma</option>
                                <option>PT Sanbe Farma</option>
                                <option>PT Jayamas Medica</option>
                            </select>
                        </div>
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Daftar Item (satu per baris, format: nama obat | jumlah)</label>
                        <textarea className={uiStyles.formTextarea} rows={5} value={penerimaanForm.items}
                            onChange={e => setPenerimaanForm(f => ({ ...f, items: e.target.value }))}
                            placeholder={"Paracetamol 500mg Tab | 500\nAmbroxol 30mg Tab | 200\nCeftriaxone 1g Inj | 50"} />
                    </div>
                </div>
            </Modal>

            {/* Delete Confirm */}
            <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete}
                title="Hapus Item?" message={`Item "${deleteTarget?.nama}" (${deleteTarget?.kode}) akan dihapus dari daftar inventaris.`}
                variant="danger" confirmLabel="Ya, Hapus" />
        </div>
    );
}
