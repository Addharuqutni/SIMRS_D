/**
 * List-endpoint contract. Every paginated GET accepts `?page=&limit=&q=&status=`
 * and returns `Page<T>`. `counts` holds per-status totals for the current
 * search (ignoring the status filter) so tab badges stay correct across pages.
 */
export interface Page<T> {
    data: T[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    counts?: Record<string, number>;
}

export interface PageQuery {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
}
