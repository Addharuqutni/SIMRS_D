import { useState } from 'react';
import { Search, FolderHeart, Clock, User, Phone, MapPin } from 'lucide-react';
import { Button, StatusBadge, Card, Modal, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';

export function RekamMedis() {
    const [searchRm, setSearchRm] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [emrDetail, setEmrDetail] = useState<{ date: string; tipe: string; poli: string; dokter: string; diagnosa: string } | null>(null);

    // Patient data will be loaded from API
    const p = {
        rm: '', nik: '', nama: '',
        ttl: '', gender: '', goldar: '',
        agama: '', alamat: '',
        telepon: '', pekerjaan: '',
        alergi: '', kunjunganTerakhir: '',
    };

    const history: { date: string; tipe: string; poli: string; dokter: string; diagnosa: string; subjektif: string; objektif: string; asesmen: string; planning: string }[] = [];

    const handleSearch = () => {
        if (!searchRm.trim()) {
            showToast('Masukkan nomor RM, NIK, atau nama pasien', 'warning');
            return;
        }
        setHasSearched(true);
        showToast(`Berkas rekam medis ditemukan untuk RM: ${searchRm}`, 'success');
    };

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
                <Button variant="primary" onClick={handleSearch}>
                    <Search size={16} /> Cari Berkas
                </Button>
            </div>

            {hasSearched && (
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
                            <div><strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px' }}>NIK / No. KTP</strong>{p.nik}</div>
                            <div><strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px' }}>Tempat, Tgl Lahir</strong>{p.ttl} ({p.gender})</div>
                            <div><strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px' }}>Golongan Darah</strong><StatusBadge variant="danger" dot={false}>{p.goldar}</StatusBadge></div>
                            <div>
                                <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px' }}><MapPin size={12} /> Alamat</strong>
                                {p.alamat}
                            </div>
                            <div>
                                <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px' }}><Phone size={12} /> Telepon</strong>
                                {p.telepon}
                            </div>
                            <div style={{ background: 'var(--danger-light)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid #fca5a5', marginTop: '8px' }}>
                                <strong style={{ color: '#dc2626', display: 'block', fontSize: '12px', marginBottom: '4px' }}>Alergi Obat/Makanan:</strong>
                                <span style={{ color: '#991b1b', fontWeight: 600 }}>{p.alergi}</span>
                            </div>
                        </div>
                    </Card>

                    {/* Riwayat Kunjungan */}
                    <Card title="Riwayat Kunjungan & Tindakan" icon={<Clock size={18} />}>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                            <StatusBadge variant="info">Total: {history.length} Kunjungan</StatusBadge>
                            <StatusBadge variant="warning">Terakhir: {p.kunjunganTerakhir}</StatusBadge>
                        </div>

                        <table className={uiStyles.table}>
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Jenis Layanan</th>
                                    <th>Poli/Bagian</th>
                                    <th>DPJP</th>
                                    <th>Diagnosa (ICD-10)</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>{h.date}</td>
                                        <td>
                                            <StatusBadge variant={
                                                h.tipe === 'Rawat Jalan' ? 'success' :
                                                    h.tipe === 'IGD -> Rawat Inap' ? 'danger' : 'info'
                                            } dot={false}>
                                                {h.tipe}
                                            </StatusBadge>
                                        </td>
                                        <td>{h.poli}</td>
                                        <td>{h.dokter}</td>
                                        <td>{h.diagnosa}</td>
                                        <td>
                                            <Button variant="ghost" size="sm" title="Buka Detail EMR"
                                                onClick={() => setEmrDetail(h)}>
                                                <FolderHeart size={14} /> Buka
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </div>
            )}

            {/* EMR Detail Modal */}
            <Modal
                open={!!emrDetail}
                onClose={() => setEmrDetail(null)}
                title={`Detail EMR — ${emrDetail?.date}`}
                icon={<FolderHeart size={20} />}
                size="lg"
            >
                {emrDetail && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Tanggal</strong>{emrDetail.date}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Poli / Unit</strong>{emrDetail.poli}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>DPJP</strong>{emrDetail.dokter}</div>
                        </div>

                        {[
                            { label: 'S — Subjektif (Anamnesis)', content: (emrDetail as typeof history[0]).subjektif, color: 'var(--primary)' },
                            { label: 'O — Objektif (Pemeriksaan Fisik)', content: (emrDetail as typeof history[0]).objektif, color: 'var(--success)' },
                            { label: 'A — Asesmen (Diagnosa)', content: (emrDetail as typeof history[0]).asesmen, color: 'var(--warning)' },
                            { label: 'P — Planning (Terapi & Rencana)', content: (emrDetail as typeof history[0]).planning, color: 'var(--info)' },
                        ].map((soap, i) => (
                            <div key={i} style={{ borderLeft: `4px solid ${soap.color}`, paddingLeft: '16px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: soap.color, marginBottom: '6px' }}>{soap.label}</div>
                                <div style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.6 }}>{soap.content}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Modal>
        </div>
    );
}
