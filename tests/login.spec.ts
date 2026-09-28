import { test, expect } from '@playwright/test';

/**
 * Smoke test — the frontend alone (see playwright.config.ts webServer) must
 * render the login screen. No backend is required: the form is static, and a
 * submit without a server surfaces the connection error instead of crashing.
 */
test.describe('Login', () => {
    test('renders the login form', async ({ page }) => {
        await page.goto('/login');

        await expect(page.getByRole('heading', { name: 'Selamat Datang' })).toBeVisible();
        await expect(page.getByLabel('Username')).toBeVisible();
        await expect(page.getByLabel('Password')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Masuk' })).toBeVisible();
    });

    test('validates that both fields are required', async ({ page }) => {
        await page.goto('/login');

        await page.getByRole('button', { name: 'Masuk' }).click();

        await expect(page.getByText('Username dan password harus diisi')).toBeVisible();
        await expect(page).toHaveURL(/\/login$/);
    });
});
