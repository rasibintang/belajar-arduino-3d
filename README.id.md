<div align="center">

# Learn Arduino

**Kursus Arduino 3D interaktif dan sandbox rangkaian di browser — kode C++ sungguhan dikompilasi dengan `arduino-cli`, lalu dijalankan emulator ATmega328P.**

[English](README.md) · **Bahasa Indonesia**

[![Situs](https://img.shields.io/badge/situs-learn--arduino--id.vercel.app-1f9e94?style=for-the-badge)](https://learn-arduino-id.vercel.app)
[![Versi](https://img.shields.io/badge/versi-0.9.0-1d2740?style=for-the-badge)](CHANGELOG.md)
[![Lisensi: MIT](https://img.shields.io/badge/lisensi-MIT-e8603c?style=for-the-badge)](LICENSE)

![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-r186-000000?logo=threedotjs&logoColor=white)
![Arduino CLI](https://img.shields.io/badge/arduino--cli-1.5.1-00878F?logo=arduino&logoColor=white)
![avr8js](https://img.shields.io/badge/emulator-avr8js-e8603c)
![Supabase](https://img.shields.io/badge/akun-Supabase-3ECF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/deploy-Vercel-000000?logo=vercel&logoColor=white)

<img src="docs/images/lessons.png" alt="Halaman pelajaran: Arduino Uno dan breadboard 3D dengan label bagian, catatan pelajaran, dan kode yang bisa diubah" width="900">

</div>

## Ringkasan

Learn Arduino mengajarkan elektronika seperti belajar di meja kerja sungguhan: papan 3D yang bisa
diputar, komponen yang bisa diklik, dan kode yang bisa diubah lalu dijalankan. Setelah siap,
**sandbox** memungkinkan Anda merakit rangkaian sendiri dari 85 komponen dan menjalankan sketch
Arduino sungguhan di browser — tanpa perangkat keras dan tanpa instalasi.

| | |
|---|---|
| **30 pelajaran** | Dasar (11), Menengah (10), Mahir (9): dari LED berkedip sampai interupsi, EEPROM, state machine, dan NeoPixel |
| **Sandbox** | 85 komponen, 38 contoh proyek, kompilasi sungguhan dengan 27 library Arduino, Serial Monitor dua arah |
| **Panduan kabel** | Menyorot ke mana kabel sebaiknya disambung dan menjelaskan bila sambungannya belum tepat |
| **Katalog komponen** | Semua komponen dalam 3D lengkap dengan pin, pengaturan, dan tombol "Coba di sandbox" |
| **Dua bahasa** | Indonesia dan Inggris di seluruh situs, termasuk pelajaran dan kode contoh |
| **Akun** | Masuk dengan Google (opsional) untuk menyimpan proyek sandbox dan progres pelajaran di cloud |
| **AI penyusun rangkaian** | Jelaskan proyek dengan kalimat biasa; AI memilih komponen, memasang kabel, dan menulis sketch — dikompilasi dan diperiksa kabelnya sebelum pratinjau tampil |

## Situs

**https://learn-arduino-id.vercel.app**

| Halaman | Isi |
|---|---|
| [`/`](https://learn-arduino-id.vercel.app) | 30 pelajaran interaktif |
| [`/sandbox.html`](https://learn-arduino-id.vercel.app/sandbox.html) | Rakit rangkaian dan jalankan C++ sungguhan di emulator |
| [`/gallery.html`](https://learn-arduino-id.vercel.app/gallery.html) | Katalog 85 komponen |

## Fitur

### Pelajaran interaktif

- Arduino Uno 3D dengan keterangan untuk setiap bagian penting; seret untuk menggeser, memutar,
  dan memperbesar.
- Setiap pelajaran punya ringkasan, pinout, kode, dan spesifikasi, plus parameter yang bisa
  diubah (nilai resistor, warna LED, kecepatan kedip, …) dengan hasil yang langsung terlihat.
- Pelajaran bisa dibuka di sandbox dengan rangkaian setara dan kode yang sama.

### Sandbox rangkaian

<img src="docs/images/sandbox.png" alt="Sandbox menjalankan sketch pelangi pada cincin NeoPixel di samping kodenya" width="900">

- Tempatkan komponen dari 10 kategori (papan, breadboard, input, sensor, layar, motor, logika, …);
  komponen breadboard menancap ke lubang dan ikut berpindah bersama breadboard.
- Klik satu pin lalu pin lain untuk memasang kabel; seret ujung kabel yang dipilih untuk
  memindahkannya.
- **Run** mengompilasi `sketch.ino` dengan `arduino-cli` di server, lalu menjalankan `.hex`-nya di
  [avr8js](https://github.com/wokwi/avr8js): timer/PWM, ADC, USART, I²C, SPI, EEPROM, serta model
  perangkat seperti LCD HD44780 dan I²C, OLED SSD1306, TFT ILI9341, WS2812, DHT22, HC-SR04, servo,
  stepper, kartu SD, dan lainnya.
- Baris yang sedang dijalankan disorot di editor; Serial Monitor bekerja dua arah.
- Proyek tersimpan di browser; unduh/buka sebagai `.json` atau bagikan sebagai tautan.

<table>
  <tr>
    <td width="50%"><img src="docs/images/sandbox-oled.png" alt="Sandbox menjalankan sketch OLED SSD1306"></td>
    <td width="50%"><img src="docs/images/catalog.png" alt="Katalog komponen berisi 85 komponen 3D"></td>
  </tr>
  <tr>
    <td align="center"><sub>OLED SSD1306 lewat I²C</sub></td>
    <td align="center"><sub>Katalog komponen</sub></td>
  </tr>
</table>

### Panduan kabel

Pemula sering tahu komponen apa yang ingin dipakai, tetapi bingung ke mana setiap kabel harus
disambung. Panduan kabel memakai aturan dari dokumentasi Arduino Uno dan datasheet komponen:

- **Saat menarik kabel**, tujuan yang cocok menyala hijau dengan petunjuk singkat
  (misalnya *GND → GND modul, katoda LED, atau rel −*).
- **Setelah kabel terpasang**, kesalahan membuat kabel menyala jingga (kurang tepat) atau merah
  (berbahaya) dengan tanda **!** yang menjelaskan masalahnya dan menawarkan perbaikan sekali klik —
  misalnya kabel GND yang jatuh di seberang parit tengah breadboard, I²C di pin yang salah, servo
  di pin non-PWM, LED tanpa resistor, atau 5V tersambung langsung ke GND.
- Panduan tidak pernah memblokir, dan tidak menilai rangkaian yang memang belum selesai.

<table>
  <tr>
    <td width="50%"><img src="docs/images/wire-guide.png" alt="Panduan kabel menyorot tujuan GND dengan warna hijau"></td>
    <td width="50%"><img src="docs/images/wire-check.png" alt="Pemeriksaan kabel menunjukkan kabel GND yang meleset beserta saran perbaikan"></td>
  </tr>
  <tr>
    <td align="center"><sub>Tujuan yang disarankan saat menarik kabel</sub></td>
    <td align="center"><sub>Kabel meleset dengan saran perbaikan</sub></td>
  </tr>
</table>

### AI penyusun rangkaian

Siapa pun bisa menuliskan keinginannya — *"monitoring kelembapan tanah otomatis yang
menampilkan nilainya di LCD"* — lalu AI menyusunnya di sandbox: memilih komponen dari katalog,
memasang kabel, dan menulis sketch. Kode kita sendiri kemudian menata komponen di breadboard,
memeriksa setiap kabel dengan aturan panduan kabel, dan mengompilasi sketch; bila ada yang gagal, AI
diberi satu kesempatan memperbaikinya. Anda melihat pratinjau 3D beserta komponen, kode, dan
pengganti, lalu **Terima** atau **Tolak**. AI juga bisa mengubah rangkaian yang sedang terbuka,
dengan tombol **Urungkan perubahan AI**. Komponen yang belum ada di katalog dilaporkan ke pengelola.

**Pakai kunci sendiri.** AI berjalan dengan kunci API *Anda* — disimpan hanya di browser Anda dan
dikirim langsung dari browser ke penyedia, tidak pernah ke server situs ini. Didukung: **Google
Gemini** (kunci gratis dari [Google AI Studio](https://aistudio.google.com/apikey)), **OpenRouter**,
**Groq**, **Anthropic (Claude)**, atau alamat apa pun berformat OpenAI. Tidak perlu login. Pemilik
situs juga bisa menyalakan **jatah gratis situs** (kunci di server, wajib login, jatah harian).

### Akun (opsional)

Masuk dengan Google (Supabase) menambah fitur tanpa mengurangi apa pun bagi pengunjung: proyek
sandbox tersimpan di akun, progres pelajaran tersinkron antarperangkat, dan halaman pengelola
untuk pemilik situs. Akses data dijaga Row Level Security di Postgres.

## Teknologi

| Bagian | Alat |
|---|---|
| Antarmuka | [Vite](https://vite.dev), [Three.js](https://threejs.org), JavaScript biasa (tanpa framework UI) |
| Simulasi | [avr8js](https://github.com/wokwi/avr8js) + netlist dan pemecah tegangan buatan sendiri |
| Kompilasi | [arduino-cli](https://arduino.github.io/arduino-cli/) dengan core AVR dan 27 library, sebagai fungsi Vercel |
| Akun | [Supabase](https://supabase.com) (Google OAuth, Postgres, Row Level Security) |
| AI | Kunci milik pengguna dari browser (Gemini, OpenRouter, Groq, Claude lewat [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript), berformat OpenAI) plus jatah server opsional (Anthropic / Amazon Bedrock / berformat OpenAI), semuanya dengan keluaran JSON terstruktur |
| Tes | `node --test`, dengan [PGlite](https://pglite.dev) untuk skema dan kebijakan database |
| Hosting | [Vercel](https://vercel.com) |

## Memulai

Kebutuhan: **Node.js 20.19+** (dikembangkan dengan Node 24).

```bash
npm install
npm run setup:arduino   # sekali saja: unduh arduino-cli, core AVR, dan library ke tools/
npm run dev             # http://localhost:5173
```

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan, sudah termasuk endpoint `/api/compile` |
| `npm test` | Tes unit: netlist, panduan kabel, akun, skema & RLS database |
| `npm run build` | Build produksi ke `dist/` |
| `npm run vercel-build` | Build di Vercel (memasang dan merampingkan toolchain Linux) |

Tanpa `setup:arduino`, pelajaran tetap berjalan, tetapi sandbox tidak bisa mengompilasi sketch.

Untuk mengaktifkan akun, salin `.env.example` menjadi `.env.local` lalu isi URL dan anon key
Supabase. Saat pengembangan, `?fakeauth=1` atau `?fakeauth=admin` memakai akun uji di memori.

## Cara kerja simulasi

```
sketch.ino ──POST /api/compile──▶ arduino-cli ──▶ .hex + peta alamat→baris (DWARF)
                                                   │
browser: avr8js (CPU, timer/PWM, ADC, USART, I²C, SPI, EEPROM)
           ⇅ kait port / baca PIN / ADC
         sim/netlist.js + sim/circuit.js — kabel, jalur breadboard, pemecah tegangan
           ⇅
         sim/devices*.js — perilaku tiap komponen (LED, servo, LCD, OLED, TFT, …)
```

## Struktur proyek

```
index.html · sandbox.html · gallery.html · admin.html
api/compile.js          Fungsi Vercel: kompilasi sketch
server/                 Pembungkus arduino-cli (cache, antrean, peta baris DWARF) + server mandiri
supabase/migrations/    Skema database dan kebijakan Row Level Security
src/
  lessons/              30 pelajaran
  components/           Spesifikasi 85 komponen sandbox (model, pin, props, perilaku)
  parts/                Model 3D yang dibangun dari kode (satuan: mm)
  sim/                  Penghubung emulator, netlist, pemecah tegangan, model perangkat, aturan panduan kabel
  sandbox/              Aplikasi sandbox, meja kerja, contoh, katalog
  account/              Masuk, proyek di akun, sinkron progres
  admin/                Halaman pengelola
  i18n/                 Teks Indonesia dan Inggris
tests/                  Tes node --test
```

## Dokumentasi

- **[Panduan pengembang](docs/PANDUAN-PENGEMBANG.md)**: cara kerja simulasi dan panduan kabel,
  deploy ke Vercel, menyiapkan akun, menambah pelajaran dan komponen.
- **[Riwayat pembaharuan](CHANGELOG.md)** — perubahan di setiap versi.

## Deploy

Proyek di-deploy ke Vercel sebagai situs statis plus satu fungsi (`api/compile.js`) yang membawa
toolchain Linux yang dirampingkan (± 200 MB, di bawah batas fungsi Vercel 250 MB).

```bash
npx vercel deploy --prod
```

Langkah menyiapkan akun (provider Google, migrasi database, variabel lingkungan) dijelaskan di
[panduan pengembang](docs/PANDUAN-PENGEMBANG.md#akun--data).

## Lisensi

Dirilis dengan [Lisensi MIT](LICENSE).

## Kredit

Desain terinspirasi dari [Learn Arduino](https://learn-arduino-red.vercel.app/) karya Dilum Sanjaya.
Kode, model 3D, dan teks pelajaran di repo ini ditulis ulang dari awal. Emulatornya adalah
[avr8js](https://github.com/wokwi/avr8js) karya Wokwi.
