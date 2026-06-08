import { Request, Response, NextFunction } from 'express';
import { auth } from '../db/auth';
import { hasAnyRoleLike } from '../utils/roles';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const session = await auth.api.getSession({
            headers: req.headers as unknown as HeadersInit
        });

        if (!session) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if ((session.user as { status?: string }).status?.toLowerCase() === 'nonaktif') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        req.user = session.user;
        next();
    } catch (_err) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
};

export const requireRole = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const role = req.user?.role;

        if (!role || !hasAnyRoleLike(role, roles)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        next();
    };
};
