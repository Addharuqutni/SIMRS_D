# SIMRS - Sistem Informasi Manajemen Rumah Sakit 🏥

SIMRS adalah aplikasi manajemen operasional operasional Rumah Sakit berskala *enterprise-ready*. Menggunakan teknologi modern *(Full-Stack TypeScript)* untuk memberikan antarmuka yang sangat responsif, pengolahan data *real-time*, dan rekam medis elektronik yang mengutamakan privasi serta kepatuhan standar medis.

Proyek ini menggunakan pendekatan **Frontend & Backend Decoupled** di dalam satu sub-struktur proyek, memudahkan pengembangan lincah namun siap untuk di-*deploy* secara terpisah (*microservices/containerization*).

---

## 🚀 Teknologi Utama (Tech Stack)

### 🎨 Frontend (Client-side)
- **Framework:** React 18 + Vite (Cepat & Ringan)
- **Bahasa:** TypeScript (Strict Mode)
- **State Management:** TanStack Query (React Query)
- **Routing:** React Router v6
- **Styling:** CSS Modules + Vanilla CSS (Bebas *bloatware*)
- **Fitur Tambahan:** `socket.io-client` (Real-Time UI), `react-to-print` (Print PDF/Kuitansi)

### ⚙️ Backend (Server-side)
- **Runtime & Framework:** Node.js + Express.js v4
- **Bahasa:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM (Type-Safe Database Interactor)
- **Keamanan:** Helmet, Express Rate Limiter, `better-auth` (Role-Based Access)
- **Observability & Logging:** Winston + Morgan
- **Kriptografi Standar Kemenkes/BPJS:** AES-256-CBC, HMAC-SHA256, LZ-String

---

## 📂 Struktur Proyek

Proyek ini dibelah menjadi dua direktori utama akar:

```text
simrs/
├── public/                 # Aset statis terbuka Frontend (Logo, Fonts)
├── server/                 # 🔴 BACKEND DOMAIN
│   ├── src/
│   │   ├── db/             # Koneksi PostgreSQL & Skema Drizzle ORM
│   │   ├── middleware/     # Penengah (RBAC Auth)
│   │   ├── modules/        # API Routers terpisah berdasarkan Domain RS
│   │   ├── utils/          # Winston Logger, Crypto BPJS, Helper
│   │   ├── index.ts        # Entry point HTTP server & Socket.io
│   │   └── socket.ts       # Manajemen WebSocket channel
│   ├── .env                # Variabel Lingkungan Backend (DB URL, Port)
│   ├── drizzle.config.ts   # Konfigurasi Database Migration Tool
│   └── package.json        # Dependencies Backend
│
├── src/                    # 🔵 FRONTEND DOMAIN
│   ├── components/         # Komponen UI Reusable (Modal, Button, Table)
│   ├── hooks/              # Custom Hooks React Query (usePharmacy, useBpjs)
│   ├── lib/                # API Client config (Axios baseUrl)
│   ├── pages/              # Antarmuka per Layanan (Billing, EMR, Kasir)
│   ├── App.tsx             # Root Router & Security Protected Routes
│   └── main.tsx            # Vite Entry Point 
│
├── vite.config.ts          # Konfigurasi React bundler
├── package.json            # Dependencies utama Frontend
└── README.md               # Dokumentasi Repositori
```

---

## 🛠 Panduan Instalasi & Menjalankan Aplikasi (Quick Start)

### 1. Prasyarat Sistem
Cukup bermodalkan dua hal ini di mesin pengembang Anda:
*   **Node.js** (Minimal versi v18.0+)
*   **PostgreSQL** (Minimal versi 14+) - Pastikan service/daemon Postgre berjalan di port default `5432`.

### 2. Kloning Repositori & Instal Dependensi Pokok

Instal _dependencies_ di *root* (untuk React Frontend) sekaligus di folder `server/` (untuk Node Backend).

```bash
# Instal modul Frontend React
npm install

# Instal modul Backend Express
cd server
npm install
```

### 3. Konfigurasi Database & Environment (.env)

