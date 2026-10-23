# Panduan Kabel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sandbox menyorot tujuan kabel yang cocok saat menarik kabel dan menandai kabel yang belum tepat (tanda !, saran, daftar "Periksa rangkaian").

**Architecture:** Aturan murni (tanpa DOM/Three) di `src/sim/wiring/` bekerja atas *snapshot* rangkaian: daftar komponen, kabel, dan *net* (kelompok titik yang tersambung). Netlist yang kini ada di dalam `Circuit` dipisah ke `src/sim/netlist.js` agar dipakai bersama simulator dan panduan. Antarmuka (`src/sandbox/guide.js`) membangun snapshot dari meja kerja, menampilkan sorotan saat menarik kabel, dan menampilkan masalah setiap kali diagram berubah.

**Tech Stack:** JavaScript ES modules, Three.js, Vite; tes dengan `node --test` (bawaan Node 24, tanpa dependensi baru).

**Spec:** `docs/superpowers/specs/2026-10-23-panduan-kabel-design.md`

## Global Constraints

- Saran, bukan larangan: tidak ada kabel yang ditolak; simulasi tetap boleh dijalankan.
- Lebih baik diam daripada salah: pin "netral" tidak menghasilkan sorotan; pemeriksaan hanya menilai net yang memuat pin Arduino (atau simbol VCC/GND), jadi rangkaian setengah jadi tidak dihakimi.
- Dua bahasa: setiap teks baru punya kunci di `src/i18n/ui.js` untuk `id` dan `en`.
- Tanpa server/AI; format `diagram.json` dan perilaku simulasi tidak berubah.
- Rekomendasi dihitung sekali saat kabel mulai ditarik; pemeriksaan dihitung saat diagram berubah.
- Dua tingkat: `danger` (merah) dan `warn` (jingga).
- Sakelar "Panduan kabel" (bawaan nyala) diingat di `localStorage` kunci `la-wire-guide`.

## Review Focus

1. Bus bersama: perangkat I²C kedua harus tetap disarankan ke A4/A5 walau A4/A5 sudah terpakai; 5V/GND juga selalu boleh dipakai bersama → tes di Task 3.
2. Rangkaian setengah jadi (komponen belum tersambung ke Arduino) tidak boleh memunculkan masalah → tes di Task 4.
3. Kabel lewat breadboard (bukan langsung ke pin): masalah tetap terdeteksi, tetapi tanpa tombol "Pindahkan" → tes di Task 4.
4. Teks ID/EN lengkap untuk setiap fungsi pin & kode masalah → tes di Task 5 dan Task 6.
5. Komponen dipindah/diputar/dihapus atau diagram diterapkan dari `diagram.json` → tanda ! dan daftar diperbarui (dipicu `onChange`) → langkah verifikasi di Task 6.

---

### Task 1: Netlist terpisah + infrastruktur tes

**Files:**
- Create: `src/sim/netlist.js`
- Modify: `src/sim/circuit.js` (bagian `build()` sampai "grup statis" memakai `buildNetlist`)
- Modify: `package.json` (script `"test": "node --test tests/"`)
- Test: `tests/netlist.test.js`

**Interfaces:**
- Produces:
  - `connectNets({ parts, wires, inserted }) → { nodeGroup: Map<string, number>, groupNodes: string[][] }` — murni. `parts: [{ id, spec, pinIds: string[] }]`, `wires: [{ from, to }]`, `inserted: Map<legNode, holeNode>`. Menyatukan: kabel; lubang breadboard satu jalur (`spec.behavior.strip(pinId)`); kaki tertancap; alias papan `mcu` (`GND`=`GND.1`=`GND.2`, `SDA`=`A4`, `SCL`=`A5`, `5V`=`IOREF`); pasangan `behavior.always`.
  - `insertedLegs(parts) → Map<legNode, holeNode>` — memakai posisi dunia (logika SNAP 0,9 mm yang kini ada di `Circuit.build`).
  - `buildNetlist(parts, wires) → { nodeGroup, groupNodes, inserted, pinWorld: Map<string, Vector3> }` — `parts` = `[{ id, spec, group }]` seperti `wb.circuitParts()`.

