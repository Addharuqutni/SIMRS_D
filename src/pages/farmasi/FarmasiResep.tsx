import { useState, useEffect } from 'react';
import { Pill, CheckCircle, AlertTriangle, QrCode } from 'lucide-react';
import { SearchBar, FilterTabs, StatusBadge, Button, Card, Pagination, QRCode, showToast, LifecycleBadge } from '../../components/ui';
import { uiStyles } from '../../components/ui';
import styles from '../registrasi/registrasi.module.css';
import { usePrescriptionList, usePrescriptionDetail, useUpdatePrescriptionStatus } from '../../hooks/usePharmacy';
import { useSignERecipe } from '../../hooks/useClinical';
import { errorMessage } from '../../lib/api-error';

export function FarmasiResep() {
    const list = usePrescriptionList();
    const resepList = list.rows;
    const [selectedId, setSelectedId] = useState('');

    const { data: detail } = usePrescriptionDetail(selectedId);
    const updateMutation = useUpdatePrescriptionStatus();
    const signERecipe = useSignERecipe();
    const [eRecipe, setERecipe] = useState<{ eRecipeCode: string; qrString: string } | null>(null);

    // Reset e-Recipe panel when selection changes
    useEffect(() => {
        setERecipe(null);
    }, [selectedId]);

    // Select the first item automatically if list loads and nothing selected
    useEffect(() => {
        if (!selectedId && resepList.length > 0) setSelectedId(resepList[0].id);
    }, [resepList, selectedId]);

    const handleTerima = async () => {
        try {
            await updateMutation.mutateAsync({ id: selectedId, status: 'proses' });
            showToast(`Resep ${detail?.noResep} diterima dan sedang diproses`, 'info');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal memproses resep'), 'danger');
        }
    };

    const handleSerahkan = async () => {
        try {
            await updateMutation.mutateAsync({ id: selectedId, status: 'selesai' });
            showToast(`Obat resep ${detail?.noResep} berhasil diserahkan dan mutasi stok dicatat`, 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal menyerahkan resep'), 'danger');
        }
    };

    const handleSignERecipe = async () => {
        try {
            const result = await signERecipe.mutateAsync(selectedId);
            setERecipe({ eRecipeCode: result.eRecipeCode, qrString: result.qrString });
            showToast(`e-Recipe ${result.eRecipeCode} berhasil ditandatangani`, 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Gagal menandatangani e-Recipe'), 'danger');
        }
    };

    const currentStatus = detail?.status;

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Resep & Dispensing</h1>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarSearch}>
                    <SearchBar placeholder="Cari resep, pasien, RM..." value={list.search} onChange={list.setSearch} />
                </div>
                <FilterTabs
                    tabs={[
                        { label: 'Semua', value: 'semua', count: list.totalAll },
                        { label: 'Baru', value: 'baru', count: list.counts.baru ?? 0 },
                        { label: 'Proses', value: 'proses', count: list.counts.proses ?? 0 },
                        { label: 'Selesai', value: 'selesai', count: list.counts.selesai ?? 0 },
                    ]}
                    active={list.status} onChange={list.setStatus}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Left — list */}
                <div className={styles.tableWrapper}>
                    <table className={uiStyles.table}>
                        <thead>
                            <tr><th>No. Resep</th><th>Pasien</th><th>Dokter</th><th>Waktu</th><th>Status</th></tr>
                        </thead>
                        <tbody className="stagger">
                            {resepList.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tidak ada resep ditemukan</td></tr>
                            ) : resepList.map((r) => (
                                <tr key={r.id}
                                    style={{ cursor: 'pointer', background: selectedId === r.id ? 'var(--bg-active)' : undefined }}
                                    onClick={() => setSelectedId(r.id)}>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{r.noResep}</td>
                                    <td>
                                        <div className={styles.nameCell}>
                                            <span className={styles.namePrimary}>{r.patientName}</span>
                                            <span className={styles.nameSecondary}>RM: {r.rm}</span>
                                        </div>
                                    </td>
                                    <td>{r.dokterName || r.dokterId}</td>
                                    <td>{new Date(r.waktuResep).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                    <td><LifecycleBadge kind="resep" status={r.status} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <Pagination {...list.paginationProps} />
                </div>

                {/* Right — detail */}
                {detail ? (
                    <Card title={`Detail ${detail.noResep}`} icon={<Pill size={18} />}>
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                Pasien: <strong style={{ color: 'var(--text)' }}>{detail.patientName}</strong> (RM: {detail.rm})
                            </div>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                Dokter: <strong style={{ color: 'var(--text)' }}>{detail.dokterName || detail.dokterId}</strong>
                            </div>
                            <div style={{ marginTop: '8px' }}>
                                <LifecycleBadge kind="resep" status={detail.status} />
                            </div>
                        </div>

                        <table className={uiStyles.table}>
                            <thead>
                                <tr><th>Obat</th><th>Dosis</th><th>Jml</th><th>Stok</th><th>Ketersediaan</th></tr>
                            </thead>
                            <tbody>
                                {detail.items?.map((item) => {
                                    const tersedia = (item.stok ?? 0) >= item.jumlah;
                                    return (
                                        <tr key={item.id}>
                                            <td style={{ fontWeight: 500 }}>{item.namaObat || item.obatId}</td>
                                            <td>{item.dosis}</td>
                                            <td>{item.jumlah}</td>
                                            <td>{item.stok ?? '-'}</td>
                                            <td>
                                                {tersedia ? (
                                                    <StatusBadge variant="success">Memenuhi</StatusBadge>
                                                ) : (
                                                    <StatusBadge variant="warning">
                                                        <AlertTriangle size={10} /> Kurang
                                                    </StatusBadge>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* e-Recipe Kemenkes Panel — Sign + QR Code */}
                        {detail && (
                            <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg, #f9fafb)', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <strong style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <QrCode size={14} /> e-Recipe Kemenkes
                                    </strong>
                                    {!eRecipe && (
                                        <Button variant="secondary" size="sm" onClick={handleSignERecipe} disabled={signERecipe.isPending}>
                                            {signERecipe.isPending ? 'Menandatangani...' : 'Tanda Tangani & Buat QR'}
                                        </Button>
                                    )}
                                </div>
                                {eRecipe ? (
                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <QRCode value={eRecipe.qrString} size={140} alt={`QR e-Recipe ${eRecipe.eRecipeCode}`} />
                                        <div style={{ fontSize: '12px' }}>
                                            <div style={{ marginBottom: '4px' }}><strong>Kode:</strong> {eRecipe.eRecipeCode}</div>
                                            <div style={{ color: 'var(--text-secondary)', maxWidth: '250px' }}>
                                                Scan QR ini di apotek/apotekek untuk verifikasi e-Recipe dan dispensing otomatis.
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        Tanda tangani resep untuk menghasilkan QR e-Recipe yang dapat dipindai apotek.
                                    </p>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                {updateMutation.isPending && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Menyimpan mutasi stok...</span>}
                            </div>
                            {currentStatus === 'baru' && (
                                <Button variant="primary" onClick={handleTerima} disabled={updateMutation.isPending}>
                                    <Pill size={14} /> Terima & Proses Resep
                                </Button>
                            )}
                            {currentStatus === 'proses' && (
                                <Button variant="primary" onClick={handleSerahkan} disabled={updateMutation.isPending}>
                                    <CheckCircle size={14} /> Serahkan Obat
                                </Button>
                            )}
                            {currentStatus === 'selesai' && (
                                <Button variant="secondary" disabled>
                                    <CheckCircle size={14} /> Telah Diserahkan
                                </Button>
                            )}
                        </div>
                    </Card>
                ) : (
                    <Card><div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Pilih resep untuk melihat detail</div></Card>
                )}
            </div>
        </div>
    );
}
