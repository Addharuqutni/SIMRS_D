/**
 * Service tariffs (IDR). Stored as settings rows (`tarifKamar`, `tarifLayanan`,
 * JSON objects); these are the defaults used when a key is unset or invalid.
 * The server prices charges with them; the settings UI edits them.
 */

export const KELAS_KAMAR = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'VIP', 'HCU', 'ICU'] as const;

export const DEFAULT_ROOM_TARIFF: Record<string, number> = {
    'Kelas 1': 500000, 'Kelas 2': 350000, 'Kelas 3': 200000,
    VIP: 750000, HCU: 750000, ICU: 1000000,
};

export const LAYANAN_KEYS = ['konsultasiPoli', 'konsultasiIgd', 'laboratorium', 'radiologi'] as const;
export type LayananKey = (typeof LAYANAN_KEYS)[number];

export const LAYANAN_LABEL: Record<LayananKey, string> = {
    konsultasiPoli: 'Konsultasi Dokter (Poli)',
    konsultasiIgd: 'Pelayanan IGD',
    laboratorium: 'Pemeriksaan Laboratorium (per order)',
    radiologi: 'Pemeriksaan Radiologi (per order)',
};

export const DEFAULT_SERVICE_TARIFF: Record<LayananKey, number> = {
    konsultasiPoli: 150000,
    konsultasiIgd: 250000,
    laboratorium: 100000,
    radiologi: 250000,
};

/**
 * Parses a stored tariff JSON and merges valid non-negative integer entries over
 * `defaults`. Invalid JSON or entries fall back to the default for that key.
 */
export function parseTariff<K extends string>(raw: string | null | undefined, defaults: Record<K, number>): Record<K, number> {
    const result = { ...defaults };
    if (!raw) return result;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return result;
        for (const [k, v] of Object.entries(parsed)) {
            const n = Number(v);
            if (Number.isFinite(n) && n >= 0) (result as Record<string, number>)[k] = Math.round(n);
        }
    } catch {
        /* invalid JSON — keep defaults */
    }
    return result;
}
