import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { generateBpjsSignature, decryptBpjsResponse } from '../../utils/crypto';

// Env-driven BPJS VClaim configuration.
// If any of the credentials is missing the service falls back to mock mode,
// so local development keeps working without real BPJS credentials.
const CONS_ID = process.env.BPJS_CONS_ID || '';
const SECRET_KEY = process.env.BPJS_SECRET_KEY || '';
const USER_KEY = process.env.BPJS_USER_KEY || '';
const BASE_URL = (process.env.BPJS_BASE_URL || 'https://apijkn.bpjs-kesehatan.go.id').replace(/\/+$/, '');

const VCLAIM_BASE = `${BASE_URL}/vclaim-rest`;

export const isBpjsConfigured = (): boolean => Boolean(CONS_ID && SECRET_KEY && USER_KEY);

export const BPJS_BASE_URL_DEFAULT = 'https://apijkn.bpjs-kesehatan.go.id';

/** Which env credentials are present (booleans only — never expose the values). */
export const getBpjsConfigStatus = (): { consId: boolean; secretKey: boolean; userKey: boolean; baseUrl: string } => ({
    consId: Boolean(CONS_ID),
    secretKey: Boolean(SECRET_KEY),
    userKey: Boolean(USER_KEY),
    baseUrl: BASE_URL,
});

/** Outcome of the most recent REAL BPJS HTTP call (mock-mode calls are not tracked). */
export interface BpjsLastCall {
    at: string;
    ok: boolean;
    latencyMs: number;
    error?: string;
}

let lastCall: BpjsLastCall | null = null;

export const getBpjsLastCall = (): BpjsLastCall | null => lastCall;

/** Error thrown when the real BPJS API rejects a request or responds abnormally. */
export class BpjsApiError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BpjsApiError';
    }
}

interface BpjsEnvelope {
    metaData?: { code?: string | number; message?: string };
    response?: string | object | null;
}

interface SepInsertResult {
    metaData: { code: string; message: string };
    response: { sep: { noSep: string; tglSep: string } };
}

class BpjsService {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: VCLAIM_BASE,
            timeout: 15000,
        });
    }

    /**
     * Execute a request against the real BPJS API.
     * Signature + timestamp are regenerated on every attempt because the
     * timestamp used to sign the request is also needed to decrypt the response.
     */
    private async rawRequest(config: AxiosRequestConfig, retries = 2): Promise<{ body: BpjsEnvelope; timestamp: string }> {
        let lastError: unknown = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
            // Regenerate per request: BPJS rejects stale signatures.
            const { signature, timestamp } = generateBpjsSignature(CONS_ID, SECRET_KEY);

            const startedAt = Date.now();
            try {
                const response = await this.client.request<BpjsEnvelope>({
                    ...config,
                    headers: {
                        'X-cons-id': CONS_ID,
                        'X-timestamp': timestamp,
                        'X-signature': signature,
                        'user_key': USER_KEY,
                        ...config.headers,
                    },
                });
                lastCall = { at: new Date().toISOString(), ok: true, latencyMs: Date.now() - startedAt };
                return { body: response.data, timestamp };
            } catch (error) {
                lastError = error;
                const axiosErr = error as AxiosError;
                const message = axiosErr.response
                    ? (axiosErr.response.data as BpjsEnvelope | undefined)?.metaData?.message ||
                      `BPJS API HTTP error ${axiosErr.response.status}`
                    : axiosErr.message || 'BPJS API request failed';
                lastCall = { at: new Date().toISOString(), ok: false, latencyMs: Date.now() - startedAt, error: message };
                const retryable = axiosErr.code === 'ECONNABORTED' ||
                    (axiosErr.response && axiosErr.response.status >= 500);
                if (retryable && attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                throw new BpjsApiError(message);
            }
        }

        throw lastError instanceof Error ? new BpjsApiError(lastError.message) : new BpjsApiError('BPJS API request failed');
    }

    /** Validate the metaData envelope and decrypt the encrypted `response` payload. */
    private unwrap(body: BpjsEnvelope, timestamp: string): unknown {
        const code = body?.metaData?.code !== undefined ? String(body.metaData.code) : '';
        if (!body?.metaData || code !== '200') {
            throw new BpjsApiError(body?.metaData?.message || `BPJS API error (code ${code || 'unknown'})`);
        }

        if (typeof body.response !== 'string' || body.response === '') {
            return null;
        }

        const decrypted = decryptBpjsResponse(body.response, CONS_ID, SECRET_KEY, timestamp);
        if (!decrypted) {
            throw new BpjsApiError('Failed to decrypt BPJS response.');
        }
        return decrypted;
    }

    async validateCard(noKartu: string, date: string) {
        if (!isBpjsConfigured()) {
            // Mock mode (dev) — keep exact previous behavior.
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

        const { body, timestamp } = await this.rawRequest({
            method: 'GET',
            url: `/Peserta/nokartu/${noKartu}/tglSEP/${date}`,
        });
        const decrypted = this.unwrap(body, timestamp) as { peserta?: object } | null;

        return {
            metaData: { code: '200', message: 'OK' },
            response: { peserta: decrypted?.peserta ?? null },
        };
    }

    async insertSEP(payload: { request?: { tglSep?: string } }): Promise<SepInsertResult> {
        if (!isBpjsConfigured()) {
            // Mock mode (dev) — keep exact previous behavior.
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

        const { body, timestamp } = await this.rawRequest({
            method: 'POST',
            url: '/SEP/1.1/insert',
            data: payload,
        });
        const decrypted = this.unwrap(body, timestamp) as { sep?: { noSep?: string } } | null;

        const noSep = decrypted?.sep?.noSep;
        if (!noSep) {
            throw new BpjsApiError('BPJS SEP insert response did not contain a SEP number.');
        }

        return {
            metaData: { code: '200', message: 'OK' },
            response: {
                sep: {
                    noSep,
                    tglSep: payload.request?.tglSep || new Date().toISOString().split('T')[0],
                },
            },
        };
    }
}

export const bpjsService = new BpjsService();
