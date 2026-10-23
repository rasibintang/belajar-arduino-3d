# AI penyusun rangkaian — desain

Tanggal: 2026-10-23 · Status: menunggu persetujuan · Urutan: proyek ke-3 dari 3
(1. panduan kabel → 2. akun & data → **3. AI penyusun rangkaian**)

## Maksud

Pengguna menulis keinginannya dalam bahasa sehari-hari — mis. "buat rangkaian Arduino untuk
monitoring otomatis kelembapan tanah" — dan sandbox menyusun rangkaian (komponen, posisi, kabel)
beserta kode sketch-nya, siap dijalankan. AI juga bisa mengubah rangkaian yang sedang terbuka
("tambahkan buzzer yang berbunyi saat tanah kering"). Permintaan akan komponen yang belum ada
menjadi masukan bagi pemilik untuk menambah katalog.

## Tujuan

1. Kotak perintah AI di sandbox (hanya untuk pengguna yang login dengan Google — lihat desain
   akun & data). Perintah boleh bahasa Indonesia atau Inggris.
2. **Rangkaian baru**: AI memilih komponen dari katalog, menempatkannya (memakai breadboard bila
   perlu), memasang kabel, dan menulis kode sketch.
3. **Ubah rangkaian**: AI menambah/menghapus/mengubah komponen, kabel, dan kode pada proyek yang
   sedang terbuka.
4. **Pratinjau dulu**: hasil tampil (meja 3D, daftar komponen, kode, penjelasan singkat, dan catatan
   bila ada komponen pengganti/tidak tersedia; untuk perubahan: apa saja yang berubah). Pengguna
   memilih **Terima** atau **Tolak**.
   - Rangkaian baru diterima → dibuka sebagai **proyek baru terpisah** (proyek yang sedang
     dikerjakan tidak tersentuh; bila login, otomatis tersimpan di akun).
   - Perubahan diterima → **langsung diterapkan** ke proyek yang terbuka, dengan tombol
     **"Urungkan perubahan AI"** untuk kembali ke versi sebelumnya.
5. **Komponen belum tersedia**: pengguna diberi tahu dengan jelas; permintaan dicatat sebagai laporan
   di halaman pengelola. Bila tujuan masih bisa dicapai dengan komponen yang ada (mis. sensor
   pengganti, relay/pompa saat kering, nilai di LCD/Serial Monitor), AI merekomendasikan dan
   menyusun versi itu sambil menjelaskan penggantinya.
6. **Batas pemakaian**: 1 permintaan per pengguna per hari (bisa diubah pengelola tanpa ubah kode);
   pengelola tidak dibatasi; permintaan yang gagal tidak mengurangi jatah.

## Bukan tujuan

- Mengobrol bebas / tanya-jawab umum tentang Arduino (fitur ini hanya menyusun & mengubah
  rangkaian).
- Membuat komponen baru otomatis, atau memakai library di luar yang terpasang di server kompilasi.
- AI untuk pengguna yang tidak login, atau dengan kunci API milik pengguna.

## Anti-tujuan

- AI **mengarang komponen** yang tidak ada di katalog, atau pin yang tidak ada pada komponen.
- Menampilkan rangkaian/kode yang **tidak jalan seolah-olah benar** (tidak terkompilasi, kabel
  berbahaya).
- Kunci API bocor ke browser, atau biaya membengkak karena penyalahgunaan.

## Batasan

- **Claude (Anthropic)** sebagai model AI, dipanggil dari fungsi server Vercel baru (mis.
  `/api/ai`), sejajar dengan `/api/compile`. Kunci API milik pemilik situs, disimpan sebagai
  variabel lingkungan Vercel. Pemilik **belum punya kunci**: semua disiapkan; selama kunci belum
  dipasang, fitur menampilkan pesan "fitur AI belum diaktifkan" tanpa error.
- Hasil AI harus berupa data proyek yang sama dengan sandbox (`diagram.json` + `sketch.ino`),
  memakai `type` dan id pin dari registri komponen (`src/components`) dan library yang terpasang.
- Bergantung pada proyek 2 (login, penyimpanan laporan & jatah) dan memakai aturan proyek 1
  (panduan kabel) untuk memeriksa kabel.
- Dua bahasa: penjelasan dari AI mengikuti bahasa situs yang aktif.

## Bagian yang sudah diputuskan

- Alur pratinjau → Terima/Tolak seperti di Tujuan 4.
- Laporan "komponen belum tersedia" disimpan di website (database) dan dibaca di halaman pengelola.

## Keputusan pembangun desain ini (boleh dikoreksi)

- Sebelum pratinjau ditampilkan, kode hasil AI **dikompilasi** lewat server kompilasi dan kabelnya
  **diperiksa** dengan aturan panduan kabel; bila gagal, AI diminta memperbaiki **sekali** secara
  otomatis. Bila tetap gagal, pengguna diberi tahu (dan jatah tidak berkurang).
- Model Claude terbaru dan paling mampu sebagai bawaan; nama model bisa diganti lewat variabel
  lingkungan.
- Daftar komponen yang diberikan ke AI berasal langsung dari registri komponen (nama, keterangan,
  pin, props), sehingga komponen baru otomatis dikenal AI tanpa mengubah prompt.

## Diserahkan ke pembangun

Format pertukaran data dengan AI (mis. tool/JSON terstruktur), isi prompt sistem, penempatan
otomatis komponen di meja & breadboard, desain kotak perintah dan pratinjau (gaya sandbox),
penyimpanan riwayat untuk "Urungkan", pencatatan pemakaian, dan penanganan batas waktu fungsi.
