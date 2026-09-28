import { useState } from 'react';
import { BedDouble, Plus, LogOut, HeartPulse, Home } from 'lucide-react';
import { SearchBar, FilterTabs, Button, Pagination, Modal, ConfirmDialog, showToast, LifecycleBadge } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useRawatInapList, useCreateRawatInapAdmisi, useUpdateRawatInapStatus } from '../../hooks/useClinical';
import { useDoctors } from '../../hooks/useMasterData';
import { usePatientSearch } from '../../hooks/usePatient';
import type { RawatInapPatient } from '../../lib/api/clinical';
import type { Patient } from '../../lib/api/patient';
import { errorMessage } from '../../lib/api-error';
import { LIFECYCLES } from '../../../shared/status';
import { JAMINAN, type Jaminan } from '../../../shared/admission';
import { KELAS_KAMAR } from '../../../shared/tariff';
import styles from '../registrasi/registrasi.module.css';

const emptyAdmisi = { ruanganId: '', kelas: 'Kelas 3', dokterId: '', jaminan: JAMINAN[0] as Jaminan };

const ACTIONS: { to: string; title: string; icon: React.ReactNode; color: string; confirm: string }[] = [
    { to: 'kritis', title: 'Tandai Kritis', icon: <HeartPulse size={14} />, color: 'var(--danger)', confirm: 'akan ditandai KRITIS.' },
    { to: 'dirawat', title: 'Kembali Dirawat', icon: <BedDouble size={14} />, color: 'var(--primary)', confirm: 'kembali berstatus dirawat.' },
    { to: 'rencana_pulang', title: 'Rencanakan Pulang', icon: <LogOut size={14} />, color: 'var(--warning)', confirm: 'masuk daftar rencana pulang.' },
    { to: 'pulang', title: 'Pulangkan', icon: <Home size={14} />, color: 'var(--success)', confirm: 'dipulangkan. Biaya kamar (lama rawat × tarif kelas) akan ditagihkan.' },
];

