# SIMRS - Sistem Informasi Manajemen Rumah Sakit 🏥

SIMRS adalah aplikasi manajemen operasional Rumah Sakit berskala *enterprise-ready*. Menggunakan teknologi modern *(Full-Stack TypeScript)* untuk memberikan antarmuka yang sangat responsif, pengolahan data *real-time*, dan rekam medis elektronik yang mengutamakan privasi serta kepatuhan standar medis.

Proyek ini menggunakan pendekatan **Frontend & Backend Decoupled** di dalam satu sub-struktur proyek, memudahkan pengembangan lincah namun siap untuk di-*deploy* secara terpisah (*microservices/containerization*).

---

## 📸 Screenshot Aplikasi

Berikut adalah tangkapan layar aplikasi SIMRS yang di-generate otomatis menggunakan Playwright dengan Chrome.

### 🔐 Autentikasi & Dashboard

| Login | Dashboard |
|:---:|:---:|
| ![Login](docs/screenshots/01-login.png) | ![Dashboard](docs/screenshots/02-dashboard.png) |

### 📋 Pendaftaran & Antrean

| Registrasi | Antrean | Jadwal Dokter |
|:---:|:---:|:---:|
| ![Registrasi](docs/screenshots/03-registrasi.png) | ![Antrean](docs/screenshots/04-antrean.png) | ![Jadwal Dokter](docs/screenshots/16-jadwal-dokter.png) |

### 🩺 Pelayanan Medis

| Rawat Jalan | IGD | Rawat Inap |
|:---:|:---:|:---:|
| ![Rawat Jalan](docs/screenshots/05-rawat-jalan.png) | ![IGD](docs/screenshots/06-igd.png) | ![Rawat Inap](docs/screenshots/07-rawat-inap.png) |

| Rekam Medis | Laboratorium | Radiologi |
|:---:|:---:|:---:|
| ![Rekam Medis](docs/screenshots/08-rekam-medis.png) | ![Laboratorium](docs/screenshots/09-laboratorium.png) | ![Radiologi](docs/screenshots/10-radiologi.png) |

### 💊 Farmasi & Penunjang

| Farmasi Resep | Farmasi Stok |
|:---:|:---:|
| ![Farmasi Resep](docs/screenshots/11-farmasi-resep.png) | ![Farmasi Stok](docs/screenshots/12-farmasi-stok.png) |

### 💰 Keuangan & Billing

| Billing | Klaim BPJS | Laporan Keuangan |
|:---:|:---:|:---:|
| ![Billing](docs/screenshots/13-billing.png) | ![Klaim BPJS](docs/screenshots/14-klaim-bpjs.png) | ![Laporan Keuangan](docs/screenshots/15-laporan-keuangan.png) |

### ⚙️ Pengaturan & Administrasi

| Notifikasi | Manajemen User | Master Data |
|:---:|:---:|:---:|
| ![Notifikasi](docs/screenshots/17-notifikasi.png) | ![Manajemen User](docs/screenshots/18-manajemen-user.png) | ![Master Data](docs/screenshots/19-master-data.png) |

| Konfigurasi | Bridging Status | Audit Trail |
|:---:|:---:|:---:|
| ![Konfigurasi](docs/screenshots/20-konfigurasi.png) | ![Bridging Status](docs/screenshots/21-bridging-status.png) | ![Audit Trail](docs/screenshots/22-audit-trail.png) |

### 🖥️ Display Board

| Papan Antrean Poliklinik |
|:---:|
| ![Display Board](docs/screenshots/23-display-board.png) |

> **Catatan:** Screenshot di-generate otomatis menggunakan Playwright. Untuk membuat ulang, jalankan:
> ```bash
> npx tsx scripts/capture-screenshots.ts
> ```
> Pastikan backend (port 3000) dan frontend (port 5173) sedang berjalan.

---

## 🚀 Teknologi Utama (Tech Stack)

### 🎨 Frontend (Client-side)
- **Framework:** React 19 + Vite (Cepat & Ringan)
- **Bahasa:** TypeScript (Strict Mode)
- **State Management:** TanStack Query v5 (React Query)
- **Routing:** React Router v7
- **Styling:** CSS Modules + Vanilla CSS (Bebas *bloatware*)
- **Charts:** Recharts (Dashboard analytics)
- **Fitur Tambahan:** WebSocket native (Real-Time UI), `react-to-print` (Print PDF/Kuitansi)

