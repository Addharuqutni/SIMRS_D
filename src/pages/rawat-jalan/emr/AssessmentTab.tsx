import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { showToast, uiStyles } from '../../../components/ui';
import { useIcd10Search, useIcdSuggest } from '../../../hooks/useClinical';
import styles from '../rawat-jalan.module.css';
import type { SoapForm } from './types';

interface AssessmentTabProps {
    soapForm: SoapForm;
    updateSoap: (field: keyof SoapForm, value: string) => void;
    icdCodes: string[];
    setIcdCodes: (codes: string[]) => void;
}

/** Diagnosa (A) — teks asesmen, picker ICD-10, dan saran ICD-10 otomatis (CDSS). */
export function AssessmentTab({ soapForm, updateSoap, icdCodes, setIcdCodes }: AssessmentTabProps) {
    // ICD-10 diagnosis picker state
    const [icdQuery, setIcdQuery] = useState('');
    const { data: icdResults = [] } = useIcd10Search(icdQuery);

    // CDSS: ICD-10 auto-suggest from SOAP text
    const { data: icdSuggestions } = useIcdSuggest(`${soapForm.subjektif} ${soapForm.objektif} ${soapForm.asesmen}`);

    const addIcdCode = (code: string) => {
        setIcdCodes(icdCodes.includes(code) ? icdCodes : [...icdCodes, code]);
        setIcdQuery('');
    };

    return (
        <div className={styles.soapContent}>
            <h3 className={styles.soapSectionTitle}>Diagnosa (Assessment - A)</h3>
            <div className={uiStyles.formGroup}>
                <label className={uiStyles.formLabel}>Kesimpulan Diagnosa (ICD-10)</label>
                <textarea
                    className={uiStyles.formTextarea}
                    rows={6}
                    value={soapForm.asesmen}
                    onChange={(e) => updateSoap('asesmen', e.target.value)}
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
                                    onClick={() => setIcdCodes(icdCodes.filter((c) => c !== code))}
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
    );
}
