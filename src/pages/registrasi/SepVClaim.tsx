import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Search, Plus, Globe, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import {
    Button, SearchBar, FilterTabs, Pagination, Card, Modal, showToast,
    LifecycleBadge, StatusBadge, uiStyles,
} from '../../components/ui';
import { LIFECYCLES } from '../../../shared/status';
import styles from '../registrasi/registrasi.module.css';
import { useSeps, useIssueSep, useCancelSep, usePesertaCheck, useSepByVisit, useVisitSummary, useBridgingStatus } from '../../hooks/useBpjs';
import { errorMessage } from '../../lib/api-error';
import type { SepRecord } from '../../lib/api/bpjs';

const todayIso = () => new Date().toISOString().slice(0, 10);

export function SepVClaim() {
    const list = useSeps();
    const issueMutation = useIssueSep();
    const cancelMutation = useCancelSep();

    const [params, setParams] = useSearchParams();
    const visitIdParam = params.get('visitId') ?? '';

    const visitSummary = useVisitSummary(visitIdParam);
    const existingSep = useSepByVisit(visitIdParam);
    const bridging = useBridgingStatus();

    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ visitId: '', noKartu: '', diagnosa: '', ppkRujukan: '' });
    const [checkTarget, setCheckTarget] = useState('');
    const peserta = usePesertaCheck(checkTarget);

    // Deep link from registration: /sep?visitId=… prefills and opens the form.
    useEffect(() => {
        if (!visitIdParam) return;
        setForm({ visitId: visitIdParam, noKartu: '', diagnosa: '', ppkRujukan: '' });
        setModalOpen(true);
    }, [visitIdParam]);

    const visit = visitSummary.data;
    const activeSep: SepRecord | null = useMemo(() => {
        const sep = existingSep.data?.sep;
        return sep && sep.status === 'aktif' ? sep : null;
    }, [existingSep.data]);

    const openForm = () => {
        setForm({ visitId: '', noKartu: '', diagnosa: '', ppkRujukan: '' });
        setCheckTarget('');
        setModalOpen(true);
    };

    const closeForm = () => {
        setModalOpen(false);
        setCheckTarget('');
        if (visitIdParam) setParams({}, { replace: true });
    };

    const isSimulasi = bridging.data?.mode === 'simulasi';
    const bridgingBadge = bridging.isLoading
        ? { variant: 'neutral' as const, label: 'Memeriksa...', dot: '#94a3b8' }
        : bridging.isError
            ? { variant: 'danger' as const, label: 'Tidak diketahui', dot: '#dc2626' }
            : bridging.data?.mode === 'real'
                ? { variant: 'success' as const, label: 'Terhubung (real)', dot: '#16a34a' }
                : bridging.data?.mode === 'nonaktif'
                    ? { variant: 'danger' as const, label: 'Belum dikonfigurasi', dot: '#dc2626' }
                    : { variant: 'warning' as const, label: 'Mode simulasi', dot: '#d97706' };

    const handleCekPeserta = () => {
        const noKartu = form.noKartu.trim();
        if (noKartu.length < 7) {
            showToast('Masukkan nomor kartu BPJS yang valid terlebih dahulu', 'warning');
            return;
        }
        setCheckTarget(noKartu);
    };

    const handleBuatSep = async () => {
        if (!visitIdParam && !form.visitId.trim()) {
            showToast('Isi ID Kunjungan (visitId) yang akan diterbitkan SEP-nya', 'warning');
            return;
        }
        if (!form.noKartu.trim() || !form.diagnosa.trim()) {
            showToast('Lengkapi No. Kartu BPJS dan Diagnosa Awal', 'warning');
            return;
        }
        if (activeSep) {
            showToast(`Kunjungan ini sudah memiliki SEP aktif ${activeSep.noSep}`, 'warning');
            return;
        }
        try {
            const { sep } = await issueMutation.mutateAsync({
                visitId: (visitIdParam || form.visitId).trim(),
                noKartu: form.noKartu.trim(),
                diagnosa: form.diagnosa.trim(),
                ppkRujukan: form.ppkRujukan.trim() || null,
            });
            showToast(`SEP ${sep.noSep} berhasil diterbitkan`, 'success');
            closeForm();
        } catch (err) {
            showToast(errorMessage(err, 'Gagal menerbitkan SEP'), 'danger');
        }
    };

    const handleBatalkan = async (sep: SepRecord) => {
        if (!confirm(`Yakin batalkan SEP ${sep.noSep}?`)) return;
        try {
            await cancelMutation.mutateAsync(sep.id);
            showToast(`SEP ${sep.noSep} telah dibatalkan`, 'warning');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal membatalkan SEP'), 'danger');
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>SEP & VClaim BPJS</h1>
                <Button variant="primary" onClick={openForm}>
                    <Plus size={16} /> Buat SEP Baru
                </Button>
            </div>

            {/* Bridging status + SEP count, from the real endpoint */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: bridgingBadge.dot }} />
                        <div>
                            <div style={{ fontWeight: 600 }}>Bridging VClaim</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{bridgingBadge.label}</div>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '10px', height: '10px', borderRadius: '50%',
                            background: bridging.data?.lastCall ? (bridging.data.lastCall.ok ? 'var(--success)' : 'var(--danger)') : '#94a3b8',
                        }} />
                        <div>
                            <div style={{ fontWeight: 600 }}>Panggilan Terakhir</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {bridging.data?.lastCall
                                    ? `${bridging.data.lastCall.ok ? 'Berhasil' : 'Gagal'} — ${bridging.data.lastCall.latencyMs} ms`
                                    : 'Belum ada panggilan'}
                            </div>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Globe size={16} style={{ color: 'var(--primary)' }} />
                        <div>
                            <div style={{ fontWeight: 600 }}>SEP Tercatat</div>
                            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>{list.totalAll}</div>
                        </div>
                    </div>
                </Card>
            </div>

            {isSimulasi && (
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <AlertTriangle size={16} style={{ color: '#d97706', flexShrink: 0 }} />
                        <span>
                            Bridging berjalan dalam <strong>mode simulasi</strong> (kredensial BPJS belum diisi di server).
                            SEP yang diterbitkan ditandai <strong>SIMULASI</strong> dan tidak berlaku di server BPJS.
                        </span>
                    </div>
                </Card>
            )}

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari No. SEP, Pasien, RM..." value={list.search} onChange={list.setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: list.totalAll },
                        { label: 'Aktif', value: 'aktif', count: list.counts.aktif ?? 0 },
                        { label: 'Terpakai', value: 'terpakai', count: list.counts.terpakai ?? 0 },
                        { label: 'Dibatalkan', value: 'batal', count: list.counts.batal ?? 0 },
                    ]}
                    active={list.status} onChange={list.setStatus}
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead>
                        <tr>
                            <th>No SEP</th><th>Pasien</th><th>No. Kartu BPJS</th><th>Diagnosa</th>
                            <th>Tgl SEP</th><th>PPK Perujuk</th><th>Status</th><th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.isLoading ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat data SEP...</td></tr>
                        ) : list.isError ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--danger)' }}>{errorMessage(list.error, 'Gagal memuat data SEP')}</td></tr>
                        ) : list.rows.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada data SEP ditemukan</td></tr>
                        ) : list.rows.map((s) => (
                            <tr key={s.id}>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {s.noSep}
                                        {s.sumber === 'simulasi' && <StatusBadge variant="warning" dot={false}>SIMULASI</StatusBadge>}
                                    </div>
                                </td>
                                <td>
                                    <div className={styles.nameCell}>
                                        <span className={styles.namePrimary}>{s.pasien ?? '-'}</span>
                                        <span className={styles.nameSecondary}>RM: {s.rm ?? '-'}</span>
                                    </div>
                                </td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{s.noKartu}</td>
                                <td>{s.diagnosa}</td>
                                <td>{new Date(s.tglSep).toLocaleDateString('id-ID')}</td>
                                <td>{s.ppkRujukan ?? '-'}</td>
                                <td><LifecycleBadge kind="sep" status={s.status} /></td>
                                <td>
                                    <div className={styles.actionBtns}>
                                        {LIFECYCLES.sep.canTransition(s.status, 'batal') && (
                                            <Button variant="ghost" size="sm" style={{ color: 'var(--danger)' }}
                                                onClick={() => handleBatalkan(s)} disabled={cancelMutation.isPending}>
                                                Batalkan
                                            </Button>
                                        )}
                                        {s.visitId && (
                                            <Button variant="ghost" size="sm" title="Buka Kunjungan ini"
                                                onClick={() => setParams({ visitId: s.visitId })}>
                                                Kunjungan
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination {...list.paginationProps} />
            </div>

            {/* Terbitkan SEP Modal */}
            <Modal open={modalOpen} onClose={closeForm} title="Terbitkan SEP Baru" icon={<FileText size={20} />}
                footer={
                    <>
                        <Button variant="secondary" onClick={closeForm}>Batal</Button>
                        <Button variant="primary" onClick={handleBuatSep}
                            disabled={issueMutation.isPending || !!activeSep || (!!peserta.data && !peserta.data.aktif)}>
                            <CheckCircle size={16} /> {issueMutation.isPending ? 'Mengirim...' : 'Terbitkan SEP'}
                        </Button>
                    </>
                }>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {visitIdParam ? (
                        visitSummary.isLoading ? (
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Memuat data kunjungan...</div>
                        ) : visitSummary.isError ? (
                            <div style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--danger)' }}>
                                <AlertTriangle size={16} />
                                {errorMessage(visitSummary.error, 'Kunjungan tidak dapat dimuat')}
                            </div>
                        ) : visit && (
                            <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <div style={{ fontWeight: 600 }}>{visit.pasien ?? '-'} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({visit.rm ?? '-'})</span></div>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    {visit.poli} · {visit.tipeKunjungan} · Jaminan: <strong>{visit.jaminan}</strong>
                                </div>
                                {activeSep && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '13px', color: 'var(--warning, #d97706)' }}>
                                        <AlertTriangle size={14} />
                                        Kunjungan ini sudah memiliki SEP aktif <strong>{activeSep.noSep}</strong>.
                                    </div>
                                )}
                            </div>
                        )
                    ) : (
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>ID Kunjungan (visitId) *</label>
                            <input className={uiStyles.formInput} value={form.visitId}
                                onChange={e => setForm(f => ({ ...f, visitId: e.target.value }))}
                                placeholder="Tempel ID kunjungan dari halaman Registrasi" />
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                Gunakan tombol SEP pada halaman Registrasi agar kunjungan terisi otomatis.
                            </span>
                        </div>
                    )}

                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>No. Kartu BPJS *</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input className={uiStyles.formInput} style={{ flex: 1 }} value={form.noKartu}
                                onChange={e => { setForm(f => ({ ...f, noKartu: e.target.value })); setCheckTarget(''); }}
                                placeholder="13 digit No. Kartu BPJS" />
                            <Button variant="secondary" onClick={handleCekPeserta} disabled={peserta.isFetching}>
                                <Search size={14} /> {peserta.isFetching ? 'Memeriksa...' : 'Cek'}
                            </Button>
                        </div>
                    </div>

                    {peserta.isError && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--danger)', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <XCircle size={16} /> {errorMessage(peserta.error, 'Peserta tidak dapat diverifikasi')}
                        </div>
                    )}

                    {peserta.data && (
                        <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{peserta.data.nama}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {peserta.data.noKartu}
                                        {peserta.data.jenisPeserta ? ` · ${peserta.data.jenisPeserta}` : ''}
                                        {peserta.data.kelas ? ` · ${peserta.data.kelas}` : ''}
                                    </div>
                                </div>
                                <StatusBadge variant={peserta.data.aktif ? 'success' : 'danger'}>{peserta.data.status}</StatusBadge>
                            </div>
                            {!peserta.data.aktif && (
                                <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--danger)' }}>
                                    Peserta tidak aktif — SEP tidak dapat diterbitkan.
                                </div>
                            )}
                        </div>
                    )}

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
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Tanggal SEP: {todayIso()}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
