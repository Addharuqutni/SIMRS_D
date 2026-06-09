import { useState, useEffect } from 'react';
import { UserPlus, Edit2, Trash2, Stethoscope } from 'lucide-react';
import { Button, StatusBadge, SearchBar, FilterTabs, Pagination, Modal, ConfirmDialog, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useMasterUsers } from '../../hooks/useMasterData';
import { masterApi, type User } from '../../lib/api/master';
import styles from '../registrasi/registrasi.module.css';

const emptyForm: Omit<User, 'id' | 'lastLogin'> = { nama: '', email: '', username: '', role: 'Dokter Umum', unit: 'Poli Umum', status: 'aktif' };

export function ListDokter() {
    const { data: dbUsers = [], isLoading, refetch } = useMasterUsers();
    const [isSaving, setIsSaving] = useState(false);

    // Filter only users with role containing 'dokter'
    const doctorUsers = dbUsers.filter((u: any) => u.role?.toLowerCase().includes('dokter') || u.role?.toLowerCase() === 'doctor');

    // Local mutable copy of the server data — synced when server data loads
    const [users, setUsers] = useState<User[]>([]);
    useEffect(() => {
        if (doctorUsers.length > 0 && users.length === 0) {
            setUsers(doctorUsers);
        }
    }, [doctorUsers, users.length]);

    const currentList = users.length > 0 ? users : doctorUsers;

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('semua');

    // Modal states
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [form, setForm] = useState(emptyForm);

    // Confirm dialog state
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmTarget, setConfirmTarget] = useState<{ user: User; action: 'delete' | 'reset' } | null>(null);

    // ---- Filtering ----
    const filtered = currentList.filter((u: User) => {
        const matchSearch = search.trim() === '' ||
            u.nama.toLowerCase().includes(search.toLowerCase()) ||
            u.username.toLowerCase().includes(search.toLowerCase()) ||
            u.unit.toLowerCase().includes(search.toLowerCase()) ||
            u.role.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === 'semua' || u.status === filter;
        return matchSearch && matchFilter;
    });

    const activeCount = currentList.filter((u: User) => u.status === 'aktif').length;
    const nonaktifCount = currentList.filter((u: User) => u.status === 'nonaktif').length;

    // ---- CRUD Handlers ----
    const openAddModal = () => {
        setEditingUser(null);
        setForm(emptyForm);
        setModalOpen(true);
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setForm({ nama: user.nama, email: user.email, username: user.username, role: user.role, unit: user.unit, status: user.status as 'aktif' | 'nonaktif' });
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.nama || !form.email || !form.username || !form.unit) {
            showToast('Harap lengkapi semua field yang wajib', 'warning');
            return;
        }

        setIsSaving(true);
        try {
            if (editingUser) {
                // UPDATE API Call
                await masterApi.updateUser(editingUser.id, {
                    nama: form.nama,
                    email: form.email,
                    role: form.role,
                    unit: form.unit,
                    status: form.status
                });
                showToast(`Dokter "${form.nama}" berhasil diperbarui`, 'success');
            } else {
                // CREATE API Call
                await masterApi.createUser({
                    nama: form.nama,
                    email: form.email,
                    username: form.username,
                    role: form.role,
                    unit: form.unit,
                    status: form.status as 'aktif' | 'nonaktif'
                });
                showToast(`Dokter "${form.nama}" berhasil ditambahkan`, 'success');
            }
            await refetch();
            setUsers([]); // trigger re-sync in useEffect
            setModalOpen(false);
        } catch (error: any) {
            console.error(error);
            const detail = error.response?.data?.details;
            showToast(detail ? `Gagal: ${detail}` : `Gagal menyimpan data dokter`, 'danger');
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmAction = async () => {
        if (!confirmTarget) return;
        setIsSaving(true);
        try {
            if (confirmTarget.action === 'delete') {
                const toggled = confirmTarget.user.status === 'aktif' ? 'nonaktif' : 'aktif';
                await masterApi.updateUser(confirmTarget.user.id, { status: toggled });
                showToast(`Dokter "${confirmTarget.user.nama}" di-${toggled === 'aktif' ? 'aktifkan' : 'nonaktifkan'}`, toggled === 'aktif' ? 'success' : 'warning');
            } else {
                showToast(`Password dokter "${confirmTarget.user.nama}" berhasil direset`, 'info');
            }
            await refetch();
            setUsers([]); // re-sync local state with DB
        } catch (error: any) {
            console.error(error);
            const detail = error.response?.data?.details;
            showToast(detail ? `Gagal: ${detail}` : `Gagal mengubah status dokter`, 'danger');
        } finally {
            setIsSaving(false);
            setConfirmOpen(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.page}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: 'var(--text-secondary)' }}>
                    Memuat data dokter...
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>List Dokter</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button variant="primary" onClick={openAddModal}>
                        <UserPlus size={16} /> Tambah Dokter
                    </Button>
                </div>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari nama, username, poliklinik..." value={search} onChange={setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua Dokter', value: 'semua', count: currentList.length },
                        { label: 'Aktif', value: 'aktif', count: activeCount },
                        { label: 'Non-aktif', value: 'nonaktif', count: nonaktifCount },
                    ]}
                    active={filter}
                    onChange={setFilter}
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead>
                        <tr>
                            <th>ID Dokter</th>
                            <th>Nama / Username</th>
                            <th>Tipe Dokter</th>
                            <th>Poliklinik / Unit</th>
                            <th>Status</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    Tidak ada data dokter ditemukan untuk pencarian "{search}"
                                </td>
                            </tr>
                        ) : filtered.map((user: User) => (
                            <tr key={user.id}>
                                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '12px' }}>{user.id.substring(0, 12)}...</td>
                                <td>
                                    <div className={styles.nameCell}>
                                        <span className={styles.namePrimary}>{user.nama}</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <span className={styles.nameSecondary}>@{user.username}</span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.email}</span>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ fontWeight: 500, color: 'var(--primary)' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Stethoscope size={14} />{user.role}</div></td>
                                <td>{user.unit}</td>
                                <td>
                                    <StatusBadge variant={user.status === 'aktif' ? 'success' : 'neutral'}>
                                        {user.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                                    </StatusBadge>
                                </td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        <Button variant="ghost" size="sm" title="Edit" onClick={() => openEditModal(user)}>
                                            <Edit2 size={14} />
                                        </Button>
                                        <Button variant="ghost" size="sm" title={user.status === 'aktif' ? 'Non-aktifkan' : 'Aktifkan'}
                                            style={{ color: user.status === 'aktif' ? 'var(--danger)' : 'var(--success)' }}
                                            onClick={() => { setConfirmTarget({ user, action: 'delete' }); setConfirmOpen(true); }}>
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

            {/* Add/Edit Modal */}
            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingUser ? 'Edit Dokter' : 'Tambah Dokter Baru'}
                icon={editingUser ? <Edit2 size={20} /> : <UserPlus size={20} />}
                size="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={isSaving}>Batal</Button>
                        <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Menyimpan...' : (editingUser ? 'Simpan Perubahan' : 'Tambah Dokter')}
                        </Button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Nama Lengkap *</label>
                        <input className={uiStyles.formInput} value={form.nama}
                            onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                            placeholder="Contoh: Dr. Sari, Sp.OG" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Email Lengkap *</label>
                            <input className={uiStyles.formInput} type="email" value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                placeholder="Contoh: dr.sari@rs-simrs.com" />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Username *</label>
                            <input className={uiStyles.formInput} value={form.username}
                                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                                placeholder="contoh: dr_sari" />
                        </div>
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Tipe Dokter *</label>
                        <select className={uiStyles.formSelect} value={form.role}
                            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                            <option>Dokter Umum</option>
                            <option>Dokter Spesialis</option>
                        </select>
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Poliklinik / Unit Kerja *</label>
                        <input className={uiStyles.formInput} value={form.unit}
                            onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                            placeholder="Contoh: Poli Kandungan" />
                    </div>
                    {!editingUser && (
                        <div style={{ background: 'var(--bg)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <strong>Info:</strong> Password default akan digenerate otomatis dan dikirim ke email dokter, atau dapat menggunakan password default sistem jika dikonfigurasi.
                        </div>
                    )}
                </div>
            </Modal>

            {/* Confirm Dialog */}
            <ConfirmDialog
                open={confirmOpen}
                title={confirmTarget?.action === 'delete' ? (confirmTarget?.user?.status === 'aktif' ? 'Nonaktifkan Dokter?' : 'Aktifkan Dokter?') : 'Reset Password?'}
                message={confirmTarget?.action === 'delete'
                    ? `Apakah Anda yakin ingin me-${confirmTarget?.user?.status === 'aktif' ? 'nonaktifkan' : 'aktifkan'} dokter ${confirmTarget?.user?.nama}?`
                    : `Apakah Anda yakin ingin mereset password untuk dokter ${confirmTarget?.user?.nama}?`}
                confirmLabel={confirmTarget?.action === 'delete' ? 'Ya, Ubah Status' : 'Ya, Reset'}
                onConfirm={handleConfirmAction}
                onClose={() => setConfirmOpen(false)}
                variant={confirmTarget?.action === 'delete' && confirmTarget?.user?.status === 'aktif' ? 'danger' : 'success'}
            />
        </div >
    );
}
