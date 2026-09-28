/**
 * Stock module — the only code that changes medicine stock quantities.
 *
 * Every movement writes a stock_mutations row and keeps `medicines.stok`
 * equal to the sum of batch `qty_sisa` (plus opname adjustments). Callers pass
 * their transaction so the movement commits with the business action.
 */
import { and, asc, eq, gt, gte, inArray, sql } from 'drizzle-orm';
import type { DbOrTx } from '../../db/types';
import { medicines, stockBatches, stockMutations } from '../../db/schemas/inventory';
import { users } from '../../db/schemas/auth';
import { notifications } from '../../db/schemas/notify';
import { rolesWith } from '../../../../shared/access';
import { DomainError, notFound } from '../../utils/domain-error';
import { logger } from '../../utils/logger';

export interface StockLevel {
    nama: string;
    stok: number;
    minStok: number;
}

/**
 * Removes `qty` of a medicine, first-expiring unexpired batch first (FEFO).
 * Rejects with 409 when unexpired batches cannot cover the quantity — stock is
 * never clamped. Locks the medicine row so concurrent consumers serialize.
 */
export async function consumeFefo(
    tx: DbOrTx,
    medicineId: number,
    qty: number,
    ref: { referensi: string; keterangan: string },
): Promise<StockLevel> {
    const [med] = await tx.select().from(medicines).where(eq(medicines.id, medicineId)).for('update');
    if (!med) throw notFound(`Obat #${medicineId}`);

    const batches = await tx.select().from(stockBatches)
        .where(and(eq(stockBatches.medicineId, medicineId), gt(stockBatches.qtySisa, 0), gte(stockBatches.expiredDate, sql`CURRENT_DATE`)))
        .orderBy(asc(stockBatches.expiredDate), asc(stockBatches.id));

    const available = batches.reduce((a, b) => a + b.qtySisa, 0);
    if (available < qty) {
        throw new DomainError(`Stok ${med.nama} tidak cukup: dibutuhkan ${qty}, tersedia ${available} (belum kedaluwarsa)`, 409);
    }

    let remaining = qty;
    for (const batch of batches) {
        if (remaining === 0) break;
        const take = Math.min(batch.qtySisa, remaining);
        await tx.update(stockBatches).set({ qtySisa: batch.qtySisa - take }).where(eq(stockBatches.id, batch.id));
        await tx.insert(stockMutations).values({
            medicineId, batchId: batch.id, jenis: 'KELUAR', qty: take, keterangan: ref.keterangan, referensi: ref.referensi,
        });
        remaining -= take;
    }

    const stok = med.stok - qty;
    await tx.update(medicines).set({ stok }).where(eq(medicines.id, medicineId));
    return { nama: med.nama, stok, minStok: med.minStok };
}

/** Adds a received batch (Penerimaan Barang). */
export async function receiveBatch(
    tx: DbOrTx,
    input: { medicineId: number; noBatch: string; expiredDate: string; qty: number; supplier: string; noFaktur: string; hargaBeli?: number },
) {
    const [batch] = await tx.insert(stockBatches).values({
        medicineId: input.medicineId, noBatch: input.noBatch, expiredDate: input.expiredDate,
        qtyMasuk: input.qty, qtySisa: input.qty, supplier: input.supplier,
    }).returning();
    await tx.insert(stockMutations).values({
        medicineId: input.medicineId, batchId: batch.id, jenis: 'MASUK', qty: input.qty,
        keterangan: `Penerimaan barang dari ${input.supplier}`, referensi: input.noFaktur,
    });
    const [med] = await tx.update(medicines).set({
        stok: sql`${medicines.stok} + ${input.qty}`,
        ...(input.hargaBeli !== undefined ? { hargaBeli: input.hargaBeli } : {}),
    }).where(eq(medicines.id, input.medicineId)).returning({ stok: medicines.stok });
    return { ...batch, stok: med.stok };
}

/**
 * Takes a whole batch out of stock (expired → dimusnahkan, or returned to supplier).
 * Idempotent-safe: an already-empty batch is a 409.
 */
export async function removeBatch(tx: DbOrTx, batchId: number, jenis: 'MUSNAH' | 'RETUR', keterangan: string): Promise<StockLevel> {
    const [batch] = await tx.select().from(stockBatches).where(eq(stockBatches.id, batchId)).for('update');
    if (!batch) throw notFound('Batch');
    if (batch.qtySisa === 0) throw new DomainError(`Batch ${batch.noBatch} sudah kosong`, 409);

    await tx.update(stockBatches).set({ qtySisa: 0 }).where(eq(stockBatches.id, batchId));
    await tx.insert(stockMutations).values({
        medicineId: batch.medicineId, batchId, jenis, qty: batch.qtySisa, keterangan, referensi: batch.noBatch,
    });
    const [med] = await tx.update(medicines).set({ stok: sql`${medicines.stok} - ${batch.qtySisa}` })
        .where(eq(medicines.id, batch.medicineId))
        .returning({ nama: medicines.nama, stok: medicines.stok, minStok: medicines.minStok });
    return med;
}

/** Sets system stock to a physical count (stok opname), recording the difference. */
export async function adjustToCount(tx: DbOrTx, medicineId: number, stokFisik: number, keterangan: string) {
    const [med] = await tx.select().from(medicines).where(eq(medicines.id, medicineId)).for('update');
    if (!med) throw notFound(`Obat #${medicineId}`);
    const selisih = stokFisik - med.stok;
    if (selisih !== 0) {
        await tx.insert(stockMutations).values({
            medicineId, jenis: 'PENYESUAIAN', qty: Math.abs(selisih), keterangan, referensi: 'STOK OPNAME',
        });
        await tx.update(medicines).set({ stok: stokFisik }).where(eq(medicines.id, medicineId));
    }
    return { medicine: med, selisih, level: { nama: med.nama, stok: stokFisik, minStok: med.minStok } };
}

/**
 * Notifies stock-alert roles about medicines below minimum. Best effort: runs
 * after the stock transaction commits and never fails the caller. Deduped per
 * medicine while an unread alert exists.
 */
export async function notifyLowStock(db: DbOrTx, levels: StockLevel[]): Promise<void> {
    try {
        const low = levels.filter((m) => m.stok < m.minStok);
        if (!low.length) return;
        const recipients = await db.select({ id: users.id }).from(users)
            .where(inArray(users.role, [...rolesWith('stockAlerts')]));
        if (!recipients.length) return;

        for (const med of low) {
            const title = `Stok Menipis: ${med.nama}`;
            const [existing] = await db.select({ id: notifications.id }).from(notifications)
                .where(and(eq(notifications.title, title), eq(notifications.isRead, false))).limit(1);
            if (existing) continue;
            await db.insert(notifications).values(recipients.map((u) => ({
                userId: u.id,
                title,
                message: `Stok ${med.nama} tersisa ${med.stok} (di bawah minimum ${med.minStok}). Segera lakukan pemesanan ulang.`,
                type: 'warning',
                linkUrl: '/farmasi/stok',
            })));
        }
    } catch (err) {
        logger.error(`Gagal mengirim notifikasi stok menipis: ${err instanceof Error ? err.message : err}`);
    }
}
