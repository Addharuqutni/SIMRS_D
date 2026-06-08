import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export class AppError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
    }
}

export const notFoundHandler = (req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
};

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
        return res.status(400).json({
            error: 'Validation failed',
            details: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        });
    }

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message });
    }

    logger.error({
        message: 'Unhandled request error',
        method: req.method,
        url: req.originalUrl,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
    });

    return res.status(500).json({ error: 'Internal Server Error' });
};

export const asyncHandler = <T extends Request>(handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>) => {
    return (req: T, res: Response, next: NextFunction) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
};
