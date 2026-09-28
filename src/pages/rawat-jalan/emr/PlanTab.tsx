import { useState } from 'react';
import { AlertOctagon, FlaskConical, Plus, ScanLine, X } from 'lucide-react';
import { Button, showToast, uiStyles } from '../../../components/ui';
import { useCheckDdi, useClinicalMedicines, useCreateOrder, useIcd9Search } from '../../../hooks/useClinical';
import { errorMessage } from '../../../lib/api-error';
import type { RawatJalanPatient } from '../../../lib/api/clinical';
import styles from '../rawat-jalan.module.css';
import type { DdiAlert, MedRow, SoapForm } from './types';

interface PlanTabProps {
    kunjungan: RawatJalanPatient;
    soapForm: SoapForm;
    updateSoap: (field: keyof SoapForm, value: string) => void;
    icd9Codes: string[];
    setIcd9Codes: (codes: string[]) => void;
    meds: MedRow[];
    setMeds: (meds: MedRow[]) => void;
}

const EMPTY_MED: MedRow = { obat: '', dosis: '', jumlah: '', keterangan: '' };

/** Tindakan & Resep (P) — rencana, ICD-9, e-resep, cek DDI, dan order penunjang. */
export function PlanTab({ kunjungan, soapForm, updateSoap, icd9Codes, setIcd9Codes, meds, setMeds }: PlanTabProps) {
    // ICD-9-CM procedure picker state
    const [icd9Query, setIcd9Query] = useState('');
    const { data: icd9Results = [] } = useIcd9Search(icd9Query);
    const { data: medicineOptions = [] } = useClinicalMedicines();
    const createOrder = useCreateOrder();

    // CDSS: DDI check state
    const checkDdi = useCheckDdi();
    const [ddiAlerts, setDdiAlerts] = useState<DdiAlert[]>([]);

    const addIcd9Code = (code: string) => {
        setIcd9Codes(icd9Codes.includes(code) ? icd9Codes : [...icd9Codes, code]);
        setIcd9Query('');
    };

    const updateMed = (index: number, patch: Partial<MedRow>) =>
        setMeds(meds.map((m, i) => (i === index ? { ...m, ...patch } : m)));

    const handleOrder = async (type: 'lab' | 'radiology', jenisPemeriksaan: string) => {
        try {
            await createOrder.mutateAsync({
                type,
                data: {
                    visitId: kunjungan.id,
                    dokterId: kunjungan.dokterId,
                    jenisPemeriksaan,
                    catatan: 'Order dari EMR',
                },
            });
            showToast(`Order ${type === 'lab' ? 'laboratorium' : 'radiologi'} dikirim`, 'info');
        } catch (err) {
            showToast(errorMessage(err, `Gagal order ${type === 'lab' ? 'laboratorium' : 'radiologi'}`), 'danger');
        }
    };

    // CDSS: Check drug-drug interactions among currently prescribed meds
    const handleCheckDdi = async () => {
        const validMeds = meds.filter((m) => m.obat);
        if (validMeds.length < 2) {
            showToast('Minimal 2 obat diperlukan untuk cek interaksi', 'info');
            return;
        }
        const names = validMeds
            .map((m) => medicineOptions.find((o) => String(o.id) === m.obat)?.nama)
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
        } catch (err) {
            showToast(errorMessage(err, 'Gagal memeriksa interaksi obat'), 'danger');
        }
    };

    const sevColor = (severity: string) => severity === 'contraindicated' ? '#dc2626'
        : severity === 'major' ? '#ea580c'
            : severity === 'moderate' ? '#f59e0b'
                : '#6b7280';

    return (
        <div className={styles.soapContent}>
            <h3 className={styles.soapSectionTitle}>Tindakan & Resep (Plan - P)</h3>
            <div className={uiStyles.formGroup} style={{ marginBottom: '20px' }}>
                <label className={uiStyles.formLabel}>Catatan Perencanaan dan Prosedur</label>
                <textarea
                    className={uiStyles.formTextarea}
                    rows={4}
                    value={soapForm.planning}
                    onChange={(e) => updateSoap('planning', e.target.value)}
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
                                    onClick={() => setIcd9Codes(icd9Codes.filter((c) => c !== code))}
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
                                    onChange={(e) => updateMed(i, { obat: e.target.value })}
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
                                <input value={med.dosis} onChange={(e) => updateMed(i, { dosis: e.target.value })} placeholder="3x1" />
                            </td>
                            <td>
                                <input value={med.jumlah} onChange={(e) => updateMed(i, { jumlah: e.target.value })} placeholder="10" />
                            </td>
                            <td>
                                <input value={med.keterangan} onChange={(e) => updateMed(i, { keterangan: e.target.value })} placeholder="Keterangan..." />
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
            <button onClick={() => setMeds([...meds, { ...EMPTY_MED }])} style={{
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
                        {ddiAlerts.map((a, i) => (
                            <div key={i} style={{
                                padding: '10px 14px',
                                background: `${sevColor(a.severity)}10`, border: `1px solid ${sevColor(a.severity)}40`,
                                borderLeft: `4px solid ${sevColor(a.severity)}`, borderRadius: 'var(--radius-md, 8px)',
                                fontSize: '12px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                    <AlertOctagon size={14} style={{ color: sevColor(a.severity) }} />
                                    <strong style={{ color: sevColor(a.severity), textTransform: 'uppercase' }}>{a.severity}</strong>
                                    <span>— {a.drugA} + {a.drugB}</span>
                                </div>
                                <div style={{ color: 'var(--text)' }}>{a.description}</div>
                                <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    <strong>Rekomendasi:</strong> {a.recommendation}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className={styles.orderBtns}>
                <Button variant="secondary" onClick={() => handleOrder('lab', 'Darah Lengkap')} disabled={createOrder.isPending}>
                    <FlaskConical size={14} /> Order Lab (Darah Lengkap)
                </Button>
                <Button variant="secondary" onClick={() => handleOrder('radiology', 'Rontgen Thorax')} disabled={createOrder.isPending}>
                    <ScanLine size={14} /> Order Radiologi (Thorax)
                </Button>
            </div>
        </div>
    );
}
