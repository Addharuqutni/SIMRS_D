import { z } from 'zod';

export const saveSoapSchema = z.object({
    body: z.object({
        visitId: z.string().min(1, 'Visit ID wajib diisi'),
        dokterId: z.string().min(1, 'Dokter ID wajib diisi'),
        subjektif: z.string().optional(),
        objektif: z.string().optional(),
        asesmen: z.string().optional(),
        planning: z.string().optional(),
    })
});

export const prescriptionItemSchema = z.object({
    obatId: z.string().min(1, 'Obat ID wajib dipilih'),
    dosis: z.string().min(1, 'Dosis wajib diisi').max(100),
    jumlah: z.number().positive('Jumlah obat harus lebih dari 0'),
    keterangan: z.string().optional(),
});

export const createPrescriptionSchema = z.object({
    body: z.object({
        visitId: z.string().min(1, 'Visit ID wajib diisi'),
        dokterId: z.string().min(1, 'Dokter ID wajib diisi'),
        items: z.array(prescriptionItemSchema).min(1, 'Minimal satu obat harus diresepkan')
    })
});

export const createOrderSchema = z.object({
    body: z.object({
        visitId: z.string().min(1, 'Visit ID wajib diisi'),
        dokterId: z.string().min(1, 'Dokter ID wajib diisi'),
        jenisPemeriksaan: z.string().min(1, 'Jenis Pemeriksaan wajib diisi'),
        catatan: z.string().optional()
    }),
    params: z.object({
        type: z.enum(['lab', 'radiology'])
    })
});
