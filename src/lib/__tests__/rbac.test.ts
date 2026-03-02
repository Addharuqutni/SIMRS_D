import { describe, it, expect } from 'vitest';
import { canAccess, getDefaultRoute, getRoleDescription } from '../rbac';

describe('RBAC Authorization Rules', () => {

    describe('canAccess', () => {
        it('should allow Superadmin access to any route', () => {
            expect(canAccess('Superadmin', '/dashboard')).toBe(true);
            expect(canAccess('Superadmin', '/billing/setting/123')).toBe(true);
            expect(canAccess('Superadmin', '/farmasi/stok')).toBe(true);
            expect(canAccess('Superadmin', '/random-path')).toBe(true);
        });

        it('should allow all users access to public routes', () => {
            const roles = ['Pendaftaran', 'Kasir / Billing', 'Apoteker', 'Dokter Spesialis'];
            roles.forEach(role => {
                expect(canAccess(role, '/dashboard')).toBe(true);
                expect(canAccess(role, '/notifikasi')).toBe(true);
                expect(canAccess(role, '/notifikasi/detail/1')).toBe(true);
            });
        });

        it('should deny unauthorized access', () => {
            // Kasir should not access farmasi
            expect(canAccess('Kasir / Billing', '/farmasi/resep')).toBe(false);

            // Apoteker should not access billing
            expect(canAccess('Apoteker', '/billing')).toBe(false);

            // Pendaftaran should not access igd
            expect(canAccess('Pendaftaran', '/igd')).toBe(false);
        });

        it('should allow Apoteker access to only specific farmasi modules', () => {
            expect(canAccess('Apoteker', '/farmasi/resep')).toBe(true);
            expect(canAccess('Apoteker', '/farmasi/stok')).toBe(true);
            // Even though Apoteker has farmasi prefix allowed, they only define specific subroutes in rolePermissions
            // Apoteker permissions: ['/farmasi/resep', '/farmasi/stok', '/farmasi/alert']
            // Not a wildcard for all /farmasi
            expect(canAccess('Apoteker', '/farmasi/other')).toBe(false);
        });

        it('should allow Kasir access to Billing and BPJS Klaim', () => {
            expect(canAccess('Kasir / Billing', '/billing')).toBe(true);
            expect(canAccess('Kasir / Billing', '/klaim-bpjs')).toBe(true);
            expect(canAccess('Kasir / Billing', '/laporan-keuangan')).toBe(true);
            expect(canAccess('Kasir / Billing', '/billing/detail')).toBe(true); // Prefix matching test
        });
    });

    describe('getDefaultRoute', () => {
        it('should return correct default routes per role', () => {
            expect(getDefaultRoute('Superadmin')).toBe('/dashboard');
            expect(getDefaultRoute('Pendaftaran')).toBe('/registrasi');
            expect(getDefaultRoute('Kasir / Billing')).toBe('/billing');
            expect(getDefaultRoute('Apoteker')).toBe('/farmasi/resep');
            expect(getDefaultRoute('Unknown Role')).toBe('/dashboard');
        });
    });

    describe('getRoleDescription', () => {
        it('should fallback to default for unknown roles', () => {
            expect(getRoleDescription('Unknown Role')).toBe('Akses terbatas');
        });

        it('should return superadmin exact description', () => {
            expect(getRoleDescription('Superadmin')).toBe('Akses penuh ke seluruh modul sistem');
        });
    });
});