- [ ] **Step 1: Tulis tes yang gagal** — `tests/netlist.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectNets } from '../src/sim/netlist.js';
import { COMPONENT_BY_TYPE } from '../src/components/index.js';

const P = (id, type, pinIds) => ({ id, spec: COMPONENT_BY_TYPE[type], pinIds });
const same = (r, a, b) => r.nodeGroup.get(a) === r.nodeGroup.get(b);

test('kabel, jalur breadboard, kaki tertancap, dan alias Uno disatukan', () => {
  const r = connectNets({
    parts: [P('uno', 'arduino-uno', ['D13', 'GND', 'GND.1', 'A4', 'SDA', '5V', 'IOREF']), P('bb', 'breadboard', ['a8', 'c8', 'f8', 'tn3', 'tn9']), P('r1', 'resistor', ['1', '2'])],
    wires: [{ from: 'uno:D13', to: 'bb:a8' }],
    inserted: new Map([['r1:1', 'bb:c8']]),
  });
  assert.ok(same(r, 'uno:D13', 'r1:1')); // kabel + jalur a–e + kaki
  assert.ok(!same(r, 'bb:c8', 'bb:f8')); // parit memisahkan a–e dan f–j
  assert.ok(same(r, 'bb:tn3', 'bb:tn9')); // rel
  assert.ok(same(r, 'uno:GND', 'uno:GND.1') && same(r, 'uno:A4', 'uno:SDA') && same(r, 'uno:5V', 'uno:IOREF'));
});
```

(Sesuaikan id pin resistor dengan `src/components/resistor.js` bila berbeda.)

- [ ] **Step 2: Jalankan, pastikan gagal** — Run: `npm test` · Expected: FAIL (`Cannot find module '../src/sim/netlist.js'`)
- [ ] **Step 3: Implementasikan `src/sim/netlist.js`** dengan memindahkan kode DSU, penyatuan, dan pencarian kaki tertancap dari `Circuit.build`; `Circuit.build` lalu memanggil `buildNetlist(this.parts, wires)` dan mengisi `this.pinWorld`, `this.inserted`, `this.nodeGroup`, `this.groupNodes`, `this.groupCount` dari hasilnya. Logika sumber tegangan Uno (`this.sources`) tetap di `Circuit`.
- [ ] **Step 4: Jalankan** — Run: `npm test` · Expected: PASS. Run: `npm run build` · Expected: `built`. Buka 3 contoh sandbox (LED + resistor, Tombol & LED, LCD) dan jalankan: perilaku sama seperti sebelumnya.
- [ ] **Step 5: Commit** — `git add src/sim/netlist.js src/sim/circuit.js package.json tests/netlist.test.js && git commit -m "Netlist terpisah dari Circuit + tes node"`

---

### Task 2: Fungsi pin

**Files:**
- Create: `src/sim/wiring/pin-functions.js`
- Modify: `src/components/spec.js` (`validateSpec`: setiap pin harus punya fungsi)
- Test: `tests/pin-functions.test.js`

**Interfaces:**
- Produces:
  - `PIN_FNS` — daftar string fungsi: `'gnd','vcc5','vcc33','pot-end','tie-gnd','i2c-sda','i2c-scl','spi-mosi','spi-miso','spi-sck','spi-cs','analog-out','pwm-in','interrupt-out','digital-in','digital-out','digital-io','led-anode','led-cathode','neutral','mcu-gnd','mcu-5v','mcu-3v3','mcu-vin','mcu-digital','mcu-analog','mcu-other','supply-5v','supply-gnd','hole','rail+','rail-'`.
  - `pinFunction(spec, pinId) → string` (salah satu `PIN_FNS`).
  - `mcuPinInfo(pinId) → { pwm: boolean, interrupt: boolean, serial: boolean, spi: 'mosi'|'miso'|'sck'|null, i2c: 'sda'|'scl'|null, analog: boolean, digital: boolean }` untuk pin Uno (`D0`…`A5`, alias `SDA`/`SCL`).

