import { describe, it, expect } from 'vitest';
import { ALL_ROLES, can, canAccessRoute, defaultRouteFor, describeRole } from './access';

describe('can (server capabilities)', () => {
    it('rejects roles that are substrings or supersets of a granted role', () => {
        for (const role of ['admin', 'super', 's', '', '  ', 'superadmin', 'Superadmin ', 'Superadmin2']) {
            expect(can(role, 'admin')).toBe(false);
        }
        expect(can(null, 'admin')).toBe(false);
        expect(can(undefined, 'clinical')).toBe(false);
    });

    it('grants Superadmin every capability', () => {
        expect(can('Superadmin', 'admin', 'billing')).toBe(true);
        expect(can('Superadmin', 'lab')).toBe(true);
    });

    it('grants Keuangan billing but not admin', () => {
        expect(can('Keuangan', 'billing')).toBe(true);
        expect(can('Keuangan', 'admin')).toBe(false);
    });

    it('lets Perawat act clinically but not prescribe', () => {
        expect(can('Perawat', 'clinical')).toBe(true);
        expect(can('Perawat', 'prescribe')).toBe(false);
        expect(can('Dokter Umum', 'prescribe')).toBe(true);
    });

    it('passes when any listed capability matches', () => {
        expect(can('Apoteker', 'admin', 'pharmacy')).toBe(true);
    });
});

describe('canAccessRoute (client routes)', () => {
    it('opens dashboard and notifikasi to every role, including unknown ones', () => {
        for (const role of [...ALL_ROLES, 'unknown', undefined]) {
            expect(canAccessRoute(role, '/dashboard')).toBe(true);
            expect(canAccessRoute(role, '/notifikasi/detail/1')).toBe(true);
        }
    });

    it('matches whole path segments, not string prefixes', () => {
        expect(canAccessRoute('Apoteker', '/farmasi/stok')).toBe(true);
        expect(canAccessRoute('Apoteker', '/farmasi/other')).toBe(false);
        expect(canAccessRoute('Kasir / Billing', '/billing/abc')).toBe(true);
        expect(canAccessRoute('Kasir / Billing', '/billingx')).toBe(false);
    });

    it('denies cross-area access', () => {
        expect(canAccessRoute('Kasir / Billing', '/farmasi/resep')).toBe(false);
        expect(canAccessRoute('Apoteker', '/billing')).toBe(false);
        expect(canAccessRoute('Pendaftaran', '/igd')).toBe(false);
    });

    it('routes Keuangan to finance pages (server grants billing)', () => {
        expect(canAccessRoute('Keuangan', '/laporan-keuangan')).toBe(true);
        expect(canAccessRoute('Keuangan', '/billing')).toBe(true);
    });

    it('lets every known role reach its own default route', () => {
        for (const role of ALL_ROLES) expect(canAccessRoute(role, defaultRouteFor(role))).toBe(true);
    });
});

describe('describeRole / defaultRouteFor fallbacks', () => {
    it('falls back for unknown roles', () => {
        expect(describeRole('Unknown')).toBe('Akses terbatas');
        expect(defaultRouteFor('Unknown')).toBe('/dashboard');
    });
});
