import { nanoid } from 'nanoid';
import { and, count, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/types';
import { users, sessions } from '../../db/schemas/auth';
import { DOCTOR_ROLES } from '../../../../shared/access';
import { DomainError } from '../../utils/domain-error';
import { countsByStatus } from '../../utils/pagination';
import type { CreateUserInput, UpdateUserInput } from './schema';

export const USER_STATUSES = ['aktif', 'nonaktif'] as const;

export interface UserRow {
    id: string;
    name: string;
    email: string;
    role: string;
    unit: string | null;
    status: string;
}

const listColumns = {
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    unit: users.unit,
    status: users.status,
};

export interface ListUsersParams {
    q?: string;
    status?: string;
    limit: number;
    offset: number;
}

export interface UsersPage {
    rows: UserRow[];
    total: number;
    counts: Record<string, number>;
}

function searchFilter(q?: string, status?: string): SQL | undefined {
    const search = q ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`), ilike(users.role, `%${q}%`), ilike(users.unit, `%${q}%`)) : undefined;
    return and(search, status ? eq(users.status, status) : undefined);
}

/** Page of users with per-status counts for the tab badges (counts ignore the status filter). */
export async function listUsers(db: Db, p: ListUsersParams): Promise<UsersPage> {
    const search = p.q
        ? or(ilike(users.name, `%${p.q}%`), ilike(users.email, `%${p.q}%`), ilike(users.role, `%${p.q}%`), ilike(users.unit, `%${p.q}%`))
        : undefined;

    const [rows, statusRows, totalRows] = await Promise.all([
        db.select(listColumns).from(users).where(searchFilter(p.q, p.status)).orderBy(users.name).limit(p.limit).offset(p.offset),
        db.select({ status: users.status, n: count() }).from(users).where(search).groupBy(users.status),
        db.select({ n: count() }).from(users).where(searchFilter(p.q, p.status)),
    ]);

    return {
        rows,
        total: Number(totalRows[0]?.n ?? 0),
        counts: countsByStatus(statusRows),
    };
}

/** Active users holding a doctor role (exact match on DOCTOR_ROLES). */
export async function listDoctors(db: Db): Promise<UserRow[]> {
    return db.select(listColumns).from(users)
        .where(and(inArray(users.role, [...DOCTOR_ROLES]), eq(users.status, 'aktif')))
        .orderBy(users.name);
}

/** Creates a user; rejects duplicate emails. */
export async function createUser(db: Db, input: CreateUserInput): Promise<{ id: string }> {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    if (existing) throw new DomainError('Email sudah terdaftar', 409);

    const id = `USR-${nanoid(12)}`;
    const now = new Date();
    await db.insert(users).values({
        id,
        name: input.nama,
        email: input.email,
        role: input.role,
        unit: input.unit,
        status: input.status ?? 'aktif',
        createdAt: now,
        updatedAt: now,
        emailVerified: true,
    });
    return { id };
}

/**
 * Soft-deletes a user: status becomes 'nonaktif' and every session is revoked so
 * the account is signed out immediately. History (visits, prescriptions, audit
 * rows) keeps its foreign keys — a hard delete would fail and destroy the trail.
 */
export async function deactivateUser(db: Db, id: string): Promise<void> {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    if (!existing) throw new DomainError('User tidak ditemukan', 404);

    await db.transaction(async (tx) => {
        await tx.update(users).set({ status: 'nonaktif', updatedAt: new Date() }).where(eq(users.id, id));
        await tx.delete(sessions).where(eq(sessions.userId, id));
    });
}

/** Updates a user; 404 when the id is unknown, 409 on an email already used by someone else. */
export async function updateUser(db: Db, id: string, input: UpdateUserInput): Promise<void> {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    if (!existing) throw new DomainError('User tidak ditemukan', 404);

    if (input.email) {
        const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
        if (dup && dup.id !== id) throw new DomainError('Email sudah digunakan user lain', 409);
    }

    await db.update(users).set({
        ...(input.nama !== undefined ? { name: input.nama } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date(),
    }).where(eq(users.id, id));
}
