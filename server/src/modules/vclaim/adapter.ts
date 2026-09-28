/**
 * Adapter selection — the one place that decides whether SEP/ Klaim traffic
 * goes to the real BPJS web service or to the local simulation.
 *
 * Rules:
 *  - all three credentials present  → real HTTP adapter, in every environment;
 *  - credentials missing, production → NO fallback: every call throws 503, so
 *    a production deployment can never silently store simulated SEP numbers;
 *  - credentials missing, otherwise → deterministic fake adapter (dev/tests).
 */
import { DomainError } from '../../utils/domain-error';
import type { BridgingStatus, PesertaKartu, SepInserted, SepInsertPayload, VClaimPort } from './port';
import { BPJS_BASE_URL_DEFAULT, bpjsConfigFromEnv, hasBpjsCredentials, HttpVClaimAdapter } from './http-adapter';
import { FakeVClaimAdapter } from './fake-adapter';

/** Adapter used when production has no BPJS credentials: refuses every call. */
class UnconfiguredBpjsAdapter implements VClaimPort {
    readonly sumber = 'bpjs' as const;

    private refuse(): never {
        throw new DomainError(
            'Bridging BPJS belum dikonfigurasi di server produksi. Hubungi administrator untuk mengisi kredensial BPJS.',
            503,
        );
    }

    async cekPeserta(_noKartu: string, _tgl: string): Promise<PesertaKartu> {
        return this.refuse();
    }

    async insertSep(_payload: SepInsertPayload): Promise<SepInserted> {
        return this.refuse();
    }

    async batalSep(_noSep: string): Promise<void> {
        return this.refuse();
    }

    async status(): Promise<BridgingStatus> {
        return {
            mode: 'nonaktif',
            configPresent: { consId: false, secretKey: false, userKey: false, baseUrl: BPJS_BASE_URL_DEFAULT },
            lastCall: null,
        };
    }
}

/** Picks the adapter for `env` (defaults to the process environment). */
export function pickVClaimPort(env: NodeJS.ProcessEnv = process.env): VClaimPort {
    const cfg = bpjsConfigFromEnv(env);
    if (hasBpjsCredentials(cfg)) return new HttpVClaimAdapter(cfg);
    if (env.NODE_ENV === 'production') return new UnconfiguredBpjsAdapter();
    return new FakeVClaimAdapter({ baseUrl: cfg.baseUrl });
}

/** Process-wide adapter, resolved once from the environment. */
export const vclaimPort: VClaimPort = pickVClaimPort();
