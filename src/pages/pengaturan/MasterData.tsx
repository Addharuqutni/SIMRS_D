import { useState } from 'react';
import { Database, Plus, Stethoscope, Pill, Map, CreditCard, Shield, Edit2, Trash2, Eye } from 'lucide-react';
import { Button, SearchBar, Card, Modal, ConfirmDialog, showToast, Pagination } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';

interface MasterEntry {
    kode: string; nama: string; keterangan: string;
}

const masterMenus = [
    { key: 'tindakan', title: 'Tindakan & Tarif Medis', count: 0, icon: <CreditCard size={20} />, color: 'var(--primary)', entries: [] as MasterEntry[] },
    { key: 'diagnosa', title: 'Diagnosa (ICD-10)', count: 0, icon: <Stethoscope size={20} />, color: 'var(--success)', entries: [] as MasterEntry[] },
    { key: 'prosedur', title: 'Prosedur (ICD-9-CM)', count: 0, icon: <Database size={20} />, color: 'var(--info)', entries: [] as MasterEntry[] },
    { key: 'obat', title: 'Obat & Alkes', count: 0, icon: <Pill size={20} />, color: 'var(--warning)', entries: [] as MasterEntry[] },
    { key: 'kamar', title: 'Kamar & Ruangan', count: 0, icon: <Map size={20} />, color: 'var(--danger)', entries: [] as MasterEntry[] },
    { key: 'poli', title: 'Poliklinik', count: 0, icon: <Map size={20} />, color: '#6366f1', entries: [] as MasterEntry[] },
    { key: 'dokter', title: 'Data Dokter', count: 0, icon: <Stethoscope size={20} />, color: '#14b8a6', entries: [] as MasterEntry[] },
    { key: 'asuransi', title: 'Grup Asuransi / Jaminan', count: 0, icon: <Shield size={20} />, color: '#8b5cf6', entries: [] as MasterEntry[] },
];

