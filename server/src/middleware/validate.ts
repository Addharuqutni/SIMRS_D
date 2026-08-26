import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

// Parse failures are forwarded to errorHandler, which maps ZodError to a 400
// with per-issue details.
export const validate = (schema: ZodSchema) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        } catch (error) {
            next(error);
        }
    };
};
