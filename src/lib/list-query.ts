import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Page, PageQuery } from '../../shared/page';

export type { Page, PageQuery };

/**
 * Server-paginated list state for a list page: search (debounced), status tab,
 * page number, and the query itself. Changing search or status resets to page 1.
 *
 *   const list = useListQuery('billings', billingApi.list);
 *   <SearchBar value={list.search} onChange={list.setSearch} />
 *   <FilterTabs active={list.status} onChange={list.setStatus} tabs={[{ ..., count: list.counts.paid }]} />
 *   list.rows.map(...)
 *   <Pagination {...list.paginationProps} />
 */
export function useListQuery<T>(key: string, fetchPage: (q: PageQuery) => Promise<Page<T>>, opts: { limit?: number } = {}) {
    const [search, setSearchRaw] = useState('');
    const [debounced, setDebounced] = useState('');
    const [status, setStatusRaw] = useState('semua');
    const [page, setPage] = useState(1);
    const limit = opts.limit ?? 20;

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search.trim()), 300);
        return () => clearTimeout(t);
    }, [search]);

    const params: PageQuery = { page, limit, q: debounced || undefined, status: status === 'semua' ? undefined : status };
    const query = useQuery({
        queryKey: [key, 'page', params],
        queryFn: () => fetchPage(params),
        placeholderData: keepPreviousData,
    });

    const pagination = query.data?.pagination ?? { page, limit, total: 0, totalPages: 1 };
    const counts = query.data?.counts ?? {};
    const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);

    return {
        rows: query.data?.data ?? [],
        counts,
        /** Sum of per-status counts — the "Semua" tab badge. */
        totalAll,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
        search,
        setSearch: (v: string) => { setSearchRaw(v); setPage(1); },
        status,
        setStatus: (v: string) => { setStatusRaw(v); setPage(1); },
        paginationProps: {
            currentPage: pagination.page,
            totalPages: pagination.totalPages,
            totalItems: pagination.total,
            onPageChange: setPage,
        },
    };
}
