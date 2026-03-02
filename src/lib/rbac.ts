/**
 * Centralized Role-Based Access Control (RBAC) configuration.
 * Defines which roles can access which route paths.
 *
 * Role list:
 *  - Superadmin        → Full access to everything
 *  - Dokter Spesialis  → Clinical + Penunjang + Farmasi (view prescriptions)
 *  - Dokter Umum       → Clinical + Penunjang + Farmasi (view prescriptions)
 *  - Perawat           → Clinical + Penunjang (limited)
 *  - Apoteker          → Farmasi module only
 *  - Pendaftaran       → Registration, scheduling, queue
 *  - Kasir / Billing   → Billing, claims, financial reports
 *  - Analis Lab        → Laboratory + Radiology
 */

export type UserRole =
    | 'Superadmin'
    | 'Dokter Spesialis'
    | 'Dokter Umum'
    | 'Perawat'
    | 'Apoteker'
    | 'Pendaftaran'
    | 'Kasir / Billing'
    | 'Analis Lab';

// Routes accessible to ALL authenticated users (no role check)
const publicRoutes = [
    '/dashboard',
    '/notifikasi',
];

// Role → allowed route prefixes
const rolePermissions: Record<UserRole, string[]> = {
    'Superadmin': ['*'], // wildcard = all routes

    'Pendaftaran': [
        '/registrasi',
        '/sep',
        '/jadwal-dokter',
        '/antrean',
        '/dokter',
    ],

    'Dokter Spesialis': [
        '/rawat-jalan',
        '/rawat-inap',
        '/igd',
        '/rekam-medis',
        '/laboratorium',
        '/radiologi',
        '/farmasi/resep',    // can view prescriptions
        '/jadwal-dokter',    // can view own schedule
        '/dokter',
    ],

    'Dokter Umum': [
        '/rawat-jalan',
        '/rawat-inap',
        '/igd',
        '/rekam-medis',
        '/laboratorium',
        '/radiologi',
        '/farmasi/resep',
        '/jadwal-dokter',
        '/dokter',
    ],

    'Perawat': [
        '/rawat-jalan',
        '/rawat-inap',
        '/igd',
        '/rekam-medis',
        '/laboratorium',
        '/radiologi',
        '/antrean',          // can manage queue
        '/dokter',
    ],

    'Apoteker': [
        '/farmasi/resep',
        '/farmasi/stok',
        '/farmasi/alert',
    ],

    'Kasir / Billing': [
        '/billing',
        '/klaim-bpjs',
        '/laporan-keuangan',
    ],

    'Analis Lab': [
        '/laboratorium',
        '/radiologi',
    ],
};

/**
 * Check if a given role is allowed to access a given path.
 */
export function canAccess(role: string, path: string): boolean {
    // Public routes are always accessible
    if (publicRoutes.some(r => path === r || path.startsWith(r + '/'))) {
        return true;
    }

    const permissions = rolePermissions[role as UserRole];
    if (!permissions) return false;

    // Superadmin wildcard
    if (permissions.includes('*')) return true;

    // Check if path matches any allowed prefix
    return permissions.some(prefix => path === prefix || path.startsWith(prefix + '/'));
}

/**
 * Get the default landing page for a role.
 */
export function getDefaultRoute(role: string): string {
    switch (role as UserRole) {
        case 'Superadmin': return '/dashboard';
        case 'Pendaftaran': return '/registrasi';
        case 'Dokter Spesialis': return '/rawat-jalan';
        case 'Dokter Umum': return '/rawat-jalan';
        case 'Perawat': return '/rawat-jalan';
        case 'Apoteker': return '/farmasi/resep';
        case 'Kasir / Billing': return '/billing';
        case 'Analis Lab': return '/laboratorium';
        default: return '/dashboard';
    }
}

/**
 * Get a human-readable feature description for a role.
 */
export function getRoleDescription(role: string): string {
    switch (role as UserRole) {
        case 'Superadmin': return 'Akses penuh ke seluruh modul sistem';
        case 'Pendaftaran': return 'Registrasi pasien, SEP, jadwal dokter, antrean';
        case 'Dokter Spesialis': return 'Rawat jalan/inap, IGD, rekam medis, lab, radiologi, resep';
        case 'Dokter Umum': return 'Rawat jalan/inap, IGD, rekam medis, lab, radiologi, resep';
        case 'Perawat': return 'Pelayanan medis, penunjang, antrean';
        case 'Apoteker': return 'Farmasi: resep, stok obat, alert expired';
        case 'Kasir / Billing': return 'Billing, klaim BPJS, laporan keuangan';
        case 'Analis Lab': return 'Laboratorium & radiologi';
        default: return 'Akses terbatas';
    }
}
