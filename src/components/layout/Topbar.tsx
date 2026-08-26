import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, Sun, Moon, ChevronRight, LogOut } from 'lucide-react';
import { useSession, signOut } from '../../lib/auth-client';
import { useUnreadCount } from '../../hooks/useNotification';
import styles from './layout.module.css';

interface TopbarProps {
    onToggleSidebar: () => void;
    /**
     * Legacy (optional): when `darkMode` is provided the parent stays in control
     * of the theme state. Otherwise the toggle below manages the theme itself
     * via `document.documentElement.dataset.theme` + localStorage key 'theme'.
     */
    darkMode?: boolean;
    onToggleDarkMode?: () => void;
}

const THEME_STORAGE_KEY = 'theme';

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

function readStoredTheme(): boolean {
    try {
        return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch {
        return false;
    }
}

function applyTheme(dark: boolean) {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light');
    } catch {
        // Storage unavailable (e.g. private mode) — theme still applies for this session
    }
}

export function Topbar({ onToggleSidebar, darkMode, onToggleDarkMode }: TopbarProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { data: session } = useSession();
    const { data: unreadCount = 0 } = useUnreadCount();

    const [internalDark, setInternalDark] = useState(readStoredTheme);
    const isDark = darkMode ?? internalDark;

    // On mount (self-managed mode): apply the persisted theme and keep tabs in sync.
    useEffect(() => {
        if (darkMode !== undefined) return; // parent controls the theme

        applyTheme(readStoredTheme());

        const onStorage = (e: StorageEvent) => {
            if (e.key !== THEME_STORAGE_KEY) return;
            const dark = e.newValue === 'dark';
            document.documentElement.dataset.theme = dark ? 'dark' : 'light';
            setInternalDark(dark);
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [darkMode]);

    const handleToggleTheme = () => {
        const next = !isDark;
        if (onToggleDarkMode) onToggleDarkMode(); // legacy: let the parent flip its state
        applyTheme(next);
        setInternalDark(next);
    };

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
        await signOut();
        navigate('/login', { replace: true });
    };

    const userName = session?.user?.name || 'User';
    const userRole = ((session?.user as Record<string, unknown>)?.role as string | undefined) || 'user';
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
                <button
                    className={styles.themeToggle}
                    onClick={handleToggleTheme}
                    title={isDark ? 'Mode terang' : 'Mode gelap'}
                    aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
                >
                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                <button className={styles.topbarIconBtn} onClick={() => navigate('/notifikasi')} title="Notifikasi">
                    <Bell size={18} />
                    {unreadCount > 0 && (
                        <span className={styles.topbarBadge} style={{ minWidth: '16px', padding: '0 4px' }}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
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
