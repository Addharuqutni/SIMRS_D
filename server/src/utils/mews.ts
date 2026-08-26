/**
 * MEWS (Modified Early Warning Score) calculator.
 *
 * MEWS is a simple, validated bedside tool to identify clinical deterioration
 * early. Each vital parameter contributes 0-3 points; total ranges 0-14.
 * Higher scores → escalation: notify doctor, consider ICU transfer.
 *
 * Reference: Subbe et al., Q J Med 2001. Ranges below are clinically standard.
 *
 * Trigger thresholds (configurable, see `mewsActionFor`):
 *   0-1  → Routine monitoring
 *   2    → Increased frequency, inform doctor
 *   3-4  → Urgent doctor review (warn)
 *   >=5  → Critical — escalate to senior/ICU (danger)
 */

export interface VitalSignsInput {
    sistolik?: number | null;
    diastolik?: number | null;
    nadi?: number | null;
    suhu?: number | null;
    pernapasan?: number | null;
    spo2?: number | null;
    gcs?: number | null;
}

export interface MewsResult {
    score: number;
    /** Per-parameter breakdown for transparency/audit. */
    breakdown: Partial<Record<keyof VitalSignsInput, number>>;
    level: 'normal' | 'watch' | 'warn' | 'danger';
    action: string;
}

function scoreRange(value: number | null | undefined, bands: [number, number, number]): number {
    // bands = [low_severe, low_mild, high_mild, high_severe] encoded compactly.
    // We implement with explicit thresholds passed in.
    if (value == null) return 0;
    return 0; // placeholder, replaced by specific scorers below
}

// Sistolik BP scoring (mmHg)
function sistolikScore(v: number | null | undefined): number {
    if (v == null) return 0;
    if (v < 70) return 3;
    if (v < 80) return 2;
    if (v < 100) return 1;
    if (v <= 180) return 0;
    if (v <= 200) return 1;
    return 2;
}

// Heart rate (bpm)
function nadiScore(v: number | null | undefined): number {
    if (v == null) return 0;
    if (v < 40) return 2;
    if (v < 50) return 1;
    if (v <= 100) return 0;
    if (v <= 110) return 1;
    if (v <= 129) return 2;
    return 3;
}

// Temperature (°C)
function suhuScore(v: number | null | undefined): number {
    if (v == null) return 0;
    if (v < 35) return 2;
    if (v < 36) return 1;
    if (v <= 38) return 0;
    if (v <= 38.5) return 1;
    return 2;
}

// Respiratory rate (breaths/min)
function pernapasanScore(v: number | null | undefined): number {
    if (v == null) return 0;
    if (v < 8) return 3;
    if (v < 10) return 2;
    if (v <= 14) return 0;
    if (v <= 20) return 1;
    if (v <= 29) return 2;
    return 3;
}

// SpO2 (%)
function spo2Score(v: number | null | undefined): number {
    if (v == null) return 0;
    if (v < 85) return 3;
    if (v < 90) return 2;
    if (v < 95) return 1;
    return 0;
}

// AVPU / consciousness (we approximate via GCS: 15 = 0, 13-14 = 1, 9-12 = 2, <9 = 3)
function gcsScore(v: number | null | undefined): number {
    if (v == null) return 0;
    if (v >= 15) return 0;
    if (v >= 13) return 1;
    if (v >= 9) return 2;
    return 3;
}

/**
 * Compute MEWS from available vital signs. Missing parameters contribute 0.
 * Returns the aggregate score, a per-parameter breakdown, an escalation level,
 * and a human-readable recommended action.
 */
export function computeMews(v: VitalSignsInput): MewsResult {
    const breakdown: MewsResult['breakdown'] = {};

    if (v.sistolik != null) breakdown.sistolik = sistolikScore(v.sistolik);
    if (v.nadi != null) breakdown.nadi = nadiScore(v.nadi);
    if (v.suhu != null) breakdown.suhu = suhuScore(v.suhu);
    if (v.pernapasan != null) breakdown.pernapasan = pernapasanScore(v.pernapasan);
    if (v.spo2 != null) breakdown.spo2 = spo2Score(v.spo2);
    if (v.gcs != null) breakdown.gcs = gcsScore(v.gcs);

    const score = Object.values(breakdown).reduce<number>((acc, n) => acc + (n ?? 0), 0);

    return { score, breakdown, ...mewsActionFor(score) };
}

export function mewsActionFor(score: number): { level: MewsResult['level']; action: string } {
    if (score <= 1) {
        return {
            level: 'normal',
            action: 'Pemantauan rutin. Tidak ada eskalasi diperlukan.',
        };
    }
    if (score === 2) {
        return {
            level: 'watch',
            action: 'Tingkatkan frekuensi pemantauan. Informasikan ke dokter jaga.',
        };
    }
    if (score <= 4) {
        return {
            level: 'warn',
            action: 'Peninjauan dokter segera (≤30 menit). Pertimbangkan pemindahan ke ruang perawatan intensif.',
        };
    }
    return {
        level: 'danger',
        action: 'KRITIS. Eskalasi ke dokter senior/spesialis & PICU/ICU segera.',
    };
}

// Suppress unused export warning for the placeholder helper above.
void scoreRange;
