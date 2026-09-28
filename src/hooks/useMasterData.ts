import { useQuery } from '@tanstack/react-query';
import { useMutate } from '../lib/query';
import { masterApi } from '../lib/api/master';

/** Active doctors for pickers (registrasi, IGD, rawat inap, jadwal, penunjang). */
export const useDoctors = () =>
    useQuery({
        queryKey: ['doctors'],
        queryFn: () => masterApi.getDoctors(),
    });

export const useResetPassword = () =>
    useMutate(
        (vars: { id: string; password: string }) => masterApi.resetUserPassword(vars.id, vars.password),
        'master-users'
    );
