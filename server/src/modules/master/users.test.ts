import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createTestDb } from '../../db/testing';
import type { Db } from '../../db/types';
import { sessions, users } from '../../db/schemas/auth';
import { createUserSchema, updateUserSchema } from './schema';
import { createUser, deactivateUser, listDoctors, listUsers, updateUser } from './users';

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());
beforeEach(async () => {
    await db.execute(sql`truncate users cascade`);
});

/** Runs a payload through the Zod schema, mirroring what the route's validate() does. */
const parseCreate = (body: unknown) => createUserSchema.safeParse({ body });

const baseUser = (over: Record<string, unknown> = {}) => ({
    nama: 'Dr. Sari',
    email: 'sari@simrs.com',
    role: 'Dokter Spesialis',
    unit: 'Poli Anak',
    ...over,
});

describe('Master users — role validation', () => {
    it('rejects unknown roles with a Zod issue (route maps ZodError to 400)', () => {
        for (const role of ['admin', 'Superadmin ', 'dokter']) {
            const result = parseCreate(baseUser({ role }));
            expect(result.success, `role ${JSON.stringify(role)} must be rejected`).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some((i) => i.path.join('.') === 'body.role')).toBe(true);
            }
        }
    });

    it('accepts every role from ALL_ROLES', () => {
        const roles = ['Superadmin', 'Pendaftaran', 'Dokter Spesialis', 'Dokter Umum', 'Perawat', 'Apoteker', 'Kasir / Billing', 'Analis Lab', 'Keuangan'];
        for (const role of roles) {
            const result = parseCreate(baseUser({ role }));
            expect(result.success, `role ${JSON.stringify(role)} must be accepted`).toBe(true);
        }
    });

    it('rejects an invalid status and an invalid email', () => {
        expect(parseCreate(baseUser({ status: 'aktifkan' })).success).toBe(false);
        expect(parseCreate(baseUser({ email: 'bukan-email' })).success).toBe(false);
    });

    it('update schema validates the role too and ignores absent fields', () => {
        expect(updateUserSchema.safeParse({ body: { role: 'dokter' }, params: { id: 'USR-1' } }).success).toBe(false);
        expect(updateUserSchema.safeParse({ body: { status: 'nonaktif' }, params: { id: 'USR-1' } }).success).toBe(true);
        expect(updateUserSchema.safeParse({ body: {}, params: { id: 'USR-1' } }).success).toBe(true);
    });
});

describe('Master users — domain behaviour', () => {
    it('creates a valid user and rejects a duplicate email', async () => {
        const { id } = await createUser(db, baseUser() as never);
        expect(id).toMatch(/^USR-/);

        await expect(createUser(db, baseUser() as never)).rejects.toMatchObject({ status: 409 });
    });

    it('updates a user, rejects unknown ids and emails owned by someone else', async () => {
        const { id } = await createUser(db, baseUser() as never);
        await createUser(db, baseUser({ nama: 'Ns. Siti', email: 'siti@simrs.com', role: 'Perawat' }) as never);

        await updateUser(db, id, { status: 'nonaktif' });
        const [row] = await db.select().from(users).where(sql`${users.id} = ${id}`);
        expect(row.status).toBe('nonaktif');

        await expect(updateUser(db, 'USR-missing', { unit: 'IGD' })).rejects.toMatchObject({ status: 404 });
        await expect(updateUser(db, id, { email: 'siti@simrs.com' })).rejects.toMatchObject({ status: 409 });
    });

    it('pages users with per-status counts and search', async () => {
        await createUser(db, baseUser() as never);
        await createUser(db, baseUser({ nama: 'Ani', email: 'ani@simrs.com', role: 'Perawat', status: 'nonaktif' }) as never);

        const all = await listUsers(db, { limit: 20, offset: 0 });
        expect(all.total).toBe(2);
        expect(all.counts).toEqual({ aktif: 1, nonaktif: 1 });

        const filtered = await listUsers(db, { status: 'nonaktif', limit: 20, offset: 0 });
        expect(filtered.rows).toHaveLength(1);
        expect(filtered.rows[0].name).toBe('Ani');

        const searched = await listUsers(db, { q: 'sari', limit: 20, offset: 0 });
        expect(searched.rows).toHaveLength(1);
        expect(searched.rows[0].role).toBe('Dokter Spesialis');
    });

    it('deactivates instead of deleting: status flips, sessions are revoked, history survives', async () => {
        const { id } = await createUser(db, baseUser({ role: 'Dokter Umum' }) as never);
        await db.insert(sessions).values({
            id: 'sess-1', token: 'tok-1', userId: id,
            expiresAt: new Date(Date.now() + 86_400_000),
            createdAt: new Date(), updatedAt: new Date(),
        });

        expect((await listDoctors(db)).map((d) => d.id)).toEqual([id]);

        await deactivateUser(db, id);

        const [user] = await db.select().from(users).where(eq(users.id, id));
        expect(user).toBeDefined();
        expect(user.status).toBe('nonaktif');
        expect(await db.select().from(sessions).where(eq(sessions.userId, id))).toHaveLength(0);
        expect(await listDoctors(db)).toHaveLength(0);

        await expect(deactivateUser(db, 'USR-missing')).rejects.toMatchObject({ status: 404 });
    });

    it('lists only active users holding an exact doctor role', async () => {
        await createUser(db, baseUser({ email: 'dok1@simrs.com', role: 'Dokter Umum' }) as never);
        await createUser(db, baseUser({ nama: 'Perawat', email: 'perawat@simrs.com', role: 'Perawat' }) as never);
        await createUser(db, baseUser({ nama: 'Non Aktif', email: 'off@simrs.com', role: 'Dokter Spesialis', status: 'nonaktif' }) as never);
        // near-miss role strings must never be treated as doctors
        await db.insert(users).values({ id: 'USR-x', name: 'X', email: 'x@simrs.com', role: 'Dokter Gigi', createdAt: new Date(), updatedAt: new Date() });

        const doctors = await listDoctors(db);
        // only the active exact-role doctor survives both filters
        expect(doctors.map((d) => d.role)).toEqual(['Dokter Umum']);
    });
});
