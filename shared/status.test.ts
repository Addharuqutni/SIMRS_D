import { describe, it, expect } from 'vitest';
import { LIFECYCLES } from './status';

describe('status lifecycles', () => {
    it('rejects moving a finished Kunjungan back to menunggu', () => {
        expect(LIFECYCLES.kunjungan.canTransition('selesai', 'menunggu')).toBe(false);
        expect(LIFECYCLES.kunjungan.canTransition('menunggu', 'pemeriksaan')).toBe(true);
    });

    it('allows the IGD path menunggu → tindakan → observasi → selesai', () => {
        const k = LIFECYCLES.kunjungan;
        expect(k.canTransition('menunggu', 'tindakan')).toBe(true);
        expect(k.canTransition('tindakan', 'observasi')).toBe(true);
        expect(k.canTransition('observasi', 'selesai')).toBe(true);
    });

    it('makes Resep dispensing one-way and non-repeatable', () => {
        expect(LIFECYCLES.resep.canTransition('proses', 'selesai')).toBe(true);
        expect(LIFECYCLES.resep.canTransition('selesai', 'selesai')).toBe(false);
        expect(LIFECYCLES.resep.canTransition('baru', 'selesai')).toBe(false);
    });

    it('treats unknown from-states as having no legal moves', () => {
        expect(LIFECYCLES.billing.canTransition('bogus', 'paid')).toBe(false);
    });

    it('renders unknown statuses as a neutral raw label instead of throwing', () => {
        expect(LIFECYCLES.kunjungan.badge('batal')).toEqual({ label: 'Batal', variant: 'neutral' });
        expect(LIFECYCLES.resep.badge('???')).toEqual({ label: '???', variant: 'neutral' });
    });

    it('allows a disputed Klaim to be resubmitted but not a paid one', () => {
        expect(LIFECYCLES.klaim.canTransition('dispute', 'pending')).toBe(true);
        expect(LIFECYCLES.klaim.canTransition('layak', 'pending')).toBe(false);
    });
});
