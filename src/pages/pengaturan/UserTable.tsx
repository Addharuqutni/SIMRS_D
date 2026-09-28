import { useState } from 'react';
import { UserPlus, Edit2, Trash2, Key, Search } from 'lucide-react';
import { Button, StatusBadge, FilterTabs, Pagination, Modal, ConfirmDialog, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useResetPassword } from '../../hooks/useMasterData';
import { useListQuery } from '../../lib/list-query';
import { masterApi, type User, type UserInput } from '../../lib/api/master';
import { errorMessage } from '../../lib/api-error';
import { ALL_ROLES } from '../../../shared/access';
import styles from '../registrasi/registrasi.module.css';

interface UserTableProps {
    title: string;
    /** Restricts the role picker (and the visible list) to these roles, e.g. DOCTOR_ROLES. */
    allowedRoles?: readonly string[];
    /** Query cache key — must differ per screen so the two lists never share state. */
    queryKey: string;
    /** When true the list is fetched from /master/doctors (active doctors only). */
    doctorsOnly?: boolean;
}

const emptyForm = (roles: readonly string[]): UserInput => ({
    nama: '',
    email: '',
    role: roles[0] ?? ALL_ROLES[0],
    unit: '',
    status: 'aktif',
});

/**
 * Shared user CRUD screen (list + form + confirm) used by Manajemen User and
 * Daftar Dokter. Server enforces role/status/email validation; this mirrors it.
 */
