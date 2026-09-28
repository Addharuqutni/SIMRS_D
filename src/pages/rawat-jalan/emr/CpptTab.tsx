import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, showToast, uiStyles } from '../../../components/ui';
import { useProgressNotes, useSaveProgressNote } from '../../../hooks/useClinical';
import { errorMessage } from '../../../lib/api-error';
import type { RawatJalanPatient } from '../../../lib/api/clinical';
import styles from '../rawat-jalan.module.css';

interface CpptTabProps {
    kunjungan: RawatJalanPatient;
}

const EMPTY_NOTE = { subjektif: '', objektif: '', asesmen: '', planning: '' };

/** CPPT — catatan perkembangan pasien terintegrasi (timeline longitudinal). */
export function CpptTab({ kunjungan }: CpptTabProps) {
    const [form, setForm] = useState({ ...EMPTY_NOTE });

    // ===== CPPT (progress notes timeline, server: oldest → newest) =====
    const { data: progressNotes = [] } = useProgressNotes(kunjungan.id);
    const saveProgressNote = useSaveProgressNote();

    const handleSaveProgressNote = async () => {
        if (!form.subjektif && !form.objektif && !form.asesmen && !form.planning) {
            showToast('Isi minimal satu bagian catatan perkembangan', 'warning');
            return;
        }
        try {
            await saveProgressNote.mutateAsync({
                visitId: kunjungan.id,
                authorId: kunjungan.dokterId,
                authorRole: 'Dokter',
                subjektif: form.subjektif || undefined,
                objektif: form.objektif || undefined,
                asesmen: form.asesmen || undefined,
                planning: form.planning || undefined,
                icd10Codes: [],
                icd9Codes: [],
            });
            showToast('Catatan perkembangan (CPPT) tersimpan', 'success');
            setForm({ ...EMPTY_NOTE });
        } catch (err) {
            showToast(errorMessage(err, 'Gagal menyimpan catatan CPPT'), 'danger');
        }
    };

    return (
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
                    <textarea className={uiStyles.formTextarea} rows={2} value={form.subjektif}
                        onChange={(e) => setForm({ ...form, subjektif: e.target.value })}
                        placeholder="Keluhan terkini / perkembangan kondisi pasien..." />
                </div>
                <div className={uiStyles.formGroup}>
                    <label className={uiStyles.formLabel}>Objektif</label>
                    <textarea className={uiStyles.formTextarea} rows={2} value={form.objektif}
                        onChange={(e) => setForm({ ...form, objektif: e.target.value })}
                        placeholder="Hasil pemeriksaan fisik / tanda vital terkini..." />
                </div>
                <div className={uiStyles.formGroup}>
                    <label className={uiStyles.formLabel}>Asesmen</label>
                    <textarea className={uiStyles.formTextarea} rows={2} value={form.asesmen}
                        onChange={(e) => setForm({ ...form, asesmen: e.target.value })}
                        placeholder="Kesimpulan kondisi pasien / diagnosa kerja..." />
                </div>
                <div className={uiStyles.formGroup}>
                    <label className={uiStyles.formLabel}>Planning</label>
                    <textarea className={uiStyles.formTextarea} rows={2} value={form.planning}
                        onChange={(e) => setForm({ ...form, planning: e.target.value })}
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
    );
}
