import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, Clock, AlertTriangle, FileText, Users, Package } from 'lucide-react';
import { Button, StatusBadge, FilterTabs, Card, ConfirmDialog, showToast } from '../../components/ui';
import { useNotifications, useUnreadCount, useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteNotification, useClearNotifications } from '../../hooks/useNotification';
import type { AppNotification } from '../../lib/api/notification';
import styles from '../registrasi/registrasi.module.css';

type Tipe = 'info' | 'warning' | 'success' | 'danger';
type Kategori = 'sistem' | 'pasien' | 'farmasi' | 'keuangan';

const iconMap: Record<Kategori, React.ReactNode> = {
    farmasi: <Package size={18} />,
    keuangan: <FileText size={18} />,
    pasien: <Users size={18} />,
    sistem: <Bell size={18} />,
};

const colorMap: Record<Tipe, string> = {
    info: 'var(--primary)',
    warning: '#d97706',
    success: '#16a34a',
    danger: '#dc2626',
};

const bgMap: Record<Tipe, string> = {
    info: '#eff6ff',
    warning: '#fffbeb',
    success: '#f0fdf4',
    danger: '#fef2f2',
};

// DB stores info|success|warning|error; the UI palette uses "danger" for error.
const toTipe = (type: string): Tipe =>
    type === 'warning' ? 'warning' : type === 'success' ? 'success' : type === 'error' || type === 'danger' ? 'danger' : 'info';

// The table has no kategori column — derive it from linkUrl so tabs/icons stay meaningful.
const toKategori = (linkUrl?: string | null): Kategori => {
    const url = linkUrl || '';
    if (url.startsWith('/farmasi')) return 'farmasi';
    if (url.startsWith('/billing') || url.startsWith('/laporan-keuangan') || url.startsWith('/klaim-bpjs') || url.startsWith('/kasir')) return 'keuangan';
    if (url.startsWith('/registrasi') || url.startsWith('/pasien') || url.startsWith('/rekam-medis') || url.startsWith('/rawat-jalan') || url.startsWith('/rawat-inap') || url.startsWith('/igd') || url.startsWith('/antrean') || url.startsWith('/sep')) return 'pasien';
    return 'sistem';
};

