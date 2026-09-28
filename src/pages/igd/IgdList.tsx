import { useState } from 'react';
import { AlertCircle, Plus, TriangleAlert } from 'lucide-react';
import { Button, StatusBadge, SearchBar, Pagination, Modal, FilterTabs, showToast, LifecycleBadge } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useIgdList, useCreateAdmisiIgd, useUpdateIgdStatus } from '../../hooks/useIgd';
import { useDoctors } from '../../hooks/useMasterData';
import type { IgdPatient } from '../../lib/api/igd';
import { errorMessage } from '../../lib/api-error';
import { JAMINAN, TRIASE, type Jaminan, type Triase, type Vitals } from '../../../shared/admission';
import styles from '../registrasi/registrasi.module.css';

const TRIASE_LABEL: Record<Triase, string> = {
    merah: 'MERAH (P1 - Resusitasi)', kuning: 'KUNING (P2 - Urgen)', hijau: 'HIJAU (P3 - Non-Urgen)', hitam: 'HITAM (P0 - Meninggal)',
};
const NEXT_ACTION: Record<string, { to: string; label: string } | undefined> = {
    menunggu: { to: 'tindakan', label: 'Mulai Tindakan' },
    tindakan: { to: 'observasi', label: 'Pindah Observasi' },
    observasi: { to: 'selesai', label: 'Selesai' },
};
const VITAL_FIELDS: { key: keyof Omit<Vitals, 'kesadaran'>; placeholder: string; step?: string }[] = [
    { key: 'sistolik', placeholder: 'Sistolik (mmHg)' },
    { key: 'diastolik', placeholder: 'Diastolik (mmHg)' },
    { key: 'nadi', placeholder: 'Nadi (x/min)' },
    { key: 'suhu', placeholder: 'Suhu (°C)', step: '0.1' },
    { key: 'pernapasan', placeholder: 'RR (x/min)' },
    { key: 'spo2', placeholder: 'SpO2 (%)' },
];
const MEWS_COLOR = { danger: '#dc2626', warn: '#f59e0b', watch: '#3b82f6', normal: '#22c55e' } as const;

const emptyForm = {
    nama: '', gender: '' as '' | 'L' | 'P', triase: 'kuning' as Triase, keluhanUtama: '', dokterId: '',
    jaminan: JAMINAN[0] as Jaminan, vitals: {} as Vitals,
};

