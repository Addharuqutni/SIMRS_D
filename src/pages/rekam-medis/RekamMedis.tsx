import { useState } from 'react';
import { Search, FolderHeart, Clock, User, Phone, MapPin, ArrowLeft } from 'lucide-react';
import { Button, StatusBadge, Card, Modal, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { api } from '../../lib/axios';
import { useDetail } from '../../lib/query';
import { useVisits } from '../../hooks/usePatient';
import { clinicalApi, type EmrSoap } from '../../lib/api/clinical';
import type { Patient, VisitWithPatient } from '../../lib/api/patient';
import styles from '../registrasi/registrasi.module.css';

// /patients/visits/all also returns `tipe` (visits.tipeKunjungan)
interface VisitRow extends VisitWithPatient {
    tipe?: string | null;
}

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const tipeMap: Record<string, { label: string; variant: BadgeVariant }> = {
    rawat_jalan: { label: 'Rawat Jalan', variant: 'success' },
    igd: { label: 'IGD', variant: 'danger' },
    rawat_inap: { label: 'Rawat Inap', variant: 'info' },
};

const visitStatusMap: Record<string, { label: string; variant: BadgeVariant }> = {
    menunggu: { label: 'Menunggu', variant: 'warning' },
    pemeriksaan: { label: 'Pemeriksaan', variant: 'info' },
    selesai: { label: 'Selesai', variant: 'success' },
    batal: { label: 'Batal', variant: 'danger' },
};

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtDateTime = (iso: string) =>
    `${fmtDate(iso)} ${new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;

const genderLabel = (g?: string | null) =>
    g === 'L' ? 'Laki-laki' : g === 'P' ? 'Perempuan' : (g || '-');

export function RekamMedis() {
    const [searchRm, setSearchRm] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<Patient[] | null>(null);
    const [selected, setSelected] = useState<Patient | null>(null);
    const [selectedVisit, setSelectedVisit] = useState<VisitRow | null>(null);

    const { data: allVisits, isLoading: visitsLoading } = useVisits();

    // Visit history of the selected patient (matched by RM — the visits rows carry rm, not patientId)
    const history = ((allVisits as VisitRow[] | undefined) ?? [])
        .filter((v) => selected && v.rm === selected.rm)
        .sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());

    // EMR SOAP of the visit opened in the detail modal
    const { data: soap, isLoading: soapLoading, isError: soapError } = useDetail<EmrSoap | null>(
        'soap',
        selectedVisit?.id ?? '',
        () => clinicalApi.getSoap(selectedVisit!.id)
    );

    const handleSearch = async () => {
        const q = searchRm.trim();
        if (!q) {
            showToast('Masukkan nomor RM, NIK, atau nama pasien', 'warning');
            return;
        }
        setSearching(true);
        try {
            const res = await api.get<Patient[]>('/patients', { params: { q } });
            const found = Array.isArray(res.data) ? res.data : [];
            setResults(found);
            setSelectedVisit(null);
            if (found.length === 0) {
                setSelected(null);
                showToast(`Tidak ditemukan pasien dengan "${q}"`, 'warning');
            } else if (found.length === 1) {
                setSelected(found[0]);
                showToast(`Berkas rekam medis ditemukan untuk RM: ${found[0].rm}`, 'success');
            } else {
                setSelected(null);
                showToast(`${found.length} pasien cocok — pilih salah satu`, 'info');
            }
        } catch {
            showToast('Pencarian gagal, coba lagi', 'danger');
        } finally {
            setSearching(false);
        }
    };

    const p = selected;

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Rekam Medis Pasien</h1>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', maxWidth: '600px' }}>
                <input
                    className={uiStyles.formInput}
                    style={{ flex: 1 }}
                    placeholder="Cari No. RM / NIK / Nama Lengkap..."
                    value={searchRm}
                    onChange={(e) => setSearchRm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button variant="primary" onClick={handleSearch} disabled={searching}>
                    <Search size={16} /> {searching ? 'Mencari...' : 'Cari Berkas'}
                </Button>
            </div>

            {/* Multiple matches: pick one patient first */}
            {results !== null && results.length > 0 && !p && (
                <div style={{ marginBottom: '24px', animation: 'fadeIn 0.3s ease' }}>
                    <table className={uiStyles.table}>
                        <thead>
                            <tr>
                                <th>Nama Pasien</th>
                                <th>No. RM</th>
                                <th>NIK</th>
                                <th>Telepon</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((r) => (
                                <tr key={r.id}>
                                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>{r.nama}</td>
                                    <td style={{ fontFamily: 'var(--font-mono)' }}>{r.rm}</td>
                                    <td>{r.nik || '-'}</td>
                                    <td>{r.telepon || '-'}</td>
                                    <td>
                                        <Button variant="ghost" size="sm" onClick={() => { setSelected(r); setSelectedVisit(null); }}>
                                            <FolderHeart size={14} /> Pilih
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {results !== null && results.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: '24px' }}>
                    Tidak ada pasien yang cocok dengan pencarian.
                </div>
            )}

            {p && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {results && results.length > 1 && (
                        <div>
                            <Button variant="secondary" size="sm" onClick={() => setSelected(null)}>
                                <ArrowLeft size={14} /> Kembali ke hasil pencarian
                            </Button>
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
                        {/* Identitas Pasien */}
                        <Card title="Identitas Pasien" icon={<User size={18} />}>
                            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                <div style={{ width: '80px', height: '80px', background: 'var(--primary-100)', color: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 12px' }}>
                                    {p.nama.charAt(0)}
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{p.nama}</h3>
                                <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>RM: {p.rm}</p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                                <div><strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px' }}>NIK / No. KTP</strong>{p.nik || '-'}</div>
                                <div>
                                    <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px' }}>Tempat, Tgl Lahir</strong>
                                    {[p.tempatLahir, p.tanggalLahir ? new Date(`${p.tanggalLahir}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : ''].filter(Boolean).join(', ') || '-'} ({genderLabel(p.gender)})
                                </div>
                                <div><strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px' }}>Golongan Darah</strong><StatusBadge variant="danger" dot={false}>{p.goldar || '-'}</StatusBadge></div>
                                <div>
                                    <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px' }}><MapPin size={12} /> Alamat</strong>
                                    {p.alamat || '-'}
                                </div>
                                <div>
                                    <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px' }}><Phone size={12} /> Telepon</strong>
                                    {p.telepon || '-'}
                                </div>
                                <div style={{ background: 'var(--danger-light)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid #fca5a5', marginTop: '8px' }}>
                                    <strong style={{ color: '#dc2626', display: 'block', fontSize: '12px', marginBottom: '4px' }}>Alergi Obat/Makanan:</strong>
                                    <span style={{ color: '#991b1b', fontWeight: 600 }}>{p.alergi || 'Tidak ada data alergi'}</span>
                                </div>
                            </div>
                        </Card>

                        {/* Riwayat Kunjungan */}
                        <Card title="Riwayat Kunjungan & Tindakan" icon={<Clock size={18} />}>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                                <StatusBadge variant="info">Total: {history.length} Kunjungan</StatusBadge>
                                <StatusBadge variant="warning">Terakhir: {history[0] ? fmtDate(history[0].waktu) : '-'}</StatusBadge>
                            </div>

                            <table className={uiStyles.table}>
                                <thead>
                                    <tr>
                                        <th>Tanggal</th>
                                        <th>Jenis Layanan</th>
                                        <th>Poli/Bagian</th>
                                        <th>DPJP</th>
                                        <th>Status</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visitsLoading ? (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Memuat riwayat kunjungan...</td></tr>
                                    ) : history.length === 0 ? (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Belum ada kunjungan tercatat untuk pasien ini</td></tr>
                                    ) : history.map((h) => {
                                        const tipe = h.tipe ? tipeMap[h.tipe] ?? { label: h.tipe, variant: 'neutral' as BadgeVariant } : null;
                                        const st = visitStatusMap[h.status] ?? { label: h.status, variant: 'neutral' as BadgeVariant };
                                        return (
                                            <tr key={h.id}>
                                                <td style={{ fontWeight: 600, color: 'var(--text)' }}>{fmtDate(h.waktu)}</td>
                                                <td>
                                                    <StatusBadge variant={tipe ? tipe.variant : 'neutral'} dot={false}>
                                                        {tipe ? tipe.label : h.jaminan}
                                                    </StatusBadge>
                                                </td>
                                                <td>{h.poli}</td>
                                                <td>{h.dokter || '-'}</td>
                                                <td><StatusBadge variant={st.variant}>{st.label}</StatusBadge></td>
                                                <td>
                                                    <Button variant="ghost" size="sm" title="Buka Detail EMR"
                                                        onClick={() => setSelectedVisit(h)}>
                                                        <FolderHeart size={14} /> Buka
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </Card>
                    </div>
                </div>
            )}

            {/* EMR Detail Modal */}
            <Modal
                open={!!selectedVisit}
                onClose={() => setSelectedVisit(null)}
                title={`Detail EMR — ${selectedVisit ? fmtDate(selectedVisit.waktu) : ''}`}
                icon={<FolderHeart size={20} />}
                size="lg"
            >
                {selectedVisit && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Tanggal</strong>{fmtDateTime(selectedVisit.waktu)}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Poli / Unit</strong>{selectedVisit.poli}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>DPJP</strong>{selectedVisit.dokter || '-'}</div>
                        </div>

                        {soapLoading ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat data EMR...</div>
                        ) : soapError ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--danger)' }}>Gagal memuat EMR. Coba buka kembali.</div>
                        ) : !soap ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
                                Belum ada EMR untuk kunjungan ini.
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                                        <strong style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', minWidth: '110px' }}>Diagnosa (ICD-10)</strong>
                                        {soap.icd10Codes && soap.icd10Codes.length > 0
                                            ? soap.icd10Codes.map((c) => <StatusBadge key={c} variant="danger" dot={false}>{c}</StatusBadge>)
                                            : <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>-</span>}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                                        <strong style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', minWidth: '110px' }}>Tindakan (ICD-9)</strong>
                                        {soap.icd9Codes && soap.icd9Codes.length > 0
                                            ? soap.icd9Codes.map((c) => <StatusBadge key={c} variant="info" dot={false}>{c}</StatusBadge>)
                                            : <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>-</span>}
                                    </div>
                                </div>

                                {[
                                    { label: 'S — Subjektif (Anamnesis)', content: soap.subjektif, color: 'var(--primary)' },
                                    { label: 'O — Objektif (Pemeriksaan Fisik)', content: soap.objektif, color: 'var(--success)' },
                                    { label: 'A — Asesmen (Diagnosa)', content: soap.asesmen, color: 'var(--warning)' },
                                    { label: 'P — Planning (Terapi & Rencana)', content: soap.planning, color: 'var(--info)' },
                                ].map((sec, i) => (
                                    <div key={i} style={{ borderLeft: `4px solid ${sec.color}`, paddingLeft: '16px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 700, color: sec.color, marginBottom: '6px' }}>{sec.label}</div>
                                        <div style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{sec.content || '-'}</div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
