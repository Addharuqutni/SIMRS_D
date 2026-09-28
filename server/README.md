# SIMRS Backend

Express 4 + Drizzle ORM backend for the SIMRS hospital app.

## Skema & Data

Skema adalah satu-satunya sumber kebenaran; tidak ada folder migrasi.

```bash
npm run db:push     # Selaraskan skema ke PostgreSQL (WAJIB setelah pull — ada kolom baru)
npm run db:seed     # Data awal: user demo, ICD-10/9, tarif, lalu kunjungan/resep/billing contoh
npm run db:wipe     # Kosongkan semua tabel (dev saja; menolak jalan saat NODE_ENV=production)
npm run db:backup   # pg_dump (PowerShell + WSL; lihat scripts/backup.ps1)
```

`src/db/seed.ts` memakai pola *builder*: `seedDatabase(db, ids)` dapat dijalankan
pada `Db` apa pun (PGlite di tes, pool nyata di CLI). Semua baris klinis dibuat
lewat modul domain — `admit`, `createResep`/`startProses`/`dispense`,
`createOrder`, `issueSep`, `charge`/`finalize`/`pay` — sehingga data seed tunduk
pada invarian yang sama dengan data produksi.

## Testing & Type Checking

```bash
npm test            # vitest run — PGlite in-memory, PostgreSQL TIDAK diperlukan
npm run typecheck   # tsc --noEmit
```

Tes membangun skema langsung dari definisi Drizzle (`src/db/testing.ts`), jadi
tes selalu mengikuti skema terkini tanpa service database.

## Modul Domain

Route hanya memvalidasi masukan (Zod) lalu memanggil modul domain; modul
menerima `db: Db` sebagai parameter pertama dan melempar `DomainError` yang
dipetakan `middleware/error.ts` ke HTTP.

| Modul | Aturan yang dimiliki |
|---|---|
| `admission/admission.ts` | Kunjungan (rawat jalan/IGD/rawat inap), RM dibuat server, antrean, admisi & pemulangan |
| `pharmacy/dispensing.ts` + `inventory/stock.ts` | Resep (baru → proses → selesai) dan stok FEFO |
| `billing/ledger.ts` | Satu billing per kunjungan; `charge` idempoten per `sourceRef`; finalize/pay + baris ledger |
| `penunjang/orders.ts` | Order Lab & Radiologi (menunggu → diproses → selesai/batal) + tagihan & unggahan hasil |
| `vclaim/sep-klaim.ts` + `vclaim/port.ts` | SEP & Klaim BPJS; adapter HTTP/`simulasi`; produksi tanpa kredensial menolak 503 |
| `settings/index.ts` | Tarif kamar & layanan (diubah operator via Konfigurasi Sistem) |

**Penagihan terjadi saat layanan diberikan** (*charge at service time*), memakai
tarif yang berlaku saat itu; `finalize()` hanya menjumlahkan yang sudah tercatat.
