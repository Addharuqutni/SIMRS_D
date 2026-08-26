import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { auditLogs } from '../db/schemas/audit';
import { logger } from '../utils/logger';

const AUDITED_METHODS = ['POST', 'PUT', 'DELETE'];
const SENSITIVE_KEY = /password|secret|token/i;
const REDACTED = '[REDACTED]';
const MAX_BODY_CHARS = 2000;

// Recursively strip password-ish keys so credentials never land in the audit trail
const stripSensitive = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stripSensitive);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, val]) => [
                key,
                SENSITIVE_KEY.test(key) ? REDACTED : stripSensitive(val),
            ])
        );
    }
    return value;
};

const getClientIp = (req: Request): string => {
    const forwarded = req.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
    return first || req.ip || '-';
};

/**
 * App-wide audit trail for mutating requests (POST/PUT/DELETE).
 * Fire-and-forget: insert errors are logged, never propagated to the response.
 *
 * Mount AFTER express.json() so req.body is parsed, e.g. app.use(auditLog).
 * The insert is deferred to the response 'finish' event so requireAuth (which
 * runs per-route, later) has populated req.user by then.
 */
export const auditLog = (req: Request, res: Response, next: NextFunction) => {
    if (!AUDITED_METHODS.includes(req.method) || req.path.startsWith('/api/auth')) {
        return next();
    }

    res.on('finish', () => {
        const body = req.body !== undefined
            ? JSON.stringify(stripSensitive(req.body)).slice(0, MAX_BODY_CHARS)
            : null;

        db.insert(auditLogs).values({
            userId: (req.user?.id ?? '-').slice(0, 64),
            userName: (req.user?.name ?? '-').slice(0, 200),
            method: req.method,
            path: req.originalUrl || req.url,
            body,
            ip: getClientIp(req).slice(0, 64),
        }).catch((err: unknown) => {
            logger.error({
                message: 'Failed to write audit log',
                method: req.method,
                path: req.path,
                error: err instanceof Error ? err.message : String(err),
            });
        });
    });

    next();
};
