# Pemantauan situs (tab "Kondisi situs" di halaman pengelola)

Disetujui pemilik pada 2026-10-25 ("ok lakukan").

## Tujuan
Pengelola bisa melihat kesehatan situs tanpa layanan pihak ketiga: ringkasan, log error & warning
yang dikelompokkan, dan kinerja (waktu muat, kompilasi, AI).

## Bukan tujuan
- Pelacakan pengunjung / analitik pemasaran.
- Mencatat isi sketch, isi perintah AI, kunci API, atau email.

## Data (Supabase, migrasi `20261025000000_pemantauan.sql`)
- `site_events`: level (`error`/`warn`), source (`browser`/`server`), kind, message, page, device,
  browser, fingerprint, created_at. Hanya ditulis server (service role); dibaca pengelola.
- `site_metrics`: name (`load`/`compile`/`ai`), page, device, value_ms, ok, created_at.
- `site_event_resolved`: fingerprint → resolved_at (pengelola menandai "Selesai"; kelompok tampil
  lagi bila muncul kejadian baru setelahnya).
- Data > 30 hari dihapus oleh `/api/log` (peluang kecil per permintaan; tanpa pg_cron).

## Alur
- Browser (`src/monitor/client.js`, hanya produksi atau `?monitor=1`): error JS & promise, gagal
  akun/simpan, WebGL hilang, halaman lambat (> 15 dtk), AI "kunci saya" gagal (alasan saja), waktu
  muat sampai siap. Maks 20 kejadian per halaman, pesan sama dikirim sekali; dikirim berkelompok
  lewat `sendBeacon` ke `POST /api/log`.
- `/api/log` (`server/log.mjs`): validasi, potong panjang, samarkan rahasia (kunci API, token,
  email), sidik jari = hash(source|kind|pesan tanpa angka|halaman), batas 30 permintaan/menit per IP
  (per instans), lalu simpan.
- Server: `/api/compile` mencatat lama kompilasi (ok = server berfungsi; kesalahan sketch pengguna
  bukan error situs) dan error bila toolchain hilang/timeout; `/api/ai` mencatat lama & hasil,
  kegagalan penyedia sebagai error, kegagalan lain sebagai warning.

## Tampilan pengelola
Tab "Kondisi situs", periode 24 jam / 7 hari:
1. Kartu ringkasan dengan pembanding periode sebelumnya: error, warning, kompilasi (% berhasil,
   waktu tipikal), AI (berhasil/gagal), pengguna baru, proyek disimpan.
2. Log error & warning dikelompokkan: level, pesan, sumber·jenis, halaman, jumlah, pertama/terakhir,
   perangkat; filter level & sumber; tombol "Selesai".
3. Kinerja: waktu muat per halaman × perangkat (p50/p95, jumlah), kompilasi & AI (p50/p95, % ok).

## Keputusan pembangun
- Pengelompokan & persentil dihitung di browser pengelola (`src/monitor/summary.js`, murni & diuji);
  data dibatasi 5000 baris per tabel per periode.
- Batas per IP di memori instans (best effort); cukup untuk spam ringan, Vercel Firewall untuk berat.
