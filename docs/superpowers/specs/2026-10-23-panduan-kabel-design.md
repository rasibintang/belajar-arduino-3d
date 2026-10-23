# Panduan kabel di sandbox — desain

Tanggal: 2026-10-23 · Status: menunggu persetujuan

## Maksud

Pemula di sandbox sering tahu komponen apa yang ingin dipakai, tetapi bingung **ke mana ujung
kabel harus disambungkan** (contoh nyata: `uno:D13 → bb:c8` pada proyek "LED + resistor").
Fitur ini memberi panduan saat menarik kabel dan memberi tahu bila kabel yang terpasang
belum tepat — beserta alasan dan saran letak yang benar — supaya pengguna belajar aturan
merakit, bukan sekadar menyalin.

## Tujuan

1. **Saat menarik kabel**, tujuan yang cocok untuk pin asal disorot, tujuan lain diredupkan, dan
   label pendek di dekat kursor menjelaskan ke mana sebaiknya (mis. "GND → pin GND atau rel −").
2. **Setelah kabel terpasang**, rangkaian diperiksa. Kabel yang belum tepat menyala dengan tanda
   **!**; mengeklik tanda itu memunculkan saran di dekat kabel (alasan + letak yang benar, dengan
   tombol "Pindahkan ke …" bila sarannya jelas satu titik).
3. **Daftar "Periksa rangkaian (n)"** di pojok meja mengumpulkan semua masalah; mengeklik satu baris
   menyorot kabel/komponen terkait. Tersembunyi bila tidak ada masalah.
4. Dua tingkat: **jingga = kurang tepat** (rangkaian bisa jalan tapi keliru/kurang baik),
   **merah = berbahaya** (mis. 5V langsung ke GND).

## Bukan tujuan

- Tidak ada mode "ikuti rangkaian contoh persis". Proyek dari menu Contoh atau dari pelajaran
  memakai aturan umum yang sama dengan merakit bebas.
- Tidak membangun kembali rangkaian secara otomatis (itu ide terpisah: integrasi AI).
- Tidak menilai kode sketch (mis. pin di kode tidak cocok dengan kabel) — hanya kabel & komponen.

## Anti-tujuan (gagal walau "berfungsi")

- **Melarang atau memblokir.** Kabel yang dinilai salah tetap boleh dipasang dan simulasi tetap boleh
  dijalankan. Sandbox tetap alat eksperimen, bukan kuis.
- **Berisik.** Menyorot hampir semua lubang breadboard, atau memberi peringatan untuk hal yang
  sebenarnya benar, membuat pengguna mengabaikan panduan. Lebih baik diam daripada salah.
- **Menghakimi rangkaian yang sedang dirakit setengah jalan** dengan daftar panjang "belum
  tersambung" — kabel yang belum dipasang bukan kesalahan.

## Sumber aturan

Aturan merakit dari dokumentasi resmi Arduino Uno dan datasheet tiap komponen (bukan ebook
tertentu). Aturan ditulis sebagai data (bukan tersebar di kode UI) agar mudah ditambah.

## Bagian yang sudah diputuskan

### Fungsi pin (dasar semua aturan)

Setiap titik sambung punya **fungsi**:

- **Pin komponen**: dari peran perilaku yang sudah ada di spesifikasi (`behavior.vcc`, `gnd`, `sda`,
  `scl`, `signal`, `data`, `trig`, `echo`, `clk`, `din`, `cs`, `mosi`, `miso`, …) dan bila perlu
  tambahan anotasi per spesifikasi. Kaki pasif (resistor, kaki LED, saklar) bersifat "netral".
- **Pin Arduino Uno**: 5V, 3V3, VIN, GND, digital D0–D13 (PWM ~3/5/6/9/10/11, interupsi D2/D3,
  Serial D0/D1, SPI D11/D12/D13), analog A0–A5 (I²C A4/A5).
- **Lubang breadboard**: fungsi dari jalurnya — rel +/− , atau kaki komponen yang tertancap di
  jalur yang sama (pakai netlist yang sudah ada di `sim/circuit.js`).

### Aturan rekomendasi (saat menarik) — contoh, bukan daftar lengkap