### ⚙️ Backend (Server-side)
- **Runtime & Framework:** Node.js + Express.js v4
- **Bahasa:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM (Type-Safe Database Interactor)
- **Keamanan:** Helmet, Express Rate Limiter, `better-auth` (Role-Based Access)
- **Observability & Logging:** Winston Logger
- **Real-time:** WebSocket native (library `ws`) untuk antrean & notifikasi
- **Kriptografi Standar Kemenkes/BPJS:** AES-256-CBC, HMAC-SHA256, LZ-String
- **Testing:** Vitest (unit/integration) + Playwright (smoke e2e)

### 🧪 Testing & Pemeriksaan Tipe

Tes backend berjalan di atas **PGlite** (PostgreSQL in-memory lewat WASM) — **tidak perlu PostgreSQL berjalan** untuk menjalankan tes. Skema dibangun langsung dari definisi Drizzle, jadi tes selalu mengikuti skema terkini.

```bash
# Backend: unit + integration (PGlite)
cd server
npm test            # vitest run
npm run typecheck   # tsc --noEmit

# Frontend: unit (Vitest + jsdom) dan lint
npm test            # vitest run (src/ + shared/)
npm run lint        # eslint src shared
npx tsc -p tsconfig.app.json --noEmit

# e2e smoke (Chromium, frontend saja — Vite dijalankan otomatis)
npx playwright test
```

---

## 🧩 Folder `shared/` (kontrak lintas tier)

`shared/` berisi TypeScript murni yang diimpor oleh **backend dan frontend** lewat jalur relatif, sehingga aturan domain tidak pernah diduplikasi:

| Berkas | Isi |
|---|---|
| `shared/access.ts` | Kebijakan akses: `ROLES`, capability server (`admin`, `billing`, `clinical`, `prescribe`, `pharmacy`, `registration`, `lab`), dan `canAccessRoute`/`defaultRouteFor` untuk guard rute frontend |
| `shared/status.ts` | `LIFECYCLES` — satu definisi transisi + label badge per status domain (`kunjungan`, `resep`, `admisi`, `order`, `billing`, `sep`, `klaim`). Dipakai server untuk validasi tulis (`assertTransition`) dan klien untuk badge/aksi (`LifecycleBadge`, `canTransition`) |
| `shared/tariff.ts` | Tarif layanan & kamar (default + parser). Nilainya dapat diubah operator di **Konfigurasi Sistem** |
| `shared/page.ts` | Kontrak daftar: `Page<T>` (`data`, `pagination`, `counts`) dan `PageQuery` |
| `shared/admission.ts` | Nilai `JAMINAN`, daftar poli + prefix antrean, tipe `AdmitInput` |

---

## 🏗️ Arsitektur: Modul Domain (Deep Modules)

Setiap aturan hidup di satu modul domain; route hanya memvalidasi input (Zod) lalu memanggil modul. Modul menerima `db: Db` sebagai parameter pertama, sehingga dapat diuji dengan PGlite.

| Modul | Antarmuka inti | Invarian utama |
|---|---|---|
| **Admission** (`server/src/modules/admission/admission.ts`) | `admit(db, {jenis, pasien/pasienBaru, dokterId, jaminan, …})`, `transitionKunjungan`, `transitionAdmisi` | Nomor RM dibuat server (`RM000001`), antrean per poli per hari, satu transaksi untuk pasien + kunjungan + triase/administrasi + tagihan pertama |
| **Dispensing** (`server/src/modules/pharmacy/dispensing.ts`) + **Stock** (`inventory/stock.ts`) | `createResep`, `startProses`, `dispense`, `consumeFefo`, `receiveBatch`, `removeBatch` | Resep hanya diserahkan sekali (stok FEFO + tagihan dalam satu transaksi); stok tidak pernah di-clamp |
| **Billing ledger** (`server/src/modules/billing/ledger.ts`) | `charge(tx, {visitId, kategori, namaItem, harga, jumlah?, sourceRef})`, `voidCharge(tx, sourceRef)`, `finalize`, `pay` | Satu billing per kunjungan, idempoten pada `sourceRef`, hanya billing `open` yang bisa ditagih, `finalized → paid` menulis tepat satu baris ledger |
| **SEP & Klaim** (`server/src/modules/vclaim/sep-klaim.ts`) | `issueSep(db, port, …)`, `batalSep`, `transitionKlaim`, `applyHasilVerifikasi`, `listSeps`, `listKlaims` | Hanya kunjungan `BPJS Kesehatan`, peserta wajib AKTIF sebelum menyimpan apa pun, satu SEP aktif per kunjungan, SEP + Klaim dalam satu transaksi, `tarifRs` = total billing kunjungan (tanpa angka acak) |
| **VClaim port** (`vclaim/port.ts` + `http-adapter.ts` / `fake-adapter.ts` / `adapter.ts`) | `VClaimPort` (`cekPeserta`, `insertSep`, `batalSep`, `status`) | Kredensial lengkap → HTTP bertanda tangan (HMAC + AES) dengan retry; tanpa kredensial di produksi → **setiap panggilan ditolak (503), tanpa fallback simulasi**; dev/tes → adapter simulasi deterministik (`sumber = 'simulasi'`, ditandai badge SIMULASI di UI) |
| **Penunjang orders** (`server/src/modules/penunjang/orders.ts`) | `createOrder(db, kind, …)`, `startOrder`, `completeOrder`, `attachResult`, `cancelOrder`, `listOrders` | `kind` = `lab` \| `radiologi`; kunjungan harus ada & belum selesai; pengirim harus berperan dokter; `ORDER:<id>` ditagihkan saat order dibuat, dibatalkan saat order dibatalkan; `waktuSelesai` di-set server |

