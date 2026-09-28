/**
 * Billing ledger — the only module that writes billings, billing_items and
 * transactions.
 *
 * Other modules call `charge()` at the moment a service is delivered (Resep
 * diserahkan, order lab/rad dibuat, Kunjungan didaftarkan, Admisi pulang), with
 * the price that applies at that moment. `finalize()` totals what was recorded;
 * it never re-reads other modules' tables or re-prices anything.
 *
 * Invariants:
 *  - one billing per Kunjungan (visit_id UNIQUE), created lazily as 'open';
 *  - charges are only accepted while the billing is 'open';
 *  - `sourceRef` is unique, so replaying the same service is a no-op;
 *  - open → finalized → paid (shared/status 'billing' lifecycle);
 *  - paying writes exactly one 'pendapatan' row (BPJS: one 'piutang' row).
 */
import { and, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Db, DbOrTx } from '../../db/types';
import { billings, billingItems, transactions } from '../../db/schemas/billing';
import { visits } from '../../db/schemas/patient';
import { DomainError, notFound } from '../../utils/domain-error';
import { assertTransition } from '../../utils/transition';

export type ChargeKategori = 'Poli' | 'Farmasi' | 'Laboratorium' | 'Radiologi' | 'Rawat Inap' | 'Tindakan';

export interface Charge {
    visitId: string;
    kategori: ChargeKategori;
    namaItem: string;
    /** Unit price at service time (IDR, integer). */
    harga: number;
    jumlah?: number;
    /** Stable id of the originating service, e.g. `RESEP:<resepId>:<itemId>`. */
    sourceRef: string;
}

export type PaymentMethod = 'tunai' | 'debit' | 'transfer' | 'qris' | 'bpjs';

const newNoBilling = () => `INV-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;

async function openBillingFor(tx: DbOrTx, visitId: string) {
    const [existing] = await tx.select().from(billings).where(eq(billings.visitId, visitId)).limit(1);
    if (existing) return existing;

    const [visit] = await tx.select({ id: visits.id }).from(visits).where(eq(visits.id, visitId)).limit(1);
    if (!visit) throw notFound('Kunjungan');

    const [created] = await tx.insert(billings)
        .values({ id: nanoid(), visitId, noBilling: newNoBilling(), status: 'open' })
        .onConflictDoNothing({ target: billings.visitId })
        .returning();
    if (created) return created;
    // Lost a race with a concurrent charge for the same visit.
    const [winner] = await tx.select().from(billings).where(eq(billings.visitId, visitId)).limit(1);
    return winner;
}

/**
 * Records one billable service. Idempotent on `sourceRef`: returns false when
 * the service was already charged. Pass the caller's transaction so the charge
 * commits or rolls back with the service itself.
 */
export async function charge(tx: DbOrTx, c: Charge): Promise<boolean> {
    const jumlah = c.jumlah ?? 1;
    if (!Number.isInteger(c.harga) || c.harga < 0) throw new DomainError(`Harga tidak valid untuk ${c.namaItem}`, 400);
    if (!Number.isInteger(jumlah) || jumlah <= 0) throw new DomainError(`Jumlah tidak valid untuk ${c.namaItem}`, 400);

    const bill = await openBillingFor(tx, c.visitId);
    if (bill.status !== 'open') {
        throw new DomainError(`Billing ${bill.noBilling} sudah ${bill.status}; tindakan baru tidak dapat ditagihkan`, 409);
    }

    const subtotal = c.harga * jumlah;
    const inserted = await tx.insert(billingItems)
        .values({
            id: nanoid(), billingId: bill.id, kategori: c.kategori, namaItem: c.namaItem,
            harga: c.harga, jumlah, subtotal, sourceRef: c.sourceRef,
        })
        .onConflictDoNothing({ target: billingItems.sourceRef })
        .returning({ id: billingItems.id });
    if (!inserted.length) return false;

    await tx.update(billings).set({ total: sql`${billings.total} + ${subtotal}` }).where(eq(billings.id, bill.id));
    return true;
}

/** Removes a charge that was recorded for a service that is later cancelled (e.g. order batal). */
export async function voidCharge(tx: DbOrTx, sourceRef: string): Promise<void> {
    const [item] = await tx.select({ id: billingItems.id, billingId: billingItems.billingId, subtotal: billingItems.subtotal, status: billings.status })
        .from(billingItems)
        .innerJoin(billings, eq(billingItems.billingId, billings.id))
        .where(eq(billingItems.sourceRef, sourceRef))
        .limit(1);
    if (!item) return;
    if (item.status !== 'open') throw new DomainError('Billing sudah difinalisasi; tagihan tidak dapat dibatalkan', 409);
    await tx.delete(billingItems).where(eq(billingItems.id, item.id));
    await tx.update(billings).set({ total: sql`${billings.total} - ${item.subtotal}` }).where(eq(billings.id, item.billingId));
}

/** Closes the bill for a Kunjungan. Totals are what `charge()` recorded; nothing is re-priced. */
export async function finalize(db: Db, visitId: string) {
    return db.transaction(async (tx) => {
        const [bill] = await tx.select().from(billings).where(eq(billings.visitId, visitId)).limit(1);
        if (!bill) throw new DomainError('Belum ada tagihan untuk kunjungan ini', 404);
        assertTransition('billing', bill.status, 'finalized');

        const [{ total }] = await tx.select({ total: sql<number>`coalesce(sum(${billingItems.subtotal}), 0)::int` })
            .from(billingItems).where(eq(billingItems.billingId, bill.id));

        const [updated] = await tx.update(billings)
            .set({ status: 'finalized', total, waktuFinalisasi: new Date() })
            .where(and(eq(billings.id, bill.id), eq(billings.status, 'open')))
            .returning();
        if (!updated) throw new DomainError('Billing sudah difinalisasi', 409);
        return updated;
    });
}

/**
 * Settles a finalized bill. Exactly one ledger row per bill: 'pendapatan' for
 * cash-like methods, 'piutang' for BPJS (receivable until the Klaim is paid).
 */
export async function pay(db: Db, billingId: string, method: PaymentMethod, actorId: string | undefined) {
    return db.transaction(async (tx) => {
        const [bill] = await tx.select().from(billings).where(eq(billings.id, billingId)).limit(1);
        if (!bill) throw notFound('Billing');
        assertTransition('billing', bill.status, 'paid');

        const [updated] = await tx.update(billings)
            .set({ status: 'paid', metodePembayaran: method, waktuBayar: new Date() })
            .where(and(eq(billings.id, billingId), eq(billings.status, 'finalized')))
            .returning();
        if (!updated) throw new DomainError('Billing sudah dibayar', 409);

        await tx.insert(transactions).values({
            id: nanoid(),
            keterangan: `Pembayaran ${updated.noBilling}`,
            kategori: 'Pendapatan Medis',
            jenis: method === 'bpjs' ? 'piutang' : 'pendapatan',
            jumlah: updated.total,
            referensi: updated.noBilling,
            dicatatOleh: actorId ?? null,
        });
        return updated;
    });
}
