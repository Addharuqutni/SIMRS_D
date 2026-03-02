import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicalApi } from '../lib/api/clinical';

// ==========================================
// RAWAT JALAN
// ==========================================

export const useRawatJalanList = () => {
    return useQuery({
        queryKey: ['rawat-jalan'],
        queryFn: clinicalApi.getRawatJalan
    });
};

export const useUpdateRawatJalanStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => clinicalApi.updateRawatJalanStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rawat-jalan'] });
        }
    });
};

// ==========================================
// EMR SOAP
// ==========================================

export const useEmrSoap = (visitId: string) => {
    return useQuery({
        queryKey: ['emr-soap', visitId],
        queryFn: () => clinicalApi.getSoap(visitId),
        enabled: !!visitId
    });
};

export const useSaveEmrSoap = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: clinicalApi.saveSoap,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['emr-soap', variables.visitId] });
        }
    });
};

export const useCreatePrescription = () => {
    return useMutation({
        mutationFn: clinicalApi.createPrescription,
    });
};

export const useCreateOrder = () => {
    return useMutation({
        mutationFn: (vars: { type: 'lab' | 'radiology'; data: any }) => clinicalApi.createOrder(vars.type, vars.data)
    });
};

// ==========================================
// RAWAT INAP
// ==========================================

export const useRawatInapList = () => {
    return useQuery({
        queryKey: ['rawat-inap'],
        queryFn: clinicalApi.getRawatInap
    });
};

export const useCreateRawatInapAdmisi = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: clinicalApi.createAdmisiInap,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rawat-inap'] });
        }
    });
};

export const useUpdateRawatInapStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => clinicalApi.updateRawatInapStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rawat-inap'] });
        }
    });
};