export function IgdList() {
    const list = useIgdList();
    const createAdmisi = useCreateAdmisiIgd();
    const updateStatus = useUpdateIgdStatus();
    const { data: doctors = [] } = useDoctors();

    const [admisiOpen, setAdmisiOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);

    const handleTindakan = async (p: IgdPatient) => {
        const next = NEXT_ACTION[p.status];
        if (!next) return;
        try {
            await updateStatus.mutateAsync({ visitId: p.visitId, status: next.to });
            showToast(`${p.pasien}: ${next.label}`, 'info');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal mengubah status IGD'), 'danger');
        }
    };

    const handleAdmisi = async () => {
        if (!form.nama.trim() || !form.gender || !form.keluhanUtama.trim() || !form.dokterId) {
            showToast('Nama, jenis kelamin, keluhan utama, dan dokter jaga wajib diisi', 'warning');
            return;
        }
        try {
            const r = await createAdmisi.mutateAsync({
                pasienBaru: { nama: form.nama, gender: form.gender as 'L' | 'P' },
                triase: form.triase, keluhanUtama: form.keluhanUtama, dokterId: form.dokterId, jaminan: form.jaminan, vitals: form.vitals,
            });
            showToast(`Pasien ${form.nama} diadmisi (RM ${r.rm}, antrean ${r.queueCode})${r.mewsScore >= 3 ? ` — MEWS ${r.mewsScore}, dokter jaga dinotifikasi` : ''}`, r.mewsScore >= 3 ? 'warning' : 'success');
            setAdmisiOpen(false);
            setForm(emptyForm);
        } catch (err) {
            showToast(errorMessage(err, 'Gagal admisi IGD'), 'danger');
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Instalasi Gawat Darurat (IGD)</h1>
                <Button variant="danger" onClick={() => { setForm(emptyForm); setAdmisiOpen(true); }}>
                    <AlertCircle size={16} /> Admisi Darurat
                </Button>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari nama atau RM..." value={list.search} onChange={list.setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: list.totalAll },
                        { label: 'Menunggu', value: 'menunggu', count: list.counts.menunggu ?? 0 },
                        { label: 'Tindakan', value: 'tindakan', count: list.counts.tindakan ?? 0 },
                        { label: 'Observasi', value: 'observasi', count: list.counts.observasi ?? 0 },
                        { label: 'Selesai', value: 'selesai', count: list.counts.selesai ?? 0 },
                    ]}
                    active={list.status} onChange={list.setStatus}
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead><tr><th>Triase</th><th>MEWS</th><th>Waktu Masuk</th><th>Pasien (RM)</th><th>Keluhan Utama</th><th>Dokter Jaga</th><th>Status</th><th>Aksi</th></tr></thead>
                    <tbody>
                        {list.isLoading ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat daftar IGD...</td></tr>
                        ) : list.rows.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada pasien ditemukan</td></tr>
                        ) : list.rows.map((p) => {
                            const mewsColor = MEWS_COLOR[p.mews.level];
                            const next = NEXT_ACTION[p.status];
                            return (
                                <tr key={p.visitId}>
                                    <td>
                                        {p.triase && (
                                            <StatusBadge variant={p.triase === 'merah' ? 'danger' : p.triase === 'kuning' ? 'warning' : p.triase === 'hijau' ? 'success' : 'neutral'} dot={false}>
                                                {p.triase.toUpperCase()}
                                            </StatusBadge>
                                        )}
                                    </td>
                                    <td>
                                        {p.mewsScore != null ? (
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                minWidth: '28px', height: '28px', borderRadius: '999px',
                                                background: `${mewsColor}20`, color: mewsColor, fontWeight: 700, fontSize: '13px',
                                                border: `1px solid ${mewsColor}50`,
                                            }} title={p.mews.action}>{p.mewsScore}</span>
                                        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>}
                                    </td>
                                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{new Date(p.masuk).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
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
                                            {p.hasAllergy && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 500 }}>Alergi: {p.alergi}</span>}
                                        </div>
                                    </td>
                                    <td>{p.keluhanUtama}</td>
                                    <td>{p.dokter}</td>
                                    <td><LifecycleBadge kind="kunjungan" status={p.status} /></td>
                                    <td>
                                        {next && (
                                            <Button variant="primary" size="sm" onClick={() => handleTindakan(p)} disabled={updateStatus.isPending}>
                                                {next.label}
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <Pagination {...list.paginationProps} />
            </div>

            <Modal open={admisiOpen} onClose={() => setAdmisiOpen(false)} title="Admisi Darurat (IGD)" icon={<Plus size={20} />}
                footer={<><Button variant="secondary" onClick={() => setAdmisiOpen(false)}>Batal</Button><Button variant="danger" onClick={handleAdmisi} disabled={createAdmisi.isPending}>Admisi Sekarang</Button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Nama Pasien *</label>
                            <input className={uiStyles.formInput} value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
                                placeholder="Nama pasien (atau 'Tanpa Identitas')" />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Jenis Kelamin *</label>
                            <select className={uiStyles.formSelect} value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as '' | 'L' | 'P' }))}>
                                <option value="">Pilih...</option>
                                <option value="L">Laki-laki</option>
                                <option value="P">Perempuan</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Prioritas Triase *</label>
                            <select className={uiStyles.formSelect} value={form.triase} onChange={(e) => setForm((f) => ({ ...f, triase: e.target.value as Triase }))}>
                                {TRIASE.map((t) => <option key={t} value={t}>{TRIASE_LABEL[t]}</option>)}
                            </select>
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Dokter Jaga *</label>
                            <select className={uiStyles.formSelect} value={form.dokterId} onChange={(e) => setForm((f) => ({ ...f, dokterId: e.target.value }))}>
                                <option value="">Pilih Dokter Jaga...</option>
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
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Keluhan Utama *</label>
                        <textarea className={uiStyles.formTextarea} rows={2} value={form.keluhanUtama}
                            onChange={(e) => setForm((f) => ({ ...f, keluhanUtama: e.target.value }))}
                            placeholder="Deskripsikan keluhan utama pasien..." />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Tanda Vital Saat Triase (opsional — untuk auto-MEWS)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                            {VITAL_FIELDS.map((v) => (
                                <input key={v.key} className={uiStyles.formInput} type="number" step={v.step} placeholder={v.placeholder}
                                    value={form.vitals[v.key] ?? ''}
                                    onChange={(e) => setForm((f) => ({ ...f, vitals: { ...f.vitals, [v.key]: e.target.value ? Number(e.target.value) : undefined } }))} />
                            ))}
                        </div>
                    </div>
                    <div style={{ background: '#eff6ff', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid #93c5fd', fontSize: '13px', color: '#1e40af' }}>
                        <strong>Auto-MEWS:</strong> Skor MEWS dihitung dari tanda vital. Bila ≥ 3, dokter jaga langsung dinotifikasi.
                        No. RM diterbitkan sistem; data identitas dapat dilengkapi kemudian.
                    </div>
                </div>
            </Modal>
        </div>
    );
}
