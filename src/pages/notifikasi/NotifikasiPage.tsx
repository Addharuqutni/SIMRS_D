import { useState } from 'react';
import { Bell, CheckCheck, Trash2, Clock, AlertTriangle, FileText, Users, Package } from 'lucide-react';
import { Button, StatusBadge, FilterTabs, Card, ConfirmDialog, showToast } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';

interface Notification {
    id: number; judul: string; pesan: string; waktu: string;
    tipe: 'info' | 'warning' | 'success' | 'danger';
    kategori: 'sistem' | 'pasien' | 'farmasi' | 'keuangan';
    read: boolean;
}

const initialNotifs: Notification[] = [];

const iconMap: Record<string, React.ReactNode> = {
    farmasi: <Package size={18} />,
    keuangan: <FileText size={18} />,
    pasien: <Users size={18} />,
    sistem: <Bell size={18} />,
};

const colorMap: Record<string, string> = {
    info: 'var(--primary)',
    warning: '#d97706',
    success: '#16a34a',
    danger: '#dc2626',
};

const bgMap: Record<string, string> = {
    info: '#eff6ff',
    warning: '#fffbeb',
    success: '#f0fdf4',
    danger: '#fef2f2',
};

export function NotifikasiPage() {
    const [notifs, setNotifs] = useState<Notification[]>(initialNotifs);
    const [filter, setFilter] = useState('semua');
    const [clearOpen, setClearOpen] = useState(false);

    const filtered = notifs.filter(n => {
        if (filter === 'belum-baca') return !n.read;
        if (filter === 'semua') return true;
        return n.kategori === filter;
    });

    const unreadCount = notifs.filter(n => !n.read).length;

    const markAllRead = () => {
        setNotifs(prev => prev.map(n => ({ ...n, read: true })));
        showToast('Semua notifikasi ditandai sudah dibaca', 'success');
    };

    const markRead = (id: number) => {
        setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const deleteNotif = (id: number) => {
        setNotifs(prev => prev.filter(n => n.id !== id));
        showToast('Notifikasi dihapus', 'info');
    };

    const clearAll = () => {
        setNotifs([]);
        showToast('Semua notifikasi telah dihapus', 'success');
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Pusat Notifikasi</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button variant="secondary" onClick={markAllRead} disabled={unreadCount === 0}>
                        <CheckCheck size={16} /> Tandai Semua Dibaca
                    </Button>
                    <Button variant="secondary" onClick={() => setClearOpen(true)} disabled={notifs.length === 0}>
                        <Trash2 size={16} /> Hapus Semua
                    </Button>
                </div>
            </div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '12px', color: '#dc2626' }}><AlertTriangle size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{unreadCount}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Belum Dibaca</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '12px', color: '#3b82f6' }}><Bell size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{notifs.length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Notifikasi</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '12px', color: '#d97706' }}><Clock size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{notifs.filter(n => n.tipe === 'warning' || n.tipe === 'danger').length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Perlu Tindakan</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '12px', color: '#16a34a' }}><CheckCheck size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{notifs.filter(n => n.read).length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Sudah Dibaca</div></div>
                    </div>
                </Card>
            </div>

            <div className={styles.toolbar}>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: notifs.length },
                        { label: 'Belum Dibaca', value: 'belum-baca', count: unreadCount },
                        { label: 'Pasien', value: 'pasien', count: notifs.filter(n => n.kategori === 'pasien').length },
                        { label: 'Farmasi', value: 'farmasi', count: notifs.filter(n => n.kategori === 'farmasi').length },
                        { label: 'Keuangan', value: 'keuangan', count: notifs.filter(n => n.kategori === 'keuangan').length },
                        { label: 'Sistem', value: 'sistem', count: notifs.filter(n => n.kategori === 'sistem').length },
                    ]}
                    active={filter} onChange={setFilter}
                />
            </div>

            {/* Notification List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                        <Bell size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
                        <div style={{ fontSize: '16px', fontWeight: 600 }}>Tidak ada notifikasi</div>
                        <div style={{ fontSize: '13px', marginTop: 4 }}>Semua notifikasi telah dibaca atau dihapus</div>
                    </div>
                ) : filtered.map(notif => (
                    <div key={notif.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '16px 20px',
                        background: notif.read ? 'var(--bg-card)' : bgMap[notif.tipe],
                        border: `1px solid ${notif.read ? 'var(--border)' : colorMap[notif.tipe] + '33'}`,
                        borderRadius: 'var(--radius-md)', cursor: 'pointer',
                        borderLeft: `4px solid ${colorMap[notif.tipe]}`,
                        opacity: notif.read ? 0.75 : 1,
                        transition: 'all 0.2s ease',
                    }}
                        onClick={() => markRead(notif.id)}
                    >
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: bgMap[notif.tipe], color: colorMap[notif.tipe],
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            {iconMap[notif.kategori]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 600, fontSize: '14px' }}>{notif.judul}</span>
                                {!notif.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: colorMap[notif.tipe], flexShrink: 0 }} />}
                                <StatusBadge variant={
                                    notif.tipe === 'danger' ? 'danger' : notif.tipe === 'warning' ? 'warning' : notif.tipe === 'success' ? 'success' : 'info'
                                } dot={false}>
                                    {notif.kategori}
                                </StatusBadge>
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{notif.pesan}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={11} /> {notif.waktu}
                            </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteNotif(notif.id); }} title="Hapus"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px', borderRadius: '6px', flexShrink: 0 }}>
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>

            <ConfirmDialog open={clearOpen} onClose={() => setClearOpen(false)} onConfirm={clearAll}
                title="Hapus Semua Notifikasi?" message="Semua notifikasi akan dihapus secara permanen."
                variant="danger" confirmLabel="Ya, Hapus Semua" />
        </div>
    );
}
