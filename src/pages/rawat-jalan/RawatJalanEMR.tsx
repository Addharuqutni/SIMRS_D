import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, FlaskConical, ScanLine, Save, CheckCircle, X, TriangleAlert, Activity, Clock, Sparkles, AlertOctagon } from 'lucide-react';
import { Button, showToast, uiStyles } from '../../components/ui';
import { useEmrSoap, useSaveEmrSoap, useUpdateRawatJalanStatus, useCreatePrescription, useCreateOrder, useIcd10Search, useIcd9Search, useClinicalMedicines, useVitalSigns, useSaveVitalSigns, useProgressNotes, useSaveProgressNote, useIcdSuggest, useCheckDdi } from '../../hooks/useClinical';
import { useSession } from '../../lib/auth-client';
import styles from './rawat-jalan.module.css';

const soapSections = [
    { key: 'subjektif', label: 'S — Subjektif' },
    { key: 'objektif', label: 'O — Objektif' },
    { key: 'assessment', label: 'A — Assessment' },
    { key: 'plan', label: 'P — Plan' },
    { key: 'cppt', label: 'CPPT Timeline' },
    { key: 'riwayat', label: 'Riwayat' },
];

const prescriptions: { obat: string; dosis: string; jumlah: string; keterangan: string }[] = [];

const history: { date: string; diagnosa: string; dokter: string; tindakan: string; obat: string }[] = [];

