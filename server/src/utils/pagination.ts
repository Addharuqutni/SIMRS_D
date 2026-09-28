import type { Request } from 'express';
import type { Page } from '../../../shared/page';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface PageParams {
    page: number;
    limit: number;
    offset: number;
    /** Trimmed search text, or undefined when blank. */
    q?: string;
    /** Status filter, or undefined for "all". */
    status?: string;
}

/** Reads `page`, `limit`, `q`, `status` from the query string with clamping. */
export function readPageParams(req: Request): PageParams {
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(req.query.limit)) || DEFAULT_LIMIT));
    const q = typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q.trim() : undefined;
    const status = typeof req.query.status === 'string' && req.query.status && req.query.status !== 'semua'
        ? req.query.status
        : undefined;
    return { page, limit, offset: (page - 1) * limit, q, status };
}

export function toPage<T>(rows: T[], total: number, params: PageParams, counts?: Record<string, number>): Page<T> {
    return {
        data: rows,
        pagination: { page: params.page, limit: params.limit, total, totalPages: Math.max(1, Math.ceil(total / params.limit)) },
        ...(counts ? { counts } : {}),
    };
}

/** Turns `[{ status, n }]` rows from a GROUP BY into `{ status: n }`. */
export function countsByStatus(rows: { status: string | null; n: number | string }[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const r of rows) if (r.status) counts[r.status] = Number(r.n);
    return counts;
}
