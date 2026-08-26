import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './db/auth';
import { patientRouter } from './modules/patient';
import { clinicalRouter } from './modules/clinical';
import { billingRouter } from './modules/billing';
import { vclaimRouter } from './modules/vclaim';
import { masterRouter } from './modules/master';
import { inventoryRouter } from './modules/inventory';
import { scheduleRouter } from './modules/schedule';
import { notifyRouter } from './modules/notify';
import { reportsRouter } from './modules/reports';
import { igdRouter } from './modules/igd';
import { laboratoryRouter } from './modules/laboratory';
import { radiologyRouter } from './modules/radiology';
import { pharmacyRouter } from './modules/pharmacy';
import { settingsRouter } from './modules/settings';
import { auditRouter } from './modules/audit';
import { logger } from './utils/logger';
import { frontendUrls, devOrigins } from './utils/origins';
import { errorHandler, notFoundHandler } from './middleware/error';
import { auditLog } from './middleware/audit';
import { initWebSocket } from './utils/websocket';

const app = express();
const port = process.env.PORT || 3000;
const httpServer = createServer(app);

// Security: Set Secure HTTP Headers
app.use(helmet());

// Performance: Gzip/Brotli compression for JSON/responses
app.use(compression());

// Security: Rate Limiting against Bruteforce/DDoS (100 req per 15 minutes per IP)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Terlalu banyak request dari IP ini, coba lagi dalam 15 menit.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Security: strict brute-force limiter for auth endpoints. Only FAILED attempts
// (status >= 400) consume the budget, so normal session polling (get-session)
// and successful logins never lock a user out.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Terlalu banyak percobaan login gagal. Coba lagi dalam 15 menit.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});
app.use('/api/auth', authLimiter);

// CORS — allow frontend origin with credentials (cookies)
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = [...frontendUrls, ...devOrigins];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            if (isProduction) {
                callback(new Error('Not allowed by CORS'));
            } else {
                callback(null, true);
            }
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Security: request size cap — JSON/urlencoded bodies limited to 1MB
// (file uploads bypass this via multer's own 5MB PDF check)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Uploaded files (lab/radiology PDF results)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Http Request Logger Middleware
app.use((req, res, next) => {
    logger.info({
        method: req.method,
        url: req.url,
        ip: req.ip,
    });
    next();
});

// Better Auth — mount directly so handler sees full path /api/auth/*
app.all('/api/auth/*', toNodeHandler(auth.handler));

// Audit trail for all mutating domain-API requests
app.use(auditLog);

// Domain API routes
app.use('/api/v1/patients', patientRouter);
app.use('/api/v1/clinical', clinicalRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/vclaim', vclaimRouter);
app.use('/api/v1/master', masterRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/schedules', scheduleRouter);
app.use('/api/v1/notifications', notifyRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/igd', igdRouter);
app.use('/api/v1/laboratory', laboratoryRouter);
app.use('/api/v1/radiology', radiologyRouter);
app.use('/api/v1/pharmacy', pharmacyRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/audit-logs', auditRouter);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', message: 'SIMRS Backend is running', timestamp: new Date() });
});

app.use(notFoundHandler);
app.use(errorHandler);

// Start server
httpServer.listen(port, () => {
    logger.info(`🚀 Server running on port ${port}`);
    // Initialize WebSocket server on the same HTTP server (path: /ws)
    initWebSocket(httpServer);
    logger.info('🔌 WebSocket server ready at /ws');
});
