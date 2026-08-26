import { useList } from '../lib/query';
import { patientApi } from '../lib/api/patient';

export const useVisits = () => useList('visits', patientApi.getVisits);
