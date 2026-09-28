import { z } from 'zod';

const optionalText = z.string().trim().min(1).optional().nullable();

// Patients are created only through Admission (server-issued RM); this edits demographics.
export const updatePatientSchema = z.object({
    params: z.object({ rm: z.string().trim().min(1).max(20) }),
    body: z.object({
        nik: z.string().trim().length(16).optional().nullable(),
        nama: z.string().trim().min(1),
        tempatLahir: optionalText,
        tanggalLahir: z.string().trim().optional().nullable(),
        gender: z.enum(['L', 'P']),
        goldar: z.string().trim().max(5).optional().nullable(),
        agama: z.string().trim().max(50).optional().nullable(),
        alamat: optionalText,
        telepon: z.string().trim().max(20).optional().nullable(),
        pekerjaan: z.string().trim().max(100).optional().nullable(),
        alergi: optionalText,
    }).partial().strict(),
});

export const patientRmParamSchema = z.object({
    params: z.object({ rm: z.string().trim().min(1).max(20) }),
});

export const visitIdParamSchema = z.object({
    params: z.object({ id: z.string().trim().min(1) }),
});
