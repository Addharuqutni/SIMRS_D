import type { ReactNode } from 'react';
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
    MonitorSmartphone,
} from 'lucide-react';

export interface NavItem {
    label: string;
    path: string;
    icon: ReactNode;
}

export interface NavGroup {
    label: string;
    items: NavItem[];
}

/** One navigation definition shared by the Sidebar and the Topbar breadcrumbs. */
export const NAV_GROUPS: NavGroup[] = [
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
            { label: 'Papan Antrean', path: '/display', icon: <MonitorSmartphone size={20} /> },
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

export interface Breadcrumb {
    group: string;
    label: string;
}

/** Breadcrumb (group + page) for a pathname, longest matching route wins. */
export function breadcrumbFor(pathname: string): Breadcrumb | null {
    let best: Breadcrumb | null = null;
    let bestLength = -1;
    for (const group of NAV_GROUPS) {
        for (const item of group.items) {
            if ((pathname === item.path || pathname.startsWith(item.path + '/')) && item.path.length > bestLength) {
                best = { group: group.label, label: item.label };
                bestLength = item.path.length;
            }
        }
    }
    return best;
}
