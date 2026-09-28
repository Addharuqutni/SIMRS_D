import { z } from 'zod';

export const resepItemSchema = z.object({
    obatId: z.coerce.number().int().positive('Obat wajib dipilih'),
    dosis: z.string().min(1, 'Dosis wajib diisi').max(100),
    jumlah: z.coerce.number().int().positive('Jumlah harus lebih dari 0'),
    keterangan: z.string().max(500).optional(),
});

export const createResepSchema = z.object({
    body: z.object({
        visitId: z.string().min(1, 'Visit ID wajib diisi'),
        items: z.array(resepItemSchema).min(1, 'Minimal satu obat harus diresepkan'),
    }),
});

export const resepStatusSchema = z.object({
    body: z.object({ status: z.enum(['proses', 'selesai']) }),
});
