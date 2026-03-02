import { useState } from 'react';
import { FileText, Search, Plus, Globe, CheckCircle } from 'lucide-react';
import { Button, SearchBar, FilterTabs, StatusBadge, Pagination, Card, Modal, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';
import { useSeps, useCreateSep, useCancelSep } from '../../hooks/useBpjs';
import type { SepRecord } from '../../lib/api/bpjs';

const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
    aktif: { label: 'Aktif', variant: 'success' },
    terpakai: { label: 'Terpakai', variant: 'info' },
    batal: { label: 'Dibatalkan', variant: 'danger' },
};

const emptyForm = { pasien: '', noKartu: '', diagnosa: '', ppkRujukan: '', rm: '' };

export function SepVClaim() {
    const { data: seps = [] } = useSeps();
    const createMutation = useCreateSep();
    const cancelMutation = useCancelSep();

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('semua');
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);

    const filtered = seps.filter((s: SepRecord) => {
        const matchSearch = search.trim() === '' ||
            s.pasien.toLowerCase().includes(search.toLowerCase()) ||
            s.noSep.includes(search) ||
            s.rm.includes(search) ||
            s.noKartu.includes(search);
        const matchFilter = filter === 'semua' || s.status === filter;
        return matchSearch && matchFilter;
    });

    const handleBuatSep = async () => {
        if (!form.pasien || !form.noKartu || !form.diagnosa || !form.rm) {
            showToast('Lengkapi data wajib: Pasien, RM, No. Kartu, Diagnosa', 'warning');
            return;
        }
        try {
            await createMutation.mutateAsync({
                pasien: form.pasien,
                rm: form.rm,
                noKartu: form.noKartu,
                diagnosa: form.diagnosa,
                ppkRujukan: form.ppkRujukan || '-'
            });
            showToast(`SEP berhasil dibuat untuk ${form.pasien}`, 'success');
            setModalOpen(false);
            setForm(emptyForm);
        } catch (e) {
            showToast('Gagal membuat SEP BPJS', 'danger');
        }
    };

    const handleBatalkan = async (sep: SepRecord) => {
        if (confirm(`Yakin batalkan SEP ${sep.noSep}?`)) {
            try {
                await cancelMutation.mutateAsync(sep.noSep);
                showToast(`SEP ${sep.noSep} telah dibatalkan`, 'warning');
            } catch (e) {
                showToast('Gagal membatalkan SEP', 'danger');
            }
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>SEP & VClaim BPJS</h1>
                <Button variant="primary" onClick={() => { setForm(emptyForm); setModalOpen(true); }}>
                    <Plus size={16} /> Buat SEP Baru
                </Button>
            </div>

            {/* Bridging Status */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)' }}></div>
                        <div><div style={{ fontWeight: 600 }}>VClaim</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Connected</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)' }}></div>
                        <div><div style={{ fontWeight: 600 }}>PCare</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Connected</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Globe size={16} style={{ color: 'var(--primary)' }} />
                        <div><div style={{ fontWeight: 600 }}>SEP Tercatat</div><div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>{seps.length}</div></div>
                    </div>
                </Card>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari No. SEP, Pasien, RM, No. Kartu..." value={search} onChange={setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: seps.length },
                        { label: 'Aktif', value: 'aktif', count: seps.filter((s: SepRecord) => s.status === 'aktif').length },
                        { label: 'Terpakai', value: 'terpakai', count: seps.filter((s: SepRecord) => s.status === 'terpakai').length },
                        { label: 'Dibatalkan', value: 'batal', count: seps.filter((s: SepRecord) => s.status === 'batal').length },
                    ]}
                    active={filter} onChange={setFilter}
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead><tr><th>No SEP</th><th>Pasien</th><th>No. Kartu BPJS</th><th>Diagnosa</th><th>Tgl SEP</th><th>PPK Perujuk</th><th>Status</th><th>Aksi</th></tr></thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada data SEP ditemukan</td></tr>
                        ) : filtered.map((s: SepRecord, i: number) => (
                            <tr key={i}>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{s.noSep}</td>
                                <td><div className={styles.nameCell}><span className={styles.namePrimary}>{s.pasien}</span><span className={styles.nameSecondary}>RM: {s.rm}</span></div></td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{s.noKartu}</td>
                                <td>{s.diagnosa}</td>
                                <td>{new Date(s.tglSep).toLocaleDateString('id-ID')}</td>
                                <td>{s.ppkRujukan}</td>
                                <td><StatusBadge variant={statusMap[s.status]?.variant || 'neutral'}>{statusMap[s.status]?.label || s.status}</StatusBadge></td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        {s.status === 'aktif' && (
                                            <Button variant="ghost" size="sm" style={{ color: 'var(--danger)' }}
                                                onClick={() => handleBatalkan(s)}>
                                                Batalkan
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => showToast(`Pilih fitur Cetak dari detail rincian untuk ${s.noSep}`, 'info')}>
                                            Detail
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination currentPage={1} totalPages={Math.ceil(filtered.length / 10) || 1} totalItems={filtered.length} onPageChange={() => { }} />
            </div>

            {/* Buat SEP Modal */}
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Buat SEP Baru" icon={<FileText size={20} />}
                footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button><Button variant="primary" onClick={handleBuatSep} disabled={createMutation.isPending}><CheckCircle size={16} /> Buat SEP</Button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Nama Pasien *</label>
                        <input className={uiStyles.formInput} value={form.pasien} onChange={e => setForm(f => ({ ...f, pasien: e.target.value }))} placeholder="Nama lengkap pasien" />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>No. RM *</label>
                        <input className={uiStyles.formInput} value={form.rm} onChange={e => setForm(f => ({ ...f, rm: e.target.value }))} placeholder="Nomor Rekam Medis" />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>No. Kartu BPJS *</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input className={uiStyles.formInput} style={{ flex: 1 }} value={form.noKartu}
                                onChange={e => setForm(f => ({ ...f, noKartu: e.target.value }))} placeholder="13 digit No. Kartu BPJS" />
                            <Button variant="secondary" onClick={() => showToast('Data peserta ditemukan — Aktif', 'success')}>
                                <Search size={14} /> Cek
                            </Button>
                        </div>
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Diagnosa Awal (ICD-10) *</label>
                        <input className={uiStyles.formInput} value={form.diagnosa}
                            onChange={e => setForm(f => ({ ...f, diagnosa: e.target.value }))} placeholder="cth: J06.9 - ISPA" />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>PPK Perujuk (FKTP)</label>
                        <input className={uiStyles.formInput} value={form.ppkRujukan}
                            onChange={e => setForm(f => ({ ...f, ppkRujukan: e.target.value }))} placeholder="Nama Puskesmas / Klinik perujuk" />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
