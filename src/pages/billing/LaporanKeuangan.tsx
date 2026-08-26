import { formatRp } from '../../lib/format';
import { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Download, Calendar, Eye, FileText } from 'lucide-react';
import { Card, Button, SearchBar, FilterTabs, StatusBadge, Pagination, Modal, showToast } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';
import { useTransactions } from '../../hooks/useBilling';
import { api } from '../../lib/axios';
import type { Transaction } from '../../lib/api/billing';

export function LaporanKeuangan() {
    const { data: transaksi = [] } = useTransactions();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('semua');
    const [periode, setPeriode] = useState('bulan-ini');
    const [detailModal, setDetailModal] = useState<Transaction | null>(null);

    const exportRlCsv = async () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        try {
            const res = await api.get('/reports/rl', {
                params: { year, month, format: 'csv' },
                responseType: 'blob',
            });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rl_${year}_${month}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showToast(`Laporan RL ${month}/${year} berhasil diekspor`, 'success');
        } catch {
            showToast('Gagal mengekspor laporan RL', 'danger');
        }
    };


    const exportRl2bCsv = async () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        try {
            const res = await api.get('/reports/rl2b', {
                params: { year, month, format: 'csv' },
                responseType: 'blob',
            });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rl2b_${year}_${month}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showToast(`Laporan RL 2b (Morbiditas) ${month}/${year} berhasil diekspor`, 'success');
        } catch {
            showToast('Gagal mengekspor laporan RL 2b', 'danger');
        }
    };


    const filtered = transaksi.filter((t: Transaction) => {
        const matchSearch = search.trim() === '' ||
            (t.keterangan?.toLowerCase().includes(search.toLowerCase()) || '') ||
            (t.id?.toLowerCase().includes(search.toLowerCase()) || '');
        const matchFilter = filter === 'semua' || t.jenis === filter;
        return matchSearch && matchFilter;
    });

    const totalPendapatan = transaksi.filter((t: Transaction) => t.jenis === 'pendapatan').reduce((a: number, t: Transaction) => a + t.jumlah, 0);
    const totalPiutang = transaksi.filter((t: Transaction) => t.jenis === 'piutang').reduce((a: number, t: Transaction) => a + t.jumlah, 0);
    const totalBiaya = transaksi.filter((t: Transaction) => t.jenis === 'biaya').reduce((a: number, t: Transaction) => a + t.jumlah, 0);

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Dashboard Akuntansi & Keuangan</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <select className={uiStyles.formSelect} value={periode} onChange={e => setPeriode(e.target.value)}
                        style={{ width: 'auto', minWidth: '160px' }}>
                        <option value="hari-ini">Hari Ini</option>
                        <option value="minggu-ini">Minggu Ini</option>
                        <option value="bulan-ini">Bulan Ini</option>
                        <option value="kuartal-ini">Kuartal Ini</option>
                        <option value="tahun-ini">Tahun Ini</option>
                    </select>
                    <Button variant="secondary" onClick={exportRlCsv}>
                        <FileText size={16} /> Export RL (CSV)
                    </Button>
                    <Button variant="secondary" onClick={exportRl2bCsv}>
                        <FileText size={16} /> Export RL 2b (CSV)
                    </Button>
                    <Button variant="secondary" onClick={() => showToast('Mengekspor laporan ke Excel...', 'info')}>
                        <Download size={16} /> Export (.xlsx)
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '16px', borderRadius: '16px' }}>
                            <TrendingUp size={28} />
                        </div>
                        <div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Pendapatan</div>
                            <div style={{ fontSize: '22px', fontWeight: 800 }}>{formatRp(totalPendapatan)}</div>
                            <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '2px', fontWeight: 600 }}>↑ 12.5% vs bulan lalu</div>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ background: '#fffbeb', color: '#d97706', padding: '16px', borderRadius: '16px' }}>
                            <DollarSign size={28} />
                        </div>
                        <div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Piutang BPJS / Asuransi</div>
                            <div style={{ fontSize: '22px', fontWeight: 800 }}>{formatRp(totalPiutang)}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Belum tertagih</div>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '16px', borderRadius: '16px' }}>
                            <TrendingDown size={28} />
                        </div>
                        <div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Pengeluaran</div>
                            <div style={{ fontSize: '22px', fontWeight: 800 }}>{formatRp(totalBiaya)}</div>
                            <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '2px', fontWeight: 600 }}>↑ 5.3% vs bulan lalu</div>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ background: 'var(--primary-100)', color: 'var(--primary)', padding: '16px', borderRadius: '16px' }}>
                            <BarChart3 size={28} />
                        </div>
                        <div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Laba Bersih</div>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: totalPendapatan - totalBiaya > 0 ? 'var(--success)' : '#dc2626' }}>
                                {formatRp(totalPendapatan - totalBiaya)}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Pendapatan - Biaya</div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <Card title="Grafik Pendapatan vs Pengeluaran (YTD)" icon={<DollarSign size={18} />}>
                    <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '20px 0' }}>
                        {['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'].map((bulan, i) => {
                            const heights = [65, 78, 72, 85, 90, 82];
                            const biayaH = [45, 52, 55, 48, 50, 47];
                            return (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                    <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '150px' }}>
                                        <div style={{ width: '16px', height: `${heights[i]}%`, background: 'var(--primary)', borderRadius: '4px 4px 0 0', opacity: i < 2 ? 1 : 0.3 }} />
                                        <div style={{ width: '16px', height: `${biayaH[i]}%`, background: '#dc2626', borderRadius: '4px 4px 0 0', opacity: i < 2 ? 1 : 0.3 }} />
                                    </div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{bulan}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '12px' }}>
                        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--primary)', marginRight: 4 }} />Pendapatan</span>
                        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#dc2626', marginRight: 4 }} />Pengeluaran</span>
                    </div>
                </Card>

                <Card title="Proporsi Pendapatan" icon={<BarChart3 size={18} />}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
                        {[
                            { unit: 'Farmasi', persen: 45, warna: 'var(--primary)' },
                            { unit: 'Tindakan Medis', persen: 25, warna: 'var(--success)' },
                            { unit: 'Laboratorium', persen: 15, warna: 'var(--warning)' },
                            { unit: 'Kamar / Akomodasi', persen: 10, warna: 'var(--info)' },
                            { unit: 'Lain-lain', persen: 5, warna: 'var(--text-muted)' },
                        ].map((d, i) => (
                            <div key={i}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                    <span>{d.unit}</span>
                                    <span style={{ fontWeight: 600 }}>{d.persen}%</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${d.persen}%`, height: '100%', background: d.warna, borderRadius: '4px' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Transaction Table */}
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
                <FileText size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
                Jurnal Transaksi
            </h2>
            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari transaksi..." value={search} onChange={setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: transaksi.length },
                        { label: 'Pendapatan', value: 'pendapatan', count: transaksi.filter((t: Transaction) => t.jenis === 'pendapatan').length },
                        { label: 'Piutang', value: 'piutang', count: transaksi.filter((t: Transaction) => t.jenis === 'piutang').length },
                        { label: 'Biaya', value: 'biaya', count: transaksi.filter((t: Transaction) => t.jenis === 'biaya').length },
                    ]}
                    active={filter} onChange={setFilter}
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={uiStyles.table}>
                    <thead>
                        <tr>
                            <th>ID</th><th>Tanggal</th><th>Keterangan</th><th>Kategori</th>
                            <th>Jenis</th><th style={{ textAlign: 'right' }}>Jumlah</th><th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada transaksi ditemukan</td></tr>
                        ) : filtered.map((trx: Transaction, i: number) => (
                            <tr key={i}>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{trx.id}</td>
                                <td><Calendar size={12} style={{ display: 'inline', marginRight: 4, color: 'var(--text-muted)' }} />{new Date(trx.tanggal).toLocaleDateString('id-ID')}</td>
                                <td style={{ maxWidth: '350px', whiteSpace: 'normal', fontSize: '13px' }}>{trx.keterangan}</td>
                                <td><StatusBadge variant="neutral" dot={false}>{trx.kategori}</StatusBadge></td>
                                <td>
                                    <StatusBadge variant={trx.jenis === 'pendapatan' ? 'success' : trx.jenis === 'piutang' ? 'warning' : 'danger'}>
                                        {trx.jenis === 'pendapatan' ? '↓ Pendapatan' : trx.jenis === 'piutang' ? '⏳ Piutang' : '↑ Biaya'}
                                    </StatusBadge>
                                </td>
                                <td style={{
                                    textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600,
                                    color: trx.jenis === 'biaya' ? '#dc2626' : trx.jenis === 'pendapatan' ? 'var(--success)' : '#d97706'
                                }}>
                                    {trx.jenis === 'biaya' ? '-' : '+'}{formatRp(trx.jumlah)}
                                </td>
                                <td>
                                    <Button variant="ghost" size="sm" title="Lihat Detail" style={{ color: 'var(--primary)' }}
                                        onClick={() => setDetailModal(trx)}>
                                        <Eye size={14} />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination currentPage={1} totalPages={1} totalItems={filtered.length} onPageChange={() => { }} />
            </div>

            {/* Detail Modal */}
            <Modal open={!!detailModal} onClose={() => setDetailModal(null)}
                title={`Detail Transaksi — ${detailModal?.id}`} icon={<FileText size={20} />}>
                {detailModal && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '14px' }}>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>ID Transaksi</strong>{detailModal.id}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Tanggal</strong>{new Date(detailModal.tanggal).toLocaleDateString()}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Kategori</strong>{detailModal.kategori}</div>
                            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Jenis</strong>
                                <StatusBadge variant={detailModal.jenis === 'pendapatan' ? 'success' : detailModal.jenis === 'piutang' ? 'warning' : 'danger'}>
                                    {detailModal.jenis === 'pendapatan' ? 'Pendapatan' : detailModal.jenis === 'piutang' ? 'Piutang' : 'Biaya'}
                                </StatusBadge>
                            </div>
                        </div>
                        <div style={{ borderLeft: `4px solid ${detailModal.jenis === 'biaya' ? '#dc2626' : detailModal.jenis === 'pendapatan' ? 'var(--success)' : '#d97706'}`, paddingLeft: '16px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>Keterangan</div>
                            <div style={{ fontSize: '14px', lineHeight: 1.6 }}>{detailModal.keterangan}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Jumlah</div>
                            <div style={{
                                fontSize: '28px', fontWeight: 800, fontFamily: 'var(--font-mono)',
                                color: detailModal.jenis === 'biaya' ? '#dc2626' : 'var(--success)'
                            }}>
                                {detailModal.jenis === 'biaya' ? '-' : '+'}{formatRp(detailModal.jumlah)}
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button variant="secondary" onClick={() => showToast('Mencetak bukti transaksi...', 'info')}>
                                Cetak Bukti
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
