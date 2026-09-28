import { LIFECYCLES, type LifecycleKind } from '../../../shared/status';
import { DomainError } from './domain-error';

/**
 * Rejects a status write that the lifecycle does not allow.
 * Unknown target → 400; illegal move (e.g. selesai → menunggu) → 409.
 */
export function assertTransition(kind: LifecycleKind, from: string, to: unknown): void {
    const lifecycle = LIFECYCLES[kind];
    if (!lifecycle.isState(to)) {
        throw new DomainError(`Status "${String(to)}" tidak dikenal`, 400);
    }
    if (!lifecycle.canTransition(from, to)) {
        throw new DomainError(`Tidak dapat mengubah status dari "${from}" ke "${to}"`, 409);
    }
}
