import type { ReactNode } from 'react';
import {
    ClipboardList,
    Pill,
    Users,
    Wallet,
    CalendarDays,
    Activity,
    AlertTriangle,
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { StatCard, Card } from '../../components/ui';
import { useSession } from '../../lib/auth-client';
import { useList } from '../../lib/query';
import { reportsApi } from '../../lib/api/reports';
import { useVisitList } from '../../hooks/usePatient';
import { formatRp } from '../../lib/format';
import styles from './dashboard.module.css';

const activityDotColor: Record<string, 'blue' | 'green' | 'amber' | 'red'> = {
    menunggu: 'amber',
    pemeriksaan: 'blue',
    selesai: 'green',
    batal: 'red',
};

const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

export function Dashboard() {
    const { data: session } = useSession();
    const { data: dash, isLoading: dashLoading, isError: dashError } = useList('dashboard', reportsApi.getDashboard);
    const visits = useVisitList();

    const userName = session?.user?.name || 'Pengguna';
    const hour = new Date().getHours();
    const salam = hour < 11 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 19 ? 'Selamat Sore' : 'Selamat Malam';

    const today = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    // 7-day visit trend -> chart points
    const chartData = (dash?.trenKunjungan ?? []).map((t) => ({
        name: new Date(`${t.tanggal}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        kunjungan: t.jumlah,
    }));

    // Today's visits grouped per poli (rows are the latest page of registrations, newest first)
    const visitList = visits.rows;
    const todayStr = new Date().toDateString();
    const todayVisits = visitList.filter((v) => {
        const d = new Date(v.waktu);
        return !isNaN(d.getTime()) && d.toDateString() === todayStr;
    });
    const queueData = Object.entries(
        todayVisits.reduce<Record<string, number>>((acc, v) => {
            acc[v.poli] = (acc[v.poli] ?? 0) + 1;
            return acc;
        }, {})
    )
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    // Server-side total for today, rendered in the card header when it exceeds the loaded page
    const todayKey = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const todayVisitCount = dash?.trenKunjungan.find((t) => t.tanggal === todayKey)?.jumlah ?? todayVisits.length;

    // Latest 5 registrations as the activity feed
    const activities = visitList
        .slice()
        .sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime())
        .slice(0, 5)
        .map((v) => ({
            text: `${v.nama} mendaftar di ${v.poli} (${v.jaminan})`,
            time: fmtTime(v.waktu),
            color: activityDotColor[v.status] ?? 'blue',
        }));

    // Alerts derived from the dashboard stats
    const alerts: { text: string; type: 'alertWarning' | 'alertDanger' | 'alertInfo'; icon: ReactNode }[] = [];
    if (dash) {
        if (dash.resepBaru > 0) {
            alerts.push({ text: `${dash.resepBaru} resep baru menunggu diproses farmasi`, type: 'alertInfo', icon: <Pill size={16} /> });
        }
        if (dash.tagihanOpen.count > 0) {
            alerts.push({ text: `${dash.tagihanOpen.count} tagihan belum lunas — total ${formatRp(dash.tagihanOpen.total)}`, type: 'alertWarning', icon: <Wallet size={16} /> });
        }
        if (dash.kunjunganHariIni === 0) {
            alerts.push({ text: 'Belum ada kunjungan terdaftar hari ini', type: 'alertInfo', icon: <ClipboardList size={16} /> });
        }
    }

    return (
        <div className={styles.dashboard}>
            <div className={styles.greeting}>
                <div className={styles.greetingText}>
                    <h1>{salam}, {userName}</h1>
                    <p>Berikut ringkasan aktivitas rumah sakit hari ini</p>
                </div>
                <div className={styles.greetingDate}>
                    <CalendarDays size={16} />
                    {today}
                </div>
            </div>

            {/* Stat Cards */}
            <div className={styles.statsGrid}>
                <StatCard
                    icon={<ClipboardList size={22} />}
                    value={dashLoading ? '…' : dash ? dash.kunjunganHariIni : '—'}
                    label="Kunjungan Hari Ini"
                    color="blue"
                    style={{ animationDelay: '0.05s' }}
                />
                <StatCard
                    icon={<Pill size={22} />}
                    value={dashLoading ? '…' : dash ? dash.resepBaru : '—'}
                    label="Resep Baru Menunggu"
                    color="green"
                    style={{ animationDelay: '0.1s' }}
                />
                <StatCard
                    icon={<Users size={22} />}
                    value={dashLoading ? '…' : dash ? dash.totalPasien : '—'}
                    label="Total Pasien"
                    color="amber"
                    style={{ animationDelay: '0.15s' }}
                />
                <StatCard
                    icon={<Wallet size={22} />}
                    value={dashLoading ? '…' : dash ? formatRp(dash.tagihanOpen.total) : '—'}
                    label={dash ? `Tagihan Belum Lunas (${dash.tagihanOpen.count})` : 'Tagihan Belum Lunas'}
                    color="purple"
                    style={{ animationDelay: '0.2s' }}
                />
            </div>

            {/* Charts Row */}
            <div className={styles.chartsRow}>
                <Card title="Grafik Kunjungan (7 Hari)" icon={<Activity size={18} />}>
                    <div className={styles.chartContainer}>
                        {dashError ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '14px' }}>
                                Gagal memuat data kunjungan
                            </div>
                        ) : chartData.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '14px' }}>
                                Memuat grafik…
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorKunjungan" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--bg-card)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            boxShadow: 'var(--shadow-lg)',
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="kunjungan"
                                        name="Kunjungan"
                                        stroke="#0ea5e9"
                                        strokeWidth={2.5}
                                        fill="url(#colorKunjungan)"
                                        dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 0 }}
                                        activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>

                <Card title="Kunjungan per Poli Hari Ini" icon={<ClipboardList size={18} />}
                    action={todayVisitCount > visitList.length ? <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{todayVisitCount} kunjungan hari ini</span> : undefined}>
                    <div>
                        {visits.isLoading ? (
                            <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '14px' }}>Memuat data…</div>
                        ) : visits.isError ? (
                            <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '14px' }}>Gagal memuat data kunjungan</div>
                        ) : queueData.length === 0 ? (
                            <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '14px' }}>Belum ada kunjungan hari ini</div>
                        ) : (
                            queueData.map((item) => (
                                <div key={item.name} className={styles.queueItem}>
                                    <span className={styles.queueName}>{item.name}</span>
                                    <span className={styles.queueCount}>{item.count}</span>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div>

            {/* Bottom Row */}
            <div className={styles.bottomRow}>
                <Card title="Aktivitas Terkini" icon={<Activity size={18} />}>
                    <div>
                        {visits.isLoading ? (
                            <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '14px' }}>Memuat data…</div>
                        ) : visits.isError ? (
                            <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '14px' }}>Gagal memuat aktivitas</div>
                        ) : activities.length === 0 ? (
                            <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '14px' }}>Belum ada aktivitas</div>
                        ) : (
                            activities.map((act, i) => (
                                <div key={i} className={styles.activityItem}>
                                    <div className={`${styles.activityDot} ${styles[act.color]}`} />
                                    <span className={styles.activityText}>{act.text}</span>
                                    <span className={styles.activityTime}>{act.time}</span>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                <Card title="Alert & Peringatan" icon={<AlertTriangle size={18} />}>
                    <div>
                        {dashLoading ? (
                            <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '14px' }}>Memuat data…</div>
                        ) : alerts.length === 0 ? (
                            <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '14px' }}>Tidak ada peringatan</div>
                        ) : (
                            alerts.map((alert, i) => (
                                <div key={i} className={`${styles.alertItem} ${styles[alert.type]}`}>
                                    {alert.icon}
                                    {alert.text}
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
