# Learn Arduino

Kursus Arduino interaktif dengan papan 3D: 11 pelajaran dasar, rangkaian yang bisa diklik
dan diseret, kode yang bisa diubah, simulasi `setup()`/`loop()`, serta Serial Monitor.
Dibangun dengan **Vite + Three.js** (JavaScript biasa, tanpa framework UI).

Desain terinspirasi dari [Learn Arduino](https://learn-arduino-red.vercel.app/) karya Dilum Sanjaya.
Kode, model 3D, dan teks pelajaran di repo ini ditulis ulang dari awal.

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # hasil di dist/ — bisa langsung di-deploy ke Vercel/Netlify
```

## Struktur

```
src/
  main.js               Menyatukan semuanya: memuat pelajaran, parameter, Run/Stop, keyboard
  core/
    stage.js            Renderer, cahaya, bayangan, klik/hover/seret komponen
    rig.js              Kamera isometrik: geser, putar 45°, zoom, bingkai otomatis
    toon.js             Garis tepi gaya ilustrasi (deteksi tepi dari normal + depth)
  parts/                Model 3D, semuanya dibuat dari kode (satuan: mm)
    lib.js              Helper: box, cyl, rod, bentRod, canvasTexture, glowSprite, …
    arduino.js          Arduino Uno R3 (posisi pin akurat)
    breadboard.js       Breadboard 400 lubang; hole('c', 12) -> posisi lubang
    wire.js             Kabel jumper melengkung
    led.js resistor.js button.js potentiometer.js rgbled.js ldr.js lamp.js
    ultrasonic.js buzzer.js transistor.js motor.js servo.js trafficlight.js obstacles.js
  lessons/
    index.js            Daftar pelajaran + pengisi template kode
    kit.js              Alat bantu merakit: board(), breadboard(), place(), wire()
    01-board.js … 11-project.js
  sim/
    runner.js           Menjalankan sketch (generator JS) dengan waktu simulasi
    audio.js            Bunyi buzzer (Web Audio)
  ui/                   Panel info, kartu kode, callout, inspektor, strip, sidebar, dll.
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
- Buka **http://localhost:5173/gallery.html** untuk melihat semua komponen beserta titik
  pinnya, dan hasil `validateSpec()` (pin di kisi 2,54 mm, peran perilaku menunjuk pin yang ada, dll.).
- Komponen tersedia: Arduino Uno, breadboard, LED, resistor, push button, potensiometer,
  buzzer, servo SG90, LCD 16×2 I²C, HC-SR04.

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

WASD geser · Q/E putar · +/− zoom · R reset kamera · Spasi jalankan · `[` `]` pindah pelajaran · Esc tutup panel
