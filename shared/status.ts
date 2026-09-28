/**
 * Status lifecycles — one definition per domain entity, shared by server
 * (write validation) and client (badges, filters, action buttons).
 */

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface LifecycleDef<S extends string> {
    /** Legal next states per state. Terminal states map to []. */
    transitions: Record<S, readonly NoInfer<S>[]>;
    labels: Record<NoInfer<S>, { label: string; variant: BadgeVariant }>;
}

function defineLifecycle<S extends string>(def: LifecycleDef<S>) {
    const states = Object.keys(def.transitions) as S[];
    return {
        states,
        isState: (value: unknown): value is S => typeof value === 'string' && (states as string[]).includes(value),
        canTransition: (from: string, to: string): boolean =>
            (def.transitions as Record<string, readonly string[]>)[from]?.includes(to) ?? false,
        /** Label + badge variant; unknown values render as a neutral raw string, never throw. */
        badge: (value: string) =>
            (def.labels as Record<string, { label: string; variant: BadgeVariant }>)[value] ?? { label: value, variant: 'neutral' as const },
    };
}

export const LIFECYCLES = {
    /** Kunjungan rawat jalan / IGD. IGD uses tindakan → observasi between menunggu and selesai. */
    kunjungan: defineLifecycle({
        transitions: {
            menunggu: ['pemeriksaan', 'tindakan', 'batal'],
            pemeriksaan: ['selesai', 'batal'],
            tindakan: ['observasi', 'selesai'],
            observasi: ['selesai'],
            selesai: [],
            batal: [],
        },
        labels: {
            menunggu: { label: 'Menunggu', variant: 'warning' },
            pemeriksaan: { label: 'Sedang Periksa', variant: 'info' },
            tindakan: { label: 'Tindakan', variant: 'warning' },
            observasi: { label: 'Observasi', variant: 'info' },
            selesai: { label: 'Selesai', variant: 'success' },
            batal: { label: 'Batal', variant: 'neutral' },
        },
    }),
    resep: defineLifecycle({
        transitions: { baru: ['proses'], proses: ['selesai'], selesai: [] },
        labels: {
            baru: { label: 'Baru', variant: 'danger' },
            proses: { label: 'Diproses', variant: 'warning' },
            selesai: { label: 'Diserahkan', variant: 'success' },
        },
    }),
    admisi: defineLifecycle({
        transitions: {
            dirawat: ['kritis', 'rencana_pulang', 'pulang'],
            kritis: ['dirawat', 'pulang'],
            rencana_pulang: ['dirawat', 'pulang'],
            pulang: [],
        },
        labels: {
            dirawat: { label: 'Sedang Dirawat', variant: 'info' },
            kritis: { label: 'Kritis', variant: 'danger' },
            rencana_pulang: { label: 'Rencana Pulang', variant: 'warning' },
            pulang: { label: 'Pulang', variant: 'success' },
        },
    }),
    /** Lab & radiology orders. */
    order: defineLifecycle({
        transitions: { menunggu: ['diproses', 'batal'], diproses: ['selesai', 'batal'], selesai: [], batal: [] },
        labels: {
            menunggu: { label: 'Menunggu', variant: 'danger' },
            diproses: { label: 'Diproses', variant: 'warning' },
            selesai: { label: 'Selesai', variant: 'success' },
            batal: { label: 'Batal', variant: 'neutral' },
        },
    }),
    billing: defineLifecycle({
        transitions: { open: ['finalized'], finalized: ['paid'], paid: [] },
        labels: {
            open: { label: 'Terbuka', variant: 'info' },
            finalized: { label: 'Difinalisasi', variant: 'warning' },
            paid: { label: 'Lunas', variant: 'success' },
        },
    }),
    sep: defineLifecycle({
        transitions: { aktif: ['terpakai', 'batal'], terpakai: [], batal: [] },
        labels: {
            aktif: { label: 'Aktif', variant: 'success' },
            terpakai: { label: 'Terpakai', variant: 'info' },
            batal: { label: 'Dibatalkan', variant: 'danger' },
        },
    }),
    klaim: defineLifecycle({
        transitions: { dibentuk: ['pending'], pending: ['layak', 'dispute'], dispute: ['pending'], layak: [] },
        labels: {
            dibentuk: { label: 'Dibentuk', variant: 'info' },
            pending: { label: 'Pending Verif', variant: 'warning' },
            dispute: { label: 'Dispute', variant: 'danger' },
            layak: { label: 'Layak Bayar', variant: 'success' },
        },
    }),
};

export type LifecycleKind = keyof typeof LIFECYCLES;
