import type { User } from 'better-auth';

declare global {
    namespace Express {
        interface Request {
            user?: User & {
                role?: string;
                unit?: string | null;
                status?: string;
            };
        }
    }
}

export {};
