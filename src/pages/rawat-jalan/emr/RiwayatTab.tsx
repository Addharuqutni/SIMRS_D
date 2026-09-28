import { StatusBadge } from '../../../components/ui';
import { useRiwayatKunjungan } from '../../../hooks/useClinical';
import type { RawatJalanPatient } from '../../../lib/api/clinical';
import styles from '../rawat-jalan.module.css';

interface RiwayatTabProps {
    kunjungan: RawatJalanPatient;
}

/** Riwayat kunjungan pasien sebelumnya (dengan asesmen & kode ICD-10 dari SOAP). */
export function RiwayatTab({ kunjungan }: RiwayatTabProps) {
    const { data: riwayat = [], isLoading, isError } = useRiwayatKunjungan(kunjungan.id);

    if (isLoading) {
        return (
            <div className={styles.soapContent}>
                <h3 className={styles.soapSectionTitle}>Riwayat Kunjungan</h3>
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>Memuat riwayat kunjungan...</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className={styles.soapContent}>
                <h3 className={styles.soapSectionTitle}>Riwayat Kunjungan</h3>
                <p style={{ textAlign: 'center', color: 'var(--danger)', padding: '24px' }}>Gagal memuat riwayat kunjungan. Coba muat ulang halaman.</p>
            </div>
        );
    }

    return (
        <div className={styles.soapContent}>
            <h3 className={styles.soapSectionTitle}>Riwayat Kunjungan</h3>
            {riwayat.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                    Belum ada kunjungan sebelumnya untuk pasien ini.
                </p>
            ) : riwayat.map((h) => (
                <div key={h.id} className={styles.historyItem}>
                    <div className={styles.historyDate} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{new Date(h.waktu).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span style={{ display: 'inline-flex', gap: '6px' }}>
                            <StatusBadge variant="info" dot={false}>{h.poli}</StatusBadge>
                            <StatusBadge variant="neutral" dot={false}>{h.status}</StatusBadge>
                        </span>
                    </div>
                    <div className={styles.historyDetail}>
                        <strong>Dokter:</strong> {h.dokter || '-'}<br />
                        <strong>Diagnosa:</strong> {h.asesmen || '-'}
                        {h.icd10Codes && h.icd10Codes.length > 0 && (
                            <>
                                <br /><strong>Kode ICD-10:</strong> {h.icd10Codes.join(', ')}
                            </>
                        )}
                        {h.planning && (
                            <>
                                <br /><strong>Tindakan/Terapi:</strong> {h.planning}
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
