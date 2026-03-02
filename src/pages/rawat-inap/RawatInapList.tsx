import { useState } from 'react';
import { BedDouble, Eye, FolderHeart, Plus, LogOut } from 'lucide-react';
import { SearchBar, FilterTabs, StatusBadge, Button, Pagination, Modal, ConfirmDialog, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useRawatInapList, useCreateRawatInapAdmisi, useUpdateRawatInapStatus } from '../../hooks/useClinical';
import type { RawatInapPatient } from '../../lib/api/clinical';
import { useMasterUsers } from '../../hooks/useMasterData';
import styles from '../registrasi/registrasi.module.css';

const emptyAdmisi = { pasien: '', ruangan: '', kelas: 'Kelas 3', dpjp: '' };

export function RawatInapList() {
    const { data: dbPatients = [], isLoading } = useRawatInapList();
    const createAdmisi = useCreateRawatInapAdmisi();
    const updateStatus = useUpdateRawatInapStatus();

    // Map the database rows to the expected view format
    const patients = (dbPatients as RawatInapPatient[]).map(p => ({
        ...p,
        masuk: new Date(p.masuk).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }));

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('semua');

    const [admisiOpen, setAdmisiOpen] = useState(false);
    const [form, setForm] = useState(emptyAdmisi);

    const [pulangOpen, setPulangOpen] = useState(false);
    const [pulangTarget, setPulangTarget] = useState<RawatInapPatient | null>(null);

    const filtered = patients.filter(p => {
        const matchSearch = search.trim() === '' ||
            p.pasien.toLowerCase().includes(search.toLowerCase()) ||
            p.rm.includes(search) ||
            p.ruangan.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === 'semua' ||
            (filter === 'dirawat' && p.status === 'dirawat') ||
            (filter === 'pulang' && p.status === 'rencana_pulang') ||
            (filter === 'icu' && (p.status === 'kritis' || p.kelas === 'ICU'));
        return matchSearch && matchFilter;
    });

    const handleAdmisi = async () => {
        if (!form.pasien || !form.ruangan || !form.dpjp) {
            showToast('Lengkapi field yang wajib diisi', 'warning');
            return;
        }
        try {
            await createAdmisi.mutateAsync(form);
            showToast(`Pasien "${form.pasien}" berhasil diadmisi ke ${form.ruangan}`, 'success');
            setAdmisiOpen(false);
            setForm(emptyAdmisi);
        } catch (error) {
            showToast('Gagal memproses admisi', 'danger');
        }
    };

    const handlePulangkan = async () => {
        if (!pulangTarget) return;
        try {
            await updateStatus.mutateAsync({ id: pulangTarget.id, status: 'rencana_pulang' });
            showToast(`Pasien "${pulangTarget.pasien}" direncanakan pulang`, 'success');
            setPulangOpen(false);
        } catch (error) {
            showToast('Gagal mengubah status pasien', 'danger');
        }
    };

    // Master Users Data for Dropdown
    const { data: allUsers } = useMasterUsers();
    const doctorUsers = (allUsers || []).filter((u: any) => u.role?.toLowerCase() === 'dokter' || u.role?.toLowerCase() === 'doctor');

    return (
        <div className={styles.page}>
            {isLoading && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', zIndex: 50, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: 'white', padding: '16px 24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <span style={{ color: 'var(--primary)', fontWeight: 500 }}>Memuat daftar rawat inap...</span>
                    </div>
                </div>
            )}
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Rawat Inap</h1>
                <Button variant="primary" onClick={() => { setForm(emptyAdmisi); setAdmisiOpen(true); }}>
                    <BedDouble size={16} /> Admisi Pasien
                </Button>
            </div>
            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari nama pasien, ruangan, RM..." value={search} onChange={setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: patients.length },
                        { label: 'Dirawat', value: 'dirawat', count: patients.filter(p => p.status === 'dirawat').length },
                        { label: 'Rencana Pulang', value: 'pulang', count: patients.filter(p => p.status === 'rencana_pulang').length },
                        { label: 'ICU/HCU', value: 'icu', count: patients.filter(p => p.status === 'kritis' || p.kelas === 'ICU').length },
                    ]}
                    active={filter} onChange={setFilter}
                />
            </div>
            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead>
                        <tr><th>No. RM</th><th>Nama Pasien</th><th>Ruangan / Kelas</th><th>Tgl Masuk</th><th>DPJP</th><th>Status</th><th>Aksi</th></tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada pasien ditemukan</td></tr>
                        ) : filtered.map((p, i) => (
                            <tr key={i}>
                                <td style={{ fontFamily: 'var(--font-mono)' }}>{p.rm}</td>
                                <td style={{ fontWeight: 500 }}>{p.pasien}</td>
                                <td><div className={styles.nameCell}><span className={styles.namePrimary}>{p.ruangan}</span><span className={styles.nameSecondary}>{p.kelas}</span></div></td>
                                <td>{p.masuk}</td>
                                <td>{p.dpjp}</td>
                                <td>
                                    <StatusBadge variant={p.status === 'dirawat' ? 'info' : p.status === 'kritis' ? 'danger' : 'warning'}>
                                        {p.status === 'dirawat' ? 'Sedang Dirawat' : p.status === 'kritis' ? 'Kritis' : 'Rencana Pulang'}
                                    </StatusBadge>
                                </td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        <Button variant="ghost" size="sm" title="Lihat EMR"><FolderHeart size={14} /></Button>
                                        <Button variant="ghost" size="sm" title="Observasi/Asesmen"><Eye size={14} /></Button>
                                        {p.status === 'dirawat' && (
                                            <Button variant="ghost" size="sm" title="Rencanakan Pulang" style={{ color: 'var(--warning)' }}
                                                onClick={() => { setPulangTarget(p); setPulangOpen(true); }}>
                                                <LogOut size={14} />
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

            {/* Admisi Modal */}
            <Modal open={admisiOpen} onClose={() => setAdmisiOpen(false)} title="Admisi Pasien Rawat Inap" icon={<Plus size={20} />}
                footer={<><Button variant="secondary" onClick={() => setAdmisiOpen(false)}>Batal</Button><Button variant="primary" onClick={handleAdmisi}>Admisi Sekarang</Button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Nama Pasien *</label>
                        <input className={uiStyles.formInput} value={form.pasien} onChange={e => setForm(f => ({ ...f, pasien: e.target.value }))} placeholder="Nama lengkap pasien" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Ruangan / Bed *</label>
                            <select className={uiStyles.formSelect} value={form.ruangan} onChange={e => setForm(f => ({ ...f, ruangan: e.target.value }))}>
                                <option value="">Pilih Ruangan...</option>
                                <option>Melati - M03</option>
                                <option>Mawar - MW08</option>
                                <option>Anggrek - A05</option>
                                <option>ICU - 03</option>
                            </select>
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Kelas Perawatan</label>
                            <select className={uiStyles.formSelect} value={form.kelas} onChange={e => setForm(f => ({ ...f, kelas: e.target.value }))}>
                                <option>Kelas 3</option><option>Kelas 2</option><option>Kelas 1</option>
                                <option>VIP</option><option>ICU</option><option>HCU</option>
                            </select>
                        </div>
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>DPJP (Dokter Penanggung Jawab) *</label>
                        <select className={uiStyles.formSelect} value={form.dpjp} onChange={e => setForm(f => ({ ...f, dpjp: e.target.value }))}>
                            <option value="">Pilih Dokter DPJP...</option>
                            {doctorUsers.map((u: any) => (
                                <option key={u.id} value={u.id}>{u.nama || u.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </Modal>

            {/* Pulangkan Confirm */}
            <ConfirmDialog open={pulangOpen} onClose={() => setPulangOpen(false)} onConfirm={handlePulangkan}
                title="Rencanakan Pulang?" message={`Pasien "${pulangTarget?.pasien}" akan dimasukkan ke daftar rencana pulang.`}
                variant="warning" confirmLabel="Ya, Rencanakan Pulang" />
        </div>
    );
}
