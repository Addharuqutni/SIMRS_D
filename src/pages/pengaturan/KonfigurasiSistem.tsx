import { useState } from 'react';
import { Building, Globe, ShieldCheck, HardDrive, Cpu, Save, RefreshCcw, Lock, Key, Clock } from 'lucide-react';
import { Button, Card, StatusBadge, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';

export function KonfigurasiSistem() {
    const [activeTab, setActiveTab] = useState('profil');

    const tabs = [
        { key: 'profil', label: 'Profil Rumah Sakit', icon: <Building size={16} /> },
        { key: 'bridging', label: 'API & Bridging BPJS', icon: <Globe size={16} /> },
        { key: 'keamanan', label: 'Keamanan & Autentikasi', icon: <ShieldCheck size={16} /> },
        { key: 'database', label: 'Backup & Database', icon: <HardDrive size={16} /> },
        { key: 'server', label: 'Status Server (HIS)', icon: <Cpu size={16} /> },
    ];

    const handleSave = (section: string) => {
        showToast(`Konfigurasi ${section} berhasil disimpan`, 'success');
    };

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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className={uiStyles.formGroup}>
                                    <label className={uiStyles.formLabel}>Nama Rumah Sakit</label>
                                    <input className={uiStyles.formInput} defaultValue="RSUD Tipe D Maju Bersama" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}>Kode PPK BPJS / Kemenkes</label>
                                        <input className={uiStyles.formInput} defaultValue="1021R001" />
                                    </div>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}>Kelas / Tipe RS</label>
                                        <select className={uiStyles.formSelect} defaultValue="D">
                                            <option value="A">Tipe A</option><option value="B">Tipe B</option>
                                            <option value="C">Tipe C</option><option value="D">Tipe D</option>
                                        </select>
                                    </div>
                                </div>
                                <div className={uiStyles.formGroup}>
                                    <label className={uiStyles.formLabel}>Alamat Lengkap</label>
                                    <textarea className={uiStyles.formTextarea} rows={3} defaultValue="Jl. Kesehatan No. 123, Kec. Sehat, Kota Bahagia" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}>Nomor Telepon</label>
                                        <input className={uiStyles.formInput} defaultValue="(021) 555-0123" />
                                    </div>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}>Email Official</label>
                                        <input className={uiStyles.formInput} defaultValue="info@rsmajubersama.go.id" />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                                    <Button variant="primary" onClick={() => handleSave('Profil RS')}>
                                        <Save size={16} /> Simpan Perubahan
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}

                    {activeTab === 'bridging' && (
                        <Card title="Bridging VClaim BPJS & SATUSEHAT" icon={<Globe size={18} />}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ background: 'var(--bg)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></div>
                                        VClaim BPJS Kesehatan Web Service
                                    </h4>
                                    <div className={uiStyles.formGroup} style={{ marginBottom: '12px' }}>
                                        <label className={uiStyles.formLabel}>Cons ID</label>
                                        <input className={uiStyles.formInput} type="password" defaultValue="12345678" />
                                    </div>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}>Secret Key</label>
                                        <input className={uiStyles.formInput} type="password" defaultValue="abcdefghijklmnopqrstuvwxyz" />
                                    </div>
                                </div>
                                <div style={{ background: 'var(--bg)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)' }}></div>
                                        Kemenkes SATUSEHAT (IHS)
                                    </h4>
                                    <div className={uiStyles.formGroup} style={{ marginBottom: '12px' }}>
                                        <label className={uiStyles.formLabel}>Client ID</label>
                                        <input className={uiStyles.formInput} type="password" defaultValue="" placeholder="Belum dikonfigurasi" />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button variant="primary" onClick={() => handleSave('API Bridging')}>
                                        <Save size={16} /> Simpan Kunci API
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}

                    {activeTab === 'keamanan' && (
                        <Card title="Pengaturan Keamanan & Autentikasi" icon={<ShieldCheck size={18} />}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}><Lock size={14} style={{ display: 'inline', marginRight: 4 }} />Durasi Session Timeout (menit)</label>
                                        <input className={uiStyles.formInput} type="number" defaultValue={30} />
                                    </div>
                                    <div className={uiStyles.formGroup}>
                                        <label className={uiStyles.formLabel}><Key size={14} style={{ display: 'inline', marginRight: 4 }} />Minimum Panjang Password</label>
                                        <input className={uiStyles.formInput} type="number" defaultValue={8} />
                                    </div>
                                </div>
                                <div className={uiStyles.formGroup}>
                                    <label className={uiStyles.formLabel}>Kebijakan Password</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        {[
                                            { label: 'Wajib huruf besar & kecil', checked: true },
                                            { label: 'Wajib mengandung angka', checked: true },
                                            { label: 'Wajib karakter spesial (!@#$)', checked: false },
                                            { label: 'Paksa ganti password setiap 90 hari', checked: true },
                                        ].map((p, i) => (
                                            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                                                <input type="checkbox" defaultChecked={p.checked} style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }} />
                                                {p.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className={uiStyles.formGroup}>
                                    <label className={uiStyles.formLabel}>Max. Percobaan Login Gagal (sebelum lock)</label>
                                    <input className={uiStyles.formInput} type="number" defaultValue={5} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                                    <Button variant="primary" onClick={() => handleSave('Keamanan')}>
                                        <Save size={16} /> Simpan Pengaturan
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}

                    {activeTab === 'database' && (
                        <Card title="Backup & Manajemen Database" icon={<HardDrive size={18} />}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ background: 'var(--bg)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Jadwal Backup Otomatis</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div className={uiStyles.formGroup}>
                                            <label className={uiStyles.formLabel}>Frekuensi</label>
                                            <select className={uiStyles.formSelect} defaultValue="daily">
                                                <option value="hourly">Setiap Jam</option>
                                                <option value="daily">Harian (00:00)</option>
                                                <option value="weekly">Mingguan (Minggu)</option>
                                            </select>
                                        </div>
                                        <div className={uiStyles.formGroup}>
                                            <label className={uiStyles.formLabel}>Retensi Backup</label>
                                            <select className={uiStyles.formSelect} defaultValue="30">
                                                <option value="7">7 Hari</option>
                                                <option value="14">14 Hari</option>
                                                <option value="30">30 Hari</option>
                                                <option value="90">90 Hari</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Riwayat Backup Terbaru</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {[
                                            { time: '27/02/2026 00:00', size: '245 MB', status: 'success' },
                                            { time: '26/02/2026 00:00', size: '243 MB', status: 'success' },
                                            { time: '25/02/2026 00:00', size: '241 MB', status: 'success' },
                                        ].map((b, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '13px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                                                    <span>{b.time}</span>
                                                </div>
                                                <span style={{ color: 'var(--text-secondary)' }}>{b.size}</span>
                                                <StatusBadge variant="success">Sukses</StatusBadge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                                    <Button variant="secondary" onClick={() => showToast('Backup manual dimulai...', 'info')}>
                                        <RefreshCcw size={16} /> Backup Manual Sekarang
                                    </Button>
                                    <Button variant="primary" onClick={() => handleSave('Database')}>
                                        <Save size={16} /> Simpan Jadwal
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}

                    {activeTab === 'server' && (
                        <Card title="Status Server & Sistem HIS" icon={<Cpu size={18} />}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {[
                                    { label: 'Server Aplikasi (HIS)', status: 'online', uptime: '99.8%', cpu: '23%', ram: '45%' },
                                    { label: 'Database Server (PostgreSQL)', status: 'online', uptime: '99.9%', cpu: '12%', ram: '62%' },
                                    { label: 'API Gateway (Bridging)', status: 'online', uptime: '99.5%', cpu: '8%', ram: '28%' },
                                    { label: 'PACS Server (Radiologi)', status: 'warning', uptime: '97.2%', cpu: '67%', ram: '78%' },
                                ].map((s, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>{s.label}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Uptime: {s.uptime}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '13px' }}>
                                            <span>CPU: <strong>{s.cpu}</strong></span>
                                            <span>RAM: <strong>{s.ram}</strong></span>
                                            <StatusBadge variant={s.status === 'online' ? 'success' : 'warning'}>
                                                {s.status === 'online' ? 'Online' : 'High Load'}
                                            </StatusBadge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
