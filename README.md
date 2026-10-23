# Learn Arduino

Kursus Arduino interaktif dengan papan 3D — 30 pelajaran (Dasar, Menengah, Mahir) — plus
**sandbox** untuk merakit rangkaian sendiri seperti Wokwi: kode C++ sungguhan dikompilasi
oleh `arduino-cli` lalu dijalankan emulator ATmega328P (`avr8js`) di browser.
Dibangun dengan **Vite + Three.js** (JavaScript biasa, tanpa framework UI). Tersedia dalam
**bahasa Indonesia dan Inggris** (tombol ID / EN di setiap halaman).

Desain terinspirasi dari [Learn Arduino](https://learn-arduino-red.vercel.app/) karya Dilum Sanjaya.
Kode, model 3D, dan teks pelajaran di repo ini ditulis ulang dari awal.

**Versi terbaru: 0.6.0** — lihat [Riwayat pembaharuan](#riwayat-pembaharuan) atau [CHANGELOG.md](CHANGELOG.md).

| Halaman | Isi |
|---|---|
| `/` | 30 pelajaran interaktif (Dasar, Menengah, Mahir) |
| `/sandbox.html` | Rakit rangkaian sendiri + kode C++ sungguhan di emulator |
| `/gallery.html` | Katalog 85 komponen: pin, pengaturan, coba di sandbox |

## Menjalankan

```bash
npm install
npm run setup:arduino   # sekali saja: unduh arduino-cli + core AVR + library ke tools/
npm test                # tes aturan panduan kabel & netlist (node --test)
npm run dev             # http://localhost:5173  (pelajaran)  ·  /sandbox.html  ·  /gallery.html (katalog)
npm run build           # hasil di dist/
```

Saat `npm run dev`, endpoint kompilasi `/api/compile` langsung tersedia (middleware Vite).
Tanpa `setup:arduino`, pelajaran tetap jalan (simulasi bawaan), tetapi tombol Run di sandbox
akan melaporkan bahwa server kompilasi belum terpasang.

## Sandbox (`sandbox.html`)

- Kiri: `sketch.ino` (editor dengan penanda error compiler dan sorotan baris yang sedang jalan),
  `diagram.json`, daftar library. Kanan: meja kerja 3D + Serial Monitor dua arah.
- **+** membuka katalog komponen (85 komponen, 10 kategori). Seret komponen; komponen
  breadboard otomatis menancap ke lubang. Klik pin → klik pin lain = kabel. Pilih kabel lalu seret
  titik oranye di ujungnya untuk memindahkan ujung itu. `R` putar, `Delete` hapus.
- 38 contoh proyek. Disimpan otomatis di browser; **Unduh/Buka** file `.json`; **Bagikan** = tautan
  berisi seluruh proyek (dikompres di hash URL).
- Setiap pelajaran punya tombol **Buka di sandbox** (kecuali H-bridge & robot): rangkaian setara
  dari komponen standar + kode pelajaran dengan parameter terpilih.
- **Panduan kabel** (tombol kompas, bisa dimatikan): saat menarik kabel, tujuan yang cocok menyala
  hijau dengan label singkat (mis. *SDA → A4*, *pin digital → jalur resistor LED*). Kabel yang
  belum tepat menyala jingga (kurang tepat) atau merah (berbahaya) dengan tanda **!** berisi saran
  dan tombol **Pindahkan ke …**; semua masalah terkumpul di daftar **Periksa rangkaian (n)**.
  Tidak pernah memblokir — kabel tetap boleh dipasang dan simulasi tetap jalan.

### Panduan kabel (`src/sim/wiring/`)

Aturan ditulis sebagai data, dari dokumentasi Arduino Uno dan datasheet komponen:

- `pin-functions.js` — fungsi setiap pin (`gnd`, `vcc5`, `i2c-sda`, `pwm-in`, `led-anode`, …)
  dari peran `behavior` spesifikasi komponen; pin Uno (PWM ~3/5/6/9/10/11, interupsi D2/D3,
  Serial D0/D1, SPI D11–D13, I²C A4/A5); lubang breadboard (lubang/rel ±).
- `recommend.js` — tujuan yang disarankan saat menarik kabel (dihitung sekali per tarikan).
- `check.js` — pemeriksaan setelah terpasang: hubungan pendek, daya terbalik, daya di pin sinyal,
  modul 3,3 V diberi 5V, I²C/SPI/analog/PWM di pin yang salah, D0/D1, LED tanpa resistor. Hanya
  net yang tersambung ke Arduino yang dinilai, jadi rangkaian setengah jadi tidak dihakimi.
- Komponen baru otomatis ikut bila perannya memakai nama yang sudah dikenal; `validateSpec`
  memastikan setiap pin punya fungsi.
- Tes: `npm test` (`node --test`, tanpa dependensi tambahan).

### Cara kerja simulasi

```
sketch.ino ──POST /api/compile──▶ arduino-cli ──▶ .hex + peta alamat→baris (DWARF)
                                                   │
browser: avr8js (CPU, timer/PWM, ADC, USART, I²C, EEPROM)
           ⇅ kait port / baca PIN / ADC
         sim/circuit.js — netlist (kabel, jalur breadboard, kaki tertancap)
                          + pemecah tegangan (sumber kuat, jaringan resistor/Millman, saklar)
           ⇅
         sim/devices*.js — perilaku tiap komponen (LED, servo, LCD HD44780, DHT11, WS2812, …)
```

## Katalog komponen (`gallery.html`)

Semua komponen di satu meja 3D: cari, saring per kategori, lihat pin & pengaturannya, lalu
**Coba di sandbox** (Arduino + komponen itu langsung terpasang). `?dev` menampilkan hasil
`validateSpec()`, tipe, dan perilaku tiap komponen (untuk pengembang).

## Dua bahasa (`src/i18n/`)

- Teks sumber ditulis dalam bahasa Indonesia; bahasa Inggris berupa *overlay*:
  `ui.js` (teks antarmuka, dipakai lewat `t('kunci')` / atribut `data-i18n`),
  `en/lessons-*.js` (pelajaran, termasuk kode & teks Serial/LCD simulasinya),
  `en/parts.js` (nama/keterangan model 3D, spesifikasi komponen, pin),
  `en/examples.js` (contoh sandbox), `en/catalog.js` (menu Komponen).
- Bahasa: `?lang=en` → pilihan tersimpan → bahasa browser. Mengganti bahasa memuat ulang halaman.
- Mode dev mencatat teks yang belum diterjemahkan di `globalThis.__i18nMissing` (console browser).

## Deploy

### Semua di Vercel (frontend + fungsi kompilasi)

`vercel.json` sudah disiapkan: `npm run vercel-build` memasang toolchain Linux
(`arduino-cli` 1.5.1, core `arduino:avr@1.8.8`, semua library) ke `.vercel-toolchain/`,
merampingkannya dengan `scripts/slim-toolchain.mjs` (± 490 MB → ± 200 MB: hanya multilib
`avr5` untuk ATmega328P, tanpa contoh/dokumentasi library), lalu membangun situs.
Fungsi `api/compile.js` membawa toolchain itu (`includeFiles`) dan menulis semua berkas
sementara ke `/tmp`.

```bash
npm i -g vercel
vercel          # pratinjau
vercel --prod   # produksi
```

Catatan: kompilasi pertama setelah fungsi lama tidak dipakai (cold start) bisa beberapa detik
lebih lama; batas fungsi Vercel 250 MB (toolchain ramping ± 200 MB).

### Server kompilasi terpisah (alternatif)

Bila tidak memakai fungsi Vercel, jalankan server kompilasi sendiri (VPS kecil / kontainer):

```bash
docker build -t learn-arduino-compiler .
docker run -p 8787:8787 -e CORS_ORIGIN=https://situsmu.vercel.app learn-arduino-compiler
# lalu build frontend dengan alamatnya:
VITE_COMPILE_URL=https://compiler.situsmu.com/api/compile npm run build
```

Uji perampingan secara lokal: `TOOLS_DIR=.slimtest/tools` setelah menyalin `tools/` ke sana dan
menjalankan `node scripts/slim-toolchain.mjs .slimtest/tools`.

Keamanan: server menolak `#include` dengan path absolut atau `..`, membatasi ukuran sketch
(100 KB) dan waktu kompilasi (90 detik), mengompilasi satu per satu, dan menyimpan cache
hasil. Jalankan di kontainer sebagai pengguna biasa (sudah diatur di `Dockerfile`).

## Struktur

```
index.html sandbox.html gallery.html   Tiga halaman (pelajaran, sandbox, katalog)
api/compile.js          Fungsi Vercel: kompilasi sketch
server/
  compile.mjs           Kompilasi dengan arduino-cli (cache, antrean, peta baris DWARF)
  compile-server.mjs    Server kompilasi mandiri (Docker / VPS)
scripts/
  setup-arduino.mjs     Pasang arduino-cli + core AVR + library
  slim-toolchain.mjs    Rampingkan toolchain untuk serverless
src/
  main.js               Halaman pelajaran: memuat pelajaran, parameter, Run/Stop, keyboard
  core/                 stage.js (renderer, hover/klik/seret), rig.js (kamera), toon.js (garis tepi), tween.js
  parts/                Model 3D dari kode (satuan: mm): arduino, breadboard, LED, sensor, layar, …
  lessons/              30 pelajaran (Dasar di akar, intermediate/, expert/) + kit.js + helpers.js
  components/           Spesifikasi 85 komponen sandbox (model + pin + props + perilaku)
  sim/
    avr.js              Emulator ATmega328P (avr8js) + bus I²C & SPI
    netlist.js          Netlist: kabel, jalur breadboard, kaki tertancap (dipakai simulasi & panduan kabel)
    circuit.js          Pemecah tegangan rangkaian
    wiring/             Panduan kabel: fungsi pin, rekomendasi tujuan, pemeriksaan rangkaian
    devices*.js         Perilaku tiap komponen (LED, servo, LCD, OLED, TFT, kartu SD, …)
    runner.js           Simulasi JS untuk pelajaran
  sandbox/              Sandbox (main, workbench, sim, guide, contoh proyek) & katalog (gallery.js)
  i18n/                 Dua bahasa: ui.js (antarmuka) + en/ (pelajaran, komponen, contoh)
  ui/                   Panel info, kartu kode, callout, inspektor, strip, sidebar, ikon
  data/catalog.js       Daftar di menu "Komponen"
  styles/app.css
```

## Level & pelajaran

| Level | Pelajaran |
|---|---|
| **Dasar** (11) | Kenali papan · Kedipkan LED · Tekan tombol · Putar kenop · Campur warna · Rasakan cahaya · Ukur jarak · Bunyikan nada · Putar motor · Gerakkan servo · Sensor parkir |
| **Menengah** (10) | Tanpa delay() · Redam pantulan · Layar LCD · Suhu & lembap · Fungsi & array · Shift register · Keypad & kunci · Joystick · Relay & lampu · Proyek: termostat |
| **Mahir** (9) | Interrupt · Motor stepper · Motor dua arah (L298N) · Perintah Serial · Jam real-time · Simpan data (EEPROM) · LED NeoPixel · State machine · Proyek: robot penghindar |

Level didefinisikan di `src/lessons/index.js` (`LEVELS`). Pelajaran Menengah ada di
`src/lessons/intermediate/`, Mahir di `src/lessons/expert/`.

Fitur simulasi tambahan yang bisa dipakai pelajaran:

- `io.state` — keadaan perangkat yang dibaca `update()` (teks LCD, piksel NeoPixel, dll.);
  helper `lcdPrint()` / `showLCD()` ada di `src/lessons/helpers.js`.
- `serialInput: ['perintah', …]` — Serial Monitor dua arah; sketch memakai `io.available()` dan `io.readLine()`.
- `io.read(nama)` — nilai bebas dari `lesson.read()` (mis. tombol keypad).
- `quietPins`, `logPwm` — atur apa yang dicatat otomatis di Serial Monitor; `io.log()` untuk pesan sendiri.
- Tombol RESET merah di papan memulai ulang sketch (`runner.restart()`); EEPROM simulasi tetap tersimpan.

## Menambah pelajaran

1. Salin salah satu file di `src/lessons/` (mis. `02-blink.js`) menjadi file baru.
2. Ubah isinya:
   - `build(kit, api)` — rakit rangkaian: `kit.board()`, `kit.breadboard()`,
     `kit.place('led', createLED(), kit.hole('b', 13), kit.hole('b', 12))`,
     `kit.wire(kit.pin('D13'), kit.hole('c', 8), 'orange')`.
   - `params` — pengaturan yang muncul saat komponen diklik (`swatch`, `choice`, `range`).
   - `code` — kode Arduino; `{{nama}}` diganti nilai parameter.
   - `sketch` — versi JavaScript dari kode itu. `yield 1000` = `delay(1000)`.
   - `update(view, parts)` — ubah tampilan 3D dari keadaan pin (`view.pins[13]`, dll.).
   - `read(pin, view)` — nilai untuk `digitalRead`/`analogRead`/`pulseIn`.
   - `callouts`, `summary`, `features`, `explain`, `pinout`, `specs` — teks panel.
3. Daftarkan di level yang sesuai pada `LEVELS` di `src/lessons/index.js`.
4. Tambahkan terjemahan Inggris di `src/i18n/en/lessons-*.js` (kunci = `id` pelajaran): teks panel,
   kode bila ada komentar/teks, dan `phrases` untuk teks Serial/LCD yang dicetak simulasi.

## Membuat komponen baru

Setiap komponen adalah satu fungsi yang mengembalikan `THREE.Group`:

- Patokan: permukaan breadboard = `y 0`, kaki berjajar di sumbu X lokal (jarak 2,54 mm)
  dan menembus sampai `y -1,5`.
- Simpan fungsi kendali di `userData` (`setLevel`, `setAngle`, …) dan titik callout di
  `userData.anchor`.
- Tandai dengan `markPart(group, { key, name, desc })` agar bisa di-hover/diklik.
- Interaksi opsional: `userData.press(bool)` (tekan-tahan), `userData.knob` (putar),
  `userData.drag` (seret di lantai).
- Objek cahaya/efek: bungkus dengan `noOutline()` agar tidak diberi garis tepi.

## Standar komponen (untuk sandbox)

Folder `src/components/` berisi **spesifikasi** komponen: satu file per komponen yang
menyatukan model 3D (`src/parts/`), daftar pin, props yang bisa diatur, dan perilaku
listriknya (sebagai data). Format lengkapnya dijelaskan di `src/components/spec.js`.

```js
export default {
  type: 'led', name: 'LED 5 mm', category: 'output', icon: 'led',
  surface: 'breadboard',                 // kaki ditancapkan ke lubang (atau 'floor')
  create: (props) => createLED({ color: props.color }),
  props: [{ key: 'color', label: 'Warna', type: 'swatch', value: 'red', options: [...] }],
  pins: legsAlongX([['K', 'Katoda (−)'], ['A', 'Anoda (+)']]),
  behavior: { kind: 'led', anode: 'A', cathode: 'K' },
};
```

- Daftarkan di `src/components/index.js`.
- Perilaku listriknya (`behavior.kind`) dijalankan oleh `src/sim/devices*.js`
  (didaftarkan di `FACTORIES` pada `devices.js`): satu fungsi per jenis, memakai `ctx.resistor`, `ctx.switch`, `ctx.drive`,
  `ctx.watch` (tepi sinyal dengan stempel siklus CPU), `ctx.volts`, `ctx.schedule`.
- Buka **http://localhost:5173/gallery.html?dev** untuk melihat semua komponen beserta titik
  pinnya, dan hasil `validateSpec()` (pin di kisi 2,54 mm, peran perilaku menunjuk pin yang ada, dll.).
- Tambahkan terjemahan Inggris nama/keterangan/pin di `src/i18n/en/parts.js`.
- Komponen tersedia (85):
  - Papan & breadboard: Arduino Uno R3; breadboard full, half, dan mini.
  - Dasar: resistor, transistor TIP120, 74HC595, driver LED RGB NLSF595.
  - Output: LED, LED RGB, modul 8 LED, lampu lalu lintas, buzzer, relay modul & DPDT, NeoPixel (ring/tunggal/strip).
  - Input: push button (6 warna) & 6 mm, saklar geser, DIP switch 8, potensiometer putar & geser, joystick,
    keypad 4×4, rotary encoder, remote IR.
  - Sensor: LDR, NTC, PIR, MQ2, HC-SR04, DHT11/DHT22, RTC DS3231/DS1307, MPU6050, BMP180, DS18B20,
    HX711 + load cell, penerima IR, RFID MFRC522.
  - Tampilan: 7-segment 1 & 4 digit, LCD 16×2/20×4 (I²C dan paralel), NeoPixel matrix 8×8 & bar 10,
    OLED SSD1306 128×64 & SH1107 128×128, LCD Nokia 5110, TM1637, matriks MAX7219 (1/2/4 modul),
    TFT ILI9341 240×320 (± layar sentuh FT6206), e-Paper 2,9".
  - Motor: servo SG90, motor DC, stepper 28BYJ-48 + ULN2003, NEMA 17, stepper biaxial, driver A4988.
  - Logika: gerbang NOT/AND/OR/XOR/NAND/NOR/XNOR, MUX 2:1, flip-flop D (+R, +S/R), generator clock,
    74HC165, CD74HC4067, logic analyzer 8 kanal.
  - Lain-lain: simbol VCC/GND, junction, teks, kartu microSD 32 MB (FAT16).
- Bus yang diemulasikan: I²C (TWI), SPI perangkat keras (D11/D12/D13) maupun bit-bang, OneWire, protokol 2 kabel TM1637, NEC IR, kartu SD mode SPI.

## Animasi

- `core/tween.js` — mesin animasi kecil (`Tweens`, `Ease.outBack`, dll.).
- Ganti pelajaran (`stage.setContent(root, { animate: true })`): komponen lama mengecil,
  papan & breadboard bergeser, komponen baru jatuh satu per satu, kabel tergambar bertahap.
- Kamera: `rig.animateTo()`, `rig.focusPoint()`; klik ganda komponen = fokus, klik ganda kosong = reset.
- Hover mengangkat komponen; komponen terpilih diberi cincin di lantai (`stage.select`).
- Sketch menandai baris kode yang sedang berjalan dengan `io.mark('teks baris')`.
- Pengaturan "Kurangi animasi" mempercepat semua animasi (`stage.setMotion`).

## Kualitas gambar

- Selalu dirender minimal 1,5× resolusi layar (supersampling) — tepi lebih halus.
- `box()` otomatis memberi sudut tumpul (RoundedBoxGeometry, di-cache); `radius: 0` untuk tajam.
- Garis tepi (`core/toon.js`): pasangan tetangga + turunan kedua kedalaman, jadi bidang miring tidak bergaris.

## Pintasan

- Pelajaran: WASD geser · Q/E putar · +/− zoom · R reset kamera · Spasi jalankan · `[` `]` pindah pelajaran · Esc tutup panel
- Sandbox: Ctrl+Enter jalankan/hentikan · A tambah komponen · R putar · Delete hapus · Esc batal

## Riwayat pembaharuan

Rincian lengkap ada di [CHANGELOG.md](CHANGELOG.md).

| Versi | Tanggal | Isi utama |
|---|---|---|
| **0.6.0** | 2026-10-23 | Dua bahasa (Indonesia/Inggris), katalog komponen, tombol Sandbox & Katalog di halaman utama, persiapan deploy penuh di Vercel |
| 0.5.0 | 2026-10-23 | TFT ILI9341 (+ layar sentuh), e-Paper, kartu microSD, NLSF595 — total 85 komponen; komponen ikut saat breadboard dipindah |
| 0.4.0 | 2026-10-23 | Bus SPI; OLED, Nokia 5110, TM1637, MAX7219, logic analyzer, MPU6050, BMP180, DS18B20, HX711, IR, RFID — total 80 |
| 0.3.0 | 2026-10-23 | 41 komponen ala Wokwi (breadboard, input, sensor, LCD, NeoPixel, logika, motor) — total 67 |
| 0.2.0 | 2026-10-22 | Sandbox: editor rangkaian 3D, emulator ATmega328P, kompilasi `arduino-cli`, 26 komponen |
| 0.1.0 | 2026-10-22 | Kursus Arduino 3D: 30 pelajaran (Dasar, Menengah, Mahir) |
