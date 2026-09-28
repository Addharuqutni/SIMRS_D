import { useState } from 'react';
import { Shield, Filter, Download, Trash2 } from 'lucide-react';
import { Card, Button, Pagination, ConfirmDialog, showToast, uiStyles } from '../../components/ui';
import { useAuditLogs } from '../../hooks/useAudit';
import { auditApi, type AuditLogQuery } from '../../lib/api/audit';
import { errorMessage } from '../../lib/api-error';
import styles from '../registrasi/registrasi.module.css';

const methodColor: Record<string, string> = {
    POST: '#16a34a',
    PUT: '#d97706',
    DELETE: '#dc2626',
};

const emptyFilters = { method: '', path: '', userId: '', startDate: '', endDate: '' };

const statusVariant = (code: number | null): string =>
    code === null ? '#6b7280' : code >= 500 ? '#dc2626' : code >= 400 ? '#d97706' : '#16a34a';

export function AuditTrail() {
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState(emptyFilters);
    const [applied, setApplied] = useState<Omit<AuditLogQuery, 'page' | 'limit'>>({});
    const [purgeOpen, setPurgeOpen] = useState(false);

    const { data, isLoading, isError } = useAuditLogs({ page, limit: 25, ...applied });

    const handleApplyFilter = () => {
        const clean: Omit<AuditLogQuery, 'page' | 'limit'> = {};
        if (filters.method) clean.method = filters.method;
        if (filters.path) clean.path = filters.path;
        if (filters.userId) clean.userId = filters.userId;
        if (filters.startDate) clean.startDate = filters.startDate;
        if (filters.endDate) clean.endDate = filters.endDate;
        setApplied(clean);
        setPage(1);
        showToast('Filter diterapkan', 'info');
    };

    const handleResetFilter = () => {
        setFilters(emptyFilters);
        setApplied({});
        setPage(1);
    };

    const handleExportCsv = async () => {
        try {
            const blob = await auditApi.exportCsv(applied);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showToast('Log audit berhasil diekspor', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal mengekspor log audit'), 'danger');
        }
    };

    const handlePurge = async () => {
        setPurgeOpen(false);
        try {
            const result = await auditApi.purge(90);
            showToast(`${result.deleted} log lebih tua dari 90 hari dibersihkan`, 'success');
            setPage(1);
            setApplied((prev) => ({ ...prev }));
        } catch (err) {
            showToast(errorMessage(err, 'Gagal membersihkan log audit'), 'danger');
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}><Shield size={24} /> Audit Trail Sistem</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button variant="secondary" onClick={handleExportCsv}><Download size={16} /> Export CSV</Button>
                    <Button variant="danger" onClick={() => setPurgeOpen(true)}><Trash2 size={16} /> Bersihkan &gt;90 hari</Button>
                </div>
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
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <Button variant="primary" onClick={handleApplyFilter}><Filter size={16} /> Terapkan Filter</Button>
                    <Button variant="secondary" onClick={handleResetFilter}>Reset</Button>
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
                                <th>Status</th>
                                <th>Path</th>
                                <th>Body</th>
                                <th>IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>Memuat...</td></tr>
                            ) : isError ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--danger)' }}>Gagal memuat log audit</td></tr>
                            ) : !data?.data.length ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada log ditemukan</td></tr>
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
                                            background: `${methodColor[log.method ?? ''] || '#6b7280'}20`, color: methodColor[log.method ?? ''] || '#6b7280',
                                        }}>
                                            {log.method}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: 700, fontSize: '12px', color: statusVariant(log.statusCode) }}>
                                            {log.statusCode ?? '-'}
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

            <ConfirmDialog
                open={purgeOpen}
                title="Bersihkan Log Audit?"
                message="Semua log audit yang lebih tua dari 90 hari akan dihapus permanen. Disarankan mengekspor CSV terlebih dahulu. Lanjutkan?"
                variant="danger"
                confirmLabel="Ya, Bersihkan"
                onConfirm={handlePurge}
                onClose={() => setPurgeOpen(false)}
            />
        </div>
    );
}