Buat file `.env` di dalam folder `server/`:
```bash
# ~/simrs/server/.env

PORT=3000
DATABASE_URL="postgresql://postgres:root@localhost:5432/simrs"
FRONTEND_URL="http://localhost:5173"

# Konstanta Simulasi Kriptografi BPJS / SatuSehat
BPJS_CONS_ID="123456"
BPJS_SECRET_KEY="SECRETDUMMY"
```
*(Ganti nama user, password, dan port database PostgreSQL sesuai dengan konfigurasi Anda).*

### 4. Setup Database Schema (Drizzle Push)

Sebagai inisialisasi awal, dorong skema sistem terbaru yang baru di-clone ke dalam Server PostgreSQL:

```bash
cd server
npm run db:push

# (Opsional) Buka User Interface Database (Drizzle Studio) di Browser
npx drizzle-kit studio
```

### 5. Jalankan Pengembangan (Development Run)

Buka dua jendela terminal untuk menyalakan ke dua mesin *Dev Server*.

**Terminal 1 (Backend - Express API):**
```bash
cd server
npm run dev
# Backend akan memantau di http://localhost:3000
```

**Terminal 2 (Frontend - React + Vite):**
```bash
# Mulai dari root proyek
npm run dev
# Frontend akan menyala seketika di http://localhost:5173
```

🎉 Pergi ke *browser* dan buka **`http://localhost:5173`**. Masuk menggunakan antarmuka otentikasi (gunakan pengguna admin atau farmasi dummy untuk saat ini).

---

## 🚦 Fitur Tersedia (Modul Layanan RS)

Aplikasi SIMRS ini sudah memfasilitasi perjalanan *(Journey)* fungsional pasien dari awal hingga pulang:
1.  **Pendaftaran (Front Office):** Registrasi Rawat Jalan, pembuatan Nomor Antrean, integrasi pengecekan SEP BPJS.
2.  **Klinis & EMR (Electronic Medical Record):** Catatan SOAP Dokter, diagnosis ICD-10, input tanda-tanda vital per kunjungan, order rujukan Poli.
3.  **IGD:** Triase darurat (Triage Merah/Kuning/Hijau) & perlakuan langsung.
4.  **Farmasi (Apotek):** Manajemen Rak/Stok Obat (Mutasi otomatis plus minus), penarikan/e-Resep, konfirmasi penerimaan obat.
5.  **Laboratorium & Radiologi:** Entry pesanan tes dari dokter, hingga pengisian narasi hasil interpretasi Lab.
6.  **Billing & Keuangan (Kasir):** Konsolidasi seluruh tagihan jasa (Poli, Tindakan, Obat), potongan *cover* Jaminan BPJS otomatis, cetak kuitansi PDF.
7.  **Integrasi Eksternal:** Sistem pembuatan klaim INA-CBG dan Surat Eligibilitas (SEP) dengan mekanisme kriptografi standar tinggi.

## 🤝 Pedoman Kontribusi Kode (Untuk Developer Baru)

1.  **Strict Typing:** Jangan menggunakan tipe `any`. Jika Anda membuat sambungan API baru di Backend (`server/src/modules/`), petakan juga bentuk *interface* responsenya di React (`src/lib/api/`).
2.  **API Client & State:** Selalu gunakan **TanStack Query** (`useQuery` atau `useMutation`) untuk memanggil API di berkas komponen `.tsx`. JANGAN memakai `useEffect` klasik berkombinasi `fetch/axios` untuk memuat memori demi efisiensi Cache & Garbage Collection bawaan aplikasi.
3.  **Soft-Delete:** Perintah standar Rumah Sakit memblokir penghapusan rekam historis pasien. Setiap kali Anda ingin menghapus _record_, pakailah taktik Drizzle `.update().set({ deletedAt: new Date() })`, bukan operasi `db.delete()`.
4.  **Audit Linting:** Lakukan operasi `npm run build` dan `cd server && npx tsc --noEmit` yang bebas dari pesan *Error* (Hijau) sebelum menggabungkan *Pull Request* atau mendistribusikan ke Server Produksi.

---
*Dibangun dengan ❤️ oleh Tim Pengembang SIMRS RS.*
