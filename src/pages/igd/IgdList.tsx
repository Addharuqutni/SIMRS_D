import { useState } from 'react';
import { AlertCircle, Activity, HeartPulse, Clock, Plus, TriangleAlert } from 'lucide-react';
import { Button, StatusBadge, Card, SearchBar, Pagination, Modal, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useDaftarIgd, useCreateAdmisiIgd, useUpdateStatusTindakan } from '../../hooks/useIgd';
import type { IgdAdmisiData } from '../../lib/api/igd';
import type { IgdPatient } from '../../lib/api/igd';
import { useMasterUsers } from '../../hooks/useMasterData';
import styles from '../registrasi/registrasi.module.css';

const emptyForm: IgdAdmisiData = { pasien: '', triase: 'kuning', diagnosaAwal: '', dokter: '' };

export function IgdList() {
    const { data: dbIgdList = [], isLoading } = useDaftarIgd();
    const createAdmisi = useCreateAdmisiIgd();
    const updateTindakan = useUpdateStatusTindakan();

    const [search, setSearch] = useState('');
    const [admisiOpen, setAdmisiOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);

    const igdList = dbIgdList as IgdPatient[];

    const filtered = igdList.filter(p =>
        search.trim() === '' ||
        p.pasien.toLowerCase().includes(search.toLowerCase()) ||
        p.rm.includes(search) ||
        p.diagnosaAwal.toLowerCase().includes(search.toLowerCase())
    );

    const countTriase = (t: string) => igdList.filter(p => p.triase === t).length;

    const handleTindakan = async (patient: IgdPatient) => {
        try {
            if (patient.status === 'menunggu') {
                await updateTindakan.mutateAsync({ visitId: patient.visitId, status: 'tindakan' });
                showToast(`Tindakan dimulai untuk pasien ${patient.pasien}`, 'info');
            } else if (patient.status === 'tindakan') {
                await updateTindakan.mutateAsync({ visitId: patient.visitId, status: 'observasi' });
                showToast(`Pasien ${patient.pasien} dalam observasi`, 'success');
            }
        } catch (error: any) {
            showToast(error.response?.data?.details ? `Gagal: ${error.response?.data?.details}` : 'Gagal mengubah status', 'danger');
        }
    };

    const handleAdmisi = async () => {
        if (!form.pasien.trim() || !form.diagnosaAwal.trim()) {
            showToast('Lengkapi nama pasien dan keluhan', 'warning');
            return;
        }
        if (!form.dokter) {
            showToast('Pilih Dokter Jaga IGD terlebih dahulu', 'warning');
            return;
        }

        try {
            await createAdmisi.mutateAsync(form);
            showToast(`Pasien darurat "${form.pasien}" berhasil diadmisi`, 'success');
            setAdmisiOpen(false);
            setForm(emptyForm);
        } catch (error: any) {
            showToast(error.response?.data?.details ? `Gagal: ${error.response?.data?.details}` : 'Gagal mengirim pendaftaran IGD', 'danger');
        }
    };

    // Master Users Data for Dropdown
    const { data: allUsers } = useMasterUsers();
    const doctorUsers = (allUsers || []).filter((u: any) =>
        (u.role?.toLowerCase().includes('dokter') || u.role?.toLowerCase() === 'doctor') &&
        u.status === 'aktif'
    );


    return (
        <div className={styles.page}>
            {isLoading && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', zIndex: 50, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: 'white', padding: '16px 24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <span style={{ color: 'var(--primary)', fontWeight: 500 }}>Memuat daftar IGD...</span>
                    </div>
                </div>
            )}
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Instalasi Gawat Darurat (IGD)</h1>
                <Button variant="danger" onClick={() => { setForm(emptyForm); setAdmisiOpen(true); }}>
                    <AlertCircle size={16} /> Admisi Darurat
                </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '12px' }}><HeartPulse size={24} /></div>
                        <div><div style={{ fontSize: '24px', fontWeight: 700 }}>{countTriase('merah')}</div><div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Triase Merah (P1)</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fffbeb', color: '#d97706', padding: '12px', borderRadius: '12px' }}><Activity size={24} /></div>
                        <div><div style={{ fontSize: '24px', fontWeight: 700 }}>{countTriase('kuning')}</div><div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Triase Kuning (P2)</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '12px', borderRadius: '12px' }}><AlertCircle size={24} /></div>
                        <div><div style={{ fontSize: '24px', fontWeight: 700 }}>{countTriase('hijau')}</div><div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Triase Hijau (P3)</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#f8fafc', color: '#475569', padding: '12px', borderRadius: '12px' }}><Clock size={24} /></div>
                        <div><div style={{ fontSize: '24px', fontWeight: 700 }}>{igdList.length}</div><div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Pasien</div></div>
                    </div>
                </Card>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari pasien IGD..." value={search} onChange={setSearch} />
                </div>
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead><tr><th>Triase</th><th>MEWS</th><th>Waktu Masuk</th><th>Pasien (RM)</th><th>Keluhan/Diagnosa Awal</th><th>Dokter Jaga</th><th>Status</th><th>Aksi</th></tr></thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada pasien ditemukan</td></tr>
                        ) : filtered.map((p, i) => {
                            const mewsColor = p.mews?.level === 'danger' ? '#dc2626'
                                : p.mews?.level === 'warn' ? '#f59e0b'
                                : p.mews?.level === 'watch' ? '#3b82f6'
                                : '#22c55e';
                            return (
                            <tr key={i}>
                                <td>
                                    <StatusBadge variant={p.triase === 'merah' ? 'danger' : p.triase === 'kuning' ? 'warning' : 'success'} dot={false}>
                                        {p.triase.toUpperCase()}
                                    </StatusBadge>
                                </td>
                                <td>
                                    {p.mewsScore != null ? (
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            minWidth: '28px', height: '28px', borderRadius: 'var(--radius-full, 999px)',
                                            background: `${mewsColor}20`, color: mewsColor, fontWeight: 700, fontSize: '13px',
                                            border: `1px solid ${mewsColor}50`,
                                        }} title={p.mews?.action}>
                                            {p.mewsScore}
                                        </span>
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                                    )}
                                </td>
                                <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{p.masuk}</td>
                                <td>
                                    <div className={styles.nameCell}>
                                        <span className={styles.namePrimary}>
                                            {p.pasien}
                                            {p.hasAllergy && (
                                                <span title={`Alergi: ${p.alergi}`} style={{ marginLeft: '6px', color: '#dc2626', display: 'inline-flex', verticalAlign: 'middle' }}>
                                                    <TriangleAlert size={14} />
                                                </span>
                                            )}
                                        </span>
                                        <span className={styles.nameSecondary}>RM: {p.rm}</span>
                                        {p.hasAllergy && (
                                            <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 500 }}>
                                                ⚠ {p.alergi}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td>{p.diagnosaAwal}</td>
                                <td>{p.dokter}</td>
                                <td><StatusBadge variant={p.status === 'observasi' ? 'info' : p.status === 'tindakan' ? 'warning' : 'neutral'}>{p.status}</StatusBadge></td>
                                <td>
                                    <Button variant="primary" size="sm" onClick={() => handleTindakan(p)}
                                        disabled={p.status === 'observasi'}>
                                        {p.status === 'menunggu' ? 'Mulai Tindakan' : p.status === 'tindakan' ? 'Pindah Observasi' : 'Observasi'}
                                    </Button>
                                </td>
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
                <Pagination currentPage={1} totalPages={1} totalItems={filtered.length} onPageChange={() => { }} />
            </div>

            {/* Admisi Darurat Modal */}
            <Modal open={admisiOpen} onClose={() => setAdmisiOpen(false)} title="Admisi Darurat (IGD)" icon={<Plus size={20} />}
                footer={<><Button variant="secondary" onClick={() => setAdmisiOpen(false)}>Batal</Button><Button variant="danger" onClick={handleAdmisi}>Admisi Sekarang</Button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Nama Pasien *</label>
                        <input className={uiStyles.formInput} value={form.pasien}
                            onChange={e => setForm(f => ({ ...f, pasien: e.target.value }))}
                            placeholder="Nama pasien (atau 'Tanpa Identitas')" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Prioritas Triase *</label>
                            <select className={uiStyles.formSelect} value={form.triase}
                                onChange={e => setForm(f => ({ ...f, triase: e.target.value as 'merah' | 'kuning' | 'hijau' }))}>
                                <option value="merah">🔴 MERAH (P1 - Resusitasi)</option>
                                <option value="kuning">🟡 KUNING (P2 - Urgen)</option>
                                <option value="hijau">🟢 HIJAU (P3 - Non-Urgen)</option>
                            </select>
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Dokter Jaga</label>
                            <select className={uiStyles.formSelect} value={form.dokter}
                                onChange={e => setForm(f => ({ ...f, dokter: e.target.value }))}>
                                <option value="">Pilih Dokter Jaga...</option>
                                {doctorUsers.map((u: any) => (
                                    <option key={u.id} value={u.id}>{u.nama || u.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Keluhan / Diagnosa Awal *</label>
                        <textarea className={uiStyles.formTextarea} rows={2} value={form.diagnosaAwal}
                            onChange={e => setForm(f => ({ ...f, diagnosaAwal: e.target.value }))}
                            placeholder="Deskripsikan keluhan utama pasien..." />
                    </div>

                    {/* Tanda Vital saat Triase — untuk auto-MEWS */}
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Tanda Vital Saat Triase (opsional — untuk auto-MEWS)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                            <input className={uiStyles.formInput} type="number" placeholder="Sistolik (mmHg)"
                                value={form.sistolik || ''}
                                onChange={e => setForm(f => ({ ...f, sistolik: e.target.value ? Number(e.target.value) : undefined }))} />
                            <input className={uiStyles.formInput} type="number" placeholder="Diastolik (mmHg)"
                                value={form.diastolik || ''}
                                onChange={e => setForm(f => ({ ...f, diastolik: e.target.value ? Number(e.target.value) : undefined }))} />
                            <input className={uiStyles.formInput} type="number" placeholder="Nadi (x/min)"
                                value={form.nadi || ''}
                                onChange={e => setForm(f => ({ ...f, nadi: e.target.value ? Number(e.target.value) : undefined }))} />
                            <input className={uiStyles.formInput} type="number" step="0.1" placeholder="Suhu (°C)"
                                value={form.suhu || ''}
                                onChange={e => setForm(f => ({ ...f, suhu: e.target.value ? Number(e.target.value) : undefined }))} />
                            <input className={uiStyles.formInput} type="number" placeholder="RR (x/min)"
                                value={form.pernapasan || ''}
                                onChange={e => setForm(f => ({ ...f, pernapasan: e.target.value ? Number(e.target.value) : undefined }))} />
                            <input className={uiStyles.formInput} type="number" placeholder="SpO2 (%)"
                                value={form.spo2 || ''}
                                onChange={e => setForm(f => ({ ...f, spo2: e.target.value ? Number(e.target.value) : undefined }))} />
                        </div>
                    </div>
                    <div style={{ background: '#eff6ff', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid #93c5fd', fontSize: '13px', color: '#1e40af' }}>
                        <strong>Auto-MEWS:</strong> Sistem akan menghitung skor MEWS dari tanda vital di atas. Bila skor ≥ 3 (deteriorasi), notifikasi otomatis dikirim ke dokter jaga.
                    </div>
                    <div style={{ background: '#fef2f2', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid #fca5a5', fontSize: '13px', color: '#991b1b' }}>
                        <strong>Admisi Darurat:</strong> Pasien akan langsung masuk tanpa proses registrasi lengkap. Data dapat dilengkapi kemudian.
                    </div>
                </div>
            </Modal>
        </div>
    );
}