const formatWaktu = (iso: string): string => {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return iso;
    const diff = Date.now() - then;
    const menit = Math.floor(diff / 60000);
    if (menit < 1) return 'Baru saja';
    if (menit < 60) return `${menit} menit lalu`;
    const jam = Math.floor(menit / 60);
    if (jam < 24) return `${jam} jam lalu`;
    const hari = Math.floor(jam / 24);
    if (hari < 7) return `${hari} hari lalu`;
    return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

export function NotifikasiPage() {
    const navigate = useNavigate();
    const { data: notifs = [], isLoading } = useNotifications();
    const { data: unreadCount = 0 } = useUnreadCount();
    const markRead = useMarkNotificationRead();
    const markAll = useMarkAllNotificationsRead();
    const deleteOne = useDeleteNotification();
    const clearAllMut = useClearNotifications();

    const [filter, setFilter] = useState('semua');
    const [clearOpen, setClearOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<AppNotification | null>(null);

    const kategoriOf = (n: AppNotification) => toKategori(n.linkUrl);
    const tipeOf = (n: AppNotification) => toTipe(n.type);

    const filtered = notifs.filter(n => {
        if (filter === 'belum-baca') return !n.isRead;
        if (filter === 'semua') return true;
        return kategoriOf(n) === filter;
    });

    const markAllRead = () => {
        markAll.mutate(undefined, {
            onSuccess: () => showToast('Semua notifikasi ditandai sudah dibaca', 'success'),
            onError: () => showToast('Gagal menandai notifikasi', 'danger'),
        });
    };

    const openNotif = (notif: AppNotification) => {
        if (!notif.isRead) {
            markRead.mutate(notif.id, {
                onError: () => showToast('Gagal menandai notifikasi', 'danger'),
            });
        }
        if (notif.linkUrl) navigate(notif.linkUrl);
    };

    const confirmDelete = () => {
        const target = deleteTarget;
        setDeleteTarget(null);
        if (!target) return;
        deleteOne.mutate(target.id, {
            onSuccess: () => showToast('Notifikasi dihapus', 'info'),
            onError: () => showToast('Gagal menghapus notifikasi', 'danger'),
        });
    };

    const clearAll = () => {
        clearAllMut.mutate(notifs.map(n => n.id), {
            onSuccess: () => showToast('Semua notifikasi telah dihapus', 'success'),
            onError: () => showToast('Gagal menghapus notifikasi', 'danger'),
        });
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
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{notifs.filter(n => ['warning', 'danger'].includes(tipeOf(n))).length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Perlu Tindakan</div></div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '12px', color: '#16a34a' }}><CheckCheck size={20} /></div>
                        <div><div style={{ fontSize: '22px', fontWeight: 700 }}>{notifs.filter(n => n.isRead).length}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Sudah Dibaca</div></div>
                    </div>
                </Card>
            </div>

            <div className={styles.toolbar}>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: notifs.length },
                        { label: 'Belum Dibaca', value: 'belum-baca', count: unreadCount },
                        { label: 'Pasien', value: 'pasien', count: notifs.filter(n => kategoriOf(n) === 'pasien').length },
                        { label: 'Farmasi', value: 'farmasi', count: notifs.filter(n => kategoriOf(n) === 'farmasi').length },
                        { label: 'Keuangan', value: 'keuangan', count: notifs.filter(n => kategoriOf(n) === 'keuangan').length },
                        { label: 'Sistem', value: 'sistem', count: notifs.filter(n => kategoriOf(n) === 'sistem').length },
                    ]}
                    active={filter} onChange={setFilter}
                />
            </div>

            {/* Notification List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>Memuat notifikasi...</div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                        <Bell size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
                        <div style={{ fontSize: '16px', fontWeight: 600 }}>Tidak ada notifikasi</div>
                        <div style={{ fontSize: '13px', marginTop: 4 }}>Semua notifikasi telah dibaca atau dihapus</div>
                    </div>
                ) : filtered.map(notif => {
                    const tipe = tipeOf(notif);
                    return (
                        <div key={notif.id} style={{
                            display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '16px 20px',
                            background: notif.isRead ? 'var(--bg-card)' : bgMap[tipe],
                            border: `1px solid ${notif.isRead ? 'var(--border)' : colorMap[tipe] + '33'}`,
                            borderRadius: 'var(--radius-md)', cursor: notif.linkUrl ? 'pointer' : 'default',
                            borderLeft: `4px solid ${colorMap[tipe]}`,
                            opacity: notif.isRead ? 0.75 : 1,
                            transition: 'all 0.2s ease',
                        }}
                            onClick={() => openNotif(notif)}
                        >
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '10px',
                                background: bgMap[tipe], color: colorMap[tipe],
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                                {iconMap[kategoriOf(notif)]}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{notif.title}</span>
                                    {!notif.isRead && <span style={{ width: 8, height: 8, borderRadius: '50%', background: colorMap[tipe], flexShrink: 0 }} />}
                                    <StatusBadge variant={tipe} dot={false}>
                                        {kategoriOf(notif)}
                                    </StatusBadge>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{notif.message}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={11} /> {formatWaktu(notif.createdAt)}
                                </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(notif); }} title="Hapus"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px', borderRadius: '6px', flexShrink: 0 }}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>

            <ConfirmDialog open={clearOpen} onClose={() => setClearOpen(false)} onConfirm={clearAll}
                title="Hapus Semua Notifikasi?" message="Semua notifikasi akan dihapus secara permanen."
                variant="danger" confirmLabel="Ya, Hapus Semua" />

            <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete}
                title="Hapus Notifikasi?" message={`Notifikasi "${deleteTarget?.title || ''}" akan dihapus secara permanen.`}
                variant="danger" confirmLabel="Ya, Hapus" />
        </div>
    );
}
