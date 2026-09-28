import { useState } from 'react';
import { FileText, Send, AlertCircle, Clock, DollarSign, Eye, CheckCircle2 } from 'lucide-react';
import {
    Button, SearchBar, FilterTabs, Pagination, Card, Modal, showToast,
    LifecycleBadge, StatusBadge, uiStyles,
} from '../../components/ui';
import { LIFECYCLES } from '../../../shared/status';
import styles from '../registrasi/registrasi.module.css';
import { useKlaims, useUpdateKlaim, useApplyKlaimHasil } from '../../hooks/useBpjs';
import { errorMessage } from '../../lib/api-error';
import { formatRp } from '../../lib/format';
import type { Klaim } from '../../lib/api/bpjs';

export function KlaimBpjs() {
    const list = useKlaims();
    const updateMutation = useUpdateKlaim();
    const verifyMutation = useApplyKlaimHasil();

    const [detailModal, setDetailModal] = useState<Klaim | null>(null);
    const [verifyTarget, setVerifyTarget] = useState<Klaim | null>(null);
    const [hasil, setHasil] = useState({ inaCbg: '', tarifInaCbg: '' });

    const totalPotensi = list.rows
        .filter((k) => k.status !== 'dispute')
        .reduce((sum, k) => sum + (k.tarifInaCbg ?? 0), 0);

    const sendKlaim = async (klaim: Klaim, status: 'pending' | 'dispute' | 'layak', message: string) => {
        try {
            await updateMutation.mutateAsync({ id: klaim.id, status });
            showToast(message, 'info');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal mengubah status klaim'), 'danger');
        }
    };

    const handleKirimKlaim = (klaim: Klaim) =>
        sendKlaim(klaim, 'pending', klaim.status === 'dispute'
            ? `Dispute ${klaim.noSep ?? ''} diselesaikan dan dikirim ulang`
            : `Klaim ${klaim.noSep ?? ''} dikirim ke BPJS untuk verifikasi`);

    const handleVerifikasi = async () => {
        if (!verifyTarget) return;
        const tarif = Number(hasil.tarifInaCbg);
        if (!hasil.inaCbg.trim() || !Number.isInteger(tarif) || tarif < 0) {
            showToast('Isi kode INA-CBG dan tarif (angka bulat, minimal 0)', 'warning');
            return;
        }
        try {
            await verifyMutation.mutateAsync({ id: verifyTarget.id, inaCbg: hasil.inaCbg.trim(), tarifInaCbg: tarif });
            showToast(`Klaim ${verifyTarget.noSep ?? ''} dinyatakan layak bayar`, 'success');
            setVerifyTarget(null);
            setHasil({ inaCbg: '', tarifInaCbg: '' });
        } catch (err) {
            showToast(errorMessage(err, 'Gagal menyimpan hasil verifikasi'), 'danger');
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Klaim BPJS (INA-CBG)</h1>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '12px', color: '#3b82f6' }}><FileText size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{list.counts.dibentuk ?? 0}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Dibentuk</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '12px', color: '#d97706' }}><Clock size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{list.counts.pending ?? 0}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pending Verif</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '12px', color: '#dc2626' }}><AlertCircle size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{list.counts.dispute ?? 0}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Dispute</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '12px', color: '#16a34a' }}><DollarSign size={20} /></div>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{formatRp(totalPotensi)}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tarif INA-CBG (halaman ini)</div>
                        </div>
                    </div>
                </Card>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari No. SEP, Pasien, RM..." value={list.search} onChange={list.setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: list.totalAll },
                        { label: 'Dibentuk', value: 'dibentuk', count: list.counts.dibentuk ?? 0 },
                        { label: 'Pending', value: 'pending', count: list.counts.pending ?? 0 },
                        { label: 'Dispute', value: 'dispute', count: list.counts.dispute ?? 0 },
                        { label: 'Layak Bayar', value: 'layak', count: list.counts.layak ?? 0 },
                    ]}
                    active={list.status} onChange={list.setStatus}
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead>
                        <tr>
                            <th>No. SEP</th><th>Pasien</th><th>Diagnosa</th><th>INA-CBG</th>
                            <th>Tarif RS</th><th>Tarif INA-CBG</th><th>Selisih</th><th>Status</th><th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.isLoading ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat klaim...</td></tr>
                        ) : list.isError ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--danger)' }}>{errorMessage(list.error, 'Gagal memuat klaim')}</td></tr>
                        ) : list.rows.length === 0 ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada klaim ditemukan</td></tr>
                        ) : list.rows.map((k) => {
                            const selisih = k.tarifInaCbg === null ? null : k.tarifRs - k.tarifInaCbg;
                            return (
                                <tr key={k.id}>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {k.noSep ?? '-'}
                                            {k.sumber === 'simulasi' && <StatusBadge variant="warning" dot={false}>SIMULASI</StatusBadge>}
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.nameCell}>
                                            <span className={styles.namePrimary}>{k.pasien ?? '-'}</span>
                                            <span className={styles.nameSecondary}>RM: {k.rm ?? '-'}</span>
                                        </div>
                                    </td>
                                    <td style={{ fontSize: '13px' }}>{k.diagnosa ?? '-'}</td>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{k.inaCbg ?? '—'}</td>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{formatRp(k.tarifRs)}</td>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                                        {k.tarifInaCbg === null ? '—' : formatRp(k.tarifInaCbg)}
                                    </td>
                                    <td style={{
                                        fontFamily: 'var(--font-mono)', fontSize: '12px',
                                        color: selisih === null ? 'var(--text-muted)' : selisih > 0 ? 'var(--danger)' : 'var(--success)',
                                    }}>
                                        {selisih === null ? '—' : selisih > 0 ? `-${formatRp(selisih)}` : formatRp(0)}
                                    </td>
                                    <td><LifecycleBadge kind="klaim" status={k.status} /></td>
                                    <td>
                                        <div className={styles.actionBtns}>
                                            <Button variant="ghost" size="sm" title="Detail Klaim" onClick={() => setDetailModal(k)}>
                                                <Eye size={14} />
                                            </Button>
                                            {LIFECYCLES.klaim.canTransition(k.status, 'pending') && (
                                                <Button variant="primary" size="sm" onClick={() => handleKirimKlaim(k)} disabled={updateMutation.isPending}>
                                                    <Send size={12} /> {k.status === 'dispute' ? 'Kirim Ulang' : 'Kirim'}
                                                </Button>
                                            )}
                                            {LIFECYCLES.klaim.canTransition(k.status, 'layak') && (
                                                <Button variant="secondary" size="sm"
                                                    onClick={() => { setVerifyTarget(k); setHasil({ inaCbg: k.inaCbg ?? '', tarifInaCbg: k.tarifInaCbg !== null ? String(k.tarifInaCbg) : '' }); }}>
                                                    <CheckCircle2 size={12} /> Verifikasi
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <Pagination {...list.paginationProps} />
            </div>

            {/* Detail Modal */}
            <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title={`Detail Klaim — ${detailModal?.noSep ?? ''}`} icon={<FileText size={20} />} size="md">
                {detailModal && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '14px' }}>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Pasien</strong>{detailModal.pasien ?? '-'}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>No. Rekam Medis</strong>{detailModal.rm ?? '-'}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Diagnosa</strong>{detailModal.diagnosa ?? '-'}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Kode INA-CBG</strong><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{detailModal.inaCbg ?? 'Belum terbit'}</span></div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Waktu Klaim</strong>{new Date(detailModal.waktuKlaim).toLocaleString('id-ID')}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Status</strong><LifecycleBadge kind="klaim" status={detailModal.status} /></div>
                            {detailModal.sumber === 'simulasi' && (
                                <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Sumber SEP</strong><StatusBadge variant="warning" dot={false}>SIMULASI</StatusBadge></div>
                            )}
                        </div>
                        <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Perbandingan Tarif</h4>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                <span>Tarif Rumah Sakit</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatRp(detailModal.tarifRs)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                <span>Tarif INA-CBG</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary)' }}>
                                    {detailModal.tarifInaCbg === null ? 'Belum ada' : formatRp(detailModal.tarifInaCbg)}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '14px' }}>
                                <span style={{ fontWeight: 600 }}>Selisih</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--danger)' }}>
                                    {detailModal.tarifInaCbg === null ? '—' : formatRp(detailModal.tarifRs - detailModal.tarifInaCbg)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Verifikasi Modal — records the BPJS grouping, moves the Klaim to 'layak' */}
            <Modal open={!!verifyTarget} onClose={() => setVerifyTarget(null)}
                title={`Hasil Verifikasi BPJS — ${verifyTarget?.noSep ?? ''}`} icon={<CheckCircle2 size={20} />}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setVerifyTarget(null)}>Batal</Button>
                        <Button variant="primary" onClick={handleVerifikasi} disabled={verifyMutation.isPending}>
                            <CheckCircle2 size={16} /> Tandai Layak Bayar
                        </Button>
                    </>
                }>
                {verifyTarget && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {verifyTarget.pasien ?? '-'} · {verifyTarget.diagnosa ?? '-'}<br />
                            Tarif RS tercatat: <strong>{formatRp(verifyTarget.tarifRs)}</strong>
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Kode INA-CBG *</label>
                            <input className={uiStyles.formInput} value={hasil.inaCbg}
                                onChange={(e) => setHasil((h) => ({ ...h, inaCbg: e.target.value }))}
                                placeholder="cth: Q-5-44-0" />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Tarif INA-CBG (Rp) *</label>
                            <input className={uiStyles.formInput} inputMode="numeric" value={hasil.tarifInaCbg}
                                onChange={(e) => setHasil((h) => ({ ...h, tarifInaCbg: e.target.value.replace(/\D/g, '') }))}
                                placeholder="cth: 240000" />
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