export function RawatJalanEMR() {
    const navigate = useNavigate();
    const location = useLocation();
    const { data: session } = useSession();

    // Patient context passed from list view
    const patient = location.state as any;
    const visitId = patient?.id;
    const currentUserId = session?.user?.id || patient?.dokterId || '';

    const [activeTab, setActiveTab] = useState('subjektif');
    const [meds, setMeds] = useState(prescriptions);
    const [soapForm, setSoapForm] = useState({ subjektif: '', objektif: '', asesmen: '', planning: '' });

    // ===== VITAL SIGNS (stateful — replaces hardcoded defaultValue) =====
    const [vitals, setVitals] = useState({
        sistolik: '' as string | number,
        diastolik: '' as string | number,
        nadi: '' as string | number,
        suhu: '' as string | number,
        pernapasan: '' as string | number,
        spo2: '' as string | number,
        beratBadan: '' as string | number,
        tinggiBadan: '' as string | number,
        gcs: 15 as string | number,
        catatan: '',
    });
    const { data: vitalsTimeline = [] } = useVitalSigns(visitId);
    const saveVitals = useSaveVitalSigns();

    // Latest MEWS score from the most recent vital signs record
    const latestVitals = vitalsTimeline[0];
    const latestMews = latestVitals?.mews;

    // ===== CPPT (progress notes timeline) =====
    const [cpptForm, setCpptForm] = useState({ subjektif: '', objektif: '', asesmen: '', planning: '' });
    const { data: progressNotes = [] } = useProgressNotes(visitId);
    const saveProgressNote = useSaveProgressNote();

    // ICD-10 diagnosis picker state
    const [icdQuery, setIcdQuery] = useState('');
    const [icdCodes, setIcdCodes] = useState<string[]>([]);

    // ICD-9-CM procedure picker state
    const [icd9Query, setIcd9Query] = useState('');
    const [icd9Codes, setIcd9Codes] = useState<string[]>([]);

    // CDSS: ICD-10 auto-suggest from SOAP text + DDI check
    const { data: icdSuggestions } = useIcdSuggest(`${soapForm.subjektif} ${soapForm.objektif} ${soapForm.asesmen}`);
    const checkDdi = useCheckDdi();
    const [ddiAlerts, setDdiAlerts] = useState<Array<{ severity: string; drugA: string; drugB: string; description: string; recommendation: string }>>([]);

    const { data: soapData, isLoading } = useEmrSoap(visitId);
    const saveSoap = useSaveEmrSoap();
    const savePrescription = useCreatePrescription();
    const createOrder = useCreateOrder();
    const updateVisitStatus = useUpdateRawatJalanStatus();
    const { data: icdResults = [] } = useIcd10Search(icdQuery);
    const { data: icd9Results = [] } = useIcd9Search(icd9Query);
    const { data: medicineOptions = [] } = useClinicalMedicines();

    // Allergy info travels with the visit row from the list page (patients.alergi)
    const patientAlergi = (patient?.alergi || '').trim();

    useEffect(() => {
        if (soapData) {
            setSoapForm({
                subjektif: soapData.subjektif || '',
                objektif: soapData.objektif || '',
                asesmen: soapData.asesmen || '',
                planning: soapData.planning || ''
            });
            setIcdCodes(Array.isArray(soapData.icd10Codes) ? soapData.icd10Codes : []);
            setIcd9Codes(Array.isArray(soapData.icd9Codes) ? soapData.icd9Codes : []);
        }
    }, [soapData]);

    const addIcdCode = (code: string) => {
        if (!icdCodes.includes(code)) {
            setIcdCodes([...icdCodes, code]);
        }
        setIcdQuery('');
    };

    const removeIcdCode = (code: string) => {
        setIcdCodes(icdCodes.filter(c => c !== code));
    };

    const addIcd9Code = (code: string) => {
        if (!icd9Codes.includes(code)) {
            setIcd9Codes([...icd9Codes, code]);
        }
        setIcd9Query('');
    };

    const removeIcd9Code = (code: string) => {
        setIcd9Codes(icd9Codes.filter(c => c !== code));
    };

    const addMed = () => {
        setMeds([...meds, { obat: '', dosis: '', jumlah: '', keterangan: '' }]);
    };

    const handleSaveDraft = async () => {
        if (!visitId) return;
        try {
            await saveSoap.mutateAsync({ visitId, dokterId: patient.dokterId, ...soapForm, icd10Codes: icdCodes, icd9Codes });
            showToast('Draft SOAP berhasil tersimpan', 'success');
        } catch {
            showToast('Gagal menyimpan draft SOAP', 'danger');
        }
    };

    const handleSelesai = async () => {
        if (!visitId) return;
        try {
            await saveSoap.mutateAsync({ visitId, dokterId: patient.dokterId, ...soapForm, icd10Codes: icdCodes, icd9Codes });

            // Only send if there are items with filled data
            const validMeds = meds.filter(m => m.obat && m.dosis);
            if (validMeds.length > 0) {
                // Soft warning if any prescribed medicine is out of stock (order still goes through — stock may arrive later)
                const habis = validMeds.filter(m => medicineOptions.some(o => String(o.id) === m.obat && o.stok <= 0));
                if (habis.length > 0) {
                    showToast('Perhatian: resep mengandung obat dengan stok habis — tetap dikirim ke Farmasi', 'warning');
                }

                await savePrescription.mutateAsync({
                    visitId,
                    dokterId: patient.dokterId,
                    items: validMeds.map(m => ({
                        obatId: m.obat,
                        dosis: m.dosis,
                        jumlah: Number(m.jumlah) || 1,
                        keterangan: m.keterangan || ''
                    }))
                });
            }

            await updateVisitStatus.mutateAsync({ id: visitId, status: 'selesai' });
            showToast('Pemeriksaan selesai — data dikirim ke Farmasi & Billing', 'success');
            navigate('/rawat-jalan');
        } catch {
            showToast('Gagal menyelesaikan pemeriksaan', 'danger');
        }
    };

    const handleOrder = async (type: 'lab' | 'radiology', jenisPemeriksaan: string) => {
        if (!visitId) return;
        try {
            await createOrder.mutateAsync({
                type,
                data: {
                    visitId,
                    dokterId: patient.dokterId,
                    jenisPemeriksaan,
                    catatan: 'Order dari EMR'
                }
            });
            showToast(`Order ${type === 'lab' ? 'laboratorium' : 'radiologi'} dikirim`, 'info');
        } catch {
            showToast(`Gagal order ${type}`, 'danger');
        }
    };

    // ===== VITAL SIGNS SAVE — auto-computes MEWS on server, creates critical notification =====
    const handleSaveVitals = async () => {
        if (!visitId || !currentUserId) return;
        const hasAny = Object.values(vitals).some(v => v !== '' && v !== 15 && typeof v !== 'string');
        if (!hasAny) {
            showToast('Isi minimal satu tanda vital sebelum menyimpan', 'warning');
            return;
        }
        try {
            await saveVitals.mutateAsync({
                visitId,
                recordedBy: currentUserId,
                sistolik: vitals.sistolik === '' ? undefined : Number(vitals.sistolik),
                diastolik: vitals.diastolik === '' ? undefined : Number(vitals.diastolik),
                nadi: vitals.nadi === '' ? undefined : Number(vitals.nadi),
                suhu: vitals.suhu === '' ? undefined : Number(vitals.suhu),
                pernapasan: vitals.pernapasan === '' ? undefined : Number(vitals.pernapasan),
                spo2: vitals.spo2 === '' ? undefined : Number(vitals.spo2),
                beratBadan: vitals.beratBadan === '' ? undefined : Number(vitals.beratBadan),
                tinggiBadan: vitals.tinggiBadan === '' ? undefined : Number(vitals.tinggiBadan),
                gcs: vitals.gcs === '' ? undefined : Number(vitals.gcs),
                catatan: vitals.catatan || undefined,
                penyelenggara: 'Dokter',
            });
            showToast('Tanda vital tersimpan. MEWS dihitung otomatis.', 'success');
            // Reset form fields after successful save
            setVitals({ sistolik: '', diastolik: '', nadi: '', suhu: '', pernapasan: '', spo2: '', beratBadan: '', tinggiBadan: '', gcs: 15, catatan: '' });
        } catch (err: any) {
            const msg = err?.response?.data?.issues?.[0]?.message || 'Gagal menyimpan tanda vital';
            showToast(msg, 'danger');
        }
    };

    // ===== CPPT — save new progress note to the longitudinal timeline =====
    const handleSaveProgressNote = async () => {
        if (!visitId || !currentUserId) return;
        if (!cpptForm.subjektif && !cpptForm.objektif && !cpptForm.asesmen && !cpptForm.planning) {
            showToast('Isi minimal satu bagian catatan perkembangan', 'warning');
            return;
        }
        try {
            await saveProgressNote.mutateAsync({
                visitId,
                authorId: currentUserId,
                authorRole: 'Dokter',
                subjektif: cpptForm.subjektif || undefined,
                objektif: cpptForm.objektif || undefined,
                asesmen: cpptForm.asesmen || undefined,
                planning: cpptForm.planning || undefined,
                icd10Codes: [],
                icd9Codes: [],
            });
            showToast('Catatan perkembangan (CPPT) tersimpan', 'success');
            setCpptForm({ subjektif: '', objektif: '', asesmen: '', planning: '' });
        } catch {
            showToast('Gagal menyimpan catatan CPPT', 'danger');
        }
    };

    // CDSS: Check drug-drug interactions among currently prescribed meds
    const handleCheckDdi = async () => {
        const validMeds = meds.filter(m => m.obat);
        if (validMeds.length < 2) {
            showToast('Minimal 2 obat diperlukan untuk cek interaksi', 'info');
            return;
        }
        const names = validMeds
            .map(m => medicineOptions.find(o => String(o.id) === m.obat)?.nama)
            .filter(Boolean) as string[];
        if (names.length < 2) {
            showToast('Pilih obat dari daftar terlebih dahulu', 'warning');
            return;
        }
        try {
            const result = await checkDdi.mutateAsync(names);
            setDdiAlerts(result.alerts);
            if (result.alerts.length === 0) {
                showToast('Tidak ada interaksi obat signifikan terdeteksi', 'success');
            } else {
                showToast(`${result.alerts.length} interaksi obat terdeteksi — tinjau alert`, 'warning');
            }
        } catch {
            showToast('Gagal memeriksa interaksi obat', 'danger');
        }
    };

    if (!patient) {
        return (
            <div className={styles.page}>
                <div style={{ textAlign: 'center', marginTop: '100px' }}>
                    <p>Data Kunjungan tidak ditemukan. Harap kembali ke daftar.</p>
                    <Button variant="primary" onClick={() => navigate('/rawat-jalan')}>Kembali</Button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.emr}>
            <button className={styles.backLink} onClick={() => navigate('/rawat-jalan')} style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px',
                background: 'none', border: 'none', cursor: 'pointer',
            }}>
                <ArrowLeft size={16} /> Kembali ke Daftar Rawat Jalan
            </button>

            {/* Patient Info Bar */}
            <div className={styles.patientBar}>
                <div className={styles.patientAvatar}>{patient.nama.substring(0, 2).toUpperCase()}</div>
                <div>
                    <div className={styles.patientName}>{patient.nama}</div>
                    <div className={styles.patientMeta}>
                        <span className={styles.patientTag}>📋 RM: {patient.rm}</span>
                        <span className={styles.patientTag}>🩺 Poli: {patient.poli}</span>
                        <span className={styles.patientTag}>👨‍⚕️ {patient.dokter}</span>
                    </div>
                </div>
            </div>

            {/* Persistent allergy warning banner */}
            {patientAlergi && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 16px', marginBottom: '16px',
                    background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.35)',
                    borderLeft: '4px solid var(--danger, #dc2626)', borderRadius: 'var(--radius-md, 8px)',
                    color: 'var(--danger, #dc2626)',
                }}>
                    <TriangleAlert size={18} style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                        <strong style={{ display: 'block' }}>Alergi pasien — periksa sebelum meresepkan!</strong>
                        <span>{patientAlergi}</span>
                    </div>
                </div>
            )}

            {isLoading && <div style={{ padding: '20px', textAlign: 'center' }}>Memuat riwayat medis...</div>}

            {/* SOAP Tabs */}
            <div className={styles.soapTabs}>
                {soapSections.map((s) => (
                    <button
                        key={s.key}
                        className={`${styles.soapTab} ${activeTab === s.key ? styles.active : ''}`}
                        onClick={() => setActiveTab(s.key)}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Tab Contents */}
            {activeTab === 'subjektif' && (
                <div className={styles.soapContent}>
                    <h3 className={styles.soapSectionTitle}>Catatan Subjektif (S)</h3>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Keluhan & Riwayat Penyakit (Anamnesis)</label>
                        <textarea
                            className={uiStyles.formTextarea}
                            rows={8}
                            value={soapForm.subjektif}
                            onChange={(e) => setSoapForm({ ...soapForm, subjektif: e.target.value })}
                            placeholder="Tuliskan keluhan utama dan riwayat penyakit pasien secara mendetail..."
                        />
                    </div>
                </div>
            )}

            {activeTab === 'objektif' && (
                <div className={styles.soapContent}>
                    <h3 className={styles.soapSectionTitle}>Pemeriksaan Fisik (Objektif)</h3>

                    {/* MEWS Early Warning Score Badge — auto-updates from latest vital signs */}
                    {latestMews && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 16px', marginBottom: '16px',
                            background: latestMews.level === 'danger' ? 'rgba(220, 38, 38, 0.1)'
                                : latestMews.level === 'warn' ? 'rgba(245, 158, 11, 0.1)'
                                : latestMews.level === 'watch' ? 'rgba(59, 130, 246, 0.1)'
                                : 'rgba(34, 197, 94, 0.1)',
                            border: `1px solid ${latestMews.level === 'danger' ? 'rgba(220, 38, 38, 0.4)'
                                : latestMews.level === 'warn' ? 'rgba(245, 158, 11, 0.4)'
                                : latestMews.level === 'watch' ? 'rgba(59, 130, 246, 0.4)'
                                : 'rgba(34, 197, 94, 0.4)'}`,
                            borderRadius: 'var(--radius-md, 8px)',
                        }}>
                            <Activity size={20} style={{
                                color: latestMews.level === 'danger' ? '#dc2626'
                                    : latestMews.level === 'warn' ? '#f59e0b'
                                    : latestMews.level === 'watch' ? '#3b82f6'
                                    : '#22c55e'
                            }} />
                            <div style={{ flex: 1 }}>
                                <strong style={{ display: 'block', fontSize: '14px' }}>
                                    MEWS Score: {latestVitals.mewsScore} — {latestMews.level.toUpperCase()}
                                </strong>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{latestMews.action}</span>
                            </div>
                        </div>
                    )}

                    <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Tanda Vital (input numerik untuk akurasi MEWS)</h4>
                    <div className={styles.vitalsGrid}>
                        <div className={styles.vitalItem}>
                            <span className={styles.vitalLabel}>Sistolik</span>
                            <input className={styles.vitalInput} type="number" inputMode="numeric" placeholder="120"
                                value={vitals.sistolik}
                                onChange={(e) => setVitals({ ...vitals, sistolik: e.target.value })} />
                            <span className={styles.vitalUnit}>mmHg</span>
                        </div>
                        <div className={styles.vitalItem}>
                            <span className={styles.vitalLabel}>Diastolik</span>
                            <input className={styles.vitalInput} type="number" inputMode="numeric" placeholder="80"
                                value={vitals.diastolik}
                                onChange={(e) => setVitals({ ...vitals, diastolik: e.target.value })} />
                            <span className={styles.vitalUnit}>mmHg</span>
                        </div>
                        <div className={styles.vitalItem}>
                            <span className={styles.vitalLabel}>Nadi</span>
                            <input className={styles.vitalInput} type="number" inputMode="numeric" placeholder="80"
                                value={vitals.nadi}
                                onChange={(e) => setVitals({ ...vitals, nadi: e.target.value })} />
                            <span className={styles.vitalUnit}>x/menit</span>
                        </div>
                        <div className={styles.vitalItem}>
                            <span className={styles.vitalLabel}>Suhu</span>
                            <input className={styles.vitalInput} type="number" step="0.1" inputMode="decimal" placeholder="36.5"
                                value={vitals.suhu}
                                onChange={(e) => setVitals({ ...vitals, suhu: e.target.value })} />
                            <span className={styles.vitalUnit}>°C</span>
                        </div>
                        <div className={styles.vitalItem}>
                            <span className={styles.vitalLabel}>Resp. Rate</span>
                            <input className={styles.vitalInput} type="number" inputMode="numeric" placeholder="16"
                                value={vitals.pernapasan}
                                onChange={(e) => setVitals({ ...vitals, pernapasan: e.target.value })} />
                            <span className={styles.vitalUnit}>x/menit</span>
                        </div>
                        <div className={styles.vitalItem}>
                            <span className={styles.vitalLabel}>SpO2</span>
                            <input className={styles.vitalInput} type="number" inputMode="numeric" placeholder="98"
                                value={vitals.spo2}
                                onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })} />
                            <span className={styles.vitalUnit}>%</span>
                        </div>
                        <div className={styles.vitalItem}>
                            <span className={styles.vitalLabel}>GCS</span>
                            <input className={styles.vitalInput} type="number" min={3} max={15} placeholder="15"
                                value={vitals.gcs}
                                onChange={(e) => setVitals({ ...vitals, gcs: e.target.value })} />
                            <span className={styles.vitalUnit}>3-15</span>
                        </div>
                        <div className={styles.vitalItem}>
                            <span className={styles.vitalLabel}>Berat Badan</span>
                            <input className={styles.vitalInput} type="number" step="0.1" inputMode="decimal" placeholder="60"
                                value={vitals.beratBadan}
                                onChange={(e) => setVitals({ ...vitals, beratBadan: e.target.value })} />
                            <span className={styles.vitalUnit}>kg</span>
                        </div>
                        <div className={styles.vitalItem}>
                            <span className={styles.vitalLabel}>Tinggi Badan</span>
                            <input className={styles.vitalInput} type="number" inputMode="numeric" placeholder="160"
                                value={vitals.tinggiBadan}
                                onChange={(e) => setVitals({ ...vitals, tinggiBadan: e.target.value })} />
                            <span className={styles.vitalUnit}>cm</span>
                        </div>
                    </div>
                    <div className={uiStyles.formGroup} style={{ marginTop: '12px' }}>
                        <label className={uiStyles.formLabel}>Catatan Tanda Vital (opsional)</label>
                        <input className={uiStyles.formInput} placeholder="Mis: Pasien tampak sesak napas"
                            value={vitals.catatan}
                            onChange={(e) => setVitals({ ...vitals, catatan: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <Button variant="primary" onClick={handleSaveVitals} disabled={saveVitals.isPending}>
                            <Save size={16} /> {saveVitals.isPending ? 'Menyimpan...' : 'Simpan Tanda Vital'}
                        </Button>
                    </div>

                    {/* Vital Signs Timeline — trending chart for deterioration detection */}
                    {vitalsTimeline.length > 0 && (
                        <div style={{ marginTop: '24px' }}>
                            <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={14} /> Riwayat Tanda Vital ({vitalsTimeline.length} catatan)
                            </h4>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                                            <th style={{ padding: '8px' }}>Waktu</th>
                                            <th style={{ padding: '8px' }}>Pencatat</th>
                                            <th style={{ padding: '8px' }}>TD</th>
                                            <th style={{ padding: '8px' }}>N</th>
                                            <th style={{ padding: '8px' }}>S</th>
                                            <th style={{ padding: '8px' }}>RR</th>
                                            <th style={{ padding: '8px' }}>SpO2</th>
                                            <th style={{ padding: '8px' }}>GCS</th>
                                            <th style={{ padding: '8px' }}>MEWS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {vitalsTimeline.map((v) => {
                                            const mewsColor = v.mews?.level === 'danger' ? '#dc2626'
                                                : v.mews?.level === 'warn' ? '#f59e0b'
                                                : v.mews?.level === 'watch' ? '#3b82f6'
                                                : '#22c55e';
                                            return (
                                                <tr key={v.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                    <td style={{ padding: '8px' }}>{new Date(v.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                                                    <td style={{ padding: '8px' }}>{v.recorderName || '-'}</td>
                                                    <td style={{ padding: '8px' }}>{v.sistolik || '-'}/{v.diastolik || '-'}</td>
                                                    <td style={{ padding: '8px' }}>{v.nadi ?? '-'}</td>
                                                    <td style={{ padding: '8px' }}>{v.suhu ?? '-'}</td>
                                                    <td style={{ padding: '8px' }}>{v.pernapasan ?? '-'}</td>
                                                    <td style={{ padding: '8px' }}>{v.spo2 ?? '-'}</td>
                                                    <td style={{ padding: '8px' }}>{v.gcs ?? '-'}</td>
                                                    <td style={{ padding: '8px' }}>
                                                        <span style={{ fontWeight: 700, color: mewsColor }}>{v.mewsScore ?? '-'}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className={uiStyles.formGroup} style={{ marginTop: '20px' }}>
                        <label className={uiStyles.formLabel}>Catatan Pemeriksaan Fisik Terstruktur (O)</label>
                        <textarea
                            className={uiStyles.formTextarea}
                            rows={6}
                            value={soapForm.objektif}
                            onChange={(e) => setSoapForm({ ...soapForm, objektif: e.target.value })}
                            placeholder="Hasil pemeriksaan klinis objektif..."
                        />
                    </div>
                </div>
            )}

            {activeTab === 'assessment' && (
                <div className={styles.soapContent}>
                    <h3 className={styles.soapSectionTitle}>Diagnosa (Assessment - A)</h3>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Kesimpulan Diagnosa (ICD-10)</label>
                        <textarea
                            className={uiStyles.formTextarea}
                            rows={6}
                            value={soapForm.asesmen}
                            onChange={(e) => setSoapForm({ ...soapForm, asesmen: e.target.value })}
                            placeholder="Tuliskan diagnosa medis utama dan sekunder..."
                        />
                    </div>

                    <div className={uiStyles.formGroup} style={{ position: 'relative' }}>
                        <label className={uiStyles.formLabel}>Kode Diagnosa ICD-10</label>
                        <input
                            className={uiStyles.formInput}
                            value={icdQuery}
                            onChange={(e) => setIcdQuery(e.target.value)}
                            placeholder="Cari kode / deskripsi diagnosa (min. 2 karakter)..."
                        />
                        {icdQuery.trim().length >= 2 && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                                background: 'var(--bg-card, #fff)', border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md, 8px)', marginTop: '4px',
                                maxHeight: '240px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            }}>
                                {icdResults.length === 0 ? (
                                    <div style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                        Kode ICD-10 tidak ditemukan
                                    </div>
                                ) : icdResults.map((icd) => (
                                    <button
                                        key={icd.code}
                                        type="button"
                                        onClick={() => addIcdCode(icd.code)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                                            padding: '10px 14px', background: 'none', border: 'none',
                                            borderBottom: '1px solid var(--border-light)', cursor: 'pointer',
                                            textAlign: 'left', fontSize: '13px',
                                        }}
                                    >
                                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary)' }}>{icd.code}</span>
                                        <span style={{ color: 'var(--text-secondary)' }}>{icd.description}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {icdCodes.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                                {icdCodes.map((code) => (
                                    <span key={code} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                                        fontFamily: 'var(--font-mono)', background: 'var(--primary)', color: '#fff',
                                    }}>
                                        {code}
                                        <button
                                            type="button"
                                            onClick={() => removeIcdCode(code)}
                                            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'inline-flex', padding: 0, opacity: 0.85 }}
                                            aria-label={`Hapus kode ${code}`}
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* CDSS: ICD-10 auto-suggest from SOAP text */}
                    {icdSuggestions?.suggestions && icdSuggestions.suggestions.length > 0 && (
                        <div style={{
                            marginTop: '16px', padding: '12px 16px',
                            background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.25)',
                            borderRadius: 'var(--radius-md, 8px)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                <Sparkles size={14} style={{ color: '#6366f1' }} />
                                <strong style={{ fontSize: '13px', color: '#6366f1' }}>CDSS — Saran ICD-10 dari teks SOAP</strong>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {icdSuggestions.suggestions.map((s) => (
                                    <button
                                        key={s.code}
                                        type="button"
                                        onClick={() => {
                                            if (!icdCodes.includes(s.code)) {
                                                setIcdCodes([...icdCodes, s.code]);
                                                showToast(`ICD-10 ${s.code} ditambahkan`, 'success');
                                            }
                                        }}
                                        style={{
                                            padding: '6px 10px', background: 'var(--bg-card, #fff)',
                                            border: '1px solid var(--border)', borderRadius: 'var(--radius-full, 999px)',
                                            fontSize: '12px', cursor: 'pointer',
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        }}
                                        title={`Match: ${s.matchedKeywords.join(', ')} • ${s.description}`}
                                    >
                                        <strong>{s.code}</strong>
                                        <span style={{ color: 'var(--text-secondary)' }}>{s.description.slice(0, 30)}</span>
                                        <span style={{ fontSize: '10px', color: '#6366f1' }}>{Math.round(s.confidence * 100)}%</span>
                                    </button>
                                ))}
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                                Saran otomatis berdasarkan kata kunci klinis di teks S/O/A. Klik untuk menambahkan ke diagnosa.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'plan' && (
                <div className={styles.soapContent}>
                    <h3 className={styles.soapSectionTitle}>Tindakan & Resep (Plan - P)</h3>
                    <div className={uiStyles.formGroup} style={{ marginBottom: '20px' }}>
                        <label className={uiStyles.formLabel}>Catatan Perencanaan dan Prosedur</label>
                        <textarea
                            className={uiStyles.formTextarea}
                            rows={4}
                            value={soapForm.planning}
                            onChange={(e) => setSoapForm({ ...soapForm, planning: e.target.value })}
                            placeholder="Rencana tindakan, observasi, edukasi, atau instruksi selanjutnya..."
                        />
                    </div>

                    <div className={uiStyles.formGroup} style={{ position: 'relative', marginBottom: '20px' }}>
                        <label className={uiStyles.formLabel}>Tindakan/Prosedur (ICD-9)</label>
                        <input
                            className={uiStyles.formInput}
                            value={icd9Query}
                            onChange={(e) => setIcd9Query(e.target.value)}
                            placeholder="Cari kode / deskripsi tindakan (min. 2 karakter)..."
                        />
                        {icd9Query.trim().length >= 2 && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                                background: 'var(--bg-card, #fff)', border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md, 8px)', marginTop: '4px',
                                maxHeight: '240px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            }}>
                                {icd9Results.length === 0 ? (
                                    <div style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                        Kode ICD-9 tidak ditemukan
                                    </div>
                                ) : icd9Results.map((icd) => (
                                    <button
                                        key={icd.code}
                                        type="button"
                                        onClick={() => addIcd9Code(icd.code)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                                            padding: '10px 14px', background: 'none', border: 'none',
                                            borderBottom: '1px solid var(--border-light)', cursor: 'pointer',
                                            textAlign: 'left', fontSize: '13px',
                                        }}
                                    >
                                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary)' }}>{icd.code}</span>
                                        <span style={{ color: 'var(--text-secondary)' }}>{icd.description}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {icd9Codes.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                                {icd9Codes.map((code) => (
                                    <span key={code} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                                        fontFamily: 'var(--font-mono)', background: 'var(--primary)', color: '#fff',
                                    }}>
                                        {code}
                                        <button
                                            type="button"
                                            onClick={() => removeIcd9Code(code)}
                                            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'inline-flex', padding: 0, opacity: 0.85 }}
                                            aria-label={`Hapus tindakan ${code}`}
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📝 E-Resep (Simulasi)
                    </h4>

                    <table className={styles.prescriptionTable}>
                        <thead>
                            <tr>
                                <th style={{ width: '35%' }}>Nama Obat</th>
                                <th style={{ width: '15%' }}>Dosis</th>
                                <th style={{ width: '12%' }}>Jumlah</th>
                                <th style={{ width: '30%' }}>Keterangan</th>
                                <th style={{ width: '8%' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {meds.map((med, i) => (
                                <tr key={i}>
                                    <td>
                                        <select
                                            className={uiStyles.formSelect}
                                            value={med.obat}
                                            onChange={(e) => {
                                                const newMeds = [...meds];
                                                newMeds[i].obat = e.target.value;
                                                setMeds(newMeds);
                                            }}
                                        >
                                            <option value="">Pilih Obat...</option>
                                            {medicineOptions.map((m) => (
                                                <option key={m.id} value={String(m.id)}>
                                                    {m.nama} ({m.kodeObat}){m.stok <= 0 ? ' — Stok habis' : ` — stok: ${m.stok}`}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <input
                                            value={med.dosis}
                                            onChange={(e) => {
                                                const newMeds = [...meds];
                                                newMeds[i].dosis = e.target.value;
                                                setMeds(newMeds);
                                            }}
                                            placeholder="3x1"
                                        />
                                    </td>
                                    <td>
                                        <input
                                            value={med.jumlah}
                                            onChange={(e) => {
                                                const newMeds = [...meds];
                                                newMeds[i].jumlah = e.target.value;
                                                setMeds(newMeds);
                                            }}
                                            placeholder="10"
                                        />
                                    </td>
                                    <td>
                                        <input
                                            value={med.keterangan}
                                            onChange={(e) => {
                                                const newMeds = [...meds];
                                                newMeds[i].keterangan = e.target.value;
                                                setMeds(newMeds);
                                            }}
                                            placeholder="Keterangan..."
                                        />
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => setMeds(meds.filter((_, j) => j !== i))}
                                            style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                                        >
                                            ×
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button onClick={addMed} style={{
                        display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px',
                        fontSize: '13px', color: 'var(--primary)', background: 'none', border: 'none',
                        cursor: 'pointer', fontWeight: 500,
                    }}>
                        <Plus size={14} /> Tambah Obat
                    </button>

                    {/* CDSS: Drug-Drug Interaction Check */}
                    <div style={{ marginTop: '16px' }}>
                        <Button variant="secondary" size="sm" onClick={handleCheckDdi} disabled={checkDdi.isPending}>
                            <AlertOctagon size={14} /> {checkDdi.isPending ? 'Memeriksa...' : 'Cek Interaksi Obat (DDI)'}
                        </Button>
                        {ddiAlerts.length > 0 && (
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {ddiAlerts.map((a, i) => {
                                    const sevColor = a.severity === 'contraindicated' ? '#dc2626'
                                        : a.severity === 'major' ? '#ea580c'
                                        : a.severity === 'moderate' ? '#f59e0b'
                                        : '#6b7280';
                                    return (
                                        <div key={i} style={{
                                            padding: '10px 14px',
                                            background: `${sevColor}10`, border: `1px solid ${sevColor}40`,
                                            borderLeft: `4px solid ${sevColor}`, borderRadius: 'var(--radius-md, 8px)',
                                            fontSize: '12px',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                <AlertOctagon size={14} style={{ color: sevColor }} />
                                                <strong style={{ color: sevColor, textTransform: 'uppercase' }}>{a.severity}</strong>
                                                <span>— {a.drugA} + {a.drugB}</span>
                                            </div>
                                            <div style={{ color: 'var(--text)' }}>{a.description}</div>
                                            <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                <strong>Rekomendasi:</strong> {a.recommendation}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className={styles.orderBtns}>
                        <Button variant="secondary" onClick={() => handleOrder('lab', 'Darah Lengkap')}>
                            <FlaskConical size={14} /> Order Lab (Darah Lengkap)
                        </Button>
                        <Button variant="secondary" onClick={() => handleOrder('radiology', 'Rontgen Thorax')}>
                            <ScanLine size={14} /> Order Radiologi (Thorax)
                        </Button>
                    </div>
                </div>
            )}

            {activeTab === 'cppt' && (
                <div className={styles.soapContent}>
                    <h3 className={styles.soapSectionTitle}>CPPT — Catatan Perkembangan Pasien Terintegrasi</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Setiap catatan perkembangan terdokumentasi secara longitudinal (akreditasi KARS). Dokter & perawat dapat menambahkan catatan kapan saja.
                    </p>

                    {/* Form tambah CPPT baru */}
                    <div style={{ background: 'var(--bg, #f9fafb)', padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light)', marginBottom: '20px' }}>
                        <strong style={{ display: 'block', fontSize: '13px', marginBottom: '12px' }}>Tambah Catatan Perkembangan</strong>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Subjektif</label>
                            <textarea className={uiStyles.formTextarea} rows={2} value={cpptForm.subjektif}
                                onChange={(e) => setCpptForm({ ...cpptForm, subjektif: e.target.value })}
                                placeholder="Keluhan terkini / perkembangan kondisi pasien..." />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Objektif</label>
                            <textarea className={uiStyles.formTextarea} rows={2} value={cpptForm.objektif}
                                onChange={(e) => setCpptForm({ ...cpptForm, objektif: e.target.value })}
                                placeholder="Hasil pemeriksaan fisik / tanda vital terkini..." />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Asesmen</label>
                            <textarea className={uiStyles.formTextarea} rows={2} value={cpptForm.asesmen}
                                onChange={(e) => setCpptForm({ ...cpptForm, asesmen: e.target.value })}
                                placeholder="Kesimpulan kondisi pasien / diagnosa kerja..." />
                        </div>
                        <div className={uiStyles.formGroup}>
                            <label className={uiStyles.formLabel}>Planning</label>
                            <textarea className={uiStyles.formTextarea} rows={2} value={cpptForm.planning}
                                onChange={(e) => setCpptForm({ ...cpptForm, planning: e.target.value })}
                                placeholder="Rencana tindakan / obat / edukasi..." />
                        </div>
                        <Button variant="primary" onClick={handleSaveProgressNote} disabled={saveProgressNote.isPending}>
                            <Plus size={16} /> {saveProgressNote.isPending ? 'Menyimpan...' : 'Tambah Catatan'}
                        </Button>
                    </div>

                    {/* Timeline CPPT */}
                    {progressNotes.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                            Belum ada catatan perkembangan. Catatan SOAP awal dan setiap entry CPPT akan muncul di timeline ini.
                        </p>
                    ) : (
                        <div>
                            {progressNotes.slice().reverse().map((note) => (
                                <div key={note.id} className={styles.historyItem} style={{ borderLeft: `4px solid ${note.authorRole === 'Dokter' ? 'var(--primary, #3b82f6)' : '#22c55e'}` }}>
                                    <div className={styles.historyDate} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>{new Date(note.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                        <span style={{
                                            fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full, 999px)',
                                            background: note.authorRole === 'Dokter' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                            color: note.authorRole === 'Dokter' ? 'var(--primary, #3b82f6)' : '#22c55e',
                                        }}>
                                            {note.authorRole} — {note.authorName || 'Tidak diketahui'}
                                        </span>
                                    </div>
                                    <div className={styles.historyDetail}>
                                        {note.subjektif && <><strong>S:</strong> {note.subjektif}<br /></>}
                                        {note.objektif && <><strong>O:</strong> {note.objektif}<br /></>}
                                        {note.asesmen && <><strong>A:</strong> {note.asesmen}<br /></>}
                                        {note.planning && <><strong>P:</strong> {note.planning}<br /></>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'riwayat' && (
                <div className={styles.soapContent}>
                    <h3 className={styles.soapSectionTitle}>Riwayat Kunjungan</h3>
                    {history.map((h, i) => (
                        <div key={i} className={styles.historyItem}>
                            <div className={styles.historyDate}>{h.date}</div>
                            <div className={styles.historyDetail}>
                                <strong>Diagnosa:</strong> {h.diagnosa}<br />
                                <strong>Dokter:</strong> {h.dokter}<br />
                                <strong>Tindakan:</strong> {h.tindakan}<br />
                                <strong>Obat:</strong> {h.obat}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Actions */}
            <div className={styles.emrActions}>
                <Button variant="secondary" onClick={handleSaveDraft} disabled={saveSoap.isPending}>
                    <Save size={16} /> {saveSoap.isPending ? 'Menyimpan...' : 'Simpan Draft'}
                </Button>
                <Button variant="primary" onClick={handleSelesai} disabled={saveSoap.isPending}>
                    <CheckCircle size={16} /> Selesai Pemeriksaan
                </Button>
            </div>
        </div>
    );
}
