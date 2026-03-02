import { Router } from 'express';
import { auth } from '../../db/auth';
import { toNodeHandler } from 'better-auth/node';

const router = Router();

// Mount better-auth handler — catches all /api/auth/* requests
router.all('/*', toNodeHandler(auth.handler));

export const authRouter = router;
