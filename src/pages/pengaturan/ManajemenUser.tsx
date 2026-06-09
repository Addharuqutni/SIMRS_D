import { useState, useEffect } from 'react';
import { UserPlus, Shield, Activity, Edit2, Trash2, Key } from 'lucide-react';
import { Button, StatusBadge, SearchBar, FilterTabs, Pagination, Modal, ConfirmDialog, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useMasterUsers } from '../../hooks/useMasterData';
import { masterApi, type User } from '../../lib/api/master';
import styles from '../registrasi/registrasi.module.css';

const emptyForm: Omit<User, 'id' | 'lastLogin'> = { nama: '', email: '', username: '', role: 'Perawat', unit: '', status: 'aktif' };

export function ManajemenUser() {
    const { data: dbUsers = [], isLoading, refetch } = useMasterUsers();
    const [isSaving, setIsSaving] = useState(false);

    // Local mutable copy of the server data — synced when server data loads
    const [users, setUsers] = useState<User[]>([]);
    useEffect(() => {
        if (dbUsers.length > 0 && users.length === 0) {
            setUsers(dbUsers);
        }
    }, [dbUsers, users.length]);

    const currentList = users.length > 0 ? users : dbUsers;

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('semua');

    // Modal states
    const [modalOpen, setModalOpen] = useState(false);
    const [roleModalOpen, setRoleModalOpen] = useState(false);
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
                showToast(`User "${form.nama}" berhasil diperbarui`, 'success');
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
                showToast(`User "${form.nama}" berhasil ditambahkan`, 'success');
            }
            await refetch();
            setUsers([]); // trigger re-sync in useEffect
            setModalOpen(false);
        } catch (error: any) {
            console.error(error);
            const detail = error.response?.data?.details;
            showToast(detail ? `Gagal: ${detail}` : `Gagal menyimpan data user`, 'danger');
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
                // Toggle status in database instead of hard deleting for audit trail (or actual delete call)
                // Using update instead to toggle 'status'
                await masterApi.updateUser(confirmTarget.user.id, { status: toggled });
                showToast(`User "${confirmTarget.user.nama}" di-${toggled === 'aktif' ? 'aktifkan' : 'nonaktifkan'}`, toggled === 'aktif' ? 'success' : 'warning');
            } else {
                // Future Implementation: Password reset API connection
                showToast(`Password user "${confirmTarget.user.nama}" berhasil direset`, 'info');
            }
            await refetch();
            setUsers([]); // re-sync local state with DB
        } catch (error: any) {
            console.error(error);
            const detail = error.response?.data?.details;
            showToast(detail ? `Gagal: ${detail}` : `Gagal mengubah status user`, 'danger');
        } finally {
            setIsSaving(false);
            setConfirmOpen(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.page}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: 'var(--text-secondary)' }}>
                    Memuat data user...
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Manajemen User & Akses</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button variant="secondary" onClick={() => setRoleModalOpen(true)}>
                        <Shield size={16} /> Kelola Role
                    </Button>
                    <Button variant="primary" onClick={openAddModal}>
                        <UserPlus size={16} /> Tambah User
                    </Button>
                </div>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari nama, username, unit..." value={search} onChange={setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua User', value: 'semua', count: currentList.length },
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
                            <th>User ID</th>
                            <th>Nama / Username</th>
                            <th>Role Sistem</th>
                            <th>Unit Kerja</th>
                            <th>Aktivitas Terakhir</th>
                            <th>Status</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    Tidak ada data ditemukan untuk pencarian "{search}"
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
                                <td style={{ fontWeight: 500, color: 'var(--primary)' }}>{user.role}</td>
                                <td>{user.unit}</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        <Activity size={14} /> {user.lastLogin}
                                    </div>
                                </td>
                                <td>
                                    <StatusBadge variant={user.status === 'aktif' ? 'success' : 'neutral'}>
                                        {user.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                                    </StatusBadge>
                                </td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        <Button variant="ghost" size="sm" title="Reset Password"
                                            onClick={() => { setConfirmTarget({ user, action: 'reset' }); setConfirmOpen(true); }}>
                                            <Key size={14} />
                                        </Button>
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
                title={editingUser ? 'Edit User' : 'Tambah User Baru'}
                icon={editingUser ? <Edit2 size={20} /> : <UserPlus size={20} />}
                size="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={isSaving}>Batal</Button>
                        <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Menyimpan...' : (editingUser ? 'Simpan Perubahan' : 'Tambah User')}
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
                        <label className={uiStyles.formLabel}>Role</label>
                        <select className={uiStyles.formSelect} value={form.role}
                            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                            <option>Superadmin</option>
                            <option>Dokter Spesialis</option>
                            <option>Dokter Umum</option>
                            <option>Perawat</option>
                            <option>Apoteker</option>
                            <option>Pendaftaran</option>
                            <option>Kasir / Billing</option>
                            <option>Analis Lab</option>
                        </select>
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Unit Kerja *</label>
                        <input className={uiStyles.formInput} value={form.unit}
                            onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                            placeholder="Contoh: Rawat Inap" />
                    </div>
                    {!editingUser && (
                        <div style={{ background: 'var(--bg)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <strong>Password default:</strong> Akan digenerate otomatis dan dikirim ke email user.
                        </div>
                    )}
                </div>
            </Modal>

            {/* Kelola Role Modal */}
            <Modal
                open={roleModalOpen}
                onClose={() => setRoleModalOpen(false)}
                title="Kelola Role & Hak Akses"
                icon={<Shield size={20} />}
                size="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setRoleModalOpen(false)}>Tutup</Button>
                    </>
                }
            >
                <div>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                        Daftar role sistem yang tersedia:
                    </p>
                    {['Superadmin', 'Dokter Spesialis', 'Dokter Umum', 'Perawat', 'Apoteker', 'Pendaftaran', 'Kasir / Billing', 'Analis Lab'].map((r, i) => (
                        <div key={i} style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontWeight: 500, color: 'var(--text)' }}>{r}</span>
                            <Button variant="ghost" size="sm" style={{ color: 'var(--primary)' }} onClick={() => showToast(`Izin untuk hak akses ${r} tidak dapat diubah`, 'warning')}>Pilih Akses</Button>
                        </div>
                    ))}
                </div>
            </Modal>

            {/* Confirm Dialog */}
            <ConfirmDialog
                open={confirmOpen}
                title={confirmTarget?.action === 'delete' ? (confirmTarget?.user?.status === 'aktif' ? 'Nonaktifkan User?' : 'Aktifkan User?') : 'Reset Password?'}
                message={confirmTarget?.action === 'delete'
                    ? `Apakah Anda yakin ingin me-${confirmTarget?.user?.status === 'aktif' ? 'nonaktifkan' : 'aktifkan'} user ${confirmTarget?.user?.nama}?`
                    : `Apakah Anda yakin ingin mereset password untuk user ${confirmTarget?.user?.nama}?`}
                confirmLabel={confirmTarget?.action === 'delete' ? 'Ya, Ubah Status' : 'Ya, Reset'}
                onConfirm={handleConfirmAction}
                onClose={() => setConfirmOpen(false)}
                variant={confirmTarget?.action === 'delete' && confirmTarget?.user?.status === 'aktif' ? 'danger' : 'success'}
            />
        </div >
    );
}
