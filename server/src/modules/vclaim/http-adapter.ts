/**
 * VClaim over HTTP — the signed BPJS client (HMAC-SHA256 signature, encrypted
 * response, retry on timeouts/5xx). One instance per configuration; the
 * last-call tracker belongs to the instance, never a module global, so tests
 * and multiple configurations cannot observe each other.
 */
import axios, { AxiosError, AxiosInstance, type AxiosRequestConfig } from 'axios';
import { setTimeout as delay } from 'node:timers/promises';
import { generateBpjsSignature, decryptBpjsResponse } from '../../utils/crypto';
import { DomainError } from '../../utils/domain-error';
import type { BridgingStatus, CallOutcome, ConfigPresence, PesertaKartu, SepInserted, SepInsertPayload, VClaimPort } from './port';

export interface BpjsConfig {
    consId: string;
    secretKey: string;
    userKey: string;
    /** VClaim root URL, e.g. https://apijkn.bpjs-kesehatan.go.id/vclaim-rest */
    baseUrl: string;
}

export const BPJS_BASE_URL_DEFAULT = 'https://apijkn.bpjs-kesehatan.go.id';

/** True when all three credentials are present (the base URL has a default). */
export const hasBpjsCredentials = (cfg: Omit<BpjsConfig, 'baseUrl'> & { baseUrl?: string }): boolean =>
    Boolean(cfg.consId && cfg.secretKey && cfg.userKey);

export function bpjsConfigFromEnv(env: NodeJS.ProcessEnv = process.env): BpjsConfig {
    const baseUrl = (env.BPJS_BASE_URL || BPJS_BASE_URL_DEFAULT).replace(/\/+$/, '');
    return {
        consId: env.BPJS_CONS_ID || '',
        secretKey: env.BPJS_SECRET_KEY || '',
        userKey: env.BPJS_USER_KEY || '',
        baseUrl: `${baseUrl}/vclaim-rest`,
    };
}

/** Which env credentials are present (booleans only — never expose the values). */
export const configPresence = (cfg: BpjsConfig): ConfigPresence => ({
    consId: Boolean(cfg.consId),
    secretKey: Boolean(cfg.secretKey),
    userKey: Boolean(cfg.userKey),
    baseUrl: cfg.baseUrl,
});

interface BpjsEnvelope {
    metaData?: { code?: string | number; message?: string };
    response?: string | object | null;
}

export class HttpVClaimAdapter implements VClaimPort {
    readonly sumber = 'bpjs' as const;
    private readonly client: AxiosInstance;
    /** Outcome of the most recent call made through THIS instance. */
    private lastCall: CallOutcome | null = null;

    constructor(private readonly cfg: BpjsConfig, private readonly retries = 2) {
        this.client = axios.create({ baseURL: cfg.baseUrl, timeout: 15000 });
    }

    /**
     * Signature + timestamp are regenerated on every attempt: BPJS rejects a
     * stale signature, and the timestamp that signed the request is also the
     * one needed to decrypt the response.
     */
    private async rawRequest(config: AxiosRequestConfig): Promise<{ body: BpjsEnvelope; timestamp: string }> {
        let lastError: unknown = null;

        for (let attempt = 0; attempt <= this.retries; attempt++) {
            const { signature, timestamp } = generateBpjsSignature(this.cfg.consId, this.cfg.secretKey);
            const startedAt = Date.now();
            try {
                const response = await this.client.request<BpjsEnvelope>({
                    ...config,
                    headers: {
                        'X-cons-id': this.cfg.consId,
                        'X-timestamp': timestamp,
                        'X-signature': signature,
                        'user_key': this.cfg.userKey,
                        ...config.headers,
                    },
                });
                this.track(true, startedAt);
                return { body: response.data, timestamp };
            } catch (error) {
                lastError = error;
                const axiosErr = error as AxiosError;
                const message = axiosErr.response
                    ? (axiosErr.response.data as BpjsEnvelope | undefined)?.metaData?.message ||
                      `BPJS API HTTP error ${axiosErr.response.status}`
                    : axiosErr.message || 'BPJS API request failed';
                this.track(false, startedAt, message);

                const retryable = axiosErr.code === 'ECONNABORTED' ||
                    (axiosErr.response !== undefined && axiosErr.response.status >= 500);
                if (retryable && attempt < this.retries) {
                    await delay(1000);
                    continue;
                }
                break;
            }
        }

        const message = lastError instanceof Error ? lastError.message : 'BPJS API request failed';
        throw new DomainError(`BPJS VClaim: ${message}`, 502);
    }

