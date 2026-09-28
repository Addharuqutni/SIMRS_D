import { useQuery } from '@tanstack/react-query';
import { useMutate } from '../lib/query';
import { useListQuery } from '../lib/list-query';
import { patientApi } from '../lib/api/patient';

export const useVisitList = () => useListQuery('visits', patientApi.listVisits);
export const usePatientSearch = (q: string) =>
    useQuery({ queryKey: ['patients', q], queryFn: () => patientApi.searchPatients(q), enabled: q.trim().length >= 2 });
export const useRegister = () => useMutate(patientApi.register, 'visits', 'rawat-jalan', 'queues-display');
export const useCancelVisit = () => useMutate(patientApi.cancelVisit, 'visits', 'rawat-jalan', 'queues-display');
