import { z } from 'zod';

export const createMedicineSchema = z.object({
    body: z.object({
        kodeObat: z.string().min(1, 'Kode obat wajib diisi').max(50),
        nama: z.string().min(1, 'Nama obat wajib diisi').max(200),
        kategori: z.string().max(100).optional(),
        satuan: z.string().max(50).optional(),
        hargaBeli: z.number().nonnegative('Harga beli tidak boleh negatif').default(0),
        hargaJual: z.number().nonnegative('Harga jual tidak boleh negatif').default(0),
        stok: z.number().nonnegative().default(0),
        minStok: z.number().nonnegative().default(10),
    })
});

export const updateMedicineSchema = z.object({
    body: z.object({
        nama: z.string().min(1).max(200).optional(),
        kategori: z.string().max(100).optional(),
        satuan: z.string().max(50).optional(),
        hargaBeli: z.number().nonnegative().optional(),
        hargaJual: z.number().nonnegative().optional(),
        stok: z.number().nonnegative().optional(),
        minStok: z.number().nonnegative().optional(),
    }),
    params: z.object({
        kode: z.string().min(1, 'Kode obat param is required')
    })
});

export const deleteMedicineSchema = z.object({
    params: z.object({
        kode: z.string().min(1, 'Kode obat param is required')
    })
});