- [ ] **Step 1: Tulis tes yang gagal** — `tests/pin-functions.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pinFunction, mcuPinInfo } from '../src/sim/wiring/pin-functions.js';
import { COMPONENT_BY_TYPE as C } from '../src/components/index.js';

test('peran perilaku → fungsi', () => {
  assert.equal(pinFunction(C['oled-ssd1306'], 'SDA'), 'i2c-sda');
  assert.equal(pinFunction(C['oled-ssd1306'], 'GND'), 'gnd');
  assert.equal(pinFunction(C['rfid-mfrc522'], '3.3V'), 'vcc33');
  assert.equal(pinFunction(C['rfid-mfrc522'], 'MOSI'), 'spi-mosi');
  assert.equal(pinFunction(C['servo-sg90'], C['servo-sg90'].behavior.signal), 'pwm-in');
  assert.equal(pinFunction(C['potentiometer'], 'W'), 'analog-out');
  assert.equal(pinFunction(C['potentiometer'], '1'), 'pot-end');
  assert.equal(pinFunction(C['led'], 'A'), 'led-anode');
  assert.equal(pinFunction(C['led'], 'K'), 'led-cathode');
  assert.equal(pinFunction(C['resistor'], C['resistor'].behavior.a), 'neutral');
  assert.equal(pinFunction(C['rotary-encoder'], C['rotary-encoder'].behavior.clk), 'interrupt-out');
  assert.equal(pinFunction(C['a4988'], 'VMOT'), 'vcc5'); // cadangan dari nama pin
});
test('pin Uno, breadboard, simbol', () => {
  const U = C['arduino-uno'];
  assert.equal(pinFunction(U, 'GND.2'), 'mcu-gnd');
  assert.equal(pinFunction(U, 'D9'), 'mcu-digital');
  assert.equal(pinFunction(U, 'A0'), 'mcu-analog');
  assert.equal(pinFunction(C['breadboard'], 'tn4'), 'rail-');
  assert.equal(pinFunction(C['breadboard'], 'bp4'), 'rail+');
  assert.equal(pinFunction(C['breadboard'], 'c8'), 'hole');
  assert.equal(pinFunction(C['gnd'], 'GND'), 'supply-gnd');
  assert.deepEqual(mcuPinInfo('D11'), { pwm: true, interrupt: false, serial: false, spi: 'mosi', i2c: null, analog: false, digital: true });
  assert.equal(mcuPinInfo('SDA').i2c, 'sda');
});
```

- [ ] **Step 2: Jalankan, pastikan gagal** — Run: `npm test` · Expected: FAIL (module not found)
- [ ] **Step 3: Implementasikan `pinFunction`** sebagai tabel data per `behavior.kind` (peran → fungsi), lalu cadangan dari id pin, lalu `'neutral'`. Keputusan pemetaan (wajib diikuti):

| kind | peran → fungsi |
|---|---|
| `mcu` | GND* → `mcu-gnd`; 5V/IOREF → `mcu-5v`; 3V3 → `mcu-3v3`; VIN → `mcu-vin`; D0–D13 → `mcu-digital`; A0–A5/SDA/SCL → `mcu-analog`; lainnya → `mcu-other` |
| `breadboard` | tp/bp → `rail+`; tn/bn → `rail-`; lainnya → `hole` |
| `source` | pin dengan `volts: 0` → `supply-gnd`; lainnya → `supply-5v` |
| semua kind | `vcc`,`vdd` → `vcc5` (pin bernama `3.3V`/`3V3` → `vcc33`); `gnd`,`vss` → `gnd` |
| `i2c-lcd`,`i2c-rtc`,`oled`,`mpu6050`,`bmp180`,`ili9341` | `sda` → `i2c-sda`; `scl` → `i2c-scl` |
| `mfrc522`,`microsd`,`ili9341`,`epaper` | `mosi` → `spi-mosi`; `miso` → `spi-miso`; `sck` → `spi-sck`; `cs` → `spi-cs` |
| `pot`,`joystick` | `wiper`,`x`,`y` → `analog-out`; `end1`,`end2` → `pot-end` |
| `ntc` `out`, `mq2` `aout`, `mux16` `sig` | `analog-out` |
| `servo` | `signal` → `pwm-in` |
| `encoder` | `clk` → `interrupt-out`; `dt` → `digital-out` |
| `led` | `anode` → `led-anode`; `cathode` → `led-cathode` |
| `rgb-led` | `red`,`green`,`blue` → `led-anode`; `cathode` → `led-cathode` |
| `seg7` | `segments[]` → `led-anode`; `common` → `led-cathode` |
| `lcd-parallel` | `rw` → `tie-gnd`; `rs`,`e`,`inputs[]` → `digital-in` |
| keluaran modul ke Arduino: `pir.out`, `mq2.dout`, `hcsr04.echo`, `ir-receiver.dat`, `hx711.dt`, `gate.y`, `mux2.out`, `dff.q/notq`, `clock.clk`, `hc165.q7/notq7`, `epaper.busy`, `joystick.sw` | `digital-out` |
| dua arah: `dht.data`, `ds18b20.dq`, `tm1637.dio`, `keypad.rows[]/cols[]` | `digital-io` |
| masukan modul dari Arduino: `relay.signal`, `hcsr04.trig`, `hc595.data/shift/latch/oe/mr`, `ws2812.din`, `stepper.inputs[]`, `a4988.step/dir/enable/sleep/reset/ms[]`, `indicator.outputs[]`, `buzzer.plus`, `tm1637.clk`, `max7219.din/cs/clk`, `pcd8544.rst/ce/dc/din/clk`, `ili9341.dc/rst`, `epaper.dc/rst`, `mfrc522.rst`, `hx711.sck`, `gate.inputs[]`, `mux2.a/b/sel`, `dff.d/clk/set/reset`, `hc165.pl/cp/ce`, `mux16.select[]/en` | `digital-in` |
| `buzzer.minus`, `indicator.gnd`, `logic-analyzer.gnd` | `gnd` |
| cadangan id pin (bila tak ada peran): `VCC`,`VDD`,`VIN`,`VMOT`,`5V`,`+`,`V+`,`+5V` → `vcc5`; `3.3V`,`3V3` → `vcc33`; `GND`,`GND2`,`-`,`VSS` → `gnd` |
| lainnya (resistor, saklar, LDR, NPN, motor, dpdt, dip, kanal mux16, keluaran a4988/bipolar, dout ws2812, junction, …) | `neutral` |

