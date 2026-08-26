import { useState } from 'react';
import { Shield, Filter, Download } from 'lucide-react';
import { Card, Button, Pagination, showToast, uiStyles } from '../../components/ui';
import { useAuditLogs } from '../../hooks/useAudit';
import styles from '../registrasi/registrasi.module.css';

const methodColor: Record<string, string> = {
    POST: '#16a34a',
    PUT: '#d97706',
    DELETE: '#dc2626',
};

export function AuditTrail() {
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ method: '', path: '', userId: '', startDate: '', endDate: '' });
    const [appliedFilters, setAppliedFilters] = useState({});

    const { data, isLoading } = useAuditLogs({ page, limit: 25, ...appliedFilters });

    const handleApplyFilter = () => {
        const clean: Record<string, string> = {};
        if (filters.method) clean.method = filters.method;
        if (filters.path) clean.path = filters.path;
        if (filters.userId) clean.userId = filters.userId;
        if (filters.startDate) clean.startDate = filters.startDate;
        if (filters.endDate) clean.endDate = filters.endDate;
        setAppliedFilters(clean);
        setPage(1);
        showToast('Filter diterapkan', 'info');
    };

    const handleExportCsv = () => {
        if (!data?.data.length) {
            showToast('Tidak ada data untuk diekspor', 'warning');
            return;
        }
        const headers = ['ID', 'User', 'Method', 'Path', 'IP', 'Waktu'];
        const rows = data.data.map(r => [r.id, r.userName || r.userId, r.method, r.path, r.ip || '-', new Date(r.createdAt).toLocaleString('id-ID')]);
        const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}><Shield size={24} /> Audit Trail Sistem</h1>
                <Button variant="secondary" onClick={handleExportCsv}><Download size={16} /> Export CSV</Button>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Method</label>
                        <select className={uiStyles.formSelect} value={filters.method} onChange={e => setFilters({ ...filters, method: e.target.value })}>
                            <option value="">Semua</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Path contains</label>
                        <input className={uiStyles.formInput} placeholder="/api/v1/..." value={filters.path} onChange={e => setFilters({ ...filters, path: e.target.value })} />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>User ID</label>
                        <input className={uiStyles.formInput} placeholder="user id" value={filters.userId} onChange={e => setFilters({ ...filters, userId: e.target.value })} />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Dari Tanggal</label>
                        <input type="date" className={uiStyles.formInput} value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
                    </div>
                    <div className={uiStyles.formGroup}>
                        <label className={uiStyles.formLabel}>Sampai Tanggal</label>
                        <input type="date" className={uiStyles.formInput} value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
                    </div>
                </div>
                <div style={{ marginTop: '12px' }}>
                    <Button variant="primary" onClick={handleApplyFilter}><Filter size={16} /> Terapkan Filter</Button>
                </div>
            </div>

            <Card>
                <div className={styles.tableWrapper}>
                    <table className={uiStyles.table}>
                        <thead>
                            <tr>
                                <th>Waktu</th>
                                <th>User</th>
                                <th>Method</th>
                                <th>Path</th>
                                <th>Body</th>
                                <th>IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>Memuat...</td></tr>
                            ) : !data?.data.length ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada log ditemukan</td></tr>
                            ) : data.data.map((log) => (
                                <tr key={log.id}>
                                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString('id-ID')}</td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{log.userName || '-'}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{log.userId}</div>
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: 'var(--radius-full, 999px)', fontSize: '11px', fontWeight: 700,
                                            background: `${methodColor[log.method] || '#6b7280'}20`, color: methodColor[log.method] || '#6b7280',
                                        }}>
                                            {log.method}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '12px', fontFamily: 'monospace', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.path}</td>
                                    <td style={{ fontSize: '11px', fontFamily: 'monospace', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)' }}>
                                        {log.body ? (log.body.length > 80 ? log.body.slice(0, 80) + '...' : log.body) : '-'}
                                    </td>
                                    <td style={{ fontSize: '12px' }}>{log.ip || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {data?.pagination && (
                    <Pagination
                        currentPage={data.pagination.page}
                        totalPages={data.pagination.totalPages || 1}
                        totalItems={data.pagination.total}
                        onPageChange={setPage}
                    />
                )}
            </Card>
        </div>
    );
}
