import { useList, useDetail, useMutate } from '../lib/query';
import { billingApi } from '../lib/api/billing';

export const useBillings = () => useList('billings', billingApi.getBillings);
export const useBillingDetail = (id: string) => useDetail('billings', id, () => billingApi.getBillingDetail(id));
export const usePayBilling = () =>
    useMutate(
        ({ id, metodePembayaran }: { id: string; metodePembayaran: string }) => billingApi.payBilling(id, metodePembayaran),
        'billings', 'transactions'
    );
export const useTransactions = () => useList('transactions', billingApi.getTransactions);
