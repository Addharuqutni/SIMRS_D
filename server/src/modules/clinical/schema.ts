import { z } from 'zod';

export const saveSoapSchema = z.object({
    body: z.object({
        visitId: z.string().min(1, 'Visit ID wajib diisi'),
        dokterId: z.string().min(1, 'Dokter ID wajib diisi'),
        subjektif: z.string().optional(),
        objektif: z.string().optional(),
        asesmen: z.string().optional(),
        planning: z.string().optional(),
        icd10Codes: z.array(z.string()).optional(),
        icd9Codes: z.array(z.string()).optional(),
    })
});

// Vital signs — all fields optional but at least one clinical value required.
// Numeric ranges guard against fat-finger data-entry errors (e.g. BP 1200).
export const saveVitalSignsSchema = z.object({
    body: z.object({
        visitId: z.string().min(1, 'Visit ID wajib diisi'),
        recordedBy: z.string().min(1, 'Pencatat wajib diisi'),
        sistolik: z.number().int().min(40, 'Sistolik di luar rentang').max(300, 'Sistolik di luar rentang').optional(),
        diastolik: z.number().int().min(20, 'Diastolik di luar rentang').max(200, 'Diastolik di luar rentang').optional(),
        nadi: z.number().int().min(20, 'Nadi di luar rentang').max(250, 'Nadi di luar rentang').optional(),
        suhu: z.number().min(30, 'Suhu di luar rentang').max(45, 'Suhu di luar rentang').optional(),
        pernapasan: z.number().int().min(5, 'Pernapasan di luar rentang').max(60, 'Pernapasan di luar rentang').optional(),
        spo2: z.number().int().min(50, 'SpO2 di luar rentang').max(100, 'SpO2 di luar rentang').optional(),
        beratBadan: z.number().min(0.5, 'Berat badan tidak valid').max(400, 'Berat badan tidak valid').optional(),
        tinggiBadan: z.number().min(30, 'Tinggi badan tidak valid').max(250, 'Tinggi badan tidak valid').optional(),
        gcs: z.number().int().min(3, 'GCS minimal 3').max(15, 'GCS maksimal 15').optional(),
        catatan: z.string().optional(),
        penyelenggara: z.enum(['Dokter', 'Perawat', 'Analis']).optional(),
    })
});

// CPPT — Catatan Perkembangan Pasien Terintegrasi (progress note).
export const saveProgressNoteSchema = z.object({
    body: z.object({
        visitId: z.string().min(1, 'Visit ID wajib diisi'),
        authorId: z.string().min(1, 'Penulis wajib diisi'),
        authorRole: z.enum(['Dokter', 'Perawat']),
        subjektif: z.string().optional(),
        objektif: z.string().optional(),
        asesmen: z.string().optional(),
        planning: z.string().optional(),
        icd10Codes: z.array(z.string()).optional(),
        icd9Codes: z.array(z.string()).optional(),
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
