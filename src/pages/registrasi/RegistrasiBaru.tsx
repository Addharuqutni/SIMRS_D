import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, Printer, Save, User, FileText, Stethoscope, Search } from 'lucide-react';
import { Button, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { useDoctors } from '../../hooks/useMasterData';
import { usePatientSearch, useRegister } from '../../hooks/usePatient';
import type { Patient, RegistrationResult } from '../../lib/api/patient';
import { settingsApi } from '../../lib/api/settings';
import { errorMessage } from '../../lib/api-error';
import { JAMINAN, POLI_RAWAT_JALAN, type Jaminan } from '../../../shared/admission';
import styles from './registrasi.module.css';

const emptyPasien = { nik: '', nama: '', telepon: '', tanggalLahir: '', gender: '' as '' | 'L' | 'P', goldar: '', alamat: '', alergi: '' };

export function RegistrasiBaru() {
    const navigate = useNavigate();
    const register = useRegister();
    const { data: doctors = [] } = useDoctors();
    const { data: publicSettings } = useQuery({ queryKey: ['public-settings'], queryFn: settingsApi.getPublicSettings, staleTime: 5 * 60_000 });

    const [mode, setMode] = useState<'lama' | 'baru'>('lama');
    const [search, setSearch] = useState('');
    const { data: found = [], isFetching: searching } = usePatientSearch(mode === 'lama' ? search : '');
    const [existing, setExisting] = useState<Patient | null>(null);
    const [pasien, setPasien] = useState(emptyPasien);
    const [tujuan, setTujuan] = useState({ jaminan: JAMINAN[0] as Jaminan, poliId: '', dokterId: '' });
    const [ticket, setTicket] = useState<(RegistrationResult & { dokter: string; waktu: Date }) | null>(null);

    const updatePasien = (field: keyof typeof emptyPasien, value: string) => setPasien((p) => ({ ...p, [field]: value }));

    const handleSimpan = async () => {
        if (mode === 'lama' && !existing) { showToast('Pilih pasien lama terlebih dahulu', 'warning'); return; }
        if (mode === 'baru' && (!pasien.nama.trim() || !pasien.gender)) { showToast('Nama dan jenis kelamin wajib diisi', 'warning'); return; }
        if (!tujuan.poliId || !tujuan.dokterId) { showToast('Pilih poli dan dokter tujuan', 'warning'); return; }

        try {
            const res = await register.mutateAsync({
                ...tujuan,
                ...(mode === 'lama'
                    ? { patientId: existing!.id }
                    : { pasienBaru: { ...pasien, gender: pasien.gender as 'L' | 'P' } }),
            });
            setTicket({ ...res, dokter: doctors.find((d) => d.id === tujuan.dokterId)?.nama ?? '-', waktu: new Date() });
            showToast(`${res.nama} terdaftar (RM ${res.rm}) — antrean ${res.queueCode}`, 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal mendaftarkan pasien'), 'danger');
        }
    };

    return (
        <div className={styles.formPage}>
            <button className={styles.backLink} onClick={() => navigate('/registrasi')}>
                <ArrowLeft size={16} /> Kembali ke Daftar Registrasi
            </button>

            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Registrasi Rawat Jalan</h1>
            </div>

            {!ticket && (
                <>
                    <div className={styles.formSection}>
                        <h3 className={styles.formSectionTitle}><User size={18} /> Pasien</h3>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            <Button variant={mode === 'lama' ? 'primary' : 'secondary'} onClick={() => setMode('lama')}>Pasien Lama</Button>
                            <Button variant={mode === 'baru' ? 'primary' : 'secondary'} onClick={() => { setMode('baru'); setExisting(null); }}>Pasien Baru</Button>
                        </div>

                        {mode === 'lama' ? (
                            <div className={uiStyles.formGroup}>
                                <label className={uiStyles.formLabel}>Cari No. RM / Nama / NIK</label>
                                <div style={{ position: 'relative' }}>
                                    <input className={uiStyles.formInput} placeholder="Ketik minimal 2 karakter..."
                                        value={existing ? `${existing.rm} — ${existing.nama}` : search}
                                        onChange={(e) => { setExisting(null); setSearch(e.target.value); }} />
                                    {!existing && search.trim().length >= 2 && (
                                        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', maxHeight: '240px', overflowY: 'auto', background: 'var(--surface, #fff)' }}>
                                            {searching ? <div style={{ padding: '8px 12px', color: 'var(--text-muted)' }}><Search size={12} /> Mencari...</div>
                                                : found.length === 0 ? <div style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Tidak ditemukan — gunakan "Pasien Baru"</div>
                                                    : found.map((p) => (
                                                        <button key={p.id} type="button" onClick={() => setExisting(p)}
                                                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer' }}>
                                                            <strong style={{ fontFamily: 'var(--font-mono)' }}>{p.rm}</strong> — {p.nama}
                                                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}> · NIK {p.nik ?? '-'} · {p.tanggalLahir ?? ''}</span>
                                                        </button>
                                                    ))}
                                        </div>
                                    )}
                                </div>
                                {existing?.alergi && <div style={{ marginTop: '8px', color: 'var(--danger)', fontSize: '13px' }}>Alergi: {existing.alergi}</div>}
                            </div>
                        ) : (
                            <>
                                <div className={styles.formRow}>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}>Nama Lengkap *</label>
                                        <input className={uiStyles.formInput} placeholder="Nama sesuai KTP" value={pasien.nama} onChange={(e) => updatePasien('nama', e.target.value)} />
                                    </div>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}>NIK</label>
                                        <input className={uiStyles.formInput} placeholder="16 digit (opsional)" inputMode="numeric" maxLength={16} value={pasien.nik} onChange={(e) => updatePasien('nik', e.target.value.replace(/\D/g, ''))} />
                                    </div>
                                </div>
                                <div className={styles.formRow3}>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}>Jenis Kelamin *</label>
                                        <select className={uiStyles.formSelect} value={pasien.gender} onChange={(e) => updatePasien('gender', e.target.value)}>
                                            <option value="">Pilih...</option>
                                            <option value="L">Laki-laki</option>
                                            <option value="P">Perempuan</option>
                                        </select>
                                    </div>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}>Tanggal Lahir</label>
                                        <input className={uiStyles.formInput} type="date" value={pasien.tanggalLahir} onChange={(e) => updatePasien('tanggalLahir', e.target.value)} />
                                    </div>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}>Golongan Darah</label>
                                        <select className={uiStyles.formSelect} value={pasien.goldar} onChange={(e) => updatePasien('goldar', e.target.value)}>
                                            <option value="">Pilih...</option>
                                            <option>A</option><option>B</option><option>AB</option><option>O</option>
                                        </select>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}>No. Handphone</label>
                                        <input className={uiStyles.formInput} placeholder="08xxxxxxxxxx" value={pasien.telepon} onChange={(e) => updatePasien('telepon', e.target.value)} />
                                    </div>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}>Alergi</label>
                                        <input className={uiStyles.formInput} placeholder="cth. Amoksisilin (kosongkan bila tidak ada)" value={pasien.alergi} onChange={(e) => updatePasien('alergi', e.target.value)} />
                                    </div>
                                </div>
                                <div className={uiStyles.formGroup}>
                                    <label className={uiStyles.formLabel}>Alamat</label>
                                    <textarea className={uiStyles.formTextarea} rows={2} value={pasien.alamat} onChange={(e) => updatePasien('alamat', e.target.value)} />
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No. RM diterbitkan otomatis oleh sistem saat disimpan.</div>
                            </>
                        )}
                    </div>

                    <div className={styles.formSection}>
                        <h3 className={styles.formSectionTitle}><Stethoscope size={18} /> Jaminan & Tujuan</h3>
                        <div className={styles.formRow3}>
                            <div className={uiStyles.formGroup}>
                                <label className={uiStyles.formLabel}>Jaminan</label>
                                <select className={uiStyles.formSelect} value={tujuan.jaminan} onChange={(e) => setTujuan((t) => ({ ...t, jaminan: e.target.value as Jaminan }))}>
                                    {JAMINAN.map((j) => <option key={j}>{j}</option>)}
                                </select>
                            </div>
                            <div className={uiStyles.formGroup}>
                                <label className={uiStyles.formLabel}>Poli Tujuan *</label>
                                <select className={uiStyles.formSelect} value={tujuan.poliId} onChange={(e) => setTujuan((t) => ({ ...t, poliId: e.target.value }))}>
                                    <option value="">Pilih Poli...</option>
                                    {POLI_RAWAT_JALAN.map((p) => <option key={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className={uiStyles.formGroup}>
                                <label className={uiStyles.formLabel}>Dokter *</label>
                                <select className={uiStyles.formSelect} value={tujuan.dokterId} onChange={(e) => setTujuan((t) => ({ ...t, dokterId: e.target.value }))}>
                                    <option value="">Pilih Dokter...</option>
                                    {doctors.filter((d) => d.status === 'aktif').map((d) => <option key={d.id} value={d.id}>{d.nama}{d.unit ? ` (${d.unit})` : ''}</option>)}
                                </select>
                            </div>
                        </div>
                        {tujuan.jaminan === 'BPJS Kesehatan' && (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                <FileText size={12} style={{ verticalAlign: 'middle' }} /> Setelah terdaftar, lanjutkan cek kepesertaan & penerbitan SEP di halaman SEP.
                            </div>
                        )}
                    </div>

                    <div className={styles.formActions}>
                        <Button variant="secondary" onClick={() => navigate('/registrasi')}>Batal</Button>
                        <Button variant="primary" onClick={handleSimpan} disabled={register.isPending}>
                            <Save size={16} /> {register.isPending ? 'Menyimpan...' : 'Simpan & Daftarkan'}
                        </Button>
                    </div>
                </>
            )}

            {ticket && (
                <div className={styles.formSection}>
                    <h3 className={styles.formSectionTitle}><CheckCircle size={18} /> Registrasi Berhasil</h3>
                    <div className={styles.sepCard}>
                        <div className={styles.sepTitle}>Pasien terdaftar — tiket antrean dibuat</div>
                        <div className={styles.sepNumber}>No. Antrean: {ticket.queueCode}</div>
                        <div style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                            {ticket.nama} (RM {ticket.rm}) — {ticket.poliId} ({ticket.dokter})
                        </div>
                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                            <Button variant="primary" onClick={() => window.print()}><Printer size={14} /> Cetak Tiket</Button>
                            {ticket.jaminan === 'BPJS Kesehatan' && (
                                <Button variant="secondary" onClick={() => navigate(`/sep?visitId=${encodeURIComponent(ticket.id)}`)}>
                                    <FileText size={14} /> Lanjut Buat SEP
                                </Button>
                            )}
                            <Button variant="secondary" onClick={() => { setTicket(null); setExisting(null); setSearch(''); setPasien(emptyPasien); }}>Registrasi Lain</Button>
                            <Button variant="ghost" onClick={() => navigate('/registrasi')}>Selesai</Button>
                        </div>
                    </div>

                    {/* Hidden on screen; @media print shows only this ticket (see .print-ticket in index.css) */}
                    <div className="print-ticket">
                        <div style={{ textAlign: 'center', fontFamily: 'monospace', color: '#000' }}>
                            <div style={{ fontSize: '14px', fontWeight: 700 }}>{publicSettings?.namaRS ?? 'SIMRS'}</div>
                            <div style={{ margin: '10px 0', padding: '8px 0', borderTop: '1px dashed #000', borderBottom: '1px dashed #000' }}>
                                <div style={{ fontSize: '11px' }}>TIKET ANTREAN</div>
                                <div style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1.1 }}>{ticket.queueCode}</div>
                            </div>
                            <div style={{ fontSize: '12px' }}>Nama: {ticket.nama}</div>
                            <div style={{ fontSize: '12px' }}>No. RM: {ticket.rm}</div>
                            <div style={{ fontSize: '12px' }}>Poli: {ticket.poliId}</div>
                            <div style={{ fontSize: '12px' }}>Dokter: {ticket.dokter}</div>
                            <div style={{ fontSize: '12px' }}>Waktu: {ticket.waktu.toLocaleString('id-ID')}</div>
                            <div style={{ fontSize: '10px', marginTop: '8px' }}>Mohon menunggu nomor antrean Anda dipanggil petugas</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
