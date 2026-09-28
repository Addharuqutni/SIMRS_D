import { useListQuery } from '../lib/list-query';
import { useMutate } from '../lib/query';
import { penunjangApi, type CompleteOrderInput, type CreateOrderInput, type OrderKind } from '../lib/api/penunjang';

/** Key namespace per unit so the two lists never invalidate each other. */
const key = (kind: OrderKind) => (kind === 'lab' ? 'lab-orders' : 'rad-orders');

/** Server-paginated worklist for one penunjang unit. */
export const usePenunjangOrders = (kind: OrderKind) =>
    useListQuery(key(kind), (q) => penunjangApi.listOrders(kind, q));

export const useCreatePenunjangOrder = (kind: OrderKind) =>
    useMutate((input: CreateOrderInput) => penunjangApi.createOrder(kind, input), key(kind), 'billings');

export const useStartPenunjangOrder = (kind: OrderKind) =>
    useMutate((id: string) => penunjangApi.startOrder(kind, id), key(kind));

export const useCompletePenunjangOrder = (kind: OrderKind) =>
    useMutate(({ id, data }: { id: string; data: CompleteOrderInput }) => penunjangApi.completeOrder(kind, id, data), key(kind));

export const useCancelPenunjangOrder = (kind: OrderKind) =>
    useMutate((id: string) => penunjangApi.cancelOrder(kind, id), key(kind), 'billings');

export const useUploadPenunjangHasil = (kind: OrderKind) =>
    useMutate(({ id, file }: { id: string; file: File }) => penunjangApi.uploadHasil(kind, id, file), key(kind));
