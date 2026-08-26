import { z } from 'zod';

export const resetPasswordSchema = z.object({
    body: z.object({
        password: z.string().min(8, 'Password minimal 8 karakter'),
    }),
});