export function MasterData() {
    const [search, setSearch] = useState('');
    const [detailOpen, setDetailOpen] = useState(false);
    const [activeMenu, setActiveMenu] = useState<typeof masterMenus[0] | null>(null);
    const [detailSearch, setDetailSearch] = useState('');
    const [addOpen, setAddOpen] = useState(false);
    const [addForm, setAddForm] = useState({ kode: '', nama: '', keterangan: '' });
    const [entries, setEntries] = useState<MasterEntry[]>([]);
    const [editOpen, setEditOpen] = useState(false);
    const [editEntry, setEditEntry] = useState<MasterEntry | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<MasterEntry | null>(null);

    const filteredMenus = masterMenus.filter(m =>
        search.trim() === '' || m.title.toLowerCase().includes(search.toLowerCase())
    );

    const openDetail = (menu: typeof masterMenus[0]) => {
        setActiveMenu(menu);
        setEntries(menu.entries);
        setDetailSearch('');
        setDetailOpen(true);
    };

    const filteredEntries = entries.filter(e =>
        detailSearch.trim() === '' ||
        e.kode.toLowerCase().includes(detailSearch.toLowerCase()) ||
        e.nama.toLowerCase().includes(detailSearch.toLowerCase())
    );

    const handleAddEntry = () => {
        if (!addForm.kode || !addForm.nama) {
            showToast('Lengkapi Kode dan Nama', 'warning');
            return;
        }
        setEntries(prev => [...prev, { ...addForm }]);
        showToast(`Entry "${addForm.nama}" berhasil ditambahkan`, 'success');
        setAddOpen(false);
        setAddForm({ kode: '', nama: '', keterangan: '' });
    };

    const handleEditEntry = () => {
        if (!editEntry) return;
        setEntries(prev => prev.map(e => e.kode === editEntry.kode ? editEntry : e));
        showToast(`Entry "${editEntry.nama}" berhasil diperbarui`, 'success');
        setEditOpen(false);
        setEditEntry(null);
    };

    const handleDeleteEntry = () => {
        if (!deleteTarget) return;
        setEntries(prev => prev.filter(e => e.kode !== deleteTarget.kode));
        showToast(`Entry "${deleteTarget.nama}" berhasil dihapus`, 'success');
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Master Data Referensi</h1>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari master data..." value={search} onChange={setSearch} />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {filteredMenus.map((menu, i) => (
                    <Card key={i} style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', border: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                background: `color-mix(in srgb, ${menu.color} 15%, transparent)`,
                                color: menu.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {menu.icon}
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>{menu.title}</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    {menu.count.toLocaleString('id-ID')} entries
                                </p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => openDetail(menu)}>
                                Lihat <Eye size={14} style={{ marginLeft: 4 }} />
                            </Button>
                        </div>
                    </Card>
                ))}

                <div onClick={() => showToast('Fitur tambah kategori akan tersedia dalam versi berikutnya', 'info')} style={{
                    border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-muted)', cursor: 'pointer', minHeight: '100px', background: 'var(--bg)',
                    transition: 'border-color 0.2s',
                }}>
                    <Plus size={24} style={{ marginBottom: '8px' }} />
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>Tambah Master Kategori</span>
                </div>
            </div>

            {/* Detail Modal */}
            <Modal open={detailOpen} onClose={() => setDetailOpen(false)}
                title={`${activeMenu?.title}`} icon={activeMenu?.icon} size="lg"
                footer={<Button variant="secondary" onClick={() => setDetailOpen(false)}>Tutup</Button>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <SearchBar placeholder="Cari entry..." value={detailSearch} onChange={setDetailSearch} />
                        </div>
                        <Button variant="primary" onClick={() => { setAddForm({ kode: '', nama: '', keterangan: '' }); setAddOpen(true); }}>
                            <Plus size={14} /> Tambah
                        </Button>
                    </div>
                    <table className={uiStyles.table}>
                        <thead><tr><th>Kode</th><th>Nama</th><th>Keterangan</th><th>Aksi</th></tr></thead>
                        <tbody>
                            {filteredEntries.length === 0 ? (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Tidak ada entry ditemukan</td></tr>
                            ) : filteredEntries.map((entry, i) => (
                                <tr key={i}>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>{entry.kode}</td>
                                    <td style={{ fontWeight: 600 }}>{entry.nama}</td>
                                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{entry.keterangan}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <Button variant="ghost" size="sm" style={{ color: 'var(--warning)' }}
                                                onClick={() => { setEditEntry({ ...entry }); setEditOpen(true); }}>
                                                <Edit2 size={13} />
                                            </Button>
                                            <Button variant="ghost" size="sm" style={{ color: 'var(--danger)' }}
                                                onClick={() => { setDeleteTarget(entry); setDeleteOpen(true); }}>
                                                <Trash2 size={13} />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <Pagination currentPage={1} totalPages={1} totalItems={filteredEntries.length} onPageChange={() => { }} />
                </div>
            </Modal>

            {/* Add Entry Modal */}
            <Modal open={addOpen} onClose={() => setAddOpen(false)} title={`Tambah Entry — ${activeMenu?.title}`} icon={<Plus size={20} />}
                footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Batal</Button><Button variant="primary" onClick={handleAddEntry}>Tambah</Button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Kode *</label>
                        <input className={uiStyles.formInput} value={addForm.kode} onChange={e => setAddForm(f => ({ ...f, kode: e.target.value }))} placeholder="Kode unik..." />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Nama *</label>
                        <input className={uiStyles.formInput} value={addForm.nama} onChange={e => setAddForm(f => ({ ...f, nama: e.target.value }))} placeholder="Nama entry..." />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Keterangan</label>
                        <input className={uiStyles.formInput} value={addForm.keterangan} onChange={e => setAddForm(f => ({ ...f, keterangan: e.target.value }))} placeholder="Deskripsi tambahan..." />
                    </div>
                </div>
            </Modal>

            {/* Edit Entry Modal */}
            <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Entry" icon={<Edit2 size={20} />}
                footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Batal</Button><Button variant="primary" onClick={handleEditEntry}>Simpan</Button></>}>
                {editEntry && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Kode</label>
                            <input className={uiStyles.formInput} value={editEntry.kode} disabled style={{ opacity: 0.6 }} />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Nama</label>
                            <input className={uiStyles.formInput} value={editEntry.nama} onChange={e => setEditEntry(prev => prev ? { ...prev, nama: e.target.value } : prev)} />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Keterangan</label>
                            <input className={uiStyles.formInput} value={editEntry.keterangan} onChange={e => setEditEntry(prev => prev ? { ...prev, keterangan: e.target.value } : prev)} />
                        </div>
                    </div>
                )}
            </Modal>

            {/* Delete Confirm */}
            <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDeleteEntry}
                title="Hapus Entry?" message={`Entry "${deleteTarget?.nama}" (${deleteTarget?.kode}) akan dihapus.`}
                variant="danger" confirmLabel="Ya, Hapus" />
        </div>
    );
}
