import { useState } from 'react';
import {
    ClipboardList,
    Pill,
    BedDouble,
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
import { StatCard, Card, FilterTabs } from '../../components/ui';
import styles from './dashboard.module.css';

const visitData: { name: string; kunjungan: number }[] = [];

const monthlyData: { name: string; kunjungan: number }[] = [];

const queueData: { name: string; count: number }[] = [];

const activities: { text: string; time: string; color: 'blue' | 'green' | 'amber' }[] = [];

const alerts: { text: string; type: 'alertWarning' | 'alertDanger' | 'alertInfo'; icon: React.ReactNode }[] = [];

export function Dashboard() {
    const [chartPeriod, setChartPeriod] = useState('mingguan');

    const chartData = chartPeriod === 'mingguan' ? visitData : monthlyData;

    const today = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <div className={styles.dashboard}>
            <div className={styles.greeting}>
                <div className={styles.greetingText}>
                    <h1>Selamat Pagi, Administrator 👋</h1>
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
                    value="0"
                    label="Kunjungan Hari Ini"
                    color="blue"
                    style={{ animationDelay: '0.05s' }}
                />
                <StatCard
                    icon={<Pill size={22} />}
                    value="0"
                    label="Resep Hari Ini"
                    color="green"
                    style={{ animationDelay: '0.1s' }}
                />
                <StatCard
                    icon={<BedDouble size={22} />}
                    value="0/0"
                    label="Bed Terisi (0%)"
                    color="amber"
                    style={{ animationDelay: '0.15s' }}
                />
                <StatCard
                    icon={<Wallet size={22} />}
                    value="Rp 0"
                    label="Pendapatan Hari Ini"
                    color="purple"
                    style={{ animationDelay: '0.2s' }}
                />
            </div>

            {/* Charts Row */}
            <div className={styles.chartsRow}>
                <Card
                    title="Grafik Kunjungan"
                    icon={<Activity size={18} />}
                    action={
                        <FilterTabs
                            tabs={[
                                { label: 'Mingguan', value: 'mingguan' },
                                { label: 'Bulanan', value: 'bulanan' },
                            ]}
                            active={chartPeriod}
                            onChange={setChartPeriod}
                        />
                    }
                >
                    <div className={styles.chartContainer}>
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
                                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
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
                                    stroke="#0ea5e9"
                                    strokeWidth={2.5}
                                    fill="url(#colorKunjungan)"
                                    dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 0 }}
                                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card title="Antrean Real-time" icon={<ClipboardList size={18} />}>
                    <div>
                        {queueData.map((item) => (
                            <div key={item.name} className={styles.queueItem}>
                                <span className={styles.queueName}>{item.name}</span>
                                <span className={styles.queueCount}>{item.count}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Bottom Row */}
            <div className={styles.bottomRow}>
                <Card title="Aktivitas Terkini" icon={<Activity size={18} />}>
                    <div>
                        {activities.map((act, i) => (
                            <div key={i} className={styles.activityItem}>
                                <div className={`${styles.activityDot} ${styles[act.color]}`} />
                                <span className={styles.activityText}>{act.text}</span>
                                <span className={styles.activityTime}>{act.time}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card title="Alert & Peringatan" icon={<AlertTriangle size={18} />}>
                    <div>
                        {alerts.map((alert, i) => (
                            <div key={i} className={`${styles.alertItem} ${styles[alert.type]}`}>
                                {alert.icon}
                                {alert.text}
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}
