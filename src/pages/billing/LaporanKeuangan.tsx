import { formatRp } from '../../lib/format';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Calendar, FileText, Download } from 'lucide-react';
import { Card, Button, SearchBar, FilterTabs, StatusBadge, Pagination, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';
import { useTransactions } from '../../hooks/useBilling';
import { reportsApi } from '../../lib/api/reports';
import type { Transaction } from '../../lib/api/billing';
import { downloadFile } from '../../lib/download';
import { errorMessage } from '../../lib/api-error';

const PAGE_SIZE = 20;
const JENIS = {
    pendapatan: { label: 'Pendapatan', variant: 'success', sign: '+', color: 'var(--success)' },
    piutang: { label: 'Piutang', variant: 'warning', sign: '+', color: '#d97706' },
    biaya: { label: 'Biaya', variant: 'danger', sign: '-', color: '#dc2626' },
} as const;
const BAR_COLORS = ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--info)', 'var(--text-muted)'];

const monthLabel = (ym: string) =>
    new Date(`${ym}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });

export function LaporanKeuangan() {
    const { data: transaksi = [] } = useTransactions();
    const { data: monthly = [] } = useQuery({ queryKey: ['finance-monthly'], queryFn: () => reportsApi.getFinanceMonthly(6) });
    const { data: byCategory = [] } = useQuery({ queryKey: ['finance-by-category'], queryFn: reportsApi.getRevenueByCategory });

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('semua');
    const [page, setPage] = useState(1);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const exportCsv = async (path: string, filename: string, label: string) => {
        try {
            await downloadFile(path, filename, { year, month, format: 'csv' });
            showToast(`${label} berhasil diekspor`, 'success');
        } catch (err) {
            showToast(errorMessage(err, `Gagal mengekspor ${label}`), 'danger');
        }
    };

    const totals = useMemo(() => {
        const t = { pendapatan: 0, piutang: 0, biaya: 0 };
        for (const x of transaksi) t[x.jenis] += x.jumlah;
        return t;
    }, [transaksi]);

    const needle = search.trim().toLowerCase();
    const filtered = transaksi.filter((t: Transaction) =>
        (filter === 'semua' || t.jenis === filter) &&
        (needle === '' || t.keterangan.toLowerCase().includes(needle) || t.id.toLowerCase().includes(needle)));
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const countOf = (jenis: string) => transaksi.filter((t) => t.jenis === jenis).length;

    const maxMonthly = Math.max(1, ...monthly.flatMap((m) => [m.pendapatan + m.piutang, m.biaya]));
    const categoryTotal = byCategory.reduce((a, c) => a + c.total, 0);

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Dashboard Akuntansi & Keuangan</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button variant="secondary" onClick={() => exportCsv('/reports/rl', `rl_${year}_${month}.csv`, `Laporan RL ${month}/${year}`)}>
                        <FileText size={16} /> Export RL (CSV)
                    </Button>
                    <Button variant="secondary" onClick={() => exportCsv('/reports/rl2b', `rl2b_${year}_${month}.csv`, `Laporan RL 2b ${month}/${year}`)}>
                        <FileText size={16} /> Export RL 2b (CSV)
                    </Button>
                    <Button variant="secondary" onClick={() => exportCsv('/reports/finance/export-csv', `jurnal_${year}_${month}.csv`, 'Jurnal transaksi 30 hari')}>
                        <Download size={16} /> Export Jurnal (CSV)
                    </Button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
                {[
                    { icon: <TrendingUp size={28} />, bg: '#f0fdf4', fg: '#16a34a', label: 'Total Pendapatan', value: totals.pendapatan, note: 'Pembayaran tunai/non-tunai' },
                    { icon: <DollarSign size={28} />, bg: '#fffbeb', fg: '#d97706', label: 'Piutang BPJS / Asuransi', value: totals.piutang, note: 'Belum tertagih' },
                    { icon: <TrendingDown size={28} />, bg: '#fef2f2', fg: '#dc2626', label: 'Total Pengeluaran', value: totals.biaya, note: 'Tercatat di jurnal' },
                    { icon: <BarChart3 size={28} />, bg: 'var(--primary-100)', fg: 'var(--primary)', label: 'Laba Bersih', value: totals.pendapatan - totals.biaya, note: 'Pendapatan - Biaya' },
                ].map((c) => (
                    <Card key={c.label}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ background: c.bg, color: c.fg, padding: '16px', borderRadius: '16px' }}>{c.icon}</div>
                            <div>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{c.label}</div>
                                <div style={{ fontSize: '22px', fontWeight: 800 }}>{formatRp(c.value)}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{c.note}</div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <Card title="Pemasukan vs Pengeluaran (6 bulan)" icon={<DollarSign size={18} />}>
                    <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '20px 0' }}>
                        {monthly.map((m) => (
                            <div key={m.bulan} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                                title={`Masuk ${formatRp(m.pendapatan + m.piutang)} · Keluar ${formatRp(m.biaya)}`}>
                                <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '150px' }}>
                                    <div style={{ width: '16px', height: `${((m.pendapatan + m.piutang) / maxMonthly) * 100}%`, background: 'var(--primary)', borderRadius: '4px 4px 0 0' }} />
                                    <div style={{ width: '16px', height: `${(m.biaya / maxMonthly) * 100}%`, background: '#dc2626', borderRadius: '4px 4px 0 0' }} />
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{monthLabel(m.bulan)}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '12px' }}>
                        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--primary)', marginRight: 4 }} />Pendapatan + Piutang</span>
                        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#dc2626', marginRight: 4 }} />Pengeluaran</span>
                    </div>
                </Card>

                <Card title="Proporsi Pendapatan (tagihan lunas)" icon={<BarChart3 size={18} />}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
                        {byCategory.length === 0 ? (
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Belum ada tagihan lunas</div>
                        ) : byCategory.map((d, i) => {
                            const persen = categoryTotal ? Math.round((d.total / categoryTotal) * 100) : 0;
                            return (
                                <div key={d.kategori}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                        <span>{d.kategori}</span>
                                        <span style={{ fontWeight: 600 }}>{persen}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${persen}%`, height: '100%', background: BAR_COLORS[i % BAR_COLORS.length], borderRadius: '4px' }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>

            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
                <FileText size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
                Jurnal Transaksi
            </h2>
            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari transaksi..." value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: transaksi.length },
                        { label: 'Pendapatan', value: 'pendapatan', count: countOf('pendapatan') },
                        { label: 'Piutang', value: 'piutang', count: countOf('piutang') },
                        { label: 'Biaya', value: 'biaya', count: countOf('biaya') },
                    ]}
                    active={filter} onChange={(v) => { setFilter(v); setPage(1); }}
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead>
                        <tr>
                            <th>Referensi</th><th>Tanggal</th><th>Keterangan</th><th>Kategori</th>
                            <th>Jenis</th><th style={{ textAlign: 'right' }}>Jumlah</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageRows.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada transaksi ditemukan</td></tr>
                        ) : pageRows.map((trx) => {
                            const j = JENIS[trx.jenis];
                            return (
                                <tr key={trx.id}>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{trx.referensi ?? trx.id}</td>
                                    <td><Calendar size={12} style={{ display: 'inline', marginRight: 4, color: 'var(--text-muted)' }} />{new Date(trx.tanggal).toLocaleDateString('id-ID')}</td>
                                    <td style={{ maxWidth: '350px', whiteSpace: 'normal', fontSize: '13px' }}>{trx.keterangan}</td>
                                    <td><StatusBadge variant="neutral" dot={false}>{trx.kategori}</StatusBadge></td>
                                    <td><StatusBadge variant={j.variant}>{j.label}</StatusBadge></td>
                                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: j.color }}>
                                        {j.sign}{formatRp(trx.jumlah)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <Pagination currentPage={page} totalPages={totalPages} totalItems={filtered.length} onPageChange={setPage} />
            </div>
        </div>
    );
}
