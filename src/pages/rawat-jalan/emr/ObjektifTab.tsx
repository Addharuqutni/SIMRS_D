import { useState } from 'react';
import { Activity, Clock, Save } from 'lucide-react';
import { Button, showToast, uiStyles } from '../../../components/ui';
import { useSaveVitalSigns, useVitalSigns } from '../../../hooks/useClinical';
import { errorMessage } from '../../../lib/api-error';
import type { RawatJalanPatient } from '../../../lib/api/clinical';
import styles from '../rawat-jalan.module.css';
import type { SoapForm } from './types';

interface ObjektifTabProps {
    kunjungan: RawatJalanPatient;
    soapForm: SoapForm;
    updateSoap: (field: keyof SoapForm, value: string) => void;
}

const EMPTY_VITALS = { sistolik: '', diastolik: '', nadi: '', suhu: '', pernapasan: '', spo2: '', beratBadan: '', tinggiBadan: '', gcs: '15', catatan: '' };

/** Pemeriksaan fisik (O) — tanda vital ber-MEWS, timeline, dan catatan objektif. */
export function ObjektifTab({ kunjungan, soapForm, updateSoap }: ObjektifTabProps) {
    const visitId = kunjungan.id;

    // ===== VITAL SIGNS (stateful — replaces hardcoded defaultValue) =====
    const [vitals, setVitals] = useState({ ...EMPTY_VITALS });
    const { data: vitalsTimeline = [] } = useVitalSigns(visitId);
    const saveVitals = useSaveVitalSigns();

    // Latest MEWS score from the most recent vital signs record
    const latestVitals = vitalsTimeline[vitalsTimeline.length - 1];
    const latestMews = latestVitals?.mews;

    // ===== VITAL SIGNS SAVE — auto-computes MEWS on server, creates critical notification =====
    const handleSaveVitals = async () => {
        // GCS keeps its normal default of 15, so it only counts when the user changes it.
        const hasAny = [
            vitals.sistolik, vitals.diastolik, vitals.nadi, vitals.suhu,
            vitals.pernapasan, vitals.spo2, vitals.beratBadan, vitals.tinggiBadan,
        ].some((v) => v !== '') || (vitals.gcs !== '' && vitals.gcs !== '15') || vitals.catatan !== '';
        if (!hasAny) {
            showToast('Isi minimal satu tanda vital sebelum menyimpan', 'warning');
            return;
        }
        const num = (v: string) => (v === '' ? undefined : Number(v));
        try {
            await saveVitals.mutateAsync({
                visitId,
                recordedBy: kunjungan.dokterId,
                sistolik: num(vitals.sistolik),
                diastolik: num(vitals.diastolik),
                nadi: num(vitals.nadi),
                suhu: num(vitals.suhu),
                pernapasan: num(vitals.pernapasan),
                spo2: num(vitals.spo2),
                beratBadan: num(vitals.beratBadan),
                tinggiBadan: num(vitals.tinggiBadan),
                gcs: num(vitals.gcs),
                catatan: vitals.catatan || undefined,
                penyelenggara: 'Dokter',
            });
            showToast('Tanda vital tersimpan. MEWS dihitung otomatis.', 'success');
            // Reset form fields after successful save
            setVitals({ ...EMPTY_VITALS });
        } catch (err) {
            showToast(errorMessage(err, 'Gagal menyimpan tanda vital'), 'danger');
        }
    };

    const setVital = (field: keyof typeof EMPTY_VITALS, value: string) => setVitals((v) => ({ ...v, [field]: value }));

    const mewsColor = (level?: string) => level === 'danger' ? '#dc2626'
        : level === 'warn' ? '#f59e0b'
            : level === 'watch' ? '#3b82f6'
                : '#22c55e';

    const vitalFields = [
        { key: 'sistolik' as const, label: 'Sistolik', placeholder: '120', unit: 'mmHg', step: undefined },
        { key: 'diastolik' as const, label: 'Diastolik', placeholder: '80', unit: 'mmHg', step: undefined },
        { key: 'nadi' as const, label: 'Nadi', placeholder: '80', unit: 'x/menit', step: undefined },
        { key: 'suhu' as const, label: 'Suhu', placeholder: '36.5', unit: '°C', step: '0.1' },
        { key: 'pernapasan' as const, label: 'Resp. Rate', placeholder: '16', unit: 'x/menit', step: undefined },
        { key: 'spo2' as const, label: 'SpO2', placeholder: '98', unit: '%', step: undefined },
        { key: 'gcs' as const, label: 'GCS', placeholder: '15', unit: '3-15', step: undefined },
        { key: 'beratBadan' as const, label: 'Berat Badan', placeholder: '60', unit: 'kg', step: '0.1' },
        { key: 'tinggiBadan' as const, label: 'Tinggi Badan', placeholder: '160', unit: 'cm', step: undefined },
    ];

    return (
        <div className={styles.soapContent}>
            <h3 className={styles.soapSectionTitle}>Pemeriksaan Fisik (Objektif)</h3>

            {/* MEWS Early Warning Score Badge — auto-updates from latest vital signs */}
            {latestMews && latestVitals && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', marginBottom: '16px',
                    background: `${mewsColor(latestMews.level)}1a`,
                    border: `1px solid ${mewsColor(latestMews.level)}66`,
                    borderRadius: 'var(--radius-md, 8px)',
                }}>
                    <Activity size={20} style={{ color: mewsColor(latestMews.level) }} />
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
                {vitalFields.map((f) => (
                    <div className={styles.vitalItem} key={f.key}>
                        <span className={styles.vitalLabel}>{f.label}</span>
                        <input className={styles.vitalInput} type="number" step={f.step}
                            inputMode={f.step ? 'decimal' : 'numeric'} min={f.key === 'gcs' ? 3 : undefined} max={f.key === 'gcs' ? 15 : undefined}
                            placeholder={f.placeholder}
                            value={vitals[f.key]}
                            onChange={(e) => setVital(f.key, e.target.value)} />
                        <span className={styles.vitalUnit}>{f.unit}</span>
                    </div>
                ))}
            </div>
            <div className={uiStyles.formGroup} style={{ marginTop: '12px' }}>
                <label className={uiStyles.formLabel}>Catatan Tanda Vital (opsional)</label>
                <input className={uiStyles.formInput} placeholder="Mis: Pasien tampak sesak napas"
                    value={vitals.catatan}
                    onChange={(e) => setVital('catatan', e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <Button variant="primary" onClick={handleSaveVitals} disabled={saveVitals.isPending}>
                    <Save size={16} /> {saveVitals.isPending ? 'Menyimpan...' : 'Simpan Tanda Vital'}
                </Button>
            </div>

            {/* Vital Signs Timeline — trending chart for deterioration detection (server: oldest → newest) */}
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
                                {vitalsTimeline.slice().reverse().map((v) => (
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
                                            <span style={{ fontWeight: 700, color: mewsColor(v.mews?.level) }}>{v.mewsScore ?? '-'}</span>
                                        </td>
                                    </tr>
                                ))}
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
                    onChange={(e) => updateSoap('objektif', e.target.value)}
                    placeholder="Hasil pemeriksaan klinis objektif..."
                />
            </div>
        </div>
    );
}
