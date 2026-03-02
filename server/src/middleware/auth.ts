import { Request, Response, NextFunction } from 'express';
import { auth } from '../db/auth';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const session = await auth.api.getSession({
            headers: req.headers as unknown as HeadersInit
        });

        if (!session) {
            return res.status(401).json({ error: 'Unauthorized: No active session' });
        }

        // Attach session to request for downstream usage
        // @ts-ignore
        req.user = session.user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};
