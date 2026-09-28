import { useList, useDetail, useMutate } from '../lib/query';
import { useListQuery } from '../lib/list-query';
import { billingApi, type PaymentMethod } from '../lib/api/billing';

export const useBillingList = () => useListQuery('billings', billingApi.list);
export const useBillingDetail = (id: string) => useDetail('billings', id, () => billingApi.getBillingDetail(id));
export const useFinalizeBilling = () => useMutate(billingApi.finalizeBilling, 'billings');
export const usePayBilling = () =>
    useMutate(
        ({ id, metodePembayaran }: { id: string; metodePembayaran: PaymentMethod }) => billingApi.payBilling(id, metodePembayaran),
        'billings', 'transactions'
    );
export const useTransactions = () => useList('transactions', billingApi.getTransactions);