export function RawatInapList() {
    const list = useRawatInapList();
    const createAdmisi = useCreateRawatInapAdmisi();
    const updateStatus = useUpdateRawatInapStatus();
    const { data: doctors = [] } = useDoctors();

    const [admisiOpen, setAdmisiOpen] = useState(false);
    const [form, setForm] = useState(emptyAdmisi);
    const [patientQuery, setPatientQuery] = useState('');
    const [patient, setPatient] = useState<Patient | null>(null);
    const { data: found = [] } = usePatientSearch(patient ? '' : patientQuery);

    const [target, setTarget] = useState<{ p: RawatInapPatient; action: (typeof ACTIONS)[number] } | null>(null);

    const handleAdmisi = async () => {
        if (!patient || !form.ruanganId.trim() || !form.dokterId) {
            showToast('Pilih pasien, isi ruangan, dan pilih DPJP', 'warning');
            return;
        }
        try {
            await createAdmisi.mutateAsync({ ...form, patientId: patient.id });
            showToast(`${patient.nama} diadmisi ke ${form.ruanganId} (${form.kelas})`, 'success');
            setAdmisiOpen(false);
        } catch (err) {
            showToast(errorMessage(err, 'Gagal admisi rawat inap'), 'danger');
        }
    };

    const confirmAction = async () => {
        if (!target) return;
        try {
            await updateStatus.mutateAsync({ id: target.p.id, status: target.action.to });
            showToast(`${target.p.pasien}: ${target.action.title}`, 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal mengubah status rawat inap'), 'danger');
        } finally {
            setTarget(null);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Rawat Inap</h1>
                <Button variant="primary" onClick={() => { setForm(emptyAdmisi); setPatient(null); setPatientQuery(''); setAdmisiOpen(true); }}>
                    <BedDouble size={16} /> Admisi Pasien
                </Button>
            </div>
            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari nama pasien, ruangan, RM..." value={list.search} onChange={list.setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: list.totalAll },
                        { label: 'Dirawat', value: 'dirawat', count: list.counts.dirawat ?? 0 },
                        { label: 'Kritis', value: 'kritis', count: list.counts.kritis ?? 0 },
                        { label: 'Rencana Pulang', value: 'rencana_pulang', count: list.counts.rencana_pulang ?? 0 },
                        { label: 'Pulang', value: 'pulang', count: list.counts.pulang ?? 0 },
                    ]}
                    active={list.status} onChange={list.setStatus}
                />
            </div>
            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead>
                        <tr><th>No. RM</th><th>Nama Pasien</th><th>Ruangan / Kelas</th><th>Tgl Masuk</th><th>DPJP</th><th>Status</th><th>Aksi</th></tr>
                    </thead>
                    <tbody>
                        {list.isLoading ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat daftar rawat inap...</td></tr>
                        ) : list.rows.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada pasien ditemukan</td></tr>
                        ) : list.rows.map((p) => (
                            <tr key={p.id}>
                                <td style={{ fontFamily: 'var(--font-mono)' }}>{p.rm}</td>
                                <td style={{ fontWeight: 500 }}>{p.pasien}</td>
                                <td><div className={styles.nameCell}><span className={styles.namePrimary}>{p.ruangan}</span><span className={styles.nameSecondary}>{p.kelas}</span></div></td>
                                <td>{new Date(p.masuk).toLocaleDateString('id-ID')}</td>
                                <td>{p.dpjp}</td>
                                <td><LifecycleBadge kind="admisi" status={p.status} /></td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        {ACTIONS.filter((a) => LIFECYCLES.admisi.canTransition(p.status, a.to)).map((a) => (
                                            <Button key={a.to} variant="ghost" size="sm" title={a.title} style={{ color: a.color }}
                                                onClick={() => setTarget({ p, action: a })}>
                                                {a.icon}
                                            </Button>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination {...list.paginationProps} />
            </div>

            <Modal open={admisiOpen} onClose={() => setAdmisiOpen(false)} title="Admisi Pasien Rawat Inap" icon={<Plus size={20} />}
                footer={<><Button variant="secondary" onClick={() => setAdmisiOpen(false)}>Batal</Button><Button variant="primary" onClick={handleAdmisi} disabled={createAdmisi.isPending}>Admisi Sekarang</Button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Pasien (cari No. RM / Nama / NIK) *</label>
                        <input className={uiStyles.formInput}
                            value={patient ? `${patient.rm} — ${patient.nama}` : patientQuery}
                            onChange={(e) => { setPatient(null); setPatientQuery(e.target.value); }}
                            placeholder="Pasien harus sudah terdaftar (registrasi / IGD)" />
                        {!patient && found.length > 0 && (
                            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                                {found.map((p) => (
                                    <button key={p.id} type="button" onClick={() => setPatient(p)}
                                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer' }}>
                                        <strong style={{ fontFamily: 'var(--font-mono)' }}>{p.rm}</strong> — {p.nama}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Ruangan / Bed *</label>
                            <input className={uiStyles.formInput} value={form.ruanganId} onChange={(e) => setForm((f) => ({ ...f, ruanganId: e.target.value }))} placeholder="cth. Melati - M03" />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Kelas Perawatan</label>
                            <select className={uiStyles.formSelect} value={form.kelas} onChange={(e) => setForm((f) => ({ ...f, kelas: e.target.value }))}>
                                {KELAS_KAMAR.map((k) => <option key={k}>{k}</option>)}
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>DPJP (Dokter Penanggung Jawab) *</label>
                            <select className={uiStyles.formSelect} value={form.dokterId} onChange={(e) => setForm((f) => ({ ...f, dokterId: e.target.value }))}>
                                <option value="">Pilih Dokter DPJP...</option>
                                {doctors.filter((d) => d.status === 'aktif').map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
                            </select>
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Jaminan</label>
                            <select className={uiStyles.formSelect} value={form.jaminan} onChange={(e) => setForm((f) => ({ ...f, jaminan: e.target.value as Jaminan }))}>
                                {JAMINAN.map((j) => <option key={j}>{j}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog open={!!target} onClose={() => setTarget(null)} onConfirm={confirmAction}
                title={`${target?.action.title}?`} message={`Pasien "${target?.p.pasien}" ${target?.action.confirm}`}
                variant="warning" confirmLabel={`Ya, ${target?.action.title}`} />
        </div>
    );
}