**Aturan inti penagihan — *charge at service time*:** biaya dicatat pada saat layanan **benar-benar diberikan** (kunjungan didaftarkan, resep diserahkan, order penunjang dibuat, pasien admisi pulang), menggunakan tarif yang berlaku pada saat itu (snapshot harga di `billing_items`). `finalize()` hanya menjumlahkan apa yang tercatat — tidak pernah menilai ulang. Tarif diubah operator lewat halaman **Konfigurasi Sistem** (`tarifKamar`, `tarifLayanan`); perubahan tarif berlaku untuk transaksi berikutnya, bukan yang sudah tercatat.

---

## 🏥 Modul & Fitur Utama

### 📋 Pendaftaran & Registrasi
- Registrasi pasien baru (Rawat Jalan, IGD, Rawat Inap)
- SEP & VClaim (Bridging BPJS Kesehatan)
- Jadwal dokter & quota per poli
- Antrean dengan display board real-time (WebSocket)

### 🩺 Pelayanan Medis
- **EMR SOAP** — Rekam medis elektronik terstruktur (Subjektif/Objektif/Asesmen/Plan)
- **CPPT** — Catatan Perkembangan Pasien Terintegrasi (timeline longitudinal, akreditasi KARS)
- **ICD-10 & ICD-9-CM** — Pencarian kode diagnosa & tindakan
- **Rawat Jalan, IGD, Rawat Inap** — Alur pelayanan terintegrasi

### 🚨 Patient Safety (Fase 1)
- **Allergy Alert Banner** — Peringatan alergi pasien di setiap layanan klinis
- **Vital Signs Numeric** — Tanda vital tersruktur (numeric, bukan teks) dengan trending
- **MEWS Early Warning Score** — Skor otomatis (Modified Early Warning Score) untuk deteksi deteriorasi pasien. Auto-notifikasi ke dokter bila skor ≥ 3.
- **Triase IGD** dengan vital signs + MEWS otomatis

### 💊 Farmasi
- **e-Recipe Kemenkes** — Penandatanganan resep elektronik dengan QR code (HMAC-SHA256 signature)
- Manajemen stok obat (multi-batch, FEFO)
- Alert obat kadaluarsa & stok menipis
- **Multi-warehouse** — Stok per lokasi (Farmasi Pusat, Depot IGD, Depot OK) + transfer antar lokasi

### 🔬 Penunjang
- Laboratorium (order, hasil, PDF)
- Radiologi (order, hasil DICOM, expertise)

### 💰 Keuangan & Billing
- **Charge at service time** — biaya dicatat saat layanan diberikan (registrasi, resep diserahkan, order penunjang, pemulangan admisi) memakai tarif yang berlaku saat itu; satu tagihan per kunjungan, idempoten per sumber tindakan
- Finalisasi tagihan & pembayaran kasir (tunai/debit/transfer/QRIS/BPJS) — menulis tepat satu baris ledger (BPJS = piutang)
- Klaim BPJS (Ina-CBG)
- Laporan keuangan (pendapatan, piutang, biaya)
- Transaksi keuangan terpisah

### ⚙️ Administrasi & Compliance
- **Audit Trail** — Log setiap operasi mutating (POST/PUT/DELETE) dengan filter & export CSV
- Manajemen User (RBAC, 9 role termasuk Keuangan)
- Master Data — pencarian referensi ICD-10 (diagnosa) & ICD-9-CM (prosedur), read-only dari katalog hasil seed
- Konfigurasi sistem (profil RS, tarif kamar & tarif layanan)
- Backup database terjadwal (PowerShell scripts)

