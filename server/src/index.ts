import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { initSocket } from './socket';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './db/auth';
import { patientRouter } from './modules/patient';
import { clinicalRouter } from './modules/clinical';
import { servicesRouter } from './modules/services';
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
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/error';

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

// CORS — allow frontend origin with credentials (cookies)
const frontendUrls = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(url => url.trim()) : [];
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = [
    ...frontendUrls,
    'http://localhost:5173', 'http://localhost:5174',
    'http://localhost:5175', 'http://localhost:5176',
    'http://127.0.0.1:5173', 'http://127.0.0.1:5174',
];
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

// Initialize Socket.io with the same CORS list
initSocket(httpServer, allowedOrigins);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Domain API routes
app.use('/api/v1/patients', patientRouter);
app.use('/api/v1/clinical', clinicalRouter);
app.use('/api/v1/services', servicesRouter);
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

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', message: 'SIMRS Backend is running', timestamp: new Date() });
});

app.use(notFoundHandler);
app.use(errorHandler);

// Start server
httpServer.listen(port, () => {
    logger.info(`🚀 Server running on port ${port} with WebSockets enabled`);
});
