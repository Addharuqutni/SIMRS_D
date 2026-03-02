import axios, { AxiosInstance, AxiosError } from 'axios';

// Mock Config for development (in real world these will come from env)
const BPJS_CONFIG = {
    baseURL: process.env.BPJS_API_URL || 'https://vclaim.bpjs-kesehatan.go.id/vclaim-rest',
    consid: process.env.BPJS_CONSID || '12345',
    secretKey: process.env.BPJS_SECRET || 'secret123',
    userKey: process.env.BPJS_USER_KEY || 'userkey123',
    timeout: 5000, // 5 seconds timeout requirement
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
                'X-signature': 'MOCK_SIGNATURE', // Normally uses crypto to sign
                'user_key': BPJS_CONFIG.userKey,
            }
        });

        // Add retry mechanism and logging via intercepts
        this.client.interceptors.response.use(
            (response) => {
                console.log(`[BPJS Service] Success ${response.config.url}`);
                return response;
            },
            async (error: AxiosError) => {
                const config: any = error.config;
                if (!config) return Promise.reject(error);

                config._retryCount = config._retryCount || 0;

                // Max 2 retries on network timeout or 500 errors
                if (config._retryCount < 2 && (error.code === 'ECONNABORTED' || (error.response && error.response.status >= 500))) {
                    config._retryCount += 1;
                    console.warn(`[BPJS Service] Retry ${config._retryCount} for ${config.url}`);

                    // Wait 1 second before retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return this.client(config);
                }

                console.error(`[BPJS Service] Failed ${config.url} after ${config._retryCount} retries`, error.message);
                return Promise.reject(error);
            }
        );
    }

    /**
     * MOCK FUNCTION: Validasi Nomor Kartu BPJS
     */
    async validateCard(noKartu: string, date: string) {
        try {
            // For true implementation:
            // const res = await this.client.get(`/Peserta/nokartu/${noKartu}/tglSEP/${date}`);
            // return res.data;

            // Mock implementation: Simulate network delay 500ms
            await new Promise(resolve => setTimeout(resolve, 500));

            return {
                metaData: { code: '200', message: 'OK' },
                response: {
                    peserta: {
                        noKartu,
                        nama: 'Mock Pasien',
                        statusPeserta: { keterangan: 'AKTIF' }
                    }
                }
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * MOCK FUNCTION: Create SEP BPJS
     */
    async insertSEP(payload: any) {
        try {
            // For true implementation:
            // const res = await this.client.post('/SEP/1.1/insert', payload);
            // return res.data;

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
        } catch (error) {
            throw error;
        }
    }
}

export const bpjsService = new BpjsService();
