import { z } from 'zod';
import { JAMINAN, TRIASE } from '../../../../shared/admission';

const optional = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

export const pasienBaruSchema = z.object({
    nama: z.string().trim().min(1, 'Nama pasien wajib diisi'),
    gender: z.enum(['L', 'P'], { message: 'Jenis kelamin wajib dipilih' }),
    nik: z.string().trim().regex(/^\d{16}$/, 'NIK harus 16 digit').optional().nullable().or(z.literal('').transform(() => null)),
    tempatLahir: optional(100),
    tanggalLahir: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('').transform(() => null)),
    alamat: optional(500),
    telepon: optional(20),
    goldar: optional(5),
    agama: optional(50),
    pekerjaan: optional(100),
    alergi: optional(500),
});

const pasien = {
    patientId: z.string().trim().min(1).optional(),
    pasienBaru: pasienBaruSchema.optional(),
};
const common = {
    ...pasien,
    dokterId: z.string().trim().min(1, 'Dokter wajib dipilih'),
    jaminan: z.enum(JAMINAN),
};
const onePatient = (b: { patientId?: string; pasienBaru?: unknown }) => !!b.patientId !== !!b.pasienBaru;
const onePatientMsg = { message: 'Pilih pasien lama atau isi data pasien baru (salah satu)' };

export const admitRawatJalanSchema = z.object({
    body: z.object({ ...common, poliId: z.string().trim().min(1, 'Poli wajib dipilih') }).refine(onePatient, onePatientMsg),
});

export const admitIgdSchema = z.object({
    body: z.object({
        ...common,
        triase: z.enum(TRIASE),
        keluhanUtama: z.string().trim().min(1, 'Keluhan utama wajib diisi'),
        vitals: z.object({
            sistolik: z.coerce.number().int().min(40).max(300).optional(),
            diastolik: z.coerce.number().int().min(20).max(200).optional(),
            nadi: z.coerce.number().int().min(20).max(250).optional(),
            suhu: z.coerce.number().min(30).max(45).optional(),
            pernapasan: z.coerce.number().int().min(5).max(60).optional(),
            spo2: z.coerce.number().int().min(50).max(100).optional(),
            kesadaran: z.string().max(50).optional(),
        }).optional(),
    }).refine(onePatient, onePatientMsg),
});

export const admitRawatInapSchema = z.object({
    body: z.object({
        ...common,
        ruanganId: z.string().trim().min(1, 'Ruangan wajib diisi'),
        kelas: z.string().trim().min(1, 'Kelas wajib dipilih'),
    }).refine(onePatient, onePatientMsg),
});

export const statusSchema = z.object({
    body: z.object({ status: z.string().trim().min(1) }),
});
