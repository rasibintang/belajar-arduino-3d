# Akun & data (login Google, proyek di akun, halaman pengelola) — desain

Tanggal: 2026-10-23 · Status: menunggu persetujuan · Urutan: proyek ke-2 dari 3
(1. panduan kabel → **2. akun & data** → 3. AI penyusun rangkaian)

## Maksud

Situs saat ini menyimpan semuanya di browser masing-masing. Pemilik ingin pengelolaan pengguna dan
data yang lebih rapi: pengguna bisa masuk dengan akun Google untuk membuka fitur tambahan, dan
pemilik (pengelola) bisa melihat apa yang dibuat dan diminta pengguna. Ini juga fondasi untuk
fitur AI (siapa yang meminta, batas pemakaian, laporan komponen).

## Tujuan

1. **Masuk dengan Google** di sandbox (dan tersedia di halaman lain). Tanpa login semua tetap bekerja
   seperti sekarang.
2. **Proyek disimpan di akun**: daftar "Proyek saya", buka di perangkat lain, simpan/ubah nama/hapus.
   Penyimpanan lokal di browser tetap ada untuk pengguna yang tidak login.
3. **Halaman pengelola** (khusus pemilik):
   - laporan **komponen yang belum tersedia** dari fitur AI (permintaan, pengguna, waktu,
     berapa kali diminta) — untuk menentukan komponen baru;
   - **proyek semua pengguna** (nama, pemilik, terakhir diubah), bisa dibuka di sandbox;
   - daftar pengguna dan pemakaian AI per pengguna;
   - pengaturan **batas AI per hari** (awal: 1) tanpa mengubah kode.
4. Pemberitahuan singkat saat login: proyek yang disimpan di akun dapat dilihat pengelola situs.

## Bukan tujuan

- Login dengan selain Google, login email/password, atau akun untuk banyak pengelola sekaligus.
- Fitur sosial (berbagi ke pengguna lain, komentar, galeri publik). Tautan "Bagikan" yang sudah ada
  tetap seperti sekarang.
- Membatasi sandbox/pelajaran bagi yang tidak login.

## Anti-tujuan

- Sandbox atau pelajaran menjadi lebih lambat atau rusak saat Supabase belum dikonfigurasi atau
  sedang tidak bisa dihubungi.
- Pengguna biasa bisa membaca proyek pengguna lain, atau rahasia (service key, kunci AI) sampai ke
  browser.
- Pengelola tanpa sengaja mengubah proyek milik pengguna.

## Batasan

- **Supabase** (pilihan pemilik): Auth dengan Google + Postgres. Proyek:
  `https://gsjpkjolxielseltvhnn.supabase.co`. Password database **tidak** dipakai aplikasi dan tidak
  boleh ditulis di repo; yang dipakai: anon key (browser) dan service_role key (hanya server, variabel
  lingkungan Vercel).
- Tetap satu situs statis Vite + fungsi Vercel; tidak ada server lain.
- Disiapkan lebih dulu: selama kunci Supabase belum dipasang, tombol masuk tidak tampil (atau tampil
  dengan keterangan "belum diaktifkan") dan semua fitur lain normal.
- Dua bahasa (ID/EN) untuk semua teks baru.

## Bagian yang sudah diputuskan

- Pengelola = akun Google pemilik (ditandai sebagai admin; cara menandainya diserahkan ke pembangun,
  mis. daftar email admin di variabel lingkungan atau kolom peran yang diisi manual).
- Proyek pengguna yang dibuka pengelola selalu dibuka sebagai **salinan** — milik pengguna tidak
  berubah.
- Akun pengelola tidak terkena batas pemakaian AI.

## Keputusan pembangun desain ini (boleh dikoreksi)

- **Progres pelajaran** (tanda "selesai") ikut tersimpan di akun bila login, digabung dengan progres
  lokal saat pertama login.
- Halaman pengelola sebagai halaman terpisah (mis. `/admin.html`), tidak muncul di menu untuk
  pengguna biasa.
- Akses data diatur dengan Row Level Security Supabase: pengguna hanya membaca/menulis miliknya;
  pengelola membaca semua.

## Yang harus dilakukan pemilik (di luar kode)

1. Di dashboard Supabase: aktifkan provider **Google** (perlu OAuth Client ID dari Google Cloud
   Console) dan isi URL situs/redirect.
2. Salin **anon key** dan **service_role key**; pasang di Vercel (dan `.env.local` untuk lokal).
3. Disarankan mengganti password database (sempat tertulis di percakapan).

## Diserahkan ke pembangun

Skema tabel, kebijakan RLS, letak tombol masuk & daftar "Proyek saya" di antarmuka, desain halaman
pengelola (mengikuti gaya situs), cara sinkron proyek lokal ↔ akun, dan migrasi SQL yang bisa
dijalankan pemilik di Supabase.
