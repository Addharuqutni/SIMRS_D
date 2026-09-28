import { Request, Response, NextFunction } from 'express';
import { auth } from '../db/auth';
import { can, type Capability } from '../../../shared/access';

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

/** Allows the request when the user's role holds any of `capabilities` (exact role match). */
export const requireRole = (...capabilities: Capability[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!can(req.user?.role, ...capabilities)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        next();
    };
};
