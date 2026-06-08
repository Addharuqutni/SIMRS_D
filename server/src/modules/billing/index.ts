import { Router } from 'express';
import { db } from '../../db';
import { billings, billingItems, transactions } from '../../db/schemas/billing';
import { visits, patients } from '../../db/schemas/patient';
import { prescriptions, prescriptionItems } from '../../db/schemas/services';
import { labOrders, radiologyOrders } from '../../db/schemas/clinical';
import { medicines } from '../../db/schemas/inventory';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, requireRole } from '../../middleware/auth';
import { ROLE_GROUPS } from '../../utils/roles';
import { nanoid } from 'nanoid';

const router = Router();

// GET all billings
router.get('/', requireAuth, requireRole(...ROLE_GROUPS.billing), async (req, res) => {
    try {
        const query = await db.select({
            id: billings.id,
            noBilling: billings.noBilling,
            visitId: billings.visitId,
            total: billings.total,
            status: billings.status,
            waktuFinalisasi: billings.waktuFinalisasi,
            waktuBayar: billings.waktuBayar,
            metodePembayaran: billings.metodePembayaran,
            createdAt: billings.createdAt,
            patientName: patients.nama,
            rm: patients.rm,
        })
            .from(billings)
            .leftJoin(visits, eq(billings.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .orderBy(desc(billings.createdAt));

        res.json(query);
    } catch (error) {
        console.error('Error fetching billings:', error);
        res.status(500).json({ error: 'Failed to fetch billings' });
    }
});

// GET specific billing detail
router.get('/:id', requireAuth, requireRole(...ROLE_GROUPS.billing), async (req, res) => {
    try {
        const { id } = req.params;
        const bill = await db.select({
            id: billings.id,
            noBilling: billings.noBilling,
            visitId: billings.visitId,
            total: billings.total,
            status: billings.status,
            patientName: patients.nama,
            rm: patients.rm,
        })
            .from(billings)
            .leftJoin(visits, eq(billings.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .where(eq(billings.id, id))
            .limit(1);

        if (!bill.length) return res.status(404).json({ error: 'Billing not found' });

        const items = await db.select().from(billingItems).where(eq(billingItems.billingId, id));
        res.json({ ...bill[0], items });
    } catch (error) {
        console.error('Error fetching billing detail:', error);
        res.status(500).json({ error: 'Failed to fetch billing detail' });
    }
});

// POST auto-generate billing from a highly structured visit
router.post('/visit/:visitId/finalize', requireAuth, requireRole(...ROLE_GROUPS.billing), async (req, res) => {
    try {
        const { visitId } = req.params;

        // 1. Check if billing already exists
        const existing = await db.select().from(billings).where(eq(billings.visitId, visitId)).limit(1);
        if (existing.length) {
            return res.status(400).json({ error: 'Billing already generated for this visit' });
        }

        const visitData = await db.select().from(visits).where(eq(visits.id, visitId)).limit(1);
        if (!visitData.length) return res.status(404).json({ error: 'Visit not found' });

        const billId = nanoid();
        const noBilling = `INV-${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`;

        const itemsToInsert: any[] = [];
        let grandTotal = 0;

        // A. Jasa Konsultasi Poli/Visit
        itemsToInsert.push({
            id: nanoid(),
            billingId: billId,
            kategori: 'Poli',
            namaItem: 'Konsultasi Dokter Spesialis',
            harga: 150000,
            jumlah: 1,
            subtotal: 150000
        });
        grandTotal += 150000;

        // B. Farmasi Prescriptions
        const pList = await db.select().from(prescriptions).where(eq(prescriptions.visitId, visitId));
        for (const presc of pList) {
            const pItems = await db.select().from(prescriptionItems).where(eq(prescriptionItems.prescriptionId, presc.id));
            for (const pi of pItems) {
                // Get harga jual
                const med = await db.select().from(medicines).where(eq(medicines.id, parseInt(pi.obatId))).limit(1);
                const harga = med.length ? med[0].hargaJual : 5000; // fallback 5000
                const sub = harga * pi.jumlah;
                itemsToInsert.push({
                    id: nanoid(),
                    billingId: billId,
                    kategori: 'Farmasi',
                    namaItem: `Resep: ${med.length ? med[0].nama : pi.obatId}`,
                    harga,
                    jumlah: pi.jumlah,
                    subtotal: sub
                });
                grandTotal += sub;
            }
        }

        // C. Laboratorium
        const lList = await db.select().from(labOrders).where(eq(labOrders.visitId, visitId));
        for (const lab of lList) {
            itemsToInsert.push({
                id: nanoid(),
                billingId: billId,
                kategori: 'Laboratorium',
                namaItem: `Lab: ${lab.jenisPemeriksaan}`,
                harga: 100000,
                jumlah: 1,
                subtotal: 100000
            });
            grandTotal += 100000;
        }

        // D. Radiologi
        const rList = await db.select().from(radiologyOrders).where(eq(radiologyOrders.visitId, visitId));
        for (const rad of rList) {
            itemsToInsert.push({
                id: nanoid(),
                billingId: billId,
                kategori: 'Radiologi',
                namaItem: `Rad: ${rad.jenisPemeriksaan}`,
                harga: 250000,
                jumlah: 1,
                subtotal: 250000
            });
            grandTotal += 250000;
        }

        // 2. Insert Billing Record
        const newBill = await db.insert(billings).values({
            id: billId,
            visitId,
            noBilling,
            total: grandTotal,
            status: 'finalized',
            waktuFinalisasi: new Date()
        }).returning();

        // 3. Insert Items
        if (itemsToInsert.length > 0) {
            await db.insert(billingItems).values(itemsToInsert);
        }

        res.status(201).json(newBill[0]);
    } catch (error) {
        console.error('Error auto-generating bill:', error);
        res.status(500).json({ error: 'Failed to auto-generate billing' });
    }
});

// PUT pay billing
router.put('/:id/pay', requireAuth, requireRole(...ROLE_GROUPS.billing), async (req, res) => {
    try {
        const { id } = req.params;
        const { metodePembayaran } = req.body;

        const updated = await db.update(billings)
            .set({
                status: 'paid',
                metodePembayaran,
                waktuBayar: new Date()
            })
            .where(eq(billings.id, id))
            .returning();

        if (!updated.length) return res.status(404).json({ error: 'Billing not found' });

        // Record income transaction
        await db.insert(transactions).values({
            id: nanoid(),
            keterangan: `Pembayaran ${updated[0].noBilling}`,
            kategori: 'Pendapatan Medis',
            jenis: 'pendapatan',
            jumlah: updated[0].total
        });

        res.json(updated[0]);
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ error: 'Failed to process payment' });
    }
});

// GET all transactions for Laporan Keuangan
router.get('/transactions', requireAuth, requireRole(...ROLE_GROUPS.billing), async (req, res) => {
    try {
        const query = await db.select().from(transactions).orderBy(desc(transactions.tanggal));
        res.json(query);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

export const billingRouter = router;
