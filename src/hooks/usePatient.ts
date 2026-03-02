import { useQuery } from '@tanstack/react-query';
import { patientApi, type Patient, type VisitWithPatient } from '../lib/api/patient';

export function usePatients() {
    return useQuery<Patient[]>({
        queryKey: ['patients'],
        queryFn: patientApi.getPatients,
    });
}

export function useVisits() {
    return useQuery<VisitWithPatient[]>({
        queryKey: ['visits'],
        queryFn: patientApi.getVisits,
    });
}