- [ ] **Step 4: Tambahkan pemeriksaan ke `validateSpec`**: setiap pin hasil `resolvePins` harus menghasilkan nilai di `PIN_FNS` (pesan: `pin "<id>" tidak punya fungsi panduan kabel`).
- [ ] **Step 5: Jalankan** — Run: `npm test` · Expected: PASS. Buka `/gallery.html?dev` · Expected: semua 85 komponen ✓.
- [ ] **Step 6: Commit** — `git commit -m "Panduan kabel: fungsi setiap pin"`

---

### Task 3: Rekomendasi tujuan kabel

**Files:**
- Create: `src/sim/wiring/snapshot.js` (alat bantu murni: tipe & pencarian net)
- Create: `src/sim/wiring/recommend.js`
- Test: `tests/recommend.test.js`, `tests/helpers.js`

**Interfaces:**
- Consumes: `connectNets` (Task 1), `pinFunction`, `mcuPinInfo` (Task 2).
- Produces:
  - Snapshot: `{ parts: [{ id, type }], wires: [{ id, from, to }], nets: string[][], occupied: Set<string> }` — `occupied` = lubang breadboard yang berisi kaki atau ujung kabel.
  - `snapshotFromTopology({ parts: [{ id, type, pinIds }], wires: [{ id, from, to }], inserted: Map }) → Snapshot` (memakai `connectNets`).
  - `recommend(snapshot, fromNode) → { fn: string, targets: string[] }` — `fn` = fungsi titik asal (untuk lubang: fungsi terkuat di netnya; rel: `rail+`/`rail-`); `targets` = node tujuan yang disarankan.
- `tests/helpers.js`: `snap(parts, wires, inserted = [])` membangun snapshot dari `{ id: type }`, daftar kabel `[from, to]`, dan pasangan `[leg, hole]` (pinIds diambil dari daftar node yang disebut).

- [ ] **Step 1: Tulis tes yang gagal** — `tests/recommend.test.js` (nama tes & isi asersi wajib):

