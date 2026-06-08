import axios, { AxiosInstance, AxiosError } from 'axios';

const BPJS_MODE = process.env.BPJS_MODE || 'mock';

if (!['mock', 'production'].includes(BPJS_MODE)) {
    throw new Error('Invalid BPJS_MODE. Use mock or production.');
}

if (BPJS_MODE === 'production' && (!process.env.BPJS_CONSID || !process.env.BPJS_SECRET || !process.env.BPJS_USER_KEY)) {
    throw new Error('BPJS production mode requires BPJS_CONSID, BPJS_SECRET, and BPJS_USER_KEY.');
}

const BPJS_CONFIG = {
    baseURL: process.env.BPJS_API_URL || 'https://vclaim.bpjs-kesehatan.go.id/vclaim-rest',
    mode: BPJS_MODE,
    consid: process.env.BPJS_CONSID || '',
    secretKey: process.env.BPJS_SECRET || '',
    userKey: process.env.BPJS_USER_KEY || '',
    timeout: 5000,
};

class BpjsService {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: BPJS_CONFIG.baseURL,
            timeout: BPJS_CONFIG.timeout,
            headers: {
                'X-cons-id': BPJS_CONFIG.consid,
                'X-timestamp': Math.floor(Date.now() / 1000).toString(),
                'X-signature': BPJS_CONFIG.mode === 'mock' ? 'MOCK_SIGNATURE' : '',
                'user_key': BPJS_CONFIG.userKey,
            }
        });

        this.client.interceptors.response.use(
            (response) => response,
            async (error: AxiosError) => {
                const config = error.config as (typeof error.config & { _retryCount?: number });
                if (!config) return Promise.reject(error);

                config._retryCount = config._retryCount || 0;

                if (config._retryCount < 2 && (error.code === 'ECONNABORTED' || (error.response && error.response.status >= 500))) {
                    config._retryCount += 1;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return this.client(config);
                }

                return Promise.reject(error);
            }
        );
    }

    async validateCard(noKartu: string, date: string) {
        if (BPJS_CONFIG.mode === 'production') {
            throw new Error('BPJS production validateCard is not implemented yet.');
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        return {
            metaData: { code: '200', message: 'OK' },
            response: {
                peserta: {
                    noKartu,
                    tglSep: date,
                    nama: 'Mock Pasien',
                    statusPeserta: { keterangan: 'AKTIF' }
                }
            }
        };
    }

    async insertSEP(payload: { request?: { tglSep?: string } }) {
        if (BPJS_CONFIG.mode === 'production') {
            throw new Error('BPJS production insertSEP is not implemented yet.');
        }

        await new Promise(resolve => setTimeout(resolve, 800));

        return {
            metaData: { code: '200', message: 'OK' },
            response: {
                sep: {
                    noSep: `SEP-${Date.now()}`,
                    tglSep: payload.request?.tglSep || new Date().toISOString().split('T')[0],
                }
            }
        };
    }
}

export const bpjsService = new BpjsService();
