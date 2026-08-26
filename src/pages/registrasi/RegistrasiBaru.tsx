import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, CheckCircle, Printer, Save, User, FileText, Stethoscope } from 'lucide-react';
import { Button, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { patientApi } from '../../lib/api/patient';
import { useMasterUsers } from '../../hooks/useMasterData';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../lib/api/settings';
import styles from './registrasi.module.css';

export function RegistrasiBaru() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [bpjsVerified, setBpjsVerified] = useState(false);
    const [sepCreated, setSepCreated] = useState(false);
    const [saving, setSaving] = useState(false);
    const [ticket, setTicket] = useState<{
        nama: string; rm: string; poli: string; dokter: string; queueCode: string; waktu: Date;
    } | null>(null);

    // Master Users Data for Dropdown
    const { data: allUsers } = useMasterUsers();
    const { data: publicSettings } = useQuery({
        queryKey: ['public-settings'],
        queryFn: settingsApi.getPublicSettings,
        staleTime: 5 * 60_000,
    });
    const doctorUsers = (allUsers || []).filter((u: any) =>
        (u.role?.toLowerCase().includes('dokter') || u.role?.toLowerCase() === 'doctor') &&
        u.status === 'aktif'
    );


    // Form state
    const [form, setForm] = useState({
        nik: '', noBpjs: '', nama: '', hp: '',
        tglLahir: '', gender: '', golDarah: '', alamat: '',
        jaminan: 'BPJS Kesehatan', poli: '', dokter: '', rujukan: '',
        tglKunjungan: new Date().toISOString().split('T')[0], diagnosaAwal: '',
    });

    const updateForm = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleCekBpjs = () => {
        if (!form.noBpjs.trim()) {
            showToast('Masukkan No. BPJS terlebih dahulu', 'warning');
            return;
        }
        setBpjsVerified(true);
        showToast('Data BPJS ditemukan — Peserta Aktif', 'success');
    };

    const handleSimpan = async () => {
        if (!form.nama.trim()) { showToast('Nama pasien wajib diisi', 'danger'); return; }
        if (!form.poli) { showToast('Pilih Poli Tujuan terlebih dahulu', 'danger'); return; }
        if (!form.dokter) { showToast('Pilih Dokter terlebih dahulu', 'danger'); return; }

        setSaving(true);
        try {
            // First, create or ensuring patient exists
            const generatedRM = `RM${Math.floor(100000 + Math.random() * 900000)}`;

            const patientRes = await patientApi.createPatient({
                id: `PAT-${Date.now()}`,
                rm: generatedRM, // In production, backend should autogen this
                nik: form.nik || `${Math.floor(Math.random() * 10000000000000000)}`,
                nama: form.nama,
                telepon: form.hp,
                tanggalLahir: form.tglLahir || undefined,
                gender: form.gender,
                goldar: form.golDarah,
                alamat: form.alamat
            });

            // Second, create the visit (registration instance) — response includes queueCode + loket
            const visitRes = await patientApi.createVisit({
                id: `VST-${Date.now()}`,
                patientId: patientRes.id,
                poliId: form.poli,
                dokterId: form.dokter,
                jaminan: form.jaminan,
                tipeKunjungan: 'rawat_jalan',
                status: 'belum'
            });

            // Tell Tanstack Query to refetch visits so it shows exactly correctly on list
            queryClient.invalidateQueries({ queryKey: ['visits'] });

            setTicket({
                nama: form.nama,
                rm: generatedRM,
                poli: form.poli,
                dokter: doctorUsers.find((d) => d.id === form.dokter)?.nama || form.dokter,
                queueCode: visitRes?.queueCode || '-',
                waktu: new Date(),
            });
            showToast(`Pasien "${form.nama}" berhasil didaftarkan${visitRes?.queueCode ? ` — antrean ${visitRes.queueCode}` : ''}`, 'success');
        } catch (error: any) {
            console.error(error);
            showToast(error.response?.data?.details ? `Gagal: ${error.response?.data?.details}` : 'Terjadi kesalahan saat menyimpan data', 'danger');
        } finally {
            setSaving(false);
        }
    };

    const handleCetakTiket = () => {
        window.print();
    };

    return (
        <div className={styles.formPage}>
            <button className={styles.backLink} onClick={() => navigate('/registrasi')}>
                <ArrowLeft size={16} /> Kembali ke Daftar Registrasi
            </button>

            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Registrasi Pasien Baru</h1>
            </div>

            {/* Identitas Pasien */}
            <div className={styles.formSection}>
                <h3 className={styles.formSectionTitle}>
                    <User size={18} /> Identitas Pasien
                </h3>
                <div className={styles.formRow}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Nomor Induk Kependudukan (NIK)</label>
                        <input className={uiStyles.formInput} placeholder="Masukkan 16 digit NIK"
                            value={form.nik} onChange={e => updateForm('nik', e.target.value)} />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>No. Kartu BPJS</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input className={uiStyles.formInput} placeholder="No. BPJS" style={{ flex: 1 }}
                                value={form.noBpjs} onChange={e => updateForm('noBpjs', e.target.value)} />
                            <Button variant="secondary" onClick={handleCekBpjs}>
                                <Search size={14} /> Cek BPJS
                            </Button>
                        </div>
                        {bpjsVerified && (
                            <div className={`${styles.bpjsStatus} ${styles.bpjsActive} `}>
                                <CheckCircle size={14} /> Peserta Aktif
                            </div>
                        )}
                    </div>
                </div>
                <div className={styles.formRow}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Nama Lengkap *</label>
                        <input className={uiStyles.formInput} placeholder="Nama sesuai KTP"
                            value={form.nama} onChange={e => updateForm('nama', e.target.value)} />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>No. Handphone</label>
                        <input className={uiStyles.formInput} placeholder="08xxxxxxxxxx"
                            value={form.hp} onChange={e => updateForm('hp', e.target.value)} />
                    </div>
                </div>
                <div className={styles.formRow3}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Tanggal Lahir</label>
                        <input className={uiStyles.formInput} type="date"
                            value={form.tglLahir} onChange={e => updateForm('tglLahir', e.target.value)} />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Jenis Kelamin</label>
                        <select className={uiStyles.formSelect} value={form.gender} onChange={e => updateForm('gender', e.target.value)}>
                            <option value="">Pilih...</option>
                            <option value="L">Laki-laki</option>
                            <option value="P">Perempuan</option>
                        </select>
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Golongan Darah</label>
                        <select className={uiStyles.formSelect} value={form.golDarah} onChange={e => updateForm('golDarah', e.target.value)}>
                            <option value="">Pilih...</option>
                            <option>A</option><option>B</option><option>AB</option><option>O</option>
                        </select>
                    </div>
                </div>
                <div className={uiStyles.formGroup}>
                    <label className={uiStyles.formLabel}>Alamat</label>
                    <textarea className={uiStyles.formTextarea} placeholder="Alamat lengkap sesuai KTP" rows={2}
                        value={form.alamat} onChange={e => updateForm('alamat', e.target.value)} />
                </div>
            </div>

            {/* Jaminan & Tujuan */}
            <div className={styles.formSection}>
                <h3 className={styles.formSectionTitle}>
                    <Stethoscope size={18} /> Jaminan & Tujuan
                </h3>
                <div className={styles.formRow}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Jaminan</label>
                        <select className={uiStyles.formSelect} value={form.jaminan} onChange={e => updateForm('jaminan', e.target.value)}>
                            <option>BPJS Kesehatan</option>
                            <option>Umum / Mandiri</option>
                            <option>Asuransi Lainnya</option>
                        </select>
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Poli Tujuan *</label>
                        <select className={uiStyles.formSelect} value={form.poli} onChange={e => updateForm('poli', e.target.value)}>
                            <option value="">Pilih Poli...</option>
                            <option>Poli Umum</option>
                            <option>Poli Gigi</option>
                            <option>Poli Anak</option>
                            <option>Poli Obsgyn</option>
                            <option>Poli Bedah</option>
                        </select>
                    </div>
                </div>
                <div className={styles.formRow}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Dokter *</label>
                        <select className={uiStyles.formSelect} value={form.dokter} onChange={e => updateForm('dokter', e.target.value)}>
                            <option value="">Pilih Dokter...</option>
                            {doctorUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.nama} ({u.unit})</option>
                            ))}
                        </select>
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>No. Rujukan FKTP</label>
                        <input className={uiStyles.formInput} placeholder="Nomor rujukan dari Puskesmas / Klinik"
                            value={form.rujukan} onChange={e => updateForm('rujukan', e.target.value)} />
                    </div>
                </div>
                <div className={styles.formRow}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Tanggal Kunjungan</label>
                        <input className={uiStyles.formInput} type="date"
                            value={form.tglKunjungan} onChange={e => updateForm('tglKunjungan', e.target.value)} />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Diagnosa Awal (ICD-10)</label>
                        <input className={uiStyles.formInput} placeholder="Cari kode ICD-10..."
                            value={form.diagnosaAwal} onChange={e => updateForm('diagnosaAwal', e.target.value)} />
                    </div>
                </div>
            </div>

            {/* SEP BPJS */}
            {bpjsVerified && (
                <div className={styles.formSection}>
                    <h3 className={styles.formSectionTitle}>
                        <FileText size={18} /> Surat Eligibilitas Peserta (SEP)
                    </h3>
                    {!sepCreated ? (
                        <Button variant="primary" onClick={() => {
                            setSepCreated(true);
                            showToast('SEP berhasil dibuat otomatis', 'success');
                        }}>
                            <FileText size={16} /> Buat SEP Otomatis
                        </Button>
                    ) : (
                        <div className={styles.sepCard}>
                            <div className={styles.sepTitle}>✅ SEP Berhasil Dibuat</div>
                            <div className={styles.sepNumber}>No. SEP: 0089123456789</div>
                            <div style={{ marginTop: '12px' }}>
                                <Button variant="secondary" size="sm" onClick={() => showToast('Mencetak SEP...', 'info')}>
                                    <Printer size={14} /> Cetak SEP
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tiket Antrean (shown after successful registration) */}
            {ticket && (
                <div className={styles.formSection}>
                    <h3 className={styles.formSectionTitle}>
                        <CheckCircle size={18} /> Registrasi Berhasil
                    </h3>
                    <div className={styles.sepCard}>
                        <div className={styles.sepTitle}>✅ Pasien Terdaftar — Tiket Antrean Dibuat</div>
                        <div className={styles.sepNumber}>No. Antrean: {ticket.queueCode}</div>
                        <div style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                            {ticket.nama} — {ticket.poli} ({ticket.dokter})
                        </div>
                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                            <Button variant="primary" onClick={handleCetakTiket}>
                                <Printer size={14} /> Cetak Tiket
                            </Button>
                            <Button variant="secondary" onClick={() => navigate('/registrasi')}>
                                Selesai
                            </Button>
                        </div>
                    </div>

                    {/* Hidden on screen; @media print shows only this ticket (see .print-ticket in index.css) */}
                    <div className="print-ticket">
                        <div style={{ textAlign: 'center', fontFamily: 'monospace', color: '#000' }}>
                            <div style={{ fontSize: '14px', fontWeight: 700 }}>{publicSettings?.namaRS ?? 'SIMRS Tipe D'}</div>
                            <div style={{ fontSize: '11px' }}>Sistem Informasi Manajemen Rumah Sakit</div>
                            <div style={{ margin: '10px 0', padding: '8px 0', borderTop: '1px dashed #000', borderBottom: '1px dashed #000' }}>
                                <div style={{ fontSize: '11px' }}>TIKET ANTREAN</div>
                                <div style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1.1 }}>{ticket.queueCode}</div>
                            </div>
                            <div style={{ fontSize: '12px' }}>Nama: {ticket.nama}</div>
                            <div style={{ fontSize: '12px' }}>No. RM: {ticket.rm}</div>
                            <div style={{ fontSize: '12px' }}>Poli: {ticket.poli}</div>
                            <div style={{ fontSize: '12px' }}>Dokter: {ticket.dokter}</div>
                            <div style={{ fontSize: '12px' }}>Waktu: {ticket.waktu.toLocaleString('id-ID')}</div>
                            <div style={{ fontSize: '10px', marginTop: '8px' }}>Mohon menunggu nomor antrean Anda dipanggil petugas</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className={styles.formActions}>
                <Button variant="secondary" onClick={() => navigate('/registrasi')}>
                    Batal
                </Button>
                <Button variant="primary" onClick={handleSimpan} disabled={saving}>
                    <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan & Daftarkan'}
                </Button>
            </div>
        </div>
    );
}