```js
test('GND modul → GND Arduino dan lubang kosong rel −', () => {
  const r = recommend(snap({ uno: 'arduino-uno', bb: 'breadboard', o: 'oled-ssd1306' }, []), 'o:GND');
  assert.equal(r.fn, 'gnd');
  assert.ok(r.targets.includes('uno:GND') && r.targets.includes('bb:tn5') && r.targets.includes('bb:bn5'));
  assert.ok(!r.targets.includes('uno:D13') && !r.targets.includes('bb:c5'));
});
test('SDA → A4; perangkat I²C kedua tetap disarankan ke A4 (bus bersama)', () => {
  const s = snap({ uno: 'arduino-uno', o: 'oled-ssd1306', r: 'rtc-ds3231' }, [['uno:A4', 'o:SDA']]);
  assert.ok(recommend(s, 'r:SDA').targets.includes('uno:A4'));
});
test('pin digital Arduino → jalur resistor yang menuju anoda LED (contoh D13 → bb:c8)', () => {
  const s = snap({ uno: 'arduino-uno', bb: 'breadboard', r1: 'resistor', led1: 'led' }, [], [['r1:1', 'bb:d8'], ['r1:2', 'bb:d12'], ['led1:A', 'bb:b12'], ['led1:K', 'bb:b13']]);
  const r = recommend(s, 'uno:D13');
  assert.ok(r.targets.includes('bb:c8'));
  assert.ok(!r.targets.includes('bb:d8')); // terisi kaki
  assert.ok(recommend(s, 'uno:GND').targets.includes('bb:a13')); // sisi katoda
});
test('pin digital yang sudah terpakai tidak disarankan; 5V/GND boleh bersama', () => {
  const s = snap({ uno: 'arduino-uno', p: 'pir-sensor', q: 'pir-sensor' }, [['uno:D2', 'p:OUT'], ['uno:5V', 'p:VCC']]);
  assert.ok(!recommend(s, 'q:OUT').targets.includes('uno:D2'));
  assert.ok(recommend(s, 'q:VCC').targets.includes('uno:5V'));
});
test('pin netral tanpa konteks → tanpa sorotan', () => {
  assert.deepEqual(recommend(snap({ uno: 'arduino-uno', r1: 'resistor' }, []), 'r1:1').targets, []);
});
test('servo → hanya pin PWM; encoder CLK → D2/D3; SPI MOSI → D11', () => {
  const s = snap({ uno: 'arduino-uno', sv: 'servo-sg90', e: 'rotary-encoder', rf: 'rfid-mfrc522' }, []);
  assert.deepEqual(recommend(s, 'sv:SIG').targets.filter((n) => n.startsWith('uno:')).sort(), ['uno:D10', 'uno:D11', 'uno:D3', 'uno:D5', 'uno:D6', 'uno:D9']);
  assert.deepEqual(recommend(s, 'e:CLK').targets.sort(), ['uno:D2', 'uno:D3']);
  assert.deepEqual(recommend(s, 'rf:MOSI').targets, ['uno:D11']);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal** — Run: `npm test` · Expected: FAIL.
- [ ] **Step 3: Implementasikan `recommend`.** Aturan tujuan per fungsi asal: `gnd`/`led-cathode`/`tie-gnd` → `mcu-gnd`, `supply-gnd`, lubang kosong `rail-` (dan lubang kosong di net berisi `led-cathode` bila asal adalah `mcu-gnd`); `vcc5`/`pot-end` → `mcu-5v`, `supply-5v`, `rail+` (`pot-end` juga GND); `vcc33` → `mcu-3v3`; `i2c-*` → A4/A5 (+ alias SDA/SCL); `spi-mosi/miso/sck` → D11/D12/D13; `spi-cs` → pin digital bebas D2–D10; `analog-out` → A0–A5 bebas; `pwm-in` → pin PWM bebas; `interrupt-out` → D2/D3 bebas; `digital-*`/`led-anode` → D2–D13 bebas. Dari pin Arduino: kebalikannya (pin komponen yang belum tersambung dengan fungsi cocok, plus lubang kosong di net "masukan LED": net berisi kaki resistor yang kaki lainnya satu net dengan `led-anode`). "Bebas" = net pin itu tidak memuat pin komponen lain; pengecualian: 5V/3V3/GND dan A4/A5 untuk I²C. D0/D1 tidak pernah disarankan. Fungsi `neutral`/`hole` kosong → `targets: []`.
- [ ] **Step 4: Jalankan** — Run: `npm test` · Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "Panduan kabel: rekomendasi tujuan"`

---

### Task 4: Pemeriksaan rangkaian

**Files:**
- Create: `src/sim/wiring/check.js`
- Test: `tests/check.test.js`

