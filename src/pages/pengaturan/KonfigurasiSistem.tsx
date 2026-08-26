import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building, BedDouble, ShieldCheck, Activity, Save, Info } from 'lucide-react';
import { Button, Card, StatusBadge, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { settingsApi } from '../../lib/api/settings';
import styles from '../registrasi/registrasi.module.css';

// Must mirror DEFAULT_ROOM_TARIFF in server/src/modules/settings/index.ts.
const KELAS_KAMAR = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'VIP', 'ICU', 'HCU'] as const;
const DEFAULT_TARIF: Record<string, number> = {
    'Kelas 1': 500000, 'Kelas 2': 350000, 'Kelas 3': 200000,
    'VIP': 750000, 'HCU': 750000, 'ICU': 1000000,
};

const rupiah = (n: number) => new Intl.NumberFormat('id-ID').format(n);

export function KonfigurasiSistem() {
    const [activeTab, setActiveTab] = useState('profil');
    const queryClient = useQueryClient();

    const tabs = [
        { key: 'profil', label: 'Profil Rumah Sakit', icon: <Building size={16} /> },
        { key: 'tarif', label: 'Tarif Kamar Rawat Inap', icon: <BedDouble size={16} /> },
        { key: 'keamanan', label: 'Keamanan & Autentikasi', icon: <ShieldCheck size={16} /> },
        { key: 'server', label: 'Info Sistem', icon: <Activity size={16} /> },
    ];

    const { data: settings, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: settingsApi.getSettings,
    });

    const { data: health } = useQuery({
        queryKey: ['health'],
        queryFn: settingsApi.getHealth,
        refetchInterval: 30_000,
    });

    const [profil, setProfil] = useState({ namaRS: '', alamatRS: '', jamLayanan: '' });
    const [tarif, setTarif] = useState<Record<string, string>>({});

    // Sync form state once settings load.
    useEffect(() => {
        if (!settings) return;
        setProfil({
            namaRS: settings.namaRS ?? 'RS SIMRS Tipe D',
            alamatRS: settings.alamatRS ?? '-',
            jamLayanan: settings.jamLayanan ?? '24 Jam',
        });

        let parsed: Record<string, number> = DEFAULT_TARIF;
        try {
            const raw = JSON.parse(settings.tarifKamar ?? 'null');
            if (raw && typeof raw === 'object' && !Array.isArray(raw)) parsed = { ...DEFAULT_TARIF, ...raw };
        } catch { /* invalid JSON — keep defaults */ }
        setTarif(Object.fromEntries(KELAS_KAMAR.map((k) => [k, String(parsed[k] ?? DEFAULT_TARIF[k])])));
    }, [settings]);

    const saveMutation = useMutation({
        mutationFn: settingsApi.saveSettings,
        onSuccess: () => {
            showToast('Konfigurasi berhasil disimpan', 'success');
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
        onError: () => showToast('Gagal menyimpan konfigurasi', 'danger'),
    });

    const handleSaveProfil = () => saveMutation.mutate({
        namaRS: profil.namaRS.trim(),
        alamatRS: profil.alamatRS.trim(),
        jamLayanan: profil.jamLayanan.trim(),
    });

    const handleSaveTarif = () => {
        // Merge over defaults so empty/invalid rows keep their current default.
        const merged: Record<string, number> = { ...DEFAULT_TARIF };
        for (const kelas of KELAS_KAMAR) {
            const n = Number(tarif[kelas]);
            if (Number.isFinite(n) && n >= 0) merged[kelas] = Math.round(n);
        }
        saveMutation.mutate({ tarifKamar: JSON.stringify(merged) });
    };

    const maxPercobaanLogin = settings?.maxPercobaanLogin ?? '20';

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Konfigurasi Sistem</h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '24px', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tabs.map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '12px 16px', borderRadius: 'var(--radius-md)',
                                background: activeTab === tab.key ? 'var(--bg-active)' : 'transparent',
                                color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
                                fontWeight: activeTab === tab.key ? 600 : 500,
                                border: 'none', cursor: 'pointer', textAlign: 'left',
                                transition: 'all var(--transition-fast)'
                            }}>
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                    {activeTab === 'profil' && (
                        <Card title="Profil Instansi Rumah Sakit" icon={<Building size={18} />}>
                            {isLoading ? <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Memuat pengaturan...</div> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}>Nama Rumah Sakit</label>
                                        <input className={uiStyles.formInput} value={profil.namaRS}
                                            onChange={(e) => setProfil(p => ({ ...p, namaRS: e.target.value }))}
                                            placeholder="cth. RSUD Tipe D Maju Bersama" />
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            Nama ini tampil di tiket antrean dan papan antrian (kiosk).
                                        </div>
                                    </div>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}>Alamat Lengkap</label>
                                        <textarea className={uiStyles.formTextarea} rows={3} value={profil.alamatRS}
                                            onChange={(e) => setProfil(p => ({ ...p, alamatRS: e.target.value }))} />
                                    </div>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}>Jam Layanan</label>
                                        <input className={uiStyles.formInput} value={profil.jamLayanan}
                                            onChange={(e) => setProfil(p => ({ ...p, jamLayanan: e.target.value }))}
                                            placeholder="cth. 24 Jam (IGD) / 08:00–14:00 (Poli)" />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                                        <Button variant="primary" onClick={handleSaveProfil} disabled={saveMutation.isPending}>
                                            <Save size={16} /> Simpan Perubahan
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    )}

                    {activeTab === 'tarif' && (
                        <Card title="Tarif Kamar Rawat Inap (per hari)" icon={<BedDouble size={18} />}>
                            {isLoading ? <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Memuat pengaturan...</div> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {KELAS_KAMAR.map(kelas => (
                                            <div key={kelas} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{kelas}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Default: Rp {rupiah(DEFAULT_TARIF[kelas])}</div>
                                                </div>
                                                <div className={uiStyles.formGroup} style={{ marginBottom: 0, width: '180px' }}>
                                                    <input className={uiStyles.formInput} type="number" min={0} step={1000}
                                                        value={tarif[kelas] ?? ''}
                                                        onChange={(e) => setTarif(t => ({ ...t, [kelas]: e.target.value }))} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        Tarif ini dipakai saat finalisasi billing rawat inap. Nilai kosong kembali ke default.
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                                        <Button variant="primary" onClick={handleSaveTarif} disabled={saveMutation.isPending}>
                                            <Save size={16} /> Simpan Tarif
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    )}

                    {activeTab === 'keamanan' && (
                        <Card title="Pengaturan Keamanan & Autentikasi" icon={<ShieldCheck size={18} />}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className={uiStyles.formGroup} style={{ maxWidth: '360px' }}>
                                    <label className={uiStyles.formLabel}>Max. Percobaan Login Gagal (sebelum lock)</label>
                                    <input className={uiStyles.formInput} type="number" value={maxPercobaanLogin} disabled />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    <Info size={16} style={{ flexShrink: 0, marginTop: 1, color: 'var(--primary)' }} />
                                    <span>Diterapkan via rate limiter server — nilai ini hanya informasi dan tidak dapat diubah dari aplikasi.</span>
                                </div>
                            </div>
                        </Card>
                    )}

                    {activeTab === 'server' && (
                        <Card title="Info Sistem" icon={<Activity size={18} />}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <div>
                                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Server Aplikasi (HIS)</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {health ? `Terakhir dicek: ${new Date(health.timestamp).toLocaleString('id-ID')}` : 'Memeriksa...'}
                                    </div>
                                    {health?.message && (
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{health.message}</div>
                                    )}
                                </div>
                                <StatusBadge variant={health?.status === 'ok' ? 'success' : health ? 'warning' : 'neutral'}>
                                    {health ? (health.status === 'ok' ? 'Online' : health.status) : '...'}
                                </StatusBadge>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
