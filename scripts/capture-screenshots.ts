/**
 * Automated screenshot generator for the SIMRS README.
 *
 * Launches a headless Chrome browser, logs in as Superadmin, then visits
 * every major page and captures a full-page PNG. Screenshots are saved to
 * docs/screenshots/ so the README can reference them with relative paths.
 *
 * Run with: npx tsx scripts/capture-screenshots.ts
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:5173';
const OUT_DIR = join(process.cwd(), 'docs', 'screenshots');

mkdirSync(OUT_DIR, { recursive: true });

interface Shot {
    name: string;
    path: string;
    /** Optional: wait for a specific selector before capturing */
    waitForSelector?: string;
}

const shots: Shot[] = [
    { name: '01-login', path: '/login' },
    { name: '02-dashboard', path: '/dashboard', waitForSelector: 'h1, h2' },
    { name: '03-registrasi', path: '/registrasi', waitForSelector: 'table' },
    { name: '04-antrean', path: '/antrean', waitForSelector: 'h1' },
    { name: '05-rawat-jalan', path: '/rawat-jalan', waitForSelector: 'table' },
    { name: '06-igd', path: '/igd', waitForSelector: 'table' },
    { name: '07-rawat-inap', path: '/rawat-inap', waitForSelector: 'table' },
    { name: '08-rekam-medis', path: '/rekam-medis', waitForSelector: 'h1, input' },
    { name: '09-laboratorium', path: '/laboratorium', waitForSelector: 'h1' },
    { name: '10-radiologi', path: '/radiologi', waitForSelector: 'h1' },
    { name: '11-farmasi-resep', path: '/farmasi/resep', waitForSelector: 'h1' },
    { name: '12-farmasi-stok', path: '/farmasi/stok', waitForSelector: 'table' },
    { name: '13-billing', path: '/billing', waitForSelector: 'table' },
    { name: '14-klaim-bpjs', path: '/klaim-bpjs', waitForSelector: 'h1' },
    { name: '15-laporan-keuangan', path: '/laporan-keuangan', waitForSelector: 'h1' },
    { name: '16-jadwal-dokter', path: '/jadwal-dokter', waitForSelector: 'h1' },
    { name: '17-notifikasi', path: '/notifikasi', waitForSelector: 'h1' },
    { name: '18-manajemen-user', path: '/users', waitForSelector: 'table' },
    { name: '19-master-data', path: '/master-data', waitForSelector: 'h1' },
    { name: '20-konfigurasi', path: '/konfigurasi', waitForSelector: 'h1' },
    { name: '21-bridging-status', path: '/bridging-status', waitForSelector: 'h1' },
    { name: '22-audit-trail', path: '/audit-trail', waitForSelector: 'h1' },
    { name: '23-display-board', path: '/display', waitForSelector: 'h1, main' },
];

async function run() {
    console.log('📸 Launching Chrome (Playwright)...');
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        locale: 'id-ID',
    });
    const page = await context.newPage();

    // Step 1: Login
    console.log('🔐 Logging in as admin@simrs.com...');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('#username', 'admin@simrs.com');
    await page.fill('#password', 'admin123!');
    await page.click('button[type="submit"]');
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {
        console.log('  (login redirect timed out — trying to continue anyway)');
    });
    await page.waitForTimeout(1500);
    console.log('  ✅ Logged in');

    // Step 2: Capture each page
    let ok = 0;
    let fail = 0;
    for (const shot of shots) {
        const url = `${BASE}${shot.path}`;
        console.log(`📸 ${shot.name} → ${shot.path}`);
        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
            if (shot.waitForSelector) {
                await page.waitForSelector(shot.waitForSelector, { timeout: 8000 }).catch(() => {});
            }
            await page.waitForTimeout(1200); // let charts/animations settle
            const outPath = join(OUT_DIR, `${shot.name}.png`);
            await page.screenshot({ path: outPath, fullPage: true });
            ok++;
        } catch (err) {
            console.log(`  ⚠️  Failed: ${(err as Error).message.slice(0, 80)}`);
            fail++;
        }
    }

    console.log(`\n✅ Captured ${ok} pages, ${fail} failed.`);
    await browser.close();
}

run().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