**Interfaces:**
- Consumes: Snapshot & helper (Task 3), `pinFunction`, `mcuPinInfo`.
- Produces:
  - `ISSUE_CODES = ['short','power-reversed','power-on-signal','vcc33-on-5v','i2c-pin','spi-pin','analog-pin','pwm-pin','serial-pin','led-resistor']`
  - `checkCircuit(snapshot) → Issue[]`, `Issue = { severity: 'danger'|'warn', code, net: number, nodes: [componentNode, mcuNode], fix?: { wireId: string, end: 'from'|'to', to: string } }`

- [ ] **Step 1: Tulis tes yang gagal** — satu tes per kode, ditambah:

```js
test('5V langsung ke GND → short (danger)', () => {
  const [i] = checkCircuit(snap({ uno: 'arduino-uno' }, [['uno:5V', 'uno:GND.1']]));
  assert.equal(i.code, 'short'); assert.equal(i.severity, 'danger');
});
test('SDA di A2 → i2c-pin dengan fix ke A4 lewat kabel yang sama', () => {
  const s = snap({ uno: 'arduino-uno', o: 'oled-ssd1306' }, [['o:SDA', 'uno:A2']]);
  const [i] = checkCircuit(s);
  assert.equal(i.code, 'i2c-pin'); assert.equal(i.severity, 'warn');
  assert.deepEqual(i.fix, { wireId: s.wires[0].id, end: 'to', to: 'uno:A4' });
});
test('rangkaian setengah jadi (tanpa pin Arduino di net) → tanpa masalah', () => {
  assert.deepEqual(checkCircuit(snap({ uno: 'arduino-uno', bb: 'breadboard', o: 'oled-ssd1306' }, [['o:SDA', 'bb:a3']])), []);
});
test('lewat breadboard → masalah terdeteksi tanpa fix', () => {
  const s = snap({ uno: 'arduino-uno', bb: 'breadboard', o: 'oled-ssd1306' }, [['o:SDA', 'bb:a3'], ['bb:b3', 'uno:A2']]);
  const [i] = checkCircuit(s);
  assert.equal(i.code, 'i2c-pin'); assert.equal(i.fix, undefined);
});
test('LED langsung D13 ke GND tanpa resistor → led-resistor (tanpa fix)', () => {
  const [i] = checkCircuit(snap({ uno: 'arduino-uno', led1: 'led' }, [['uno:D13', 'led1:A'], ['led1:K', 'uno:GND']]));
  assert.equal(i.code, 'led-resistor'); assert.equal(i.fix, undefined);
});
test('rangkaian contoh "LED + resistor" → tanpa masalah', () => {
  // sama dengan diagram contoh 'led' di src/sandbox/examples.js
  const s = snap({ uno: 'arduino-uno', bb: 'breadboard', r1: 'resistor', led1: 'led' }, [['uno:D13', 'bb:c8'], ['uno:GND.1', 'bb:a13']], [['r1:1', 'bb:d8'], ['r1:2', 'bb:d12'], ['led1:A', 'bb:b12'], ['led1:K', 'bb:b13']]);
  assert.deepEqual(checkCircuit(s), []);
});
test('servo di D2 → pwm-in dengan fix ke pin PWM bebas pertama (D3)', () => {
  const s = snap({ uno: 'arduino-uno', sv: 'servo-sg90' }, [['sv:SIG', 'uno:D2']]);
  const [i] = checkCircuit(s);
  assert.equal(i.code, 'pwm-pin'); assert.equal(i.fix.to, 'uno:D3');
});
```