export function UserTable({ title, allowedRoles, queryKey, doctorsOnly = false }: UserTableProps) {
    const roles = allowedRoles && allowedRoles.length > 0 ? allowedRoles : ALL_ROLES;
    const list = useListQuery(queryKey, doctorsOnly
        ? () => masterApi.getDoctors().then((rows) => ({
            data: rows,
            pagination: { page: 1, limit: rows.length || 1, total: rows.length, totalPages: 1 },
            counts: {},
        }))
        : (q) => masterApi.listUsers(q));

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<User | null>(null);
    const [form, setForm] = useState<UserInput>(emptyForm(roles));
    const [saving, setSaving] = useState(false);

    const [confirmTarget, setConfirmTarget] = useState<User | null>(null);
    const [resetTarget, setResetTarget] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const resetPassword = useResetPassword();

    const openAdd = () => {
        setEditing(null);
        setForm(emptyForm(roles));
        setModalOpen(true);
    };

    const openEdit = (user: User) => {
        setEditing(user);
        setForm({ nama: user.nama, email: user.email, role: user.role, unit: user.unit === '-' ? '' : user.unit, status: user.status });
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.nama.trim() || !form.email.trim()) {
            showToast('Nama dan email wajib diisi', 'warning');
            return;
        }
        setSaving(true);
        try {
            if (editing) {
                await masterApi.updateUser(editing.id, form);
                showToast(`User "${form.nama}" berhasil diperbarui`, 'success');
            } else {
                await masterApi.createUser(form);
                showToast(`User "${form.nama}" berhasil ditambahkan`, 'success');
            }
            await list.refetch();
            setModalOpen(false);
        } catch (err) {
            showToast(errorMessage(err, 'Gagal menyimpan data user'), 'danger');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async () => {
        if (!confirmTarget) return;
        const next = confirmTarget.status === 'aktif' ? 'nonaktif' : 'aktif';
        setSaving(true);
        try {
            await masterApi.updateUser(confirmTarget.id, { status: next });
            showToast(`User "${confirmTarget.nama}" di${next === 'aktif' ? 'aktifkan' : 'nonaktifkan'}`, next === 'aktif' ? 'success' : 'warning');
            await list.refetch();
        } catch (err) {
            showToast(errorMessage(err, 'Gagal mengubah status user'), 'danger');
        } finally {
            setSaving(false);
            setConfirmTarget(null);
        }
    };

    const handleResetPassword = () => {
        if (!resetTarget) return;
        if (newPassword.length < 8) {
            showToast('Password minimal 8 karakter', 'warning');
            return;
        }
        resetPassword.mutate({ id: resetTarget.id, password: newPassword }, {
            onSuccess: () => {
                showToast(`Password user "${resetTarget.nama}" berhasil direset`, 'success');
                setResetTarget(null);
                setNewPassword('');
            },
            onError: (err) => showToast(errorMessage(err, 'Gagal mereset password'), 'danger'),
        });
    };

    const roleOptions = roles;

    return (
        <>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>{title}</h1>
                <Button variant="primary" onClick={openAdd}>
                    <UserPlus size={16} /> Tambah User
                </Button>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        className={uiStyles.formInput}
                        style={{ paddingLeft: 36 }}
                        placeholder="Cari nama, email, role, unit..."
                        value={list.search}
                        onChange={(e) => list.setSearch(e.target.value)}
                    />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: list.totalAll },
                        { label: 'Aktif', value: 'aktif', count: list.counts.aktif ?? 0 },
                        { label: 'Non-aktif', value: 'nonaktif', count: list.counts.nonaktif ?? 0 },
                    ]}
                    active={list.status}
                    onChange={list.setStatus}
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead>
                        <tr>
                            <th>Nama / Username</th>
                            <th>Role Sistem</th>
                            <th>Unit Kerja</th>
                            <th>Status</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="stagger">
                        {list.isLoading ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat data user...</td></tr>
                        ) : list.isError ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--danger)' }}>Gagal memuat data user</td></tr>
                        ) : list.rows.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada data ditemukan</td></tr>
                        ) : list.rows.map((user) => (
                            <tr key={user.id}>
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
                                    <StatusBadge variant={user.status === 'aktif' ? 'success' : 'neutral'}>
                                        {user.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                                    </StatusBadge>
                                </td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        <Button variant="ghost" size="sm" title="Reset Password"
                                            onClick={() => { setResetTarget(user); setNewPassword(''); }}>
                                            <Key size={14} />
                                        </Button>
                                        <Button variant="ghost" size="sm" title="Edit" onClick={() => openEdit(user)}>
                                            <Edit2 size={14} />
                                        </Button>
                                        <Button variant="ghost" size="sm" title={user.status === 'aktif' ? 'Non-aktifkan' : 'Aktifkan'}
                                            style={{ color: user.status === 'aktif' ? 'var(--danger)' : 'var(--success)' }}
                                            onClick={() => setConfirmTarget(user)}>
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!doctorsOnly && <Pagination {...list.paginationProps} />}
            </div>

            {/* Add/Edit Modal */}
            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editing ? 'Edit User' : 'Tambah User Baru'}
                icon={editing ? <Edit2 size={20} /> : <UserPlus size={20} />}
                size="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Batal</Button>
                        <Button variant="primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Menyimpan...' : (editing ? 'Simpan Perubahan' : 'Tambah User')}
                        </Button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Nama Lengkap *</label>
                        <input className={uiStyles.formInput} value={form.nama}
                            onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
                            placeholder="Contoh: Dr. Sari, Sp.OG" />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Email *</label>
                        <input className={uiStyles.formInput} type="email" value={form.email}
                            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                            placeholder="Contoh: dr.sari@rs-simrs.com" />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Role</label>
                        <select className={uiStyles.formSelect} value={form.role}
                            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                        </select>
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Unit Kerja</label>
                        <input className={uiStyles.formInput} value={form.unit ?? ''}
                            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                            placeholder="Contoh: Rawat Inap" />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Status</label>
                        <select className={uiStyles.formSelect} value={form.status}
                            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'aktif' | 'nonaktif' }))}>
                            <option value="aktif">Aktif</option>
                            <option value="nonaktif">Non-aktif</option>
                        </select>
                    </div>
                </div>
            </Modal>

            {/* Reset Password Modal */}
            <Modal
                open={!!resetTarget}
                onClose={() => setResetTarget(null)}
                title={`Reset Password: ${resetTarget?.nama ?? ''}`}
                icon={<Key size={20} />}
                size="sm"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setResetTarget(null)} disabled={resetPassword.isPending}>Batal</Button>
                        <Button variant="primary" onClick={handleResetPassword} disabled={resetPassword.isPending}>
                            {resetPassword.isPending ? 'Menyimpan...' : 'Reset Password'}
                        </Button>
                    </>
                }
            >
                <div className={uiStyles.formGroup}>
                    <label className={uiStyles.formLabel}>Password Baru *</label>
                    <input className={uiStyles.formInput} type="password" value={newPassword} autoComplete="new-password"
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimal 8 karakter" />
                    {newPassword.length > 0 && newPassword.length < 8 && (
                        <span style={{ fontSize: '12px', color: 'var(--danger)' }}>Password minimal 8 karakter</span>
                    )}
                </div>
            </Modal>

            <ConfirmDialog
                open={!!confirmTarget}
                title={confirmTarget?.status === 'aktif' ? 'Nonaktifkan User?' : 'Aktifkan User?'}
                message={`Apakah Anda yakin ingin me-${confirmTarget?.status === 'aktif' ? 'nonaktifkan' : 'aktifkan'} user ${confirmTarget?.nama}?`}
                confirmLabel="Ya, Ubah Status"
                onConfirm={handleToggleStatus}
                onClose={() => setConfirmTarget(null)}
                variant={confirmTarget?.status === 'aktif' ? 'danger' : 'success'}
            />
        </>
    );
}
