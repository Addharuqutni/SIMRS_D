import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Bell,
    ClipboardList,
    FileText,
    CalendarDays,
    Ticket,
    Stethoscope,
    BedDouble,
    Ambulance,
    FolderHeart,
    HeartPulse,
    FlaskConical,
    ScanLine,
    Pill,
    Package,
    AlertTriangle,
    Wallet,
    Receipt,
    BarChart3,
    Users,
    Database,
    Settings,
    Shield,
    ChevronsLeft,
    ChevronsRight,
} from 'lucide-react';
import { useSession } from '../../lib/auth-client';
import { canAccess } from '../../lib/rbac';
import styles from './layout.module.css';

interface SidebarProps {
    collapsed: boolean;
    mobileOpen: boolean;
    onCloseMobile: () => void;
}

interface NavItem {
    label: string;
    path: string;
    icon: React.ReactNode;
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

const navGroups: NavGroup[] = [
    {
        label: 'Umum',
        items: [
            { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
            { label: 'Notifikasi', path: '/notifikasi', icon: <Bell size={20} /> },
        ],
    },
    {
        label: 'Pendaftaran',
        items: [
            { label: 'Registrasi', path: '/registrasi', icon: <ClipboardList size={20} /> },
            { label: 'SEP & VClaim', path: '/sep', icon: <FileText size={20} /> },
            { label: 'Jadwal Dokter', path: '/jadwal-dokter', icon: <CalendarDays size={20} /> },
            { label: 'Antrean', path: '/antrean', icon: <Ticket size={20} /> },
        ],
    },
    {
        label: 'Pelayanan Medis',
        items: [
            { label: 'Rawat Jalan', path: '/rawat-jalan', icon: <Stethoscope size={20} /> },
            { label: 'Rawat Inap', path: '/rawat-inap', icon: <BedDouble size={20} /> },
            { label: 'IGD', path: '/igd', icon: <Ambulance size={20} /> },
            { label: 'List Dokter', path: '/dokter', icon: <Stethoscope size={20} /> },
            { label: 'Rekam Medis', path: '/rekam-medis', icon: <FolderHeart size={20} /> },
        ],
    },
    {
        label: 'Penunjang',
        items: [
            { label: 'Laboratorium', path: '/laboratorium', icon: <FlaskConical size={20} /> },
            { label: 'Radiologi', path: '/radiologi', icon: <ScanLine size={20} /> },
        ],
    },
    {
        label: 'Farmasi',
        items: [
            { label: 'Resep & Dispensing', path: '/farmasi/resep', icon: <Pill size={20} /> },
            { label: 'Stok Obat', path: '/farmasi/stok', icon: <Package size={20} /> },
            { label: 'Alert Expired', path: '/farmasi/alert', icon: <AlertTriangle size={20} /> },
        ],
    },
    {
        label: 'Keuangan',
        items: [
            { label: 'Billing / Kasir', path: '/billing', icon: <Wallet size={20} /> },
            { label: 'Klaim BPJS', path: '/klaim-bpjs', icon: <Receipt size={20} /> },
            { label: 'Laporan Keuangan', path: '/laporan-keuangan', icon: <BarChart3 size={20} /> },
        ],
    },
    {
        label: 'Pengaturan',
        items: [
            { label: 'Manajemen User', path: '/users', icon: <Users size={20} /> },
            { label: 'Master Data', path: '/master-data', icon: <Database size={20} /> },
            { label: 'Bridging BPJS', path: '/bridging-status', icon: <HeartPulse size={20} /> },
            { label: 'Audit Trail', path: '/audit-trail', icon: <Shield size={20} /> },
            { label: 'Konfigurasi', path: '/konfigurasi', icon: <Settings size={20} /> },
        ],
    },
];

export function Sidebar({ collapsed, mobileOpen, onCloseMobile }: SidebarProps) {
    const location = useLocation();

    const sidebarClasses = [
        styles.sidebar,
        collapsed ? styles.collapsed : '',
        mobileOpen ? styles.mobileOpen : '',
    ]
        .filter(Boolean)
        .join(' ');

    const { data: session } = useSession();
    const userRole = ((session?.user as Record<string, unknown>)?.role as string | undefined) || 'user';

    // Filter nav groups and items using the centralized RBAC config
    const renderNavGroups = navGroups
        .map(group => {
            const filteredItems = group.items.filter(item => canAccess(userRole, item.path));
            if (filteredItems.length === 0) return null;
            return { ...group, items: filteredItems };
        })
        .filter(Boolean) as NavGroup[];

    return (
        <aside className={sidebarClasses}>
            <div className={styles.sidebarHeader}>
                <img src="/logo.jpg" alt="SIMRS Logo" style={{ height: '36px', width: 'auto', mixBlendMode: 'multiply' }} />
                <span className={styles.sidebarTitle}>SIMRS</span>
            </div>

            <nav className={styles.sidebarNav}>
                {renderNavGroups.map((group) => (
                    <div key={group.label} className={styles.sidebarGroup}>
                        <div className={styles.sidebarGroupLabel}>{group.label}</div>
                        {group.items.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={onCloseMobile}
                                className={({ isActive }) => {
                                    const activeClass = isActive || location.pathname.startsWith(item.path + '/') ? styles.active : '';
                                    return `${styles.sidebarItem} ${activeClass}`;
                                }}
                            >
                                <span className={styles.sidebarItemIcon}>{item.icon}</span>
                                <span className={styles.sidebarItemLabel}>{item.label}</span>
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            <div className={styles.sidebarFooter}>
                <button className={styles.sidebarToggle} style={{ display: 'none' }}>
                    {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
                    {!collapsed && <span>Collapse</span>}
                </button>
            </div>
        </aside>
    );
}