- [ ] **Step 2: Jalankan, pastikan gagal** — Run: `npm test` · Expected: FAIL.
- [ ] **Step 3: Implementasikan `checkCircuit`.** Hanya net yang memuat `mcu-*` atau `supply-*` yang dinilai. Aturan: `short` (danger) = net berisi sumber daya (`mcu-5v|mcu-3v3|mcu-vin|supply-5v`) dan ground (`mcu-gnd|supply-gnd`); `power-reversed` (danger) = `vcc5|vcc33` di net ground, atau `gnd` modul di net sumber daya; `power-on-signal` = `vcc*|gnd` modul di net `mcu-digital|mcu-analog`; `vcc33-on-5v` = `vcc33` di net 5V; `i2c-pin` = `i2c-sda` di net Uno selain A4 (`i2c-scl` selain A5); `spi-pin` = `spi-mosi|miso|sck` di net Uno selain D11/D12/D13; `analog-pin` = `analog-out` di net `mcu-digital` tanpa `mcu-analog`; `pwm-pin` = `pwm-in` di net `mcu-digital` non-PWM; `serial-pin` = net pin komponen berisi D0/D1; `led-resistor` = `led-anode` satu net dengan pin digital/5V **dan** `led-cathode` satu net dengan ground (keduanya tanpa komponen di antaranya). `fix` hanya bila satu kabel langsung menghubungkan pin komponen dengan pin Uno; tujuan fix: A4/A5, D11/D12/D13, `5V`/`GND`/`3V3`, A0–A5 bebas pertama, pin PWM bebas pertama, D2+ bebas pertama; `short`/`led-resistor` tanpa fix.
- [ ] **Step 4: Jalankan** — Run: `npm test` · Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "Panduan kabel: pemeriksaan rangkaian"`

---

### Task 5: Sorotan saat menarik kabel

**Files:**
- Create: `src/sandbox/guide.js`
- Modify: `src/sandbox/workbench.js` (`onWiring(on, fromNode)`; `snapshot()` memakai `buildNetlist`; ekspor `pinWorld` sudah ada)
- Modify: `src/sandbox/main.js` (pasang panduan, sakelar di `.sb-toolbar`, label kursor)
- Modify: `sandbox.html` (tombol sakelar `#btn-guide`), `src/sandbox/sandbox.css`
- Modify: `src/i18n/ui.js` (kunci `guide.toggle`, `guide.hint.<fn>` untuk setiap fungsi kecuali `neutral`,`hole`,`mcu-other`)
- Test: `tests/i18n-guide.test.js`

**Interfaces:**
- Consumes: `recommend` (Task 3), `buildNetlist` (Task 1).
- Produces:
  - `wb.snapshot() → Snapshot` (dari `circuitParts()` + kabel; `occupied` dari `inserted` + ujung kabel di lubang).
  - `createGuide({ wb, stage, root, t }) → { startWiring(fromNode), stopWiring(), setEnabled(bool), enabled, labelText }` di `src/sandbox/guide.js`. Sorotan: `InstancedMesh` bola hijau (`#2fd27a`) di setiap target; bola abu tembus pandang di pin header Uno yang bukan target; semua dihapus saat `stopWiring`.

- [ ] **Step 1: Tulis tes yang gagal** — `tests/i18n-guide.test.js`: untuk setiap fungsi di `PIN_FNS` kecuali `neutral`,`hole`,`mcu-other`, `UI.id['guide.hint.'+fn]` dan `UI.en[...]` ada dan tidak kosong; `guide.toggle` ada di kedua bahasa.
- [ ] **Step 2: Jalankan, pastikan gagal** — Run: `npm test` · Expected: FAIL (kunci belum ada).
- [ ] **Step 3: Tambahkan kunci ke `src/i18n/ui.js`** (contoh nilai: `guide.hint.gnd` = `'GND → pin GND atau rel −'` / `'GND → a GND pin or the − rail'`; `guide.hint.mcu-digital` = `'Pin digital → masukan modul atau jalur resistor LED'`).
- [ ] **Step 4: Implementasikan `createGuide` dan sambungannya.** `workbench.startWiring` memanggil `hooks.onWiring(true, node)`; `main.js` memanggil `guide.startWiring(node)` bila sakelar nyala dan menampilkan `labelText` di elemen `#guide-label` yang mengikuti pointer (posisi dari `pointermove` di `#stage`, offset 16/18 px seperti tooltip). Sakelar `#btn-guide` (ikon `compass`, `aria-pressed`) menyimpan `la-wire-guide`.
- [ ] **Step 5: Verifikasi** — Run: `npm test` · Expected: PASS. Run: `npm run dev`, buka sandbox, contoh "LED + resistor": klik `uno:GND` → pin GND Uno & rel − menyala hijau, label tampil; klik `uno:D13` → jalur `c8` menyala; tambahkan OLED, klik SDA → A4 menyala. Matikan sakelar → tidak ada sorotan; muat ulang → sakelar tetap mati. Ganti ke EN → label berbahasa Inggris.
- [ ] **Step 6: Commit** — `git commit -m "Panduan kabel: sorotan tujuan saat menarik kabel"`