### 📊 Dashboard & Laporan
- Dashboard analytics (tren kunjungan 7 hari, statistik harian)
- Laporan kunjungan RL (Soft-delete aware)
- Export CSV

---

## 🔬 Fitur Advanced (Enterprise-grade)

### 📡 Real-time WebSocket
Antrean poli dan display board memperbarui secara instan via WebSocket (native `ws` library, tanpa Socket.io). Polling 5 detik **hanya aktif saat koneksi WebSocket terputus** (dan berhenti lagi begitu tersambung), jadi tidak ada beban polling saat koneksi sehat.

### 🏥 FHIR R4 Export
Setiap kunjungan dapat diekspor sebagai **HL7 FHIR R4 Bundle** (Patient, Encounter, Composition, Observation, MedicationRequest) — siap untuk integrasi SATUSEHAT.

### 🧠 CDSS — Clinical Decision Support System
- **ICD-10 Auto-Suggest** — Saran kode diagnosa otomatis dari teks SOAP (keyword-based NLP, 25+ kode ICD-10 umum)
- **Drug-Drug Interaction (DDI) Alert** — Peringatan interaksi obat (7+ rule pairs, severity: contraindicated/major/moderate/minor)

### 🔒 Keamanan
- **RBAC** — 9 role (Superadmin, Dokter Spesialis, Dokter Umum, Perawat, Apoteker, Pendaftaran, Kasir/Billing, Keuangan, Analis Lab) — kebijakan lengkap di `shared/access.ts`
- **Rate Limiting** — 100 req/15min per IP (API), 20 failed login/15min (auth)
- **Helmet** — Secure HTTP headers
- **Audit Log** — Fire-and-forget, redaksi password/secret, body truncated

---

## 📂 Struktur Proyek

Proyek ini dibelah menjadi dua direktori utama akar:

```text
simrs/
├── public/                 # Aset statis terbuka Frontend (Logo, Fonts)
├── docs/
│   └── screenshots/        # Screenshot aplikasi (Playwright)
├── scripts/
│   └── capture-screenshots.ts  # Generator screenshot otomatis
├── server/                 # 🔴 BACKEND DOMAIN
│   ├── src/
│   │   ├── db/             # Koneksi PostgreSQL & Skema Drizzle ORM
│   │   │   ├── schemas/    # Skema tabel (patient, clinical, billing, inventory, dll)
│   │   │   ├── seed.ts     # Data awal — baris klinis dibuat lewat modul domain
│   │   │   ├── testing.ts  # PGlite in-memory untuk tes (tanpa PostgreSQL)
│   │   │   └── wipe.ts     # Truncate semua tabel (dev)
│   │   ├── middleware/     # Auth (RBAC), Audit, Error handler, Validator
│   │   ├── modules/        # Modul domain + router (admission, pharmacy, billing,
│   │   │                   #   penunjang, vclaim, clinical, laboratorium, radiologi, dst)
│   │   └── utils/          # Logger, WebSocket, Crypto BPJS, MEWS, FHIR, e-Recipe, CDSS
│   ├── package.json        # Dependencies Backend (npm test / npm run typecheck)
│   └── drizzle.config.ts   # Konfigurasi `drizzle-kit push`
│
├── shared/                 # 🟢 KONTRAK LINTAS TIER (access, status, tariff, page)
│
├── src/                    # 🔵 FRONTEND DOMAIN
│   ├── components/         # Komponen UI Reusable (Modal, Button, Table, QRCode, Printable)
│   │   └── ui/             # Design system (StatCard, StatusBadge, SearchBar, Pagination)
│   ├── hooks/              # Custom Hooks React Query (13 domain hooks + WebSocket)
│   ├── lib/                # API Client config (Axios), list-query, error helper, format
│   │   └── api/            # 14 API client modules (billing, clinical, igd, penunjang, bpjs, dll)
│   ├── pages/              # Antarmuka per Layanan (15 modul)
│   │   ├── billing/        # Billing, Klaim BPJS, Laporan Keuangan
│   │   ├── dashboard/      # Dashboard analytics
│   │   ├── display/        # Papan Antrean Poliklinik (fullscreen kiosk)
│   │   ├── farmasi/        # Resep, Stok, Alert Expired
│   │   ├── igd/            # IGD + Triase + MEWS
│   │   ├── pelayanan-medis/# List Dokter
│   │   ├── pengaturan/     # Manajemen User, Master Data, Konfigurasi, Audit Trail
│   │   ├── penunjang/      # Laboratorium, Radiologi
│   │   ├── rawat-inap/     # Rawat Inap
│   │   ├── rawat-jalan/    # Rawat Jalan + EMR + CPPT + CDSS
│   │   ├── rekam-medis/    # Rekam Medis
│   │   └── registrasi/     # Registrasi, SEP, Jadwal, Antrean
│   ├── App.tsx             # Routing utama (lazy-loaded)
│   └── main.tsx            # Entry point React
│
├── tests/                  # Test suite (Playwright)
├── playwright.config.ts   # Konfigurasi Playwright
├── vitest.config.ts        # Konfigurasi Vitest
├── eslint.config.js        # ESLint (typescript-eslint + react-hooks)
└── package.json            # Dependencies Frontend
```

