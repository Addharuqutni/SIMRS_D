import { formatRp } from '../../lib/format';
import { useState } from 'react';
import { Package, AlertTriangle, RefreshCcw, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { Button, StatusBadge, SearchBar, Pagination, Card, Modal, ConfirmDialog, showToast, Printable } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useMedicineList, useCreateMedicine, useUpdateMedicine, useDeleteMedicine, useCreateReception, useOpname, useStockMutations } from '../../hooks/useInventory';
import type { ObatItem, StockMutation } from '../../lib/api/inventory';
import { errorMessage } from '../../lib/api-error';
import { NEAR_EXPIRY_DAYS } from '../../../shared/inventory';
import styles from '../registrasi/registrasi.module.css';

const emptyItem = { kode: '', nama: '', kategori: 'Analgesik', bentuk: 'Tablet', min: 100, harga: 0 };
const emptyPenerimaan = { kodeObat: '', noBatch: '', noFaktur: '', supplier: '', qty: 0, expiredDate: '', hargaBeli: 0 };

const nearEdDate = new Date(Date.now() + NEAR_EXPIRY_DAYS * 86_400_000).toISOString().slice(0, 10);

const MUTASI_LABEL: Record<StockMutation['jenis'], { label: string; variant: 'success' | 'danger' | 'warning' | 'info'; sign: string }> = {
    MASUK: { label: 'Masuk', variant: 'success', sign: '+' },
    KELUAR: { label: 'Keluar', variant: 'danger', sign: '-' },
    PENYESUAIAN: { label: 'Opname', variant: 'warning', sign: '±' },
    TRANSFER: { label: 'Transfer', variant: 'info', sign: '' },
    MUSNAH: { label: 'Musnah', variant: 'danger', sign: '-' },
    RETUR: { label: 'Retur', variant: 'danger', sign: '-' },
};

