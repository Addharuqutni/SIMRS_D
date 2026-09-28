import { useState } from 'react';
import { Calendar, Plus, Edit2, Trash2, Clock, Users } from 'lucide-react';
import { Button, StatusBadge, SearchBar, Card, Modal, ConfirmDialog, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useSchedules, useCreateSchedule, useUpdateSchedule, useDeleteSchedule } from '../../hooks/useSchedule';
import { useDoctors } from '../../hooks/useMasterData';
import { HARI, type Jadwal, type JadwalInput } from '../../lib/api/schedule';
import { errorMessage } from '../../lib/api-error';
import { POLI_RAWAT_JALAN } from '../../../shared/admission';
import styles from '../registrasi/registrasi.module.css';

const emptyForm: JadwalInput = { doctorId: '', poliId: '', dayOfWeek: 1, startTime: '08:00', endTime: '12:00', quota: 20, aktif: true };

export function JadwalDokter() {
    const { data: jadwal = [], isLoading } = useSchedules();
    const { data: doctors = [] } = useDoctors();
    const createSchedule = useCreateSchedule();
    const updateSchedule = useUpdateSchedule();
    const deleteSchedule = useDeleteSchedule();
    const isSaving = createSchedule.isPending || updateSchedule.isPending;

    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Jadwal | null>(null);
    const [form, setForm] = useState<JadwalInput>(emptyForm);
    const [deleteTarget, setDeleteTarget] = useState<Jadwal | null>(null);

    const needle = search.trim().toLowerCase();
    const filtered = jadwal.filter((j) => needle === '' || j.dokter.toLowerCase().includes(needle) || j.poli.toLowerCase().includes(needle));

    const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
    const openEdit = (j: Jadwal) => {
        setEditing(j);
        setForm({ doctorId: j.doctorId, poliId: j.poli, dayOfWeek: j.dayOfWeek, startTime: j.startTime, endTime: j.endTime, quota: j.quota, aktif: j.aktif });
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.doctorId || !form.poliId) { showToast('Dokter dan poli wajib diisi', 'warning'); return; }
        try {
            if (editing) await updateSchedule.mutateAsync({ id: editing.id, data: form });
            else await createSchedule.mutateAsync(form);
            showToast(editing ? 'Jadwal berhasil diperbarui' : 'Jadwal berhasil ditambahkan', 'success');
            setModalOpen(false);
        } catch (err) {
            showToast(errorMessage(err, 'Gagal menyimpan jadwal'), 'danger');
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteSchedule.mutateAsync(deleteTarget.id);
            showToast('Jadwal praktek berhasil dihapus', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal menghapus jadwal'), 'danger');
        } finally {
            setDeleteTarget(null);
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
                <Button variant="primary" onClick={openAdd}><Plus size={16} /> Tambah Jadwal</Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'var(--primary-100)', color: 'var(--primary)', padding: '12px', borderRadius: '12px' }}><Users size={24} /></div>
                        <div>
                            <div style={{ fontSize: '24px', fontWeight: 700 }}>{new Set(jadwal.map((j) => j.doctorId)).size}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Dokter Terjadwal</div>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '12px', borderRadius: '12px' }}><Calendar size={24} /></div>
                        <div>
                            <div style={{ fontSize: '24px', fontWeight: 700 }}>{jadwal.filter((j) => j.aktif).length}</div>
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
                        <tr><th>Dokter</th><th>Poliklinik</th><th>Hari Praktek</th><th>Jam Praktek</th><th>Kuota</th><th>Status</th><th>Aksi</th></tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada jadwal ditemukan</td></tr>
                        ) : filtered.map((j) => (
                            <tr key={j.id}>
                                <td style={{ fontWeight: 500 }}>{j.dokter}</td>
                                <td>{j.poli}</td>
                                <td>{j.hari}</td>
                                <td>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', background: 'var(--bg)', padding: '4px 8px', borderRadius: '4px' }}>
                                        <Clock size={12} /> {j.startTime} - {j.endTime}
                                    </span>
                                </td>
                                <td><StatusBadge variant="info" dot={false}>{j.quota} pasien</StatusBadge></td>
                                <td><StatusBadge variant={j.aktif ? 'success' : 'warning'}>{j.aktif ? 'Aktif' : 'Cuti/Libur'}</StatusBadge></td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(j)}><Edit2 size={14} /></Button>
                                        <Button variant="ghost" size="sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(j)}><Trash2 size={14} /></Button>
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
                            <label className={uiStyles.formLabel}>Dokter *</label>
                            <select className={uiStyles.formSelect} value={form.doctorId} onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))}>
                                <option value="">Pilih Dokter...</option>
                                {doctors.filter((d) => d.status === 'aktif').map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
                            </select>
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Poliklinik *</label>
                            <select className={uiStyles.formSelect} value={form.poliId} onChange={(e) => setForm((f) => ({ ...f, poliId: e.target.value }))}>
                                <option value="">Pilih Poli...</option>
                                {POLI_RAWAT_JALAN.map((p) => <option key={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Hari Praktek *</label>
                            <select className={uiStyles.formSelect} value={form.dayOfWeek} onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: Number(e.target.value) }))}>
                                {HARI.map((h, i) => <option key={h} value={i}>{h}</option>)}
                            </select>
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Mulai</label>
                            <input className={uiStyles.formInput} type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Selesai</label>
                            <input className={uiStyles.formInput} type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Kuota Pasien</label>
                            <input className={uiStyles.formInput} type="number" min={0} value={form.quota} onChange={(e) => setForm((f) => ({ ...f, quota: +e.target.value }))} />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Status</label>
                            <select className={uiStyles.formSelect} value={form.aktif ? '1' : '0'} onChange={(e) => setForm((f) => ({ ...f, aktif: e.target.value === '1' }))}>
                                <option value="1">Aktif</option>
                                <option value="0">Cuti / Libur</option>
                            </select>
                        </div>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
                title="Hapus Jadwal Dokter?" message={`Jadwal praktek "${deleteTarget?.dokter}" (${deleteTarget?.hari}) akan dihapus.`}
                variant="danger" confirmLabel={deleteSchedule.isPending ? 'Menghapus...' : 'Ya, Hapus'} />
        </div>
    );
}
