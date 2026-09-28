import { uiStyles } from '../../../components/ui';
import styles from '../rawat-jalan.module.css';
import type { SoapForm } from './types';

interface SubjektifTabProps {
    soapForm: SoapForm;
    updateSoap: (field: keyof SoapForm, value: string) => void;
}

/** Catatan subjektif (anamnesis) — bagian S dari SOAP. */
export function SubjektifTab({ soapForm, updateSoap }: SubjektifTabProps) {
    return (
        <div className={styles.soapContent}>
            <h3 className={styles.soapSectionTitle}>Catatan Subjektif (S)</h3>
            <div className={uiStyles.formGroup}>
                <label className={uiStyles.formLabel}>Keluhan & Riwayat Penyakit (Anamnesis)</label>
                <textarea
                    className={uiStyles.formTextarea}
                    rows={8}
                    value={soapForm.subjektif}
                    onChange={(e) => updateSoap('subjektif', e.target.value)}
                    placeholder="Tuliskan keluhan utama dan riwayat penyakit pasien secara mendetail..."
                />
            </div>
        </div>
    );
}
