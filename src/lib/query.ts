import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const useList = <T>(key: string, queryFn: () => Promise<T>) =>
    useQuery<T>({ queryKey: [key], queryFn });

export const useDetail = <T>(key: string, id: string, queryFn: () => Promise<T>) =>
    useQuery<T>({ queryKey: [key, id], queryFn, enabled: !!id });

// Prefix invalidation: invalidating 'billings' also invalidates ['billings', id].
export const useMutate = <TVars, TData>(mutationFn: (vars: TVars) => Promise<TData>, ...invalidate: string[]) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        onSuccess: () => invalidate.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] })),
    });
};
