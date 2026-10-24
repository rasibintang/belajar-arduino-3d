# Riwayat pembaharuan

Semua perubahan penting pada proyek ini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/);
nomor versi mengikuti [SemVer](https://semver.org/lang/id/).

## [0.9.0] — 2026-10-24 · AI penyusun rangkaian

### Ditambahkan
- **Susun dengan AI** (sandbox): tulis perintah, AI memilih komponen dari
  katalog, memasang kabel, dan menulis sketch. Sebelum pratinjau tampil, server menata komponen di
  breadboard, memeriksa kabel dengan aturan panduan kabel, dan mengompilasi sketch; bila gagal, AI
  memperbaiki sekali.
- **Pratinjau** dengan meja 3D kecil, ringkasan, komponen, pengganti, komponen yang belum tersedia,
  kode, dan daftar perubahan; **Terima** (rangkaian baru dibuka sebagai proyek terpisah dan disimpan
  di akun — proyek yang sedang dikerjakan disimpan dulu) atau **Tolak**.
- **Mode ubah** dengan tombol **Urungkan perubahan AI**; komponen lama tetap di tempatnya.
- **Kunci saya (BYOK):** pengguna memakai kunci API sendiri — Google Gemini (gratis), OpenRouter,
  Groq, Anthropic, atau alamat berformat OpenAI. Kunci hanya disimpan di browser (opsional "Ingat
  di browser ini"), AI dipanggil langsung dari browser, tidak perlu login. Tersedia "Muat daftar
  model" dan petunjuk membuat kunci Gemini.
- **Jatah gratis situs** (opsional, bila pemilik memasang kunci di server): wajib login, dengan
  **jatah harian** per pengguna (awal 1, diatur di halaman pengelola; pengelola tanpa batas;
  permintaan gagal tidak dihitung) dan **laporan komponen** yang belum tersedia.
- **Penyedia AI bisa dipilih:** Anthropic API (Claude Sonnet 5.5), Amazon Bedrock, atau layanan
  berformat OpenAI (mis. Google Gemini gratis), dengan pemberitahuan privasi di kotak AI.
- Alur pemeriksaan (validasi, tata letak, panduan kabel, kompilasi, perbaikan sekali) dipakai sama
  oleh server dan browser (`src/ai/pipeline.js`).
- Daftar pin semua komponen kini terbaca tanpa model 3D (dipakai server).

## [0.8.0] — 2026-10-24 · Akun & data

### Ditambahkan
- **Masuk dengan Google** (Supabase) di halaman pelajaran, sandbox, katalog, dan pengelola. Tanpa
  login semua tetap bekerja; saat pertama masuk ada pemberitahuan bahwa proyek di akun dapat
  dilihat pengelola situs.
- **Proyek sandbox di akun:** *Simpan ke akun*, *Proyek saya* (buka, ubah nama, hapus), simpan
  otomatis ke akun, dan penanda "Tersimpan di akun / Hanya di browser ini". Simpanan di browser
  tetap ada.
- **Progres pelajaran ikut akun** — digabung dengan progres di browser saat pertama masuk.
- **Halaman pengelola** `/admin.html`: laporan komponen yang belum tersedia, proyek semua
  pengguna (dibuka sebagai salinan), pengguna & pemakaian AI, batas permintaan AI per hari
  (awal 1).
- Skema database + Row Level Security (`supabase/migrations/`) beserta tes di Node (PGlite):
  pengguna hanya mengakses miliknya; pengelola membaca semua tanpa bisa mengubah milik orang lain.
- Mode pengembangan `?fakeauth=1|admin|offline` (akun palsu di memori).

### Catatan
- Fitur akun aktif setelah `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` dipasang; pustaka
  Supabase dimuat malas sehingga tanpa konfigurasi tidak ada yang diunduh. Langkah pemilik ada
  di docs/PANDUAN-PENGEMBANG.md bagian *Akun & data*.

## [0.7.0] — 2026-10-23 · Panduan kabel

### Ditambahkan
- **Panduan kabel di sandbox** (tombol kompas di bilah alat, bawaan menyala, pilihan diingat):
  - Saat menarik kabel, tujuan yang cocok untuk pin asal disorot hijau, pin Arduino lain
    diredupkan, dan label di dekat kursor menjelaskan ke mana sebaiknya (mis. *GND → pin GND
    atau rel −*). Contoh: dari `D13` pada proyek "LED + resistor", jalur resistor yang menuju
    anoda LED (`c8`) yang menyala.
  - Setelah kabel terpasang, kabel yang belum tepat menyala **jingga** (kurang tepat) atau
    **merah** (berbahaya) dengan tanda **!**; klik untuk melihat alasan dan saran, plus tombol
    **Pindahkan ke …** bila kabelnya langsung ke Arduino.
  - Daftar **Periksa rangkaian (n)** di pojok meja; klik baris untuk memilih kabel dan
    memfokuskan kamera. Masalah juga ditulis ke Serial Monitor saat simulasi mulai.
  - Aturan: hubungan pendek, VCC/GND terbalik, pin daya di pin sinyal, modul 3,3 V diberi 5V,
    I²C bukan di A4/A5, SPI bukan di D11–D13, keluaran analog di pin tanpa ADC, servo di pin
    non-PWM, memakai D0/D1 (Serial), LED / 7-segment tanpa resistor.
  - **Kabel meleset / salah jalur:** ujung kabel dari Arduino yang jatuh di jalur kosong padahal
    komponen yang cocok sudah ada di breadboard (mis. GND ke `a11` atau `j13` padahal katoda LED
    di kolom 13), atau di jalur yang fungsinya tidak cocok (GND ke anoda LED, GND ke rel +), ditandai
    dengan saran lubang terdekat di jalur komponen yang benar dan tombol pindah. Jalur tombol,
    resistor biasa, dan masukan yang boleh diikat ke 5V/GND (mis. SLEEP/RESET A4988) tidak dinilai;
    begitu pula kabel ke breadboard yang belum berisi komponen yang cocok.
  - **LED kurang satu kabel:** anoda sudah ke Arduino tetapi katoda belum ke GND, padahal rel − di
    breadboard sudah tersambung GND → tanda ! di kaki katoda dengan tombol **Tambahkan kabel**
    (mis. `a13 → bn14`).
- **Pindahkan ujung kabel tanpa menghapusnya:** pilih kabel, lalu seret titik oranye di salah satu
  ujungnya ke pin/lubang lain. Panduan kabel menyorot tujuan yang cocok selama menyeret. Panel
  kabel menyingkir ke kiri bila menutupi ujung kabel.
- **Bilah kamera di sandbox** (sama seperti di halaman pelajaran): putar kiri/kanan, perkecil/perbesar,
  dan kompas untuk kembali ke tampilan awal. Keyboard: Q/E putar, +/− zoom, tombol panah geser
  (WASD tidak dipakai karena A = tambah komponen).
  - Dua bahasa (ID/EN). Tidak pernah memblokir; rangkaian setengah jadi tidak dinilai.
- Tes otomatis `npm test` (`node --test`) untuk netlist, fungsi pin, rekomendasi, pemeriksaan,
  dan kelengkapan teks ID/EN.

### Diubah
- Netlist dipisah dari simulator (`src/sim/netlist.js`) agar dipakai bersama simulasi dan
  panduan kabel.
- `validateSpec` kini memastikan setiap pin komponen punya fungsi panduan kabel.
- Peringatan simulasi lama "sambungkan SDA ke A4…", "SCK ke D13…" dan sejenisnya dihapus;
  kini ditangani pemeriksaan kabel (satu sumber aturan).

## [0.6.0] — 2026-10-23 · Dua bahasa, katalog komponen, siap Vercel

### Ditambahkan
- **Dua bahasa: Indonesia & Inggris.** Tombol **ID / EN** di semua halaman; pilihan tersimpan
  (urutan: `?lang=` di URL → pilihan tersimpan → bahasa browser).
  - Diterjemahkan: antarmuka situs, sandbox, dan katalog; 30 pelajaran (ringkasan, callout,
    penjelasan, pinout, spesifikasi, parameter); 85 komponen beserta pin & pengaturannya;
    38 contoh proyek; peringatan simulasi; pesan server kompilasi.
  - Kode pelajaran & contoh ikut diterjemahkan (komentar, teks Serial/LCD, beberapa nama
    variabel). Simulasi pelajaran menyesuaikan: keluaran Serial/LCD berbahasa Inggris,
    sorotan baris tetap tepat, dan perintah Serial bahasa Inggris (`red`, `off`, …) dikenali.
- **Katalog komponen** (`gallery.html`, sebelumnya alat pengembang): pencarian, tab kategori,
  meja 3D yang tersusun ulang sesuai filter, panel detail (keterangan, tabel pin, pengaturan),
  dan tombol **Coba di sandbox** yang membuka sandbox berisi Arduino + komponen itu
  (komponen breadboard otomatis ditancapkan). Info validasi hanya dengan `?dev`.
- **Bilah atas di halaman utama:** tombol **Sandbox**, **Katalog komponen**, dan pilihan bahasa.
  Menu Komponen kini punya tautan ke katalog lengkap; menu Pengaturan punya pilihan bahasa.
- **Persiapan deploy penuh di Vercel:** fungsi `api/compile.js`, `vercel.json`,
  skrip `npm run vercel-build`, dan `scripts/slim-toolchain.mjs` yang merampingkan toolchain
  ± 490 MB → ± 200 MB (di bawah batas fungsi 250 MB). Diuji lokal: 93 kompilasi (38 contoh +
  30 pelajaran beserta variannya) berhasil dengan toolchain ramping.
- Daftar **Library** di sandbox kini memuat semua library yang terpasang (27 entri).

### Diubah
- `server/compile.mjs`: konfigurasi `arduino-cli` dibuat saat berjalan (path bisa berbeda antara
  saat dipasang dan saat dipakai), semua berkas sementara di folder temp, cadangan izin eksekusi
  untuk serverless, dukungan `req.body` Vercel.
- `scripts/setup-arduino.mjs`: folder tujuan lewat `TOOLS_DIR`; `arduino-cli` 1.5.1 dan
  `arduino:avr@1.8.8` dipatok dan diunduh dari `downloads.arduino.cc`.

### Diperbaiki
- Gema perintah di Serial Monitor menampilkan teks yang diketik pengguna.

## [0.5.0] — 2026-10-23 · Sandbox gelombang 3 (total 85 komponen)

### Ditambahkan
- **TFT 2,8" ILI9341** 240×320 (CASET/PASET/RAMWR, 4 rotasi, BGR) dan varian dengan
  **layar sentuh FT6206** (klik-tahan layar saat simulasi).
- **e-Paper 2,9"** (SSD1680, untuk GxEPD2): refresh dengan BUSY, gambar tetap tampil setelah
  simulasi berhenti.
- **Kartu microSD 32 MB**: kartu SD mode SPI dengan sistem file FAT16 (berisi `HALO.TXT`);
  isi kartu bertahan selama halaman terbuka, daftar berkas tampil saat simulasi berhenti.
- **Driver LED RGB NLSF595**.
- Library server: Adafruit ILI9341, Adafruit FT6206, SD, GxEPD2. 5 contoh proyek baru.

### Diperbaiki
- Komponen yang tertancap di breadboard kini ikut saat breadboard digeser atau diputar.

## [0.4.0] — 2026-10-23 · Sandbox gelombang 2 (total 80 komponen)

### Ditambahkan
- **SPI** di emulator (perangkat keras D11/D12/D13 dan bit-bang).
- Layar: **OLED SSD1306** 128×64, **OLED SH1107** 128×128 (lewat U8g2), **Nokia 5110**,
  **TM1637** 4 digit, **matriks LED MAX7219** (1/2/4 modul, cocok untuk MD_Parola),
  **logic analyzer** 8 kanal.
- Sensor & input: **MPU6050**, **BMP180**, **DS18B20** (OneWire lengkap), **HX711 + load cell**,
  **penerima & remote IR** (NEC), **RFID MFRC522**.
- 16 library baru di server kompilasi; 7 contoh proyek baru.

### Diperbaiki
- Serial Monitor membaca UTF-8 (karakter seperti `°` tampil benar).

## [0.3.0] — 2026-10-23 · Sandbox gelombang 1 (total 67 komponen)

### Ditambahkan
- 41 komponen ala Wokwi: breadboard full/half/mini; push button 6 warna & 6 mm, saklar geser,
  DIP switch 8, potensiometer geser; sensor NTC, PIR, MQ2, DHT22, RTC DS1307; LCD 16×2/20×4
  (paralel & I²C), 7-segment 4 digit, NeoPixel tunggal/strip/matrix/bar; 7 gerbang logika,
  MUX 2:1, flip-flop D, generator clock, 74HC165, CD74HC4067; relay DPDT, driver A4988,
  stepper bipolar NEMA 17 & biaxial; simbol VCC/GND, junction, teks.
- 5 contoh proyek baru; library LiquidCrystal di server kompilasi.

## [0.2.0] — 2026-10-22 · Sandbox (rakit rangkaian sendiri)

### Ditambahkan
- Standar spesifikasi komponen (`src/components/`) dan galeri pengembang.
- Editor rangkaian 3D (pindah, tancap ke breadboard, putar, kabel) dan emulator ATmega328P
  (`avr8js`): timer/PWM, ADC, USART, I²C, EEPROM.
- Kompilasi sungguhan dengan `arduino-cli` (`/api/compile`), sorotan baris yang sedang
  berjalan, penanda error compiler.
- 26 komponen dengan perilaku simulasi; 21 contoh proyek; simpan/buka/bagikan proyek.
- Tombol **Buka di sandbox** di pelajaran; skrip setup dan Docker untuk server kompilasi.

## [0.1.0] — 2026-10-22 · Kursus Arduino 3D

### Ditambahkan
- Situs kursus interaktif dengan papan Arduino 3D (Vite + Three.js), terinspirasi dari
  Learn Arduino karya Dilum Sanjaya; kode, model, dan teks ditulis ulang dari awal.
- 30 pelajaran: Dasar (11), Menengah (10), Mahir (9), dengan simulasi, Serial Monitor,
  parameter yang bisa diubah, dan animasi.

[0.6.0]: https://github.com/rasibintang/belajar-arduino-3d/compare/5e8a2c0...a4287d9
[0.5.0]: https://github.com/rasibintang/belajar-arduino-3d/compare/9d36218...5e8a2c0
[0.4.0]: https://github.com/rasibintang/belajar-arduino-3d/compare/4467aca...9d36218
[0.3.0]: https://github.com/rasibintang/belajar-arduino-3d/compare/e0b8779...4467aca
[0.2.0]: https://github.com/rasibintang/belajar-arduino-3d/compare/db949dd...e0b8779
[0.1.0]: https://github.com/rasibintang/belajar-arduino-3d/commit/db949dd
