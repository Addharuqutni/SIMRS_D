import { z } from 'zod';

export const createMedicineSchema = z.object({
    body: z.object({
        kodeObat: z.string().min(1, 'Kode obat wajib diisi').max(50),
        nama: z.string().min(1, 'Nama obat wajib diisi').max(200),
        kategori: z.string().max(100).optional(),
        satuan: z.string().max(50).optional(),
        hargaBeli: z.coerce.number().int().nonnegative('Harga beli tidak boleh negatif').default(0),
        hargaJual: z.coerce.number().int().nonnegative('Harga jual tidak boleh negatif').default(0),
        minStok: z.coerce.number().int().nonnegative().default(10),
    })
});

export const updateMedicineSchema = z.object({
    body: z.object({
        nama: z.string().min(1).max(200).optional(),
        kategori: z.string().max(100).optional(),
        satuan: z.string().max(50).optional(),
        hargaBeli: z.coerce.number().int().nonnegative().optional(),
        hargaJual: z.coerce.number().int().nonnegative().optional(),
        minStok: z.coerce.number().int().nonnegative().optional(),
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

export const createReceptionSchema = z.object({
    body: z.object({
        kodeObat: z.string().min(1, 'Kode obat wajib dipilih').max(50),
        noBatch: z.string().min(1, 'No. batch wajib diisi').max(100),
        noFaktur: z.string().min(1, 'No. faktur wajib diisi').max(100),
        supplier: z.string().min(1, 'Supplier wajib diisi').max(200),
        qty: z.coerce.number().int('Qty harus berupa angka bulat').positive('Qty harus lebih dari 0'),
        expiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expired date harus berformat YYYY-MM-DD'),
        hargaBeli: z.coerce.number().int().nonnegative('Harga beli tidak boleh negatif').optional(),
    })
});

export const createOpnameSchema = z.object({
    body: z.object({
        items: z.array(z.object({
            kodeObat: z.string().min(1, 'Kode obat wajib dipilih').max(50),
            stokFisik: z.coerce.number().int('Stok fisik harus berupa angka bulat').nonnegative('Stok fisik tidak boleh negatif'),
            catatan: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
        })).min(1, 'Minimal satu item opname'),
    })
});

export const disposeBatchSchema = z.object({
    params: z.object({ id: z.coerce.number().int().positive() }),
    body: z.object({
        jenis: z.enum(['MUSNAH', 'RETUR']),
        catatan: z.string().max(500).optional(),
    }),
});
