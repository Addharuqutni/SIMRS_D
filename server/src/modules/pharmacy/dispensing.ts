/**
 * Resep dispensing — owns a Resep from creation to hand-over.
 *
 *   createResep  → baru
 *   startProses  → proses
 *   dispense     → selesai: FEFO stock deduction + billing charge, atomically.
 *
 * A Resep is dispensed at most once: the proses→selesai update is conditional
 * on the current status, so a replayed or concurrent request gets 409 and no
 * second stock deduction or charge. Items are charged at the medicine's
 * hargaJual at the moment of dispensing (price snapshot in the ledger).
 */
import { and, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Db } from '../../db/types';
import { prescriptions, prescriptionItems } from '../../db/schemas/services';
import { medicines } from '../../db/schemas/inventory';
import { visits } from '../../db/schemas/patient';
import { DomainError, notFound } from '../../utils/domain-error';
import { assertTransition } from '../../utils/transition';
import { charge } from '../billing/ledger';
import { consumeFefo, notifyLowStock, type StockLevel } from '../inventory/stock';

export interface ResepItemInput {
    obatId: number;
    dosis: string;
    jumlah: number;
    keterangan?: string;
}

export interface CreateResepInput {
    visitId: string;
    dokterId: string;
    items: ResepItemInput[];
}

const newNoResep = () => `RSP-${new Date().getFullYear().toString().slice(-2)}${nanoid(8).toUpperCase()}`;

export async function createResep(db: Db, input: CreateResepInput) {
    if (!input.items.length) throw new DomainError('Minimal satu obat harus diresepkan', 400);

    const [visit] = await db.select({ id: visits.id }).from(visits).where(eq(visits.id, input.visitId)).limit(1);
    if (!visit) throw new DomainError('Kunjungan tidak ditemukan', 400);

    const ids = [...new Set(input.items.map((i) => i.obatId))];
    const known = await db.select({ id: medicines.id }).from(medicines).where(inArray(medicines.id, ids));
    const missing = ids.filter((id) => !known.some((k) => k.id === id));
    if (missing.length) throw new DomainError(`Obat tidak dikenal: ${missing.join(', ')}`, 400);

    return db.transaction(async (tx) => {
        const [resep] = await tx.insert(prescriptions).values({
            id: nanoid(), noResep: newNoResep(), visitId: input.visitId, dokterId: input.dokterId, status: 'baru',
        }).returning();
        await tx.insert(prescriptionItems).values(input.items.map((i) => ({
            id: nanoid(), prescriptionId: resep.id, obatId: i.obatId, dosis: i.dosis, jumlah: i.jumlah, keterangan: i.keterangan,
        })));
        return resep;
    });
}

/** Loads the Resep and rejects an illegal move before any work starts. */
async function loadForTransition(db: Db, resepId: string, to: 'proses' | 'selesai') {
    const [resep] = await db.select().from(prescriptions).where(eq(prescriptions.id, resepId)).limit(1);
    if (!resep) throw notFound('Resep');
    assertTransition('resep', resep.status, to);
    return resep;
}

export async function startProses(db: Db, resepId: string) {
    const resep = await loadForTransition(db, resepId, 'proses');
    const [updated] = await db.update(prescriptions).set({ status: 'proses' })
        .where(and(eq(prescriptions.id, resepId), eq(prescriptions.status, resep.status)))
        .returning();
    if (!updated) throw new DomainError('Status resep berubah; muat ulang', 409);
    return updated;
}

export async function dispense(db: Db, resepId: string, actorName: string) {
    await loadForTransition(db, resepId, 'selesai');

    const levels: StockLevel[] = [];
    const updated = await db.transaction(async (tx) => {
        // Claim the Resep first: only one request can move proses → selesai.
        const [claimed] = await tx.update(prescriptions)
            .set({ status: 'selesai', waktuSelesai: new Date() })
            .where(and(eq(prescriptions.id, resepId), eq(prescriptions.status, 'proses')))
            .returning();
        if (!claimed) throw new DomainError('Resep sudah diserahkan', 409);

        const items = await tx.select({
            id: prescriptionItems.id, obatId: prescriptionItems.obatId, jumlah: prescriptionItems.jumlah,
            nama: medicines.nama, hargaJual: medicines.hargaJual,
        })
            .from(prescriptionItems)
            .innerJoin(medicines, eq(prescriptionItems.obatId, medicines.id))
            .where(eq(prescriptionItems.prescriptionId, resepId));

        for (const item of items) {
            levels.push(await consumeFefo(tx, item.obatId, item.jumlah, {
                referensi: claimed.noResep,
                keterangan: `Dispensing resep ${claimed.noResep} oleh ${actorName}`,
            }));
            await charge(tx, {
                visitId: claimed.visitId,
                kategori: 'Farmasi',
                namaItem: `Resep ${claimed.noResep}: ${item.nama}`,
                harga: item.hargaJual,
                jumlah: item.jumlah,
                sourceRef: `RESEP:${resepId}:${item.id}`,
            });
        }
        return claimed;
    });

    await notifyLowStock(db, levels);
    return updated;
}
