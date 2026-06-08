import { z } from 'zod';

const optionalText = z.string().trim().min(1).optional().nullable();

export const createPatientSchema = z.object({
    body: z.object({
        id: z.string().trim().min(1).optional(),
        rm: z.string().trim().min(1).max(20),
        nik: z.string().trim().length(16).optional().nullable(),
        nama: z.string().trim().min(1),
        tempatLahir: optionalText,
        tanggalLahir: z.string().trim().optional().nullable(),
        gender: z.string().trim().max(20).optional().nullable(),
        goldar: z.string().trim().max(5).optional().nullable(),
        agama: z.string().trim().max(50).optional().nullable(),
        alamat: optionalText,
        telepon: z.string().trim().max(20).optional().nullable(),
        pekerjaan: z.string().trim().max(100).optional().nullable(),
        alergi: optionalText,
    }).strict(),
});

export const updatePatientSchema = z.object({
    params: z.object({ rm: z.string().trim().min(1).max(20) }),
    body: createPatientSchema.shape.body.partial().omit({ id: true, rm: true }).strict(),
});

export const patientRmParamSchema = z.object({
    params: z.object({ rm: z.string().trim().min(1).max(20) }),
});

export const createVisitSchema = z.object({
    body: z.object({
        id: z.string().trim().min(1).optional(),
        patientId: z.string().trim().min(1),
        poliId: z.string().trim().min(1),
        dokterId: z.string().trim().min(1),
        jaminan: z.string().trim().min(1).max(50),
        status: z.string().trim().max(50).optional(),
        tipeKunjungan: z.string().trim().min(1).max(50),
    }).strict(),
});

export const visitIdParamSchema = z.object({
    params: z.object({ id: z.string().trim().min(1) }),
});
