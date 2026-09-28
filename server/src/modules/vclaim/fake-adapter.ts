/**
 * VClaim simulated adapter — deterministic stand-in for the BPJS web service.
 *
 * Used in development when BPJS env credentials are unset, and by tests to
 * exercise `sep-klaim.ts` without network access. There are NO random or
 * clock-derived values: the same input always produces the same SEP number,
 * and the tariff never comes from here (it is read from the visit's billing).
 *
 * Options let a caller force behaviour up front:
 *   `failWith`      — every call rejects, e.g. a DB string to simulate an outage;
 *   `pesertaAktif`  — false makes every card NONAKTIF (rejection path).
 */
import { setTimeout as delay } from 'node:timers/promises';
import { nanoid } from 'nanoid';
import { DomainError } from '../../utils/domain-error';
import type { BridgingStatus, CallOutcome, PesertaKartu, SepInserted, SepInsertPayload, VClaimPort } from './port';

export interface FakeVClaimOptions {
    /** Message to reject every call with. Defaults to a generic outage message. */
    failWith?: string;
    /** When false every `cekPeserta` reports the card NONAKTIF. Defaults to true. */
    pesertaAktif?: boolean;
    /** Nama used in `cekPeserta` results; defaults to 'Peserta Simulasi'. */
    namaPeserta?: string;
    /** Simulated latency in ms (0 by default so tests stay fast). */
    latencyMs?: number;
    /** Base URL reported by `status()`; defaults to the standard BPJS host. */
    baseUrl?: string;
}

/**
 * SEP number for one issuance. The date and the visit make it readable, the
 * random suffix makes it unique — an in-memory counter would repeat numbers
 * after a restart and trip the `sep_records.no_sep` unique constraint.
 */
export function fakeSepNo(payload: SepInsertPayload): string {
    const date = payload.tglSep.replace(/-/g, '');
    return `SIM-${date}-${nanoid(10)}`.slice(0, 50);
}

export class FakeVClaimAdapter implements VClaimPort {
    readonly sumber = 'simulasi' as const;
    private lastCall: CallOutcome | null = null;
    private readonly opts: Required<Pick<FakeVClaimOptions, 'pesertaAktif' | 'namaPeserta' | 'latencyMs' | 'baseUrl'>> &
        Pick<FakeVClaimOptions, 'failWith'>;

    constructor(opts: FakeVClaimOptions = {}) {
        this.opts = {
            failWith: opts.failWith,
            pesertaAktif: opts.pesertaAktif ?? true,
            namaPeserta: opts.namaPeserta ?? 'Peserta Simulasi',
            latencyMs: opts.latencyMs ?? 0,
            baseUrl: opts.baseUrl ?? 'https://apijkn.bpjs-kesehatan.go.id/vclaim-rest',
        };
    }

    private async simulate<T>(result: T): Promise<T> {
        const startedAt = Date.now();
        if (this.opts.latencyMs > 0) await delay(this.opts.latencyMs);
        if (this.opts.failWith) {
            this.lastCall = { at: new Date().toISOString(), ok: false, latencyMs: Date.now() - startedAt, error: this.opts.failWith };
            throw new DomainError(`BPJS VClaim (simulasi): ${this.opts.failWith}`, 502);
        }
        this.lastCall = { at: new Date().toISOString(), ok: true, latencyMs: Date.now() - startedAt };
        return result;
    }

    async cekPeserta(noKartu: string, _tgl: string): Promise<PesertaKartu> {
        return this.simulate({
            noKartu,
            nama: this.opts.namaPeserta,
            status: this.opts.pesertaAktif ? 'AKTIF' : 'NONAKTIF',
            jenisPeserta: 'PBPU',
            kelas: 'Kelas 3',
        });
    }

    async insertSep(payload: SepInsertPayload): Promise<SepInserted> {
        return this.simulate({ noSep: fakeSepNo(payload), tglSep: payload.tglSep });
    }

    async batalSep(_noSep: string): Promise<void> {
        await this.simulate(undefined);
    }

    async status(): Promise<BridgingStatus> {
        return {
            mode: 'simulasi',
            configPresent: { consId: false, secretKey: false, userKey: false, baseUrl: this.opts.baseUrl },
            lastCall: this.lastCall,
        };
    }
}