---

## 🔑 Akun Demo (Seed Data)

Setelah menjalankan `npm run db:seed` di folder `server/`, akun berikut tersedia untuk pengujian:

| Role | Email | Password |
|------|-------|----------|
| Superadmin | `admin@simrs.com` | `admin123!` |
| Dokter Spesialis | `dokter@simrs.com` | `dokter123!` |
| Perawat | `perawat@simrs.com` | `perawat123!` |
| Apoteker | `farmasi@simrs.com` | `farmasi123!` |
| Kasir / Billing | `kasir@simrs.com` | `kasir123!` |

---

## 🛠️ Menjalankan Proyek Secara Lokal

### Prasyarat
- Node.js 20+
- PostgreSQL 14+
- Google Chrome (untuk screenshot otomatis)

### 1. Setup Database
```bash
# Buat database PostgreSQL
createdb simrs

# Konfigurasi koneksi di server/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/simrs"
```

### 2. Setup Backend
```bash
cd server
npm install
npm run db:push     # Buat/selaraskan skema database (WAJIB setelah git pull terbaru — ada kolom baru)
npm run db:seed     # Isi data seed (user demo, ICD-10/9, tarif, kunjungan + resep + billing contoh)
npm run dev         # Start backend di http://localhost:3000
```

> **Penting:** `db:push` adalah satu-satunya jalur skema (tanpa folder migrasi).
> Setiap kali menarik perubahan yang menyentuh `server/src/db/schemas/`, jalankan
> `npm run db:push` sebelum `npm run dev`, lalu `npm run db:seed` bila perlu mengisi
> ulang data contoh (`npm run db:wipe` untuk memulai dari kosong).

### 3. Setup Frontend
```bash
# Di root proyek
npm install
npm run dev         # Start frontend di http://localhost:5173
```

### 4. Generate Screenshot (Opsional)
```bash
# Pastikan backend & frontend sedang running
npx tsx scripts/capture-screenshots.ts
```

### 5. Build untuk Production
```bash
# Frontend
npm run build       # Output ke dist/

# Backend
cd server && npm run build   # Output ke server/dist/
```

---

## 🤝 Pedoman Kontribusi Kode (Untuk Developer Baru)

1.  **Strict Typing:** Jangan menggunakan tipe `any`. Jika Anda membuat sambungan API baru di Backend (`server/src/modules/`), petakan juga bentuk *interface* responsenya di React (`src/lib/api/`).
2.  **API Client & State:** Selalu gunakan **TanStack Query** (`useQuery` atau `useMutation`) untuk memanggil API di berkas komponen `.tsx`. JANGAN memakai `useEffect` klasik berkombinasi `fetch/axios` untuk memuat memori demi efisiensi Cache & Garbage Collection bawaan aplikasi.
3.  **Soft-Delete:** Perintah standar Rumah Sakit memblokir penghapusan rekam historis pasien. Setiap kali Anda ingin menghapus _record_, pakailah taktik Drizzle `.update().set({ deletedAt: new Date() })`, bukan operasi `db.delete()`.
4.  **Audit Linting & Test:** Sebelum membuat *Pull Request* atau men-deploy ke server produksi, pastikan seluruh pemeriksaan berikut **hijau**:
    ```bash
    # Frontend (root)
    npm run lint                        # eslint src shared
    npx tsc -p tsconfig.app.json --noEmit

    # Backend
    cd server
    npm run typecheck                   # tsc --noEmit
    npm test                            # vitest (PGlite, tanpa PostgreSQL)
    ```
    Jalankan juga `npx vitest run` di root untuk unit test frontend. Jangan pernah menonaktifkan tes yang gagal hanya karena "lokal jalan".

---

