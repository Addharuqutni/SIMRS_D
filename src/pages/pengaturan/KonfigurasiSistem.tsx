import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building, BedDouble, Activity, Save, Stethoscope } from 'lucide-react';
import { Button, Card, StatusBadge, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import { settingsApi } from '../../lib/api/settings';
import { errorMessage } from '../../lib/api-error';
import {
    DEFAULT_ROOM_TARIFF, DEFAULT_SERVICE_TARIFF, KELAS_KAMAR, LAYANAN_KEYS, LAYANAN_LABEL, parseTariff,
} from '../../../shared/tariff';
import styles from '../registrasi/registrasi.module.css';

const rupiah = (n: number) => new Intl.NumberFormat('id-ID').format(n);

/** Editable tariff table for one settings key (JSON object stored as a string). */
function TariffEditor({ title, icon, note, keys, labels, defaults, stored, onSave, saving }: {
    title: string;
    icon: React.ReactNode;
    note: string;
    keys: readonly string[];
    labels?: Record<string, string>;
    defaults: Record<string, number>;
    stored: string | undefined;
    onSave: (json: string) => void;
    saving: boolean;
}) {
    const [values, setValues] = useState<Record<string, string>>({});

    useEffect(() => {
        const parsed = parseTariff(stored, defaults);
        setValues(Object.fromEntries(keys.map((k) => [k, String(parsed[k])])));
    }, [stored, defaults, keys]);

    const save = () => {
        const merged: Record<string, number> = { ...defaults };
        for (const k of keys) {
            const n = Number(values[k]);
            if (values[k] !== '' && Number.isFinite(n) && n >= 0) merged[k] = Math.round(n);
        }
        onSave(JSON.stringify(merged));
    };

    return (
        <Card title={title} icon={icon}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {keys.map((k) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{labels?.[k] ?? k}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Default: Rp {rupiah(defaults[k])}</div>
                        </div>
                        <div className={uiStyles.formGroup} style={{ marginBottom: 0, width: '180px' }}>
                            <input className={uiStyles.formInput} type="number" min={0} step={1000}
                                value={values[k] ?? ''}
                                onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} />
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>{note}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', marginTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                <Button variant="primary" onClick={save} disabled={saving}>
                    <Save size={16} /> Simpan Tarif
                </Button>
            </div>
        </Card>
    );
}

export function KonfigurasiSistem() {
    const [activeTab, setActiveTab] = useState('profil');
    const queryClient = useQueryClient();

    const tabs = [
        { key: 'profil', label: 'Profil Rumah Sakit', icon: <Building size={16} /> },
        { key: 'tarif', label: 'Tarif Layanan', icon: <BedDouble size={16} /> },
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

    // Sync form state once settings load.
    useEffect(() => {
        if (!settings) return;
        setProfil({
            namaRS: settings.namaRS ?? 'RS SIMRS Tipe D',
            alamatRS: settings.alamatRS ?? '-',
            jamLayanan: settings.jamLayanan ?? '24 Jam',
        });
    }, [settings]);

    const saveMutation = useMutation({
        mutationFn: settingsApi.saveSettings,
        onSuccess: () => {
            showToast('Konfigurasi berhasil disimpan', 'success');
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
        onError: (err) => showToast(errorMessage(err, 'Gagal menyimpan konfigurasi'), 'danger'),
    });

    const handleSaveProfil = () => saveMutation.mutate({
        namaRS: profil.namaRS.trim(),
        alamatRS: profil.alamatRS.trim(),
        jamLayanan: profil.jamLayanan.trim(),
    });

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

                    {activeTab === 'tarif' && (isLoading ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Memuat pengaturan...</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <TariffEditor
                                title="Tarif Layanan" icon={<Stethoscope size={18} />}
                                note="Dipakai saat layanan diberikan (pendaftaran, order lab/radiologi). Tagihan yang sudah tercatat tidak berubah."
                                keys={LAYANAN_KEYS} labels={LAYANAN_LABEL} defaults={DEFAULT_SERVICE_TARIFF}
                                stored={settings?.tarifLayanan}
                                onSave={(json) => saveMutation.mutate({ tarifLayanan: json })} saving={saveMutation.isPending} />
                            <TariffEditor
                                title="Tarif Kamar Rawat Inap (per hari)" icon={<BedDouble size={18} />}
                                note="Dipakai saat pasien rawat inap dipulangkan (lama rawat × tarif kelas)."
                                keys={KELAS_KAMAR} defaults={DEFAULT_ROOM_TARIFF}
                                stored={settings?.tarifKamar}
                                onSave={(json) => saveMutation.mutate({ tarifKamar: json })} saving={saveMutation.isPending} />
                        </div>
                    ))}

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