    private track(ok: boolean, startedAt: number, error?: string): void {
        this.lastCall = { at: new Date().toISOString(), ok, latencyMs: Date.now() - startedAt, ...(error ? { error } : {}) };
    }

    /** Validate the metaData envelope and decrypt the payload; provider errors surface as 502. */
    private unwrap(body: BpjsEnvelope, timestamp: string): unknown {
        const code = body?.metaData?.code !== undefined ? String(body.metaData.code) : '';
        if (!body?.metaData || code !== '200') {
            throw new DomainError(`BPJS VClaim: ${body?.metaData?.message || `kode ${code || 'tidak dikenal'}`}`, 502);
        }
        if (typeof body.response !== 'string' || body.response === '') return null;

        const decrypted = decryptBpjsResponse(body.response, this.cfg.consId, this.cfg.secretKey, timestamp);
        if (decrypted === null || decrypted === undefined) {
            throw new DomainError('BPJS VClaim: respons terenkripsi tidak dapat dibaca', 502);
        }
        return decrypted;
    }

    async cekPeserta(noKartu: string, tgl: string): Promise<PesertaKartu> {
        const { body, timestamp } = await this.rawRequest({
            method: 'GET',
            url: `/Peserta/nokartu/${encodeURIComponent(noKartu)}/tglSEP/${encodeURIComponent(tgl)}`,
        });
        const decrypted = this.unwrap(body, timestamp) as { peserta?: Record<string, unknown> } | null;
        const peserta = decrypted?.peserta;
        if (!peserta) throw new DomainError('BPJS VClaim: data peserta tidak ditemukan', 502);

        const status = String((peserta.statusPeserta as { keterangan?: string } | undefined)?.keterangan ?? '').trim();
        return {
            noKartu: String(peserta.noKartu ?? noKartu),
            nama: String(peserta.nama ?? ''),
            status: status || 'TIDAK DIKETAHUI',
            jenisPeserta: (peserta.jenisPeserta as { keterangan?: string } | undefined)?.keterangan,
            kelas: (peserta.kelasTanggungan as { keterangan?: string } | undefined)?.keterangan,
            tglLahir: peserta.tglLahir ? String(peserta.tglLahir) : undefined,
        };
    }

    async insertSep(payload: SepInsertPayload): Promise<SepInserted> {
        const { body, timestamp } = await this.rawRequest({
            method: 'POST',
            url: '/SEP/1.1/insert',
            data: {
                request: {
                    t_sep: {
                        noKartu: payload.noKartu,
                        tglSep: payload.tglSep,
                        ppkRujukan: payload.ppkRujukan || undefined,
                        diagnosaAwal: payload.diagnosa,
                        catatan: `Kunjungan ${payload.visitId}`,
                    },
                },
            },
        });
        const decrypted = this.unwrap(body, timestamp) as { sep?: { noSep?: string; tglSep?: string } } | null;
        const noSep = decrypted?.sep?.noSep;
        if (!noSep) throw new DomainError('BPJS VClaim: respons insert SEP tidak memuat nomor SEP', 502);

        return { noSep, tglSep: decrypted?.sep?.tglSep || payload.tglSep };
    }

    async batalSep(noSep: string): Promise<void> {
        const { body, timestamp } = await this.rawRequest({
            method: 'DELETE',
            url: '/SEP/1.1/delete',
            data: { request: { t_sep: { noSep } } },
        });
        const decrypted = this.unwrap(body, timestamp) as { sep?: unknown } | null;
        if (!decrypted) throw new DomainError(`BPJS VClaim: SEP ${noSep} tidak dapat dibatalkan`, 502);
    }

    async status(): Promise<BridgingStatus> {
        return {
            mode: 'real',
            configPresent: configPresence(this.cfg),
            lastCall: this.lastCall,
        };
    }
}
