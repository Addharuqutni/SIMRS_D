import { isAxiosError } from 'axios';

/**
 * Turns any thrown value into one user-facing sentence, following the server's
 * `{ error, details?: [{ path, message }] }` envelope. Callers pass a fallback
 * describing the action ("Gagal menyimpan SOAP").
 */
export function errorMessage(err: unknown, fallback: string): string {
    if (isAxiosError(err)) {
        const status = err.response?.status;
        const body = err.response?.data as { error?: unknown; details?: { path?: string; message?: string }[] } | undefined;
        if (status === 403) return 'Anda tidak memiliki akses untuk tindakan ini';
        if (!err.response) return `${fallback}: server tidak dapat dihubungi`;
        const detail = body?.details?.[0];
        if (detail?.message) return `${fallback}: ${detail.path ? `${detail.path} — ` : ''}${detail.message}`;
        if (typeof body?.error === 'string') return `${fallback}: ${body.error}`;
        if (status && status >= 500) return `${fallback}: terjadi kesalahan server`;
    }
    return fallback;
}
