const normalizeRole = (role?: string | null) => (role || '').trim().toLowerCase();

export const hasAnyRoleLike = (userRole: string | undefined | null, allowedRoles: string[]) => {
    const normalized = normalizeRole(userRole);
    return allowedRoles.some((role) => normalized.includes(normalizeRole(role)) || normalizeRole(role).includes(normalized));
};

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

export const ROLE_GROUPS = {
    admin: [ROLES.SUPERADMIN],
    billing: [ROLES.SUPERADMIN, ROLES.KASIR_BILLING, ROLES.KEUANGAN],
    clinical: [ROLES.SUPERADMIN, ROLES.DOKTER_SPESIALIS, ROLES.DOKTER_UMUM, ROLES.PERAWAT],
    pharmacy: [ROLES.SUPERADMIN, ROLES.APOTEKER],
    registration: [ROLES.SUPERADMIN, ROLES.PENDAFTARAN],
    lab: [ROLES.SUPERADMIN, ROLES.ANALIS_LAB],
};