---

### Task 6: Tanda !, saran, daftar "Periksa rangkaian"

**Files:**
- Modify: `src/sandbox/guide.js` (`showIssues(issues)`)
- Modify: `src/sandbox/workbench.js` (`setWireState(id, 'ok'|'warn'|'danger')`, `moveWireEnd(wireId, end, toNode)`)
- Modify: `src/sandbox/main.js` (hitung ulang di `onChange`, popup saran, panel daftar, log ke Serial saat simulasi mulai)
- Modify: `sandbox.html` (`#guide-issues`), `src/sandbox/sandbox.css`
- Modify: `src/sim/devices.js`, `src/sim/devices-more.js`, `src/sim/devices-wave2.js`, `src/sim/devices-wave3.js` (hapus `ctx.warn` untuk `w.i2cPins`, `w.spiPins`, `w.misoPin`, `w.tftPins`, `w.sdPins` — kini dari pemeriksaan statis; perilaku attach tetap)
- Modify: `src/i18n/ui.js` (`guide.issue.<code>` untuk setiap `ISSUE_CODES`, `guide.panel`, `guide.fix`, `guide.empty`)
- Modify: `README.md`, `CHANGELOG.md` (bagian 0.7.0 "Panduan kabel")
- Test: `tests/i18n-guide.test.js` (tambah)

**Interfaces:**
- Consumes: `checkCircuit`, `ISSUE_CODES` (Task 4); `createGuide`, `wb.snapshot()` (Task 5).
- Produces: `guide.showIssues(issues: Issue[])`; `wb.setWireState(id, state)`; `wb.moveWireEnd(wireId, end, toNode) → wire`.

- [ ] **Step 1: Tulis tes yang gagal** — setiap `ISSUE_CODES` punya `guide.issue.<code>` di `id` & `en`; teks memakai `{pin}`, `{target}`, dan (bila ada fix) `{suggest}`; `guide.panel` memakai `{n}`.
- [ ] **Step 2: Jalankan, pastikan gagal** — Run: `npm test` · Expected: FAIL.
- [ ] **Step 3: Tambahkan kunci teks** (contoh: `guide.issue.i2c-pin` = `'{pin} sebaiknya ke {suggest}, bukan {target} — I²C di Uno hanya di A4/A5.'`; `guide.panel` = `'Periksa rangkaian ({n})'`; `guide.fix` = `'Pindahkan ke {suggest}'`).
- [ ] **Step 4: Implementasikan tampilan.** Kabel di net masalah: emisif jingga `#f0a020` (warn) / merah `#d9473c` (danger), lewat `setWireState`. Tanda **!**: elemen DOM bulat di titik tengah kabel, diposisikan tiap frame dengan `stage.project(Vector3)`; klik → popup saran (teks + tombol `guide.fix` bila `issue.fix`, yang memanggil `moveWireEnd`). Panel `#guide-issues` di pojok kanan bawah meja, judul `guide.panel`, satu baris per masalah (warna sesuai tingkat); klik baris → `wb.select({ kind: 'wire', id })` pada kabel pertama di net itu dan kamera fokus. Panel tersembunyi bila 0 masalah. Dihitung ulang di `onChange` dan setelah `loadDiagram`; saat simulasi mulai, setiap masalah ditulis ke Serial Monitor dengan `serial.warn`.
- [ ] **Step 5: Verifikasi** — Run: `npm test` · Expected: PASS. Run: `npm run build` · Expected: `built`. Di sandbox: sambungkan SDA OLED ke A2 → kabel jingga + !, panel "Periksa rangkaian (1)"; klik ! → saran + "Pindahkan ke A4" → kabel pindah, panel hilang. Sambungkan 5V ke GND → merah. Pindah/putar komponen, hapus kabel, terapkan `diagram.json` → tanda & panel ikut diperbarui. Jalankan semua contoh sandbox: tidak ada masalah palsu pada contoh yang benar (catat bila ada, perbaiki aturan atau contohnya).
- [ ] **Step 6: Perbarui README (bagian Sandbox) dan CHANGELOG 0.7.0, lalu commit** — `git commit -m "Panduan kabel: tanda !, saran, daftar Periksa rangkaian"`
