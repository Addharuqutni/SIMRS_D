import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, Sun, Moon, ChevronRight, LogOut } from 'lucide-react';
import { useSession, signOut } from '../../lib/auth-client';
import styles from './layout.module.css';

interface TopbarProps {
    onToggleSidebar: () => void;
    darkMode: boolean;
    onToggleDarkMode: () => void;
}

const routeLabels: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/notifikasi': 'Notifikasi',
    '/registrasi': 'Registrasi',
    '/sep': 'SEP & VClaim',
    '/jadwal-dokter': 'Jadwal Dokter',
    '/antrean': 'Antrean',
    '/rawat-jalan': 'Rawat Jalan',
    '/rawat-inap': 'Rawat Inap',
    '/igd': 'IGD',
    '/rekam-medis': 'Rekam Medis',
    '/laboratorium': 'Laboratorium',
    '/radiologi': 'Radiologi',
    '/farmasi/resep': 'Resep & Dispensing',
    '/farmasi/stok': 'Stok Obat',
    '/farmasi/alert': 'Alert Expired',
    '/billing': 'Billing / Kasir',
    '/klaim-bpjs': 'Klaim BPJS',
    '/laporan-keuangan': 'Laporan Keuangan',
    '/users': 'Manajemen User',
    '/master-data': 'Master Data',
    '/konfigurasi': 'Konfigurasi',
};

export function Topbar({ onToggleSidebar, darkMode, onToggleDarkMode }: TopbarProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { data: session } = useSession();

    const getPageTitle = () => {
        const path = location.pathname;
        for (const [route, label] of Object.entries(routeLabels)) {
            if (path === route || path.startsWith(route + '/')) {
                return label;
            }
        }
        return 'Dashboard';
    };

    const handleLogout = async () => {
        localStorage.removeItem('simrs_auth');
        await signOut();
        navigate('/login', { replace: true });
    };

    const userName = session?.user?.name || 'Administrator';
    const userRole = (session?.user as Record<string, any>)?.role || 'Superadmin';
    const initials = userName.substring(0, 2).toUpperCase();

    return (
        <header className={styles.topbar}>
            <div className={styles.topbarLeft}>
                <button className={styles.topbarToggle} onClick={onToggleSidebar}>
                    <Menu size={20} />
                </button>
                <div className={styles.topbarBreadcrumb}>
                    <span>SIMRS</span>
                    <ChevronRight size={14} />
                    <span>{getPageTitle()}</span>
                </div>
            </div>

            <div className={styles.topbarSearch}>
                <Search size={16} className={styles.topbarSearchIcon} />
                <input
                    type="text"
                    className={styles.topbarSearchInput}
                    placeholder="Cari pasien, obat, dokter..."
                />
            </div>

            <div className={styles.topbarRight}>
                <button className={styles.themeToggle} onClick={onToggleDarkMode} title="Toggle theme">
                    {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                <button className={styles.topbarIconBtn} onClick={() => navigate('/notifikasi')}>
                    <Bell size={18} />
                    <span className={styles.topbarBadge}>3</span>
                </button>

                <div className={styles.topbarDivider} />

                <div className={styles.topbarUser}>
                    <div className={styles.topbarAvatar}>{initials}</div>
                    <div className={styles.topbarUserInfo}>
                        <span className={styles.topbarUserName}>{userName}</span>
                        <span className={styles.topbarUserRole}>{userRole}</span>
                    </div>
                </div>

                <div className={styles.topbarDivider} style={{ marginLeft: '8px', marginRight: '8px' }} />

                <button
                    className={styles.topbarIconBtn}
                    onClick={handleLogout}
                    title="Logout"
                    style={{ color: 'var(--danger)', marginLeft: '4px' }}
                >
                    <LogOut size={18} />
                </button>
            </div>
        </header>
    );
}
