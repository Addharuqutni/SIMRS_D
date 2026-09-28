/**
 * Access policy — the single source of truth for roles and what they may do.
 * Imported by the server (route guards, notification targeting) and the client
 * (route guards, sidebar). Matching is EXACT on the role string.
 */

export const ROLES = {
    SUPERADMIN: 'Superadmin',
    PENDAFTARAN: 'Pendaftaran',
    DOKTER_SPESIALIS: 'Dokter Spesialis',
    DOKTER_UMUM: 'Dokter Umum',
    PERAWAT: 'Perawat',
    APOTEKER: 'Apoteker',
    KASIR_BILLING: 'Kasir / Billing',
    ANALIS_LAB: 'Analis Lab',
    KEUANGAN: 'Keuangan',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: readonly Role[] = Object.values(ROLES);

export const DOCTOR_ROLES: readonly Role[] = [ROLES.DOKTER_SPESIALIS, ROLES.DOKTER_UMUM];

/** Server-side capabilities. Each names a domain area, not an endpoint. */
const CAPABILITY_ROLES = {
    admin: [ROLES.SUPERADMIN],
    billing: [ROLES.SUPERADMIN, ROLES.KASIR_BILLING, ROLES.KEUANGAN],
    clinical: [ROLES.SUPERADMIN, ROLES.DOKTER_SPESIALIS, ROLES.DOKTER_UMUM, ROLES.PERAWAT],
    prescribe: [ROLES.SUPERADMIN, ROLES.DOKTER_SPESIALIS, ROLES.DOKTER_UMUM],
    pharmacy: [ROLES.SUPERADMIN, ROLES.APOTEKER],
    registration: [ROLES.SUPERADMIN, ROLES.PENDAFTARAN],
    lab: [ROLES.SUPERADMIN, ROLES.ANALIS_LAB],
    /** Receives low-stock alerts. */
    stockAlerts: [ROLES.SUPERADMIN, ROLES.APOTEKER],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITY_ROLES;

export function isRole(value: unknown): value is Role {
    return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value);
}

export function rolesWith(capability: Capability): readonly Role[] {
    return CAPABILITY_ROLES[capability];
}

/** True when `role` holds any of `capabilities`. Unknown/empty roles hold nothing. */
export function can(role: string | null | undefined, ...capabilities: Capability[]): boolean {
    if (!isRole(role)) return false;
    return capabilities.some((c) => (CAPABILITY_ROLES[c] as readonly Role[]).includes(role));
}

// ─── Client routes ──────────────────────────────────────────────────────────

/** Routes every authenticated user may open. */
const OPEN_ROUTES = ['/dashboard', '/notifikasi'];

const CLINICIAN_ROUTES = ['/rawat-jalan', '/rawat-inap', '/igd', '/rekam-medis', '/laboratorium', '/radiologi', '/dokter'];
const FINANCE_ROUTES = ['/billing', '/klaim-bpjs', '/laporan-keuangan'];

const ROUTE_PREFIXES: Record<Role, readonly string[]> = {
    Superadmin: ['*'],
    Pendaftaran: ['/registrasi', '/sep', '/jadwal-dokter', '/antrean', '/dokter'],
    'Dokter Spesialis': [...CLINICIAN_ROUTES, '/farmasi/resep', '/jadwal-dokter'],
    'Dokter Umum': [...CLINICIAN_ROUTES, '/farmasi/resep', '/jadwal-dokter'],
    Perawat: [...CLINICIAN_ROUTES, '/antrean'],
    Apoteker: ['/farmasi/resep', '/farmasi/stok', '/farmasi/alert'],
    'Kasir / Billing': FINANCE_ROUTES,
    Keuangan: FINANCE_ROUTES,
    'Analis Lab': ['/laboratorium', '/radiologi'],
};

const matchesPrefix = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/');

export function canAccessRoute(role: string | null | undefined, path: string): boolean {
    if (OPEN_ROUTES.some((r) => matchesPrefix(path, r))) return true;
    if (!isRole(role)) return false;
    const prefixes = ROUTE_PREFIXES[role];
    return prefixes.includes('*') || prefixes.some((p) => matchesPrefix(path, p));
}

const DEFAULT_ROUTE: Record<Role, string> = {
    Superadmin: '/dashboard',
    Pendaftaran: '/registrasi',
    'Dokter Spesialis': '/rawat-jalan',
    'Dokter Umum': '/rawat-jalan',
    Perawat: '/rawat-jalan',
    Apoteker: '/farmasi/resep',
    'Kasir / Billing': '/billing',
    Keuangan: '/laporan-keuangan',
    'Analis Lab': '/laboratorium',
};

export function defaultRouteFor(role: string | null | undefined): string {
    return isRole(role) ? DEFAULT_ROUTE[role] : '/dashboard';
}

const DESCRIPTION: Record<Role, string> = {
    Superadmin: 'Akses penuh ke seluruh modul sistem',
    Pendaftaran: 'Registrasi pasien, SEP, jadwal dokter, antrean',
    'Dokter Spesialis': 'Rawat jalan/inap, IGD, rekam medis, lab, radiologi, resep',
    'Dokter Umum': 'Rawat jalan/inap, IGD, rekam medis, lab, radiologi, resep',
    Perawat: 'Pelayanan medis, penunjang, antrean',
    Apoteker: 'Farmasi: resep, stok obat, alert expired',
    'Kasir / Billing': 'Billing, klaim BPJS, laporan keuangan',
    Keuangan: 'Billing, klaim BPJS, laporan keuangan',
    'Analis Lab': 'Laboratorium & radiologi',
};

export function describeRole(role: string | null | undefined): string {
    return isRole(role) ? DESCRIPTION[role] : 'Akses terbatas';
}
