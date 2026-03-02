import { useState } from 'react';
import { Calendar, Plus, Edit2, Trash2, Clock, Users } from 'lucide-react';
import { Button, StatusBadge, SearchBar, Card, Modal, ConfirmDialog, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useSchedules, useCreateSchedule, useUpdateSchedule, useDeleteSchedule } from '../../hooks/useSchedule';
import { useMasterUsers } from '../../hooks/useMasterData';
import type { Jadwal } from '../../lib/api/schedule';
import styles from '../registrasi/registrasi.module.css';

const emptyForm = { dokter: '', spesialis: '', poli: '', hari: '', jam: '', kuotaJkn: 20, kuotaUmum: 10 };

export function JadwalDokter() {
    const { data: dbJadwal = [], isLoading } = useSchedules();

    const currentList = dbJadwal || [];

    const [search, setSearch] = useState('');

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Jadwal | null>(null);
    const [form, setForm] = useState(emptyForm);

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Jadwal | null>(null);

    // Mutations
    const createSchedule = useCreateSchedule();
    const updateSchedule = useUpdateSchedule();
    const deleteSchedule = useDeleteSchedule();
    const isSaving = createSchedule.isPending || updateSchedule.isPending;
    const isDeleting = deleteSchedule.isPending;

    // Master Users Data for Dropdown
    const { data: allUsers } = useMasterUsers();
    const doctorUsers = (allUsers || []).filter((u: any) =>
        (u.role?.toLowerCase().includes('dokter') || u.role?.toLowerCase() === 'doctor') &&
        u.status === 'aktif'
    );

    const filtered = currentList.filter(j =>
        search.trim() === '' ||
        j.dokter.toLowerCase().includes(search.toLowerCase()) ||
        j.poli.toLowerCase().includes(search.toLowerCase()) ||
        j.spesialis.toLowerCase().includes(search.toLowerCase())
    );

    const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
    const openEdit = (j: Jadwal) => {
        setEditing(j);
        setForm({ dokter: j.dokter, spesialis: j.spesialis, poli: j.poli, hari: j.hari, jam: j.jam, kuotaJkn: j.kuotaJkn, kuotaUmum: j.kuotaUmum });
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.dokter || !form.poli || !form.hari) return;
        try {
            if (editing) {
                await updateSchedule.mutateAsync({ id: editing.id, data: form });
                showToast(`Jadwal berhasil diperbarui`, 'success');
            } else {
                await createSchedule.mutateAsync(form);
                showToast(`Jadwal berhasil ditambahkan`, 'success');
            }
            setModalOpen(false);
        } catch (error: any) {
            showToast(error.response?.data?.details ? `Gagal: ${error.response?.data?.details}` : 'Gagal menyimpan jadwal', 'danger');
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteSchedule.mutateAsync(deleteTarget.id);
            showToast(`Jadwal praktek berhasil dihapus`, 'success');
            setConfirmOpen(false);
        } catch (error: any) {
            showToast(error.response?.data?.details ? `Gagal: ${error.response?.data?.details}` : 'Gagal menghapus jadwal', 'danger');
        }
    };

    if (isLoading) {
        return (
            <div className={styles.page}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: 'var(--text-secondary)' }}>
                    Memuat data jadwal dokter...
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Jadwal Dokter & Poliklinik</h1>
                <Button variant="primary" onClick={openAdd}>
                    <Plus size={16} /> Tambah Jadwal
                </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'var(--primary-100)', color: 'var(--primary)', padding: '12px', borderRadius: '12px' }}>
                            <Users size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '24px', fontWeight: 700 }}>{currentList.length}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Dokter</div>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '12px', borderRadius: '12px' }}>
                            <Calendar size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '24px', fontWeight: 700 }}>{currentList.filter((j: Jadwal) => j.status === 'aktif').length}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Jadwal Aktif</div>
                        </div>
                    </div>
                </Card>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari nama dokter atau poli..." value={search} onChange={setSearch} />
                </div>
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead>
                        <tr>
                            <th>Dokter</th>
                            <th>Poliklinik</th>
                            <th>Hari Praktek</th>
                            <th>Jam Praktek</th>
                            <th>Kuota (JKN / Umum)</th>
                            <th>Status</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada jadwal ditemukan</td></tr>
                        ) : filtered.map((jadwal: Jadwal) => (
                            <tr key={jadwal.id}>
                                <td>
                                    <div className={styles.nameCell}>
                                        <span className={styles.namePrimary}>{jadwal.dokter}</span>
                                        <span className={styles.nameSecondary}>{jadwal.spesialis}</span>
                                    </div>
                                </td>
                                <td style={{ fontWeight: 500 }}>{jadwal.poli}</td>
                                <td>{jadwal.hari}</td>
                                <td>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', background: 'var(--bg)', padding: '4px 8px', borderRadius: '4px' }}>
                                        <Clock size={12} /> {jadwal.jam}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <StatusBadge variant="info" dot={false}>JKN: {jadwal.kuotaJkn}</StatusBadge>
                                        <StatusBadge variant="neutral" dot={false}>Umum: {jadwal.kuotaUmum}</StatusBadge>
                                    </div>
                                </td>
                                <td>
                                    <StatusBadge variant={jadwal.status === 'aktif' ? 'success' : 'warning'}>
                                        {jadwal.status === 'aktif' ? 'Aktif' : 'Cuti/Libur'}
                                    </StatusBadge>
                                </td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(jadwal)}><Edit2 size={14} /></Button>
                                        <Button variant="ghost" size="sm" style={{ color: 'var(--danger)' }}
                                            onClick={() => { setDeleteTarget(jadwal); setConfirmOpen(true); }}>
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal open={modalOpen} onClose={() => setModalOpen(false)}
                title={editing ? 'Edit Jadwal Dokter' : 'Tambah Jadwal Baru'}
                icon={editing ? <Edit2 size={20} /> : <Plus size={20} />}
                footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button><Button variant="primary" disabled={isSaving} onClick={handleSave}>{isSaving ? 'Menyimpan...' : (editing ? 'Simpan' : 'Tambah')}</Button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Nama Dokter *</label>
                            <select className={uiStyles.formSelect} value={form.dokter} onChange={e => setForm(f => ({ ...f, dokter: e.target.value }))}>
                                <option value="">Pilih Dokter...</option>
                                {doctorUsers.map((u: any) => (
                                    <option key={u.id} value={u.id}>{u.nama || u.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Spesialisasi</label>
                            <input className={uiStyles.formInput} value={form.spesialis} onChange={e => setForm(f => ({ ...f, spesialis: e.target.value }))} placeholder="Spesialis ..." />
                        </div>
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Poliklinik *</label>
                        <input className={uiStyles.formInput} value={form.poli} onChange={e => setForm(f => ({ ...f, poli: e.target.value }))} placeholder="Poli Umum" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Hari Praktek *</label>
                            <select className={uiStyles.formSelect} value={form.hari} onChange={e => setForm(f => ({ ...f, hari: e.target.value }))}>
                                <option value="">Pilih Hari...</option>
                                <option>Senin</option><option>Selasa</option><option>Rabu</option>
                                <option>Kamis</option><option>Jumat</option><option>Sabtu</option>
                                <option>Minggu</option>
                            </select>
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Jam Praktek</label>
                            <input className={uiStyles.formInput} value={form.jam} onChange={e => setForm(f => ({ ...f, jam: e.target.value }))} placeholder="08:00 - 12:00" />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Kuota JKN</label>
                            <input className={uiStyles.formInput} type="number" value={form.kuotaJkn} onChange={e => setForm(f => ({ ...f, kuotaJkn: +e.target.value }))} />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Kuota Umum</label>
                            <input className={uiStyles.formInput} type="number" value={form.kuotaUmum} onChange={e => setForm(f => ({ ...f, kuotaUmum: +e.target.value }))} />
                        </div>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDelete}
                title="Hapus Jadwal Dokter?" message={`Jadwal praktek "${deleteTarget?.dokter}" akan dihapus dari sistem.`}
                variant="danger" confirmLabel={isDeleting ? 'Menghapus...' : 'Ya, Hapus'} />
        </div>
    );
}