export function FarmasiStok() {
    const list = useMedicineList();
    const currentList = list.rows;
    const createMedicine = useCreateMedicine();
    const updateMedicine = useUpdateMedicine();
    const deleteMedicine = useDeleteMedicine();
    const createReception = useCreateReception();
    const opname = useOpname();

    // Add item modal
    const [addOpen, setAddOpen] = useState(false);
    const [addForm, setAddForm] = useState(emptyItem);

    // Edit item modal
    const [editOpen, setEditOpen] = useState(false);
    const [editItem, setEditItem] = useState<ObatItem | null>(null);

    // Kartu stok modal
    const [kartuItem, setKartuItem] = useState<ObatItem | null>(null);
    const { data: kartuStok = [], isLoading: kartuLoading } = useStockMutations(kartuItem?.kode ?? null);

    // Penerimaan barang modal
    const [penerimaanOpen, setPenerimaanOpen] = useState(false);
    const [penerimaanForm, setPenerimaanForm] = useState(emptyPenerimaan);

    // Stok opname modal: stok fisik per kode obat (string agar input bisa kosong)
    const [opnameOpen, setOpnameOpen] = useState(false);
    const [opnameCounts, setOpnameCounts] = useState<Record<string, string>>({});

    // Delete confirm
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<ObatItem | null>(null);

    const kritisCount = currentList.filter((o) => o.stok <= o.min).length;

    // Add item handler — stock starts at 0; it grows only through Penerimaan Barang
    const handleAddItem = async () => {
        if (!addForm.kode.trim() || !addForm.nama.trim()) {
            showToast('Lengkapi kode dan nama obat', 'warning');
            return;
        }
        try {
            await createMedicine.mutateAsync({ ...addForm, kode: addForm.kode.trim().toUpperCase() });
            showToast(`Item "${addForm.nama}" berhasil ditambahkan`, 'success');
            setAddOpen(false);
            setAddForm(emptyItem);
        } catch (err) {
            showToast(errorMessage(err, 'Gagal menambahkan item inventaris'), 'danger');
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
        } catch (err) {
            showToast(errorMessage(err, 'Gagal memperbarui item inventaris'), 'danger');
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
        } catch (err) {
            showToast(errorMessage(err, 'Gagal menghapus item inventaris'), 'danger');
        }
    };

    // Penerimaan barang handler
    const handlePenerimaan = async () => {
        const { kodeObat, noBatch, noFaktur, supplier, qty, expiredDate, hargaBeli } = penerimaanForm;
        if (!kodeObat || !noBatch || !noFaktur || !supplier || !expiredDate || qty <= 0) {
            showToast('Lengkapi obat, no. batch, no. faktur, supplier, qty, dan tanggal ED', 'warning');
            return;
        }
        const obat = currentList.find((o) => o.kode === kodeObat);
        try {
            await createReception.mutateAsync({
                kodeObat,
                noBatch,
                noFaktur,
                supplier,
                qty,
                expiredDate,
                hargaBeli: hargaBeli > 0 ? hargaBeli : undefined,
            });
            showToast(`Penerimaan ${qty} unit "${obat?.nama || kodeObat}" (faktur ${noFaktur}) berhasil dicatat`, 'success');
            setPenerimaanOpen(false);
            setPenerimaanForm(emptyPenerimaan);
        } catch (err) {
            showToast(errorMessage(err, 'Gagal mencatat penerimaan barang'), 'danger');
        }
    };

    // Stok opname handler (items on the current page)
    const opnameItems = currentList
        .filter((o) => opnameCounts[o.kode] !== undefined && opnameCounts[o.kode] !== '')
        .map((o) => ({ kodeObat: o.kode, stokFisik: Number(opnameCounts[o.kode]) }));

    const handleOpname = async () => {
        if (!opnameItems.length) {
            showToast('Isi stok fisik minimal untuk satu item', 'warning');
            return;
        }
        if (opnameItems.some((i) => !Number.isInteger(i.stokFisik) || i.stokFisik < 0)) {
            showToast('Stok fisik harus berupa angka bulat >= 0', 'warning');
            return;
        }
        try {
            await opname.mutateAsync(opnameItems);
            showToast(`Stok opname tersimpan untuk ${opnameItems.length} item`, 'success');
            setOpnameOpen(false);
            setOpnameCounts({});
        } catch (err) {
            showToast(errorMessage(err, 'Gagal menyimpan stok opname'), 'danger');
        }
    };

    if (list.isLoading) {
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
                        setOpnameCounts({});
                        setOpnameOpen(true);
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'var(--primary-100)', color: 'var(--primary)', padding: '12px', borderRadius: '12px' }}><Package size={24} /></div>
                        <div><div style={{ fontSize: '24px', fontWeight: 700 }}>{list.paginationProps.totalItems}</div><div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Item Aktif</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '12px' }}><AlertTriangle size={24} /></div>
                        <div><div style={{ fontSize: '24px', fontWeight: 700 }}>{kritisCount}</div><div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Stok Kritis (halaman ini)</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '12px', borderRadius: '12px' }}><Package size={24} /></div>
                        <div><div style={{ fontSize: '14px', fontWeight: 700 }}>{formatRp(currentList.reduce((a, o) => a + o.stok * o.harga, 0))}</div><div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Nilai Inventaris (halaman ini)</div></div>
                    </div>
                </Card>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari nama obat atau kode..." value={list.search} onChange={list.setSearch} />
                </div>
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
                        {currentList.length === 0 ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada item ditemukan</td></tr>
                        ) : currentList.map((obat) => (
                            <tr key={obat.kode}>
                                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{obat.kode}</td>
                                <td style={{ fontWeight: 600 }}>{obat.nama}</td>
                                <td><StatusBadge variant="neutral" dot={false}>{obat.kategori}</StatusBadge></td>
                                <td>{obat.bentuk}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: obat.stok <= obat.min ? '#dc2626' : 'inherit' }}>
                                    {obat.stok.toLocaleString('id-ID')}
                                    {obat.stok <= obat.min && <AlertTriangle size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} />}
                                </td>
                                <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{obat.min.toLocaleString('id-ID')}</td>
                                <td><span style={{ color: obat.ed && obat.ed < nearEdDate ? '#dc2626' : 'inherit' }}>{obat.ed || '-'}</span></td>
                                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{formatRp(obat.harga)}</td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        <Button variant="ghost" size="sm" title="Kartu Stok" style={{ color: 'var(--primary)' }}
                                            onClick={() => setKartuItem(obat)}>
                                            <Eye size={14} />
                                        </Button>
                                        <Button variant="ghost" size="sm" title="Edit Item" style={{ color: 'var(--warning)' }}
                                            onClick={() => { setEditItem({ ...obat }); setEditOpen(true); }}>
                                            <Edit size={14} />
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
                <Pagination {...list.paginationProps} />
            </div>

            {/* Tambah Item Modal */}
            <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Tambah Item Baru" icon={<Plus size={20} />}
                footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Batal</Button><Button variant="primary" onClick={handleAddItem}><Plus size={16} /> Tambah</Button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Kode Obat *</label>
                            <input className={uiStyles.formInput} value={addForm.kode} onChange={e => setAddForm(f => ({ ...f, kode: e.target.value }))} placeholder="cth: OB-0001" />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Nama Obat/Alkes *</label>
                            <input className={uiStyles.formInput} value={addForm.nama} onChange={e => setAddForm(f => ({ ...f, nama: e.target.value }))} placeholder="cth: Paracetamol 500mg Tab" />
                        </div>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Min. Stok</label>
                            <input className={uiStyles.formInput} type="number" value={addForm.min} onChange={e => setAddForm(f => ({ ...f, min: +e.target.value }))} />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Harga Jual Satuan</label>
                            <input className={uiStyles.formInput} type="number" value={addForm.harga || ''} onChange={e => setAddForm(f => ({ ...f, harga: +e.target.value }))} placeholder="Rp" />
                        </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Stok awal 0 — tambahkan stok melalui Penerimaan Barang (batch, ED, supplier).</div>
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
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className={uiStyles.formGroup}>
                                <label className={uiStyles.formLabel}>Min. Stok</label>
                                <input className={uiStyles.formInput} type="number" value={editItem.min} onChange={e => setEditItem(prev => prev ? { ...prev, min: +e.target.value } : prev)} />
                            </div>
                            <div className={uiStyles.formGroup}>
                                <label className={uiStyles.formLabel}>Harga Jual Satuan</label>
                                <input className={uiStyles.formInput} type="number" value={editItem.harga} onChange={e => setEditItem(prev => prev ? { ...prev, harga: +e.target.value } : prev)} />
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Kartu Stok Modal */}
            <Modal open={!!kartuItem} onClose={() => setKartuItem(null)}
                title={`Kartu Stok — ${kartuItem?.nama}`} icon={<Eye size={20} />} size="lg">
                {kartuItem && (
                    <Printable title={`Kartu Stok ${kartuItem.kode}`} buttonText="Cetak Kartu Stok">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '14px' }}>
                                <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Kode</strong>{kartuItem.kode}</div>
                                <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Stok Saat Ini</strong><span style={{ fontWeight: 700, color: kartuItem.stok <= kartuItem.min ? '#dc2626' : 'var(--success)' }}>{kartuItem.stok}</span></div>
                                <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Supplier (batch terdekat)</strong>{kartuItem.supplier}</div>
                                <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Harga Jual</strong>{formatRp(kartuItem.harga)}</div>
                            </div>
                            <table className={uiStyles.table}>
                                <thead><tr><th>Tanggal</th><th>Jenis</th><th>Batch</th><th style={{ textAlign: 'right' }}>Jumlah</th><th>Referensi / Keterangan</th></tr></thead>
                                <tbody>
                                    {kartuLoading ? (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Memuat...</td></tr>
                                    ) : kartuStok.length === 0 ? (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada mutasi</td></tr>
                                    ) : kartuStok.map((m) => {
                                        const j = MUTASI_LABEL[m.jenis];
                                        return (
                                            <tr key={m.id}>
                                                <td style={{ fontSize: '13px' }}>{new Date(m.createdAt).toLocaleString('id-ID')}</td>
                                                <td><StatusBadge variant={j.variant} dot={false}>{j.label}</StatusBadge></td>
                                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{m.noBatch ?? '-'}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{j.sign}{m.qty}</td>
                                                <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{[m.referensi, m.keterangan].filter(Boolean).join(' — ')}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Printable>
                )}
            </Modal>

            {/* Penerimaan Barang Modal */}
            <Modal open={penerimaanOpen} onClose={() => setPenerimaanOpen(false)} title="Penerimaan Barang" icon={<Package size={20} />}
                footer={<><Button variant="secondary" onClick={() => setPenerimaanOpen(false)}>Batal</Button><Button variant="primary" onClick={handlePenerimaan} disabled={createReception.isPending}>Simpan Penerimaan</Button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Obat / Alkes *</label>
                        <select className={uiStyles.formSelect} value={penerimaanForm.kodeObat}
                            onChange={e => setPenerimaanForm(f => ({ ...f, kodeObat: e.target.value }))}>
                            <option value="">Pilih Obat...</option>
                            {currentList.map((obat) => (
                                <option key={obat.kode} value={obat.kode}>{obat.nama} ({obat.kode})</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>No. Faktur / PO *</label>
                            <input className={uiStyles.formInput} value={penerimaanForm.noFaktur}
                                onChange={e => setPenerimaanForm(f => ({ ...f, noFaktur: e.target.value }))} placeholder="PO-2026-xxxx" />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>No. Batch *</label>
                            <input className={uiStyles.formInput} value={penerimaanForm.noBatch}
                                onChange={e => setPenerimaanForm(f => ({ ...f, noBatch: e.target.value }))} placeholder="cth: B2601A" />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Supplier *</label>
                            <input className={uiStyles.formInput} value={penerimaanForm.supplier}
                                onChange={e => setPenerimaanForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Nama PBF / Supplier" />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Jumlah Diterima *</label>
                            <input className={uiStyles.formInput} type="number" min="1" value={penerimaanForm.qty || ''}
                                onChange={e => setPenerimaanForm(f => ({ ...f, qty: +e.target.value }))} placeholder="Qty masuk..." />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Tanggal Expired (ED) *</label>
                            <input className={uiStyles.formInput} type="date" value={penerimaanForm.expiredDate}
                                onChange={e => setPenerimaanForm(f => ({ ...f, expiredDate: e.target.value }))} />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Harga Beli (opsional)</label>
                            <input className={uiStyles.formInput} type="number" min="0" value={penerimaanForm.hargaBeli || ''}
                                onChange={e => setPenerimaanForm(f => ({ ...f, hargaBeli: +e.target.value }))} placeholder="Rp / satuan" />
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Stok Opname Modal */}
            <Modal open={opnameOpen} onClose={() => setOpnameOpen(false)} title="Stok Opname (Penyesuaian Stok)" icon={<RefreshCcw size={20} />} size="lg"
                footer={<>
                    <Button variant="secondary" onClick={() => setOpnameOpen(false)}>Batal</Button>
                    <Button variant="primary" onClick={handleOpname} disabled={opname.isPending}>Simpan Opname</Button>
                </>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Bandingkan stok fisik hasil penghitungan dengan stok sistem. Selisih akan dicatat sebagai mutasi
                        PENYESUAIAN. Kosongkan baris yang tidak ikut diopname.
                    </div>
                    <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                        <table className={uiStyles.table}>
                            <thead>
                                <tr>
                                    <th>Kode Item</th><th>Nama Obat/Alkes</th>
                                    <th style={{ textAlign: 'right' }}>Stok Sistem</th>
                                    <th style={{ textAlign: 'right' }}>Stok Fisik</th>
                                    <th style={{ textAlign: 'right' }}>Selisih</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentList.map((obat) => {
                                    const raw = opnameCounts[obat.kode];
                                    const fisik = raw === undefined || raw === '' ? null : Number(raw);
                                    const selisih = fisik === null || Number.isNaN(fisik) ? null : fisik - obat.stok;
                                    return (
                                        <tr key={obat.kode}>
                                            <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{obat.kode}</td>
                                            <td style={{ fontWeight: 600 }}>{obat.nama}</td>
                                            <td style={{ textAlign: 'right' }}>{obat.stok.toLocaleString('id-ID')}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <input className={uiStyles.formInput} type="number" min="0" style={{ width: '100px', textAlign: 'right' }}
                                                    value={raw ?? ''} placeholder="—"
                                                    onChange={(e) => setOpnameCounts((prev) => ({ ...prev, [obat.kode]: e.target.value }))} />
                                            </td>
                                            <td style={{
                                                textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)',
                                                color: selisih === null || selisih === 0 ? 'var(--text-muted)' : selisih > 0 ? 'var(--success)' : '#dc2626',
                                            }}>
                                                {selisih === null ? '-' : selisih > 0 ? `+${selisih}` : selisih}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {opnameItems.length} dari {currentList.length} item di halaman ini terisi
                    </div>
                </div>
            </Modal>

            {/* Delete Confirm */}
            <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete}
                title="Hapus Item?" message={`Item "${deleteTarget?.nama}" (${deleteTarget?.kode}) akan dihapus. Item yang sudah memiliki riwayat mutasi stok tidak dapat dihapus.`}
                variant="danger" confirmLabel="Ya, Hapus" />
        </div>
    );
}
