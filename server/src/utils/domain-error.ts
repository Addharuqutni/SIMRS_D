/**
 * Errors a domain module throws when a caller breaks one of its rules.
 * `errorHandler` maps `status` onto the HTTP response, so route adapters
 * never translate these by hand.
 */
export class DomainError extends Error {
    constructor(
        message: string,
        readonly status: 400 | 403 | 404 | 409 | 422 | 502 | 503 = 422,
    ) {
        super(message);
        this.name = 'DomainError';
    }
}

export const notFound = (what: string) => new DomainError(`${what} tidak ditemukan`, 404);
