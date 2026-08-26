import { useQuery } from '@tanstack/react-query';
import { Globe, RefreshCcw, CheckCircle2, XCircle, Clock, Activity, AlertTriangle } from 'lucide-react';
import { Card, Button, StatusBadge } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';
import { api } from '../../lib/axios';

const BPJS_BASE_URL_DEFAULT = 'https://apijkn.bpjs-kesehatan.go.id';

interface BridgingStatusData {
    mode: 'mock' | 'real';
    configPresent: {
        consId: boolean;
        secretKey: boolean;
        userKey: boolean;
        baseUrl: string;
    };
    lastCall: {
        at: string;
        ok: boolean;
        latencyMs: number;
        error?: string;
    } | null;
}

export function BridgingStatus() {
    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ['vclaim-status'],
        queryFn: async (): Promise<BridgingStatusData> => {
            const res = await api.get('/vclaim/status');
            return res.data.data;
        },
        refetchInterval: 30000,
    });

    const isReal = data?.mode === 'real';

    const configRows = data
        ? [
            { label: 'Cons ID', present: data.configPresent.consId },
            { label: 'Secret Key', present: data.configPresent.secretKey },
            { label: 'User Key', present: data.configPresent.userKey },
        ]
        : [];

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Monitoring Bridging BPJS</h1>
                <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
                    <RefreshCcw size={16} /> {isFetching ? 'Memuat...' : 'Refresh'}
                </Button>
            </div>

            {isLoading && (
                <Card title="Status Bridging VClaim BPJS" icon={<Globe size={18} />}>
                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Memuat status bridging...
                    </div>
                </Card>
            )}

            {isError && (
                <Card title="Status Bridging VClaim BPJS" icon={<AlertTriangle size={18} />}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 0', color: 'var(--danger, #dc2626)' }}>
                        <AlertTriangle size={18} />
                        <span>Gagal memuat status bridging: {error instanceof Error ? error.message : 'kesalahan tidak diketahui'}</span>
                    </div>
                </Card>
            )}

            {data && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <Card title="Status Bridging VClaim BPJS" icon={<Globe size={18} />}
                        action={
                            <StatusBadge variant={isReal ? 'success' : 'warning'}>
                                {isReal ? 'Real (Production)' : 'Mock Mode'}
                            </StatusBadge>
                        }>
                        <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                            {isReal
                                ? 'Semua kredensial BPJS terpasang di server — permintaan VClaim diteruskan ke Web Service BPJS yang sebenarnya.'
                                : 'Kredensial BPJS belum lengkap di server — modul VClaim berjalan dalam mode mock (simulasi lokal, tidak menghubungi server BPJS).'}
                        </div>
                    </Card>

                    <Card title="Konfigurasi Kredensial (Environment Server)" icon={<Activity size={18} />}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {configRows.map(row => (
                                <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{row.label}</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: row.present ? 'var(--success)' : 'var(--danger, #dc2626)' }}>
                                        {row.present
                                            ? <><CheckCircle2 size={16} /> Terpasang</>
                                            : <><XCircle size={16} /> Belum diset</>}
                                    </span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '14px', fontWeight: 600 }}>Base URL</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    {data.configPresent.baseUrl}
                                    {data.configPresent.baseUrl === BPJS_BASE_URL_DEFAULT && (
                                        <span style={{ marginLeft: '8px', color: 'var(--text-muted)' }}>(default)</span>
                                    )}
                                </span>
                            </div>
                        </div>
                    </Card>

                    <Card title="Panggilan Terakhir ke Server BPJS" icon={<Clock size={18} />}>
                        {!data.lastCall ? (
                            <div style={{ padding: '8px 0', fontSize: '14px', color: 'var(--text-muted)' }}>
                                Belum ada panggilan ke server BPJS sejak server dimulai
                                {!isReal && ' (mode mock tidak melakukan panggilan nyata)'}.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                    <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Waktu</div>
                                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{new Date(data.lastCall.at).toLocaleString('id-ID')}</div>
                                    </div>
                                    <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Hasil</div>
                                        <StatusBadge variant={data.lastCall.ok ? 'success' : 'danger'}>
                                            {data.lastCall.ok ? 'Berhasil' : 'Gagal'}
                                        </StatusBadge>
                                    </div>
                                    <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Latensi</div>
                                        <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{data.lastCall.latencyMs} ms</div>
                                    </div>
                                </div>
                                {!data.lastCall.ok && data.lastCall.error && (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--danger, #dc2626)' }}>
                                        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                                        <span>{data.lastCall.error}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
}

export default BridgingStatus;
