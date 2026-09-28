import { z } from 'zod';
import { ALL_ROLES, isRole } from '../../../../shared/access';

const roleSchema = z.string().refine(isRole, {
    message: `Role tidak dikenal — pilih salah satu dari: ${ALL_ROLES.join(', ')}`,
});

export const userStatusSchema = z.enum(['aktif', 'nonaktif'], {
    message: 'Status harus "aktif" atau "nonaktif"',
});

export const createUserSchema = z.object({
    body: z.object({
        nama: z.string().trim().min(1, 'Nama wajib diisi').max(200),
        email: z.string().trim().toLowerCase().email('Email tidak valid'),
        role: roleSchema,
        unit: z.string().trim().max(100).optional(),
        status: userStatusSchema.optional(),
    }),
});

export const updateUserSchema = z.object({
    body: z.object({
        nama: z.string().trim().min(1, 'Nama wajib diisi').max(200).optional(),
        email: z.string().trim().toLowerCase().email('Email tidak valid').optional(),
        role: roleSchema.optional(),
        unit: z.string().trim().max(100).optional(),
        status: userStatusSchema.optional(),
    }),
    params: z.object({ id: z.string().min(1) }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>['body'];
export type UpdateUserInput = z.infer<typeof updateUserSchema>['body'];

export const resetPasswordSchema = z.object({
    body: z.object({
        password: z.string().min(8, 'Password minimal 8 karakter'),
    }),
});
