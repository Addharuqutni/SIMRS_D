/** Payer (jaminan) values — the registration form writes these, list filters read them. */
export const JAMINAN = ['Umum / Mandiri', 'BPJS Kesehatan', 'Asuransi Swasta'] as const;
export type Jaminan = (typeof JAMINAN)[number];

/** Outpatient clinics and their queue-code prefix. IGD and Rawat Inap are admission-only units. */
export const POLI_PREFIX: Record<string, string> = {
    'Poli Umum': 'A',
    'Poli Gigi': 'B',
    'Poli Anak': 'C',
    'Poli Kandungan': 'D',
    'Poli Penyakit Dalam': 'F',
    IGD: 'E',
    'Rawat Inap': 'R',
};
export const POLI_RAWAT_JALAN = ['Poli Umum', 'Poli Gigi', 'Poli Anak', 'Poli Kandungan', 'Poli Penyakit Dalam'] as const;

export const TRIASE = ['merah', 'kuning', 'hijau', 'hitam'] as const;
export type Triase = (typeof TRIASE)[number];

export interface PasienBaru {
    nama: string;
    gender: 'L' | 'P';
    nik?: string | null;
    tempatLahir?: string | null;
    tanggalLahir?: string | null;
    alamat?: string | null;
    telepon?: string | null;
    goldar?: string | null;
    agama?: string | null;
    pekerjaan?: string | null;
    alergi?: string | null;
}

export interface Vitals {
    sistolik?: number;
    diastolik?: number;
    nadi?: number;
    suhu?: number;
    pernapasan?: number;
    spo2?: number;
    kesadaran?: string;
}

/** Exactly one of `patientId` (existing) or `pasienBaru` (register now). */
export type Pasien = { patientId: string; pasienBaru?: never } | { patientId?: never; pasienBaru: PasienBaru };

export type AdmitInput = Pasien & { dokterId: string; jaminan: Jaminan } & (
    | { jenis: 'rawat_jalan'; poliId: string }
    | { jenis: 'igd'; triase: Triase; keluhanUtama: string; vitals?: Vitals }
    | { jenis: 'rawat_inap'; ruanganId: string; kelas: string }
);
