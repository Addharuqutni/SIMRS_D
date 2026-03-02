import { useQuery } from '@tanstack/react-query';
import { masterApi } from '../lib/api/master';

export const useMasterUsers = () => {
    return useQuery({
        queryKey: ['master-users'],
        queryFn: masterApi.getUsers
    });
};

export const useDoctors = () => {
    return useQuery({
        queryKey: ['doctors'],
        queryFn: masterApi.getDoctors
    });
};
