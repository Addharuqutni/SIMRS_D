import { useState } from 'react';
import { Stethoscope, Database, Search } from 'lucide-react';
import { Card, uiStyles } from '../../components/ui';
import { useIcd10Search, useIcd9Search } from '../../hooks/useClinical';
import styles from '../registrasi/registrasi.module.css';

type Kode = 'icd10' | 'icd9';

const MIN_QUERY = 2;

/**
 * Master Data — referensi kode ICD-10 (diagnosa) dan ICD-9-CM (prosedur).
 * Read-only: sumbernya tabel referensi yang di-seed, dicari langsung ke server.
 */
export function MasterData() {
    const [kind, setKind] = useState<Kode>('icd10');
    const [query, setQuery] = useState('');

    const icd10 = useIcd10Search(kind === 'icd10' ? query : '');
    const icd9 = useIcd9Search(kind === 'icd9' ? query : '');
    const active = kind === 'icd10' ? icd10 : icd9;
    const rows = active.data ?? [];
    const ready = query.trim().length >= MIN_QUERY;

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Master Data Referensi</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setKind('icd10')}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '8px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                            border: '1px solid var(--border)', fontWeight: 600, fontSize: '13px',
                            background: kind === 'icd10' ? 'var(--primary)' : 'var(--bg-card)',
                            color: kind === 'icd10' ? '#fff' : 'var(--text)',
                        }}
                    >
                        <Stethoscope size={16} /> ICD-10 (Diagnosa)
                    </button>
                    <button
                        onClick={() => setKind('icd9')}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '8px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                            border: '1px solid var(--border)', fontWeight: 600, fontSize: '13px',
                            background: kind === 'icd9' ? 'var(--primary)' : 'var(--bg-card)',
                            color: kind === 'icd9' ? '#fff' : 'var(--text)',
                        }}
                    >
                        <Database size={16} /> ICD-9-CM (Prosedur)
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', maxWidth: '600px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        className={uiStyles.formInput}
                        style={{ paddingLeft: 36 }}
                        placeholder={kind === 'icd10' ? 'Cari kode / deskripsi diagnosa (min. 2 karakter)...' : 'Cari kode / deskripsi prosedur (min. 2 karakter)...'}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
            </div>

            <Card
                title={kind === 'icd10' ? 'Kode ICD-10 (Diagnosa)' : 'Kode ICD-9-CM (Prosedur)'}
                icon={kind === 'icd10' ? <Stethoscope size={18} /> : <Database size={18} />}
                action={ready && !active.isLoading ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{rows.length} kode ditemukan</span>
                ) : undefined}
            >
                <div className={styles.tableWrapper}>
                    <table className={uiStyles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: '20%' }}>Kode</th>
                                <th>Deskripsi</th>
                                <th style={{ width: '25%' }}>Kategori</th>
                            </tr>
                        </thead>
                        <tbody className="stagger">
                            {!ready ? (
                                <tr><td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Ketik minimal {MIN_QUERY} karakter untuk mulai mencari</td></tr>
                            ) : active.isLoading ? (
                                <tr><td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Mencari kode...</td></tr>
                            ) : active.isError ? (
                                <tr><td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: 'var(--danger)' }}>Gagal memuat referensi kode</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada kode yang cocok</td></tr>
                            ) : rows.map((row) => (
                                <tr key={row.code}>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary)' }}>{row.code}</td>
                                    <td>{row.description}</td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{row.category || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
