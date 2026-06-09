import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, FlaskConical, ScanLine, Save, CheckCircle } from 'lucide-react';
import { Button, showToast, uiStyles } from '../../components/ui';
import { useEmrSoap, useSaveEmrSoap, useUpdateRawatJalanStatus, useCreatePrescription, useCreateOrder } from '../../hooks/useClinical';
import styles from './rawat-jalan.module.css';

const soapSections = [
    { key: 'subjektif', label: 'S — Subjektif' },
    { key: 'objektif', label: 'O — Objektif' },
    { key: 'assessment', label: 'A — Assessment' },
    { key: 'plan', label: 'P — Plan' },
    { key: 'riwayat', label: 'Riwayat' },
];

const prescriptions: { obat: string; dosis: string; jumlah: string; keterangan: string }[] = [];

const history: { date: string; diagnosa: string; dokter: string; tindakan: string; obat: string }[] = [];

export function RawatJalanEMR() {
    const navigate = useNavigate();
    const location = useLocation();

    // Patient context passed from list view
    const patient = location.state as any;
    const visitId = patient?.id;

    const [activeTab, setActiveTab] = useState('subjektif');
    const [meds, setMeds] = useState(prescriptions);
    const [soapForm, setSoapForm] = useState({ subjektif: '', objektif: '', asesmen: '', planning: '' });

    const { data: soapData, isLoading } = useEmrSoap(visitId);
    const saveSoap = useSaveEmrSoap();
    const savePrescription = useCreatePrescription();
    const createOrder = useCreateOrder();
    const updateVisitStatus = useUpdateRawatJalanStatus();

    useEffect(() => {
        if (soapData) {
            setSoapForm({
                subjektif: soapData.subjektif || '',
                objektif: soapData.objektif || '',
                asesmen: soapData.asesmen || '',
                planning: soapData.planning || ''
            });
        }
    }, [soapData]);

    const addMed = () => {
        setMeds([...meds, { obat: '', dosis: '', jumlah: '', keterangan: '' }]);
    };

    const handleSaveDraft = async () => {
        if (!visitId) return;
        try {
            await saveSoap.mutateAsync({ visitId, dokterId: patient.dokterId, ...soapForm });
            showToast('Draft SOAP berhasil tersimpan', 'success');
        } catch {
            showToast('Gagal menyimpan draft SOAP', 'danger');
        }
    };

    const handleSelesai = async () => {
        if (!visitId) return;
        try {
            await saveSoap.mutateAsync({ visitId, dokterId: patient.dokterId, ...soapForm });

            // Only send if there are items with filled data
            const validMeds = meds.filter(m => m.obat && m.dosis);
            if (validMeds.length > 0) {
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
                    <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Tanda Vital</h4>
                    <div className={styles.vitalsGrid}>
                        <div className={styles.vitalItem}>
                            <span className={styles.vitalLabel}>Tekanan Darah</span>
                            <input className={styles.vitalInput} defaultValue="120/80" />
                            <span className={styles.vitalUnit}>mmHg</span>
                        </div>
                        <div className={styles.vitalItem}>
                            <span className={styles.vitalLabel}>Nadi</span>
                            <input className={styles.vitalInput} defaultValue="80" />
                            <span className={styles.vitalUnit}>x/menit</span>
                        </div>
                        <div className={styles.vitalItem}>
                            <span className={styles.vitalLabel}>Suhu</span>
                            <input className={styles.vitalInput} defaultValue="38.5" />
                            <span className={styles.vitalUnit}>°C</span>
                        </div>
                        <div className={styles.vitalItem}>
                            <span className={styles.vitalLabel}>Resp. Rate</span>
                            <input className={styles.vitalInput} defaultValue="20" />
                            <span className={styles.vitalUnit}>x/menit</span>
                        </div>
                        <div className={styles.vitalItem}>
                            <span className={styles.vitalLabel}>SpO2</span>
                            <input className={styles.vitalInput} defaultValue="98" />
                            <span className={styles.vitalUnit}>%</span>
                        </div>
                        <div className={styles.vitalItem}>
                            <span className={styles.vitalLabel}>Berat Badan</span>
                            <input className={styles.vitalInput} defaultValue="70" />
                            <span className={styles.vitalUnit}>kg</span>
                        </div>
                        <div className={styles.vitalItem}>
                            <span className={styles.vitalLabel}>Tinggi Badan</span>
                            <input className={styles.vitalInput} defaultValue="170" />
                            <span className={styles.vitalUnit}>cm</span>
                        </div>
                    </div>
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
                                        <input
                                            value={med.obat}
                                            onChange={(e) => {
                                                const newMeds = [...meds];
                                                newMeds[i].obat = e.target.value;
                                                setMeds(newMeds);
                                            }}
                                            placeholder="ID Obat..."
                                        />
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