| Dari | Disarankan ke |
|---|---|
| GND modul / kaki − | GND Arduino, rel − |
| VCC / VDD / + modul 5 V | 5V Arduino, rel + (modul 3,3 V seperti RFID: 3V3) |
| SDA / SCL | A4 / A5 |
| MOSI/DIN, MISO/DO, SCK/CLK (SPI) | D11, D12, D13; CS ke pin digital (D10 umum) |
| Keluaran analog (wiper pot, LDR/NTC OUT, MQ2 AOUT, VRx/VRy, SIG) | A0–A5 |
| Sinyal servo | pin PWM (~) |
| CLK encoder / sinyal yang biasa pakai interrupt | D2 / D3 |
| Sinyal digital umum | D2–D13 (hindari D0/D1 yang dipakai Serial) |
| Dari pin Arduino | pin komponen yang fungsinya cocok (kebalikan tabel di atas) |

Bila pin asal netral (mis. kaki resistor) dan tidak ada tujuan yang jelas lebih baik, **jangan
menyorot**; tampilkan label singkat saja (atau tidak sama sekali).

**Jalur LED (keputusan pembangun desain ini, agar contoh pemicu `uno:D13 → bb:c8` terbantu):**
kaki resistor yang tersambung seri ke **anoda** LED dihitung sebagai "masukan LED". Pin digital/PWM
Arduino menyarankan jalur itu (pada contoh: jalur `c8`), dan sebaliknya. Anoda LED tanpa resistor
juga cocok tetapi akan diberi peringatan jingga setelah terpasang. Sisi katoda menyarankan GND.
Pola yang sama berlaku untuk modul LED, LED RGB, dan 7-segment.

Keputusan kecil lain (keputusan pembangun desain ini, boleh dikoreksi):
- Pin Arduino yang **sudah terpakai** tidak disorot sebagai tujuan, kecuali 5V/GND (boleh dipakai
  bersama).
- Bila banyak tujuan cocok (mis. 12 pin digital), semuanya disorot — yang disorot hanya pin
  header Arduino dan rel/jalur yang relevan, jadi tidak ramai.
- Ada sakelar **"Panduan kabel"** (bawaan: nyala) di bilah alat sandbox untuk pengguna yang sudah
  mahir; pilihannya diingat di browser.

### Aturan pemeriksaan (setelah terpasang) — contoh

- Merah: 5V/3V3/VIN tersambung langsung ke GND; VCC modul ke GND.
- Jingga: VCC/GND modul ke pin sinyal; SDA/SCL bukan di A4/A5; SPI bukan di D11–D13; keluaran
  analog di pin tanpa ADC; servo di pin non-PWM; LED tanpa resistor seri; memakai D0/D1;
  modul 3,3 V diberi 5V.
- Peringatan yang sudah ada di simulator (hubungan pendek, LED tanpa resistor, I²C/SPI salah pin)
  memakai aturan yang sama — satu sumber kebenaran.

### Tampilan (dipilih dari mockup)

- **Saat menarik**: sorot tujuan cocok (hijau), redupkan yang lain, label di dekat kursor.
- **Setelah terpasang**: kabel jingga/merah + tanda **!**; klik → saran di dekat kabel (+ tombol
  "Pindahkan ke …" bila ada satu tujuan yang jelas).
- **Daftar "Periksa rangkaian (n)"** di pojok meja kerja; klik baris → sorot kabel/komponen.

### Kapan diperiksa

Setiap kali kabel dipasang/dihapus, komponen ditambah/dihapus/dipindah/diputar, atau diagram
diterapkan dari `diagram.json`. Hanya di mode edit untuk sorotan saat menarik; tanda ! dan daftar
tetap terlihat saat simulasi berjalan.

### Bahasa

Semua label, saran, dan daftar tersedia dalam bahasa Indonesia dan Inggris (lewat `src/i18n`).

## Batasan

- Harus terasa instan: penilaian saat menarik kabel dihitung sekali saat kabel mulai ditarik,
  bukan per gerakan kursor; pemeriksaan rangkaian cukup cepat untuk breadboard 830 lubang.
- Tidak ada server/AI — semuanya aturan lokal di browser.
- Tidak mengubah format proyek (`diagram.json`) maupun perilaku simulasi.

## Diserahkan ke pembangun

- Bentuk data aturan dan letak berkasnya; cara memetakan peran perilaku ke fungsi pin; daftar
  aturan lengkap untuk 85 komponen (mengikuti prinsip di atas, utamakan sedikit tetapi tepat).
- Detail visual (warna persis, bentuk tanda !, posisi daftar agar tidak menutupi panel komponen),
  mengikuti gaya sandbox yang ada.
- Cara menyorot lubang breadboard yang cocok tanpa membuat meja ramai (mis. sorot seluruh jalur
  atau hanya lubang terdekat).
