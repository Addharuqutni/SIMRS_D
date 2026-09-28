import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Save, TriangleAlert } from 'lucide-react';
import { Button, showToast } from '../../components/ui';
import { useAllergyAlert, useClinicalMedicines, useEmrSoap, useKunjungan, useSaveEmrSoap, useUpdateRawatJalanStatus } from '../../hooks/useClinical';
import { useCreatePrescription } from '../../hooks/usePharmacy';
import { errorMessage } from '../../lib/api-error';
import styles from './rawat-jalan.module.css';
import { AssessmentTab } from './emr/AssessmentTab';
import { CpptTab } from './emr/CpptTab';
import { ObjektifTab } from './emr/ObjektifTab';
import { PlanTab } from './emr/PlanTab';
import { RiwayatTab } from './emr/RiwayatTab';
import { SubjektifTab } from './emr/SubjektifTab';
import { SOAP_TABS, type MedRow, type SoapForm, type SoapTabKey } from './emr/types';

const EMPTY_SOAP: SoapForm = { subjektif: '', objektif: '', asesmen: '', planning: '' };

/**
 * EMR rawat jalan — konteks kunjungan dimuat dari URL (`/rawat-jalan/:id`),
 * sehingga refresh / deep link tetap membuka pasien yang sama.
 */
export function RawatJalanEMR() {
    const navigate = useNavigate();
    const { id: visitId = '' } = useParams();
    const { data: kunjungan, isLoading, isError } = useKunjungan(visitId);

    const [activeTab, setActiveTab] = useState<SoapTabKey>(SOAP_TABS[0].key);
    const [soapForm, setSoapForm] = useState<SoapForm>({ ...EMPTY_SOAP });
    const [icdCodes, setIcdCodes] = useState<string[]>([]);
    const [icd9Codes, setIcd9Codes] = useState<string[]>([]);
    const [meds, setMeds] = useState<MedRow[]>([]);

    // EMR SOAP of this visit — seeds the form once the server responds
    const { data: soapData, isLoading: soapLoading } = useEmrSoap(visitId);
    const saveSoap = useSaveEmrSoap();
    const savePrescription = useCreatePrescription();
    const updateVisitStatus = useUpdateRawatJalanStatus();
    // Medicine catalogue drives the prescription picker in the Plan tab; the
    // stock snapshot here is only used for the out-of-stock soft warning.
    const { data: medicineStok = [] } = useClinicalMedicines();

    // Patient safety: persistent allergy banner, from the patient record behind this visit
    const { data: allergy } = useAllergyAlert(kunjungan?.patientId);

    useEffect(() => {
        if (soapData) {
            setSoapForm({
                subjektif: soapData.subjektif || '',
                objektif: soapData.objektif || '',
                asesmen: soapData.asesmen || '',
                planning: soapData.planning || '',
            });
            setIcdCodes(Array.isArray(soapData.icd10Codes) ? soapData.icd10Codes : []);
            setIcd9Codes(Array.isArray(soapData.icd9Codes) ? soapData.icd9Codes : []);
        }
    }, [soapData]);

    const updateSoap = (field: keyof SoapForm, value: string) =>
        setSoapForm((f) => ({ ...f, [field]: value }));

    const handleSaveDraft = async () => {
        if (!kunjungan) return;
        try {
            await saveSoap.mutateAsync({ visitId: kunjungan.id, dokterId: kunjungan.dokterId, ...soapForm, icd10Codes: icdCodes, icd9Codes });
            showToast('Draft SOAP berhasil tersimpan', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal menyimpan draft SOAP'), 'danger');
        }
    };

    const handleSelesai = async () => {
        if (!kunjungan) return;
        try {
            await saveSoap.mutateAsync({ visitId: kunjungan.id, dokterId: kunjungan.dokterId, ...soapForm, icd10Codes: icdCodes, icd9Codes });

            // Only send if there are items with filled data
            const validMeds = meds.filter((m) => m.obat && m.dosis);
            if (validMeds.length > 0) {
                // Soft warning if any prescribed medicine is out of stock (order still goes through — stock may arrive later)
                const habis = validMeds.filter((m) => {
                    const option = medicineStok.find((o) => String(o.id) === m.obat);
                    return option !== undefined && option.stok <= 0;
                });
                if (habis.length > 0) {
                    showToast('Perhatian: resep mengandung obat dengan stok habis — tetap dikirim ke Farmasi', 'warning');
                }

                await savePrescription.mutateAsync({
                    visitId: kunjungan.id,
                    items: validMeds.map((m) => ({
                        obatId: Number(m.obat),
                        dosis: m.dosis,
                        jumlah: Number(m.jumlah) || 1,
                        keterangan: m.keterangan || undefined,
                    })),
                });
            }

            await updateVisitStatus.mutateAsync({ id: kunjungan.id, status: 'selesai' });
            showToast('Pemeriksaan selesai — data dikirim ke Farmasi & Billing', 'success');
            navigate('/rawat-jalan');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal menyelesaikan pemeriksaan'), 'danger');
        }
    };

    if (isLoading) {
        return (
            <div className={styles.emr}>
                <div style={{ padding: '20px', textAlign: 'center' }}>Memuat data kunjungan...</div>
            </div>
        );
    }

    if (isError || !kunjungan) {
        return (
            <div className={styles.emr}>
                <div style={{ textAlign: 'center', marginTop: '100px' }}>
                    <p>Data Kunjungan tidak ditemukan. Harap kembali ke daftar.</p>
                    <Button variant="primary" onClick={() => navigate('/rawat-jalan')}>Kembali</Button>
                </div>
            </div>
        );
    }

    const alergiText = (allergy?.hasAllergy ? allergy.alergiList.join(', ') : kunjungan.alergi || '').trim();

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
                <div className={styles.patientAvatar}>{kunjungan.nama.substring(0, 2).toUpperCase()}</div>
                <div>
                    <div className={styles.patientName}>{kunjungan.nama}</div>
                    <div className={styles.patientMeta}>
                        <span className={styles.patientTag}>📋 RM: {kunjungan.rm}</span>
                        <span className={styles.patientTag}>🩺 Poli: {kunjungan.poli}</span>
                        <span className={styles.patientTag}>👨‍⚕️ {kunjungan.dokter || '-'}</span>
                    </div>
                </div>
            </div>

            {/* Persistent allergy warning banner */}
            {alergiText && (
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
                        <span>{alergiText}</span>
                    </div>
                </div>
            )}

            {soapLoading && <div style={{ padding: '20px', textAlign: 'center' }}>Memuat riwayat medis...</div>}

            {/* SOAP Tabs */}
            <div className={styles.soapTabs}>
                {SOAP_TABS.map((s) => (
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
                <SubjektifTab soapForm={soapForm} updateSoap={updateSoap} />
            )}

            {activeTab === 'objektif' && (
                <ObjektifTab kunjungan={kunjungan} soapForm={soapForm} updateSoap={updateSoap} />
            )}

            {activeTab === 'assessment' && (
                <AssessmentTab soapForm={soapForm} updateSoap={updateSoap} icdCodes={icdCodes} setIcdCodes={setIcdCodes} />
            )}

            {activeTab === 'plan' && (
                <PlanTab kunjungan={kunjungan} soapForm={soapForm} updateSoap={updateSoap}
                    icd9Codes={icd9Codes} setIcd9Codes={setIcd9Codes} meds={meds} setMeds={setMeds} />
            )}

            {activeTab === 'cppt' && (
                <CpptTab kunjungan={kunjungan} />
            )}

            {activeTab === 'riwayat' && (
                <RiwayatTab kunjungan={kunjungan} />
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
