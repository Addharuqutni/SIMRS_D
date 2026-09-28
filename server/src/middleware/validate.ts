import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

// Parse failures are forwarded to errorHandler, which maps ZodError to a 400
// with per-issue details. On success the parsed body replaces `req.body`, so
// coercions/defaults apply and unknown keys are stripped (schemas must list
// every field the handler reads).
export const validate = (schema: ZodSchema) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        try {
            const parsed = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            }) as { body?: unknown };
            if (parsed && typeof parsed === 'object' && 'body' in parsed && parsed.body !== undefined) {
                req.body = parsed.body;
            }
            next();
        } catch (error) {
            next(error);
        }
    };
};
