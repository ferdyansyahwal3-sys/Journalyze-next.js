# Journalyze — Next.js Migration (Phase 1-2: /admin, /delivery)

Migrasi bertahap dari single-file HTML/JS/CSS ke Next.js 14 (App Router).
Repo asli: https://github.com/ferdyansyahwal3-sys/Journalyze

## Status
- ✅ **Phase 0** — scaffold Next.js (TypeScript, App Router, Zustand)
- ✅ **Phase 1** — `admin.html` → `/admin` (SELESAI, sudah dites & jalan)
- ✅ **Phase 2** — `delivery.html` → `/delivery` (SELESAI, sudah lulus `next build`)
- ⏳ Phase 3+ — `index.html`, `live.html`, `api/*` (belum dikerjakan, lihat roadmap di bawah)

## Cara jalanin
```bash
npm install
cp .env.local.example .env.local   # isinya sudah sama persis dengan admin.html lama
npm run dev
# buka http://localhost:3000/admin
```

## Apa yang dipindah, dan ke mana
Semua logic di bawah ini **dipindah verbatim** (tidak ditulis ulang), tiap fungsi
punya komentar nomor baris asalnya biar gampang di-diff ke file HTML lama:

### Phase 1 — admin.html
| Asal (admin.html) | Sekarang di |
|---|---|
| CSS `<style>` (baris 10-167) | `app/admin/admin.css` — disalin apa adanya, class name & CSS var **tidak diubah** |
| `_sb`, `_sbAdmin`, konstanta | `lib/supabaseClient.ts` |
| `fmtDate`, `genKeyString`, `encodeDeliveryToken` | `lib/adminHelpers.ts` |
| `initAdmin`, `checkAdminAccess`, `doLogin`, `doLogout` | `hooks/useAdminAuth.ts` |
| `loadKeys`, `applyFilter`, `generateKey`, `confirmAction` (revoke/restore/block/unblock) | `hooks/useLicenseKeys.ts` |
| `loadAnalytics` + agregasi per-user | `hooks/useAnalytics.ts` |
| `renderDailyTradesChart/WinRateChart/PairsChart/GrowthChart` | `components/admin/charts/*.tsx` |
| `allKeys`, `filteredKeys`, `currentPage`, `pendingAction`, dst (variabel global) | `store/useAdminStore.ts` (Zustand) |
| Markup HTML tiap section | `components/admin/*.tsx` |

### Phase 2 — delivery.html
| Asal (delivery.html) | Sekarang di |
|---|---|
| CSS `<style>` (baris 9-133) | `app/delivery/delivery.css` — verbatim |
| `decodeDeliveryToken()` (baris 310-329) | `lib/deliveryToken.ts` |
| Baca `token`/`key`/`name` dari URL (baris 331-357) | `components/delivery/DeliveryPage.tsx` (pakai `useSearchParams`) |
| `copyKey()` (baris 377-400) | `components/delivery/LicenseKeyBox.tsx` |
| Reveal-on-scroll `IntersectionObserver` (baris 402-407) | `hooks/useRevealOnScroll.ts` (reusable — dipakai lagi di Phase berikutnya) |
| 3× step-card (e-book, e-book, komunitas) — markup mirip, disatukan | `components/delivery/StepCard.tsx` (1 komponen, dipanggil 3x beda props) |

## Yang SENGAJA dipertahankan persis (sesuai keputusan Ferdy)
- `NEXT_PUBLIC_SUPABASE_ADMIN_KEY` (service_role key) tetap di client, sama seperti
  admin.html lama. **Ini tetap sebuah celah keamanan** — kapan pun kamu mau menutupnya,
  tinggal bilang, tinggal pindahkan query yang pakai `_sbAdmin` ke Next.js Route Handler.
- Tidak ada perubahan UI/UX, warna, spacing, atau alur — semua class CSS & struktur
  komponen mengikuti markup asli 1:1.

## Checklist testing Phase 1 (/admin)
- [ ] Login dengan email admin yang benar & salah (cek pesan error)
- [ ] Tab License Keys: generate 1 key, generate bulk (3/5/10), search, filter status
- [ ] Revoke / Restore key, Block / Unblock user (modal konfirmasi)
- [ ] Copy key & copy URL (clipboard)
- [ ] Pagination (kalau data > 20 key)
- [ ] Tab Analytics: 4 chart muncul, ranking, tabel per-user, filter growth chart (30/90/180/365 hari)

## Checklist testing Phase 2 (/delivery)
- [ ] Buka `/delivery?token=...&name=...` pakai URL yang di-generate dari `/admin` (Generate Key) — key & nama customer muncul benar
- [ ] Buka `/delivery` tanpa param sama sekali → tampil "TIDAK DITEMUKAN"
- [ ] Buka dengan token yang di-tempering / rusak → tampil "TOKEN TIDAK VALID"
- [ ] Buka dengan URL lama `?key=...&name=...` (backward compat) → tetap tampil normal
- [ ] Tombol copy key → berubah jadi "Tersalin!" 2.5 detik lalu balik lagi
- [ ] Scroll ke bawah → animasi reveal muncul (fade + slide up) di section access & step cards
- [ ] Link "Buka Journalyze", 2 e-book, dan grup WhatsApp — semua ngebuka tab baru dengan benar

Kalau ada yang beda dari versi lama, kasih tahu bagian mana — pola migrasi di Phase 1 & 2
ini bakal dipakai berulang buat halaman-halaman berikutnya.

## Roadmap Phase berikutnya (belum dikerjakan, menunggu konfirmasi tiap tahap)
3. `page-home`, `page-risk` di `index.html` — halaman low-risk, tidak butuh Supabase
4. `page-data`, `page-plan`, Modal Add/Edit Trade — bagian dengan Supabase CRUD
5. `page-filter`, `page-weekly`, `page-monthly` — banyak chart, mirip pola admin analytics
6. Share Portfolio Canvas, foto AI analysis (Claude/Gemini), notification & onboarding modal
7. `live.html` — evaluasi ulang: karena strukturnya ~90% mirip index.html, kemungkinan besar
   banyak komponen dari langkah 3-6 bisa **dipakai ulang** (dengan varian read-only),
   bukan dibuat dari nol
8. `api/rss-proxy.js`, `api/econ-calendar.js` → Next.js Route Handlers (`app/api/*/route.ts`) — hampir tanpa perubahan, sudah format serverless function
9. PWA: `manifest.json` (sudah dipindah ke `public/`), `sw.js` → custom service worker atau `next-pwa`

Tiap tahap saya kerjakan satu-satu, kamu test, baru lanjut ke tahap berikutnya — sesuai permintaan awal.
