# AI penyusun rangkaian — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pengguna yang login menulis perintah ("monitoring kelembapan tanah otomatis"), lalu AI (Claude) menyusun atau mengubah rangkaian sandbox beserta sketch-nya. Hasilnya dikompilasi dan diperiksa kabelnya di server, ditampilkan sebagai pratinjau, lalu diterima (proyek baru / perubahan langsung dengan "Urungkan") atau ditolak.

**Architecture:** AI hanya menghasilkan rangkaian *logis* (komponen dari katalog + sambungan pin-ke-pin + sketch) lewat structured output. Semua yang bersifat fisik dihitung kode kita, sama di server dan browser: katalog komponen yang dibaca tanpa model 3D, validasi, tata letak breadboard dengan matematika kisi, dan pemeriksaan kabel (`checkCircuit`). Fungsi server `api/ai.js` memeriksa login & jatah (Supabase service role), memanggil Claude, memvalidasi + mengompilasi (`/api/compile`) + memeriksa, memperbaiki sekali bila gagal, lalu mencatat pemakaian/laporan.

**Tech Stack:** `@anthropic-ai/sdk` (server saja), Claude `claude-opus-5-5` (default; `ANTHROPIC_MODEL` bisa mengganti), structured outputs (`output_config.format` JSON schema), `@supabase/supabase-js` (server, service role), modul `src/sim/wiring/*` yang sudah ada, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-23-ai-penyusun-rangkaian-design.md`

## Global Constraints

- Kunci rahasia hanya di server (variabel Vercel tanpa awalan `VITE_`): `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`. Tidak ada kode di `src/` yang membacanya; tidak ada kunci di repo, tes, log, atau memori.
- Tanpa `ANTHROPIC_API_KEY` (atau tanpa service role): `/api/ai` menjawab `{ ok: false, code: 'not-enabled' }` dan UI menampilkan "fitur AI belum diaktifkan" — tanpa error.
- Hanya untuk pengguna login (token Supabase di header `Authorization: Bearer`). Batas: `settings.ai_daily_limit` per pengguna per hari (UTC), pengelola (tabel `admins`) tanpa batas. **Permintaan yang gagal tidak mengurangi jatah** (dicatat `ai_usage.ok = false`).
- AI tidak boleh mengarang komponen/pin: setiap `type` harus ada di registri, setiap pin harus ada pada komponen itu; selain itu hasil ditolak/diperbaiki.
- Tidak menampilkan rangkaian/kode yang tidak jalan seolah benar: pratinjau hanya bila sketch terkompilasi dan tidak ada masalah kabel `danger`; masalah `warn` ditampilkan apa adanya.
- Perbaikan otomatis **paling banyak sekali**; fungsi server selesai < 60 dtk (`maxDuration` 60): perbaikan dilewati bila waktu terpakai > 30 dtk.
- Model default `claude-opus-5-5`, `output_config.effort` default `medium` (env `ANTHROPIC_EFFORT`), `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) bila SDK menerimanya bersama structured outputs; periksa `stop_reason` (`refusal`, `max_tokens`) sebelum memakai hasil.
- Katalog di prompt dibangkitkan dari registri komponen (nama, keterangan, pin + fungsi, props), deterministik, ditaruh di awal prompt dengan `cache_control` agar bisa di-cache.
- Penjelasan AI mengikuti bahasa situs (`lang`); semua teks UI baru punya kunci ID & EN.
- Tes: `npm test`, tanpa jaringan (klien Claude dan Supabase disuntik/tiruan).

## Review Focus

1. Keluaran AI berisi `type` atau pin yang tidak ada, sambungan ke komponen yang tidak dideklarasikan, atau props di luar pilihan → ditangkap validasi, diperbaiki sekali, lalu gagal dengan pesan jelas (Task 2, Task 5).
2. Tata letak breadboard menyambungkan dua kaki yang seharusnya terpisah (jalur bersama) atau gagal menancap → koneksi hasil tata letak harus identik dengan koneksi logis AI; diuji di Node dan dicocokkan dengan sandbox sungguhan (Task 3).
3. Kegagalan (Claude error/refusal/timeout, kompilasi gagal dua kali) tidak mengurangi jatah dan tetap mencatat laporan komponen yang belum ada (Task 5).
4. Mode "ubah rangkaian": komponen lama tetap di posisinya; "Urungkan perubahan AI" mengembalikan diagram & sketch persis seperti sebelumnya (Task 6).
5. Menerima rangkaian baru tidak menghilangkan proyek yang sedang dikerjakan: bila proyek itu hanya ada di browser, disimpan dulu ke akun (Task 6).

---

### Task 1: Daftar pin tanpa model 3D + katalog untuk AI

**Files:**
- Modify: `src/components/spec.js` (`headerPins(names)` memberi `fn.names = names`; tambah `pinIdsOf(spec, props?) → string[]`)
- Modify: spesifikasi yang `pins`-nya butuh `group` selain `headerPins` (mis. `arduino-uno.js`, `breadboard.js`, `dc-motor.js`, gerbang logika — temukan dengan skrip di Step 1): beri properti `pinNames` (objek `id → nama`) atau ubah ke `headerPins`
- Create: `src/ai/catalog.js`
- Test: `tests/ai-catalog.test.js`

**Interfaces:**
- Produces:
  - `pinIdsOf(spec, props = defaultProps(spec)) → string[]` — urutan sama dengan `instantiate(spec).userData.component.pins`. Urutan sumber: `spec.pins` larik → id; `spec.pins.names` → kunci; `spec.pinNames` → kunci (boleh fungsi `(props) → obj`); fungsi tanpa `group` → id.
  - `buildCatalog({ lang }) → string` — teks ringkas, deterministik, satu blok per komponen (kecuali `breadboard*`, `junction`, `text`, `vcc`, `gnd`): `type`, nama, kategori, keterangan (bahasa `lang`), pin `id(fungsi)`, props (`key`: pilihan / rentang / bawaan), dan penanda `surface: breadboard|floor`. Diakhiri daftar library terpasang (dari `LIBRARIES` sandbox → pindahkan ke `src/sandbox/libraries.js` agar bisa diimpor server).

- [ ] **Step 1: Tulis tes gagal** — `tests/ai-catalog.test.js`:
  - `'setiap komponen punya daftar pin tanpa model 3D'` — untuk semua `COMPONENTS`: `pinIdsOf` tidak melempar; panjang > 0 kecuali `text` dan `ir-remote`.
  - `'pin Uno & breadboard'` — `pinIdsOf(uno)` memuat `D13`, `A4`, `GND.1`, `5V` dan tidak memuat `NC`; `pinIdsOf(breadboard)` panjang 396.
  - `'katalog deterministik dan lengkap'` — `buildCatalog({lang:'id'}) === buildCatalog({lang:'id'})`; memuat `oled-ssd1306`, `SDA(i2c-sda)`, `servo-sg90`, `SIG(pwm-in)`; tidak memuat `breadboard-full`.
- [ ] **Step 2: Jalankan** — `npm test` · Expected: FAIL.
- [ ] **Step 3: Implementasikan** `pinIdsOf`, metadata pin pada spesifikasi, `buildCatalog`, `src/sandbox/libraries.js`.
- [ ] **Step 4: Jalankan** — `npm test` · Expected: PASS. Verifikasi di browser (`npm run dev`, impor modul di halaman `gallery.html?dev`): untuk 85 komponen `pinIdsOf(spec)` sama persis dengan id dari `instantiate(spec)`. Catat hasil (85/85).
- [ ] **Step 5: Commit** — `git commit -m "AI: daftar pin tanpa model 3D + katalog komponen"`

---

### Task 2: Skema keluaran AI + validasi

**Files:**
- Create: `src/ai/schema.js`, `src/ai/validate.js`
- Test: `tests/ai-validate.test.js`

**Interfaces:**
- Produces:
  - `CIRCUIT_SCHEMA` (JSON Schema, `additionalProperties: false` di setiap objek, semua field `required`):
    `{ title: string, summary: string, feasible: boolean, parts: [{ id: string, type: string, props: object }], connections: [{ from: string, to: string }], sketch: string, substitutions: [{ requested: string, used: string, reason: string }], missing: [{ component: string, reason: string }], changes: string[] }`.
    `id` huruf kecil/angka (`^[a-z][a-z0-9]{0,11}$`); papan Arduino selalu `{ id: 'uno', type: 'arduino-uno' }`; breadboard **tidak** dideklarasikan AI (ditambahkan tata letak).
  - `validateCircuit(result) → string[]` (pesan dalam bahasa Inggris untuk dikirim balik ke AI; kosong = sah). Memeriksa: tepat satu `arduino-uno` ber-id `uno`; `type` dikenal & bukan breadboard/junction/text; id unik; props hanya kunci yang ada, nilai `choice`/`swatch` di `options`, `range` dalam min–max; setiap `from`/`to` berbentuk `id:pin` dengan id dideklarasikan dan pin ada di `pinIdsOf`; tidak ada sambungan pin ke dirinya sendiri; sketch tidak kosong bila `feasible`.

- [ ] **Step 1: Tulis tes gagal** — `tests/ai-validate.test.js`: rangkaian sah (Uno + resistor + LED + 3 sambungan) → `[]`; `type: 'soil-sensor'` → pesan memuat `unknown component type "soil-sensor"`; pin `led1:X` → `unknown pin`; sambungan ke `r9:1` yang tidak dideklarasikan → `undeclared part`; dua Uno → pesan; `props: { color: 'ungu' }` pada LED → `invalid value`; id ganda → pesan; `feasible: true` dengan sketch kosong → pesan.
- [ ] **Step 2: Jalankan** — Expected: FAIL.
- [ ] **Step 3: Implementasikan** `schema.js` + `validate.js` (memakai `COMPONENT_BY_TYPE`, `pinIdsOf`).
- [ ] **Step 4: Jalankan** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "AI: skema keluaran + validasi"`

---

### Task 3: Tata letak otomatis

**Files:**
- Modify: `src/parts/breadboard.js` (ekspor fungsi murni `holeOffset(row, col, { cols, rails }) → { x, z }` yang dipakai juga oleh `createBreadboard`, agar posisi lubang bisa dihitung tanpa three.js scene)
- Create: `src/ai/layout.js`
- Test: `tests/ai-layout.test.js`

**Interfaces:**
- Consumes: `CIRCUIT_SCHEMA` result (Task 2), `pinIdsOf`, `connectNets`/`snapshotFromTopology`/`checkCircuit` (proyek 1).
- Produces: `layoutCircuit(result, { previous = null } = {}) → { diagram, inserted: Map<leg, hole> }`:
  - `diagram` = format `diagram.json` sandbox (`{ version: 1, parts: [{ id, type, x, z, rot, props, board?, hole? }], wires: [{ from, to }] }`).
  - Uno di `(-82.55, 21.59)`; breadboard `bb` (`type: 'breadboard'`) di `(44.45, 0)` hanya bila ada komponen `surface: 'breadboard'`.
  - Komponen breadboard: ditancapkan (`board: 'bb'`, `hole`) dari kiri ke kanan, satu kolom kosong di antaranya; posisi kaki dihitung dengan kisi (offset pin lokal / 2,54 mm, diputar `rot`); jalur (strip) yang dipakai satu komponen tidak boleh dipakai komponen lain; komponen yang kakinya di dua baris (melintasi parit) diletakkan melintasi `e`/`f`; pilih baris jangkar pertama yang membuat semua kaki jatuh di lubang sah.
  - Komponen lantai: berbaris di belakang breadboard (`z = -70`, jarak 55 mm, dua baris bila > 5).
  - Sambungan ke kaki komponen breadboard diganti ke lubang kosong di jalur kaki itu (lubang tidak dipakai dua kali); sambungan lain tetap pin-ke-pin.
  - `previous` (mode ubah): komponen ber-id sama mempertahankan `x, z, rot, board, hole` lama; hanya komponen baru yang ditata.

- [ ] **Step 1: Tulis tes gagal** — `tests/ai-layout.test.js` dengan helper `netsOf(diagram, inserted)` (memakai `connectNets` + `pinIdsOf`) dan `logicalNets(result)` (union-find atas `connections`):
  - `'LED + resistor: koneksi hasil tata letak = koneksi logis'` — untuk setiap pasangan pin komponen: sama net ⇔ sama net logis.
  - `'tidak ada dua komponen berbagi jalur breadboard'`.
  - `'semua kaki jatuh di lubang sah'` (id lubang ada di `pinIdsOf(breadboard)`).
  - `'OLED I²C di lantai tersambung pin-ke-pin'` — tanpa breadboard bila tidak ada komponen breadboard.
  - `'74HC595 melintasi parit'` — kaki di baris `e` dan `f`.
  - `'checkCircuit tanpa masalah untuk rangkaian contoh yang benar'` (LED + resistor + GND).
  - `'mode ubah mempertahankan posisi komponen lama'`.
- [ ] **Step 2: Jalankan** — Expected: FAIL.
- [ ] **Step 3: Implementasikan** `holeOffset` dan `layoutCircuit`.
- [ ] **Step 4: Jalankan** — `npm test` · Expected: PASS. Verifikasi browser: muat 4 diagram hasil tes (LED, tombol + LED, OLED, 74HC595 + 8 LED) di sandbox lewat `window.__sb.openProject`; `checkCircuit(wb.snapshot())` = `[]` dan net sandbox = net logis (bandingkan dengan skrip). Catat hasil.
- [ ] **Step 5: Commit** — `git commit -m "AI: tata letak otomatis di breadboard"`

---

### Task 4: Prompt + panggilan Claude

**Files:**
- Create: `server/ai-prompt.mjs`, `server/ai-claude.mjs`
- Modify: `package.json` (dependensi `@anthropic-ai/sdk`)
- Test: `tests/ai-prompt.test.js`

**Interfaces:**
- Consumes: `buildCatalog` (Task 1), `CIRCUIT_SCHEMA` (Task 2).
- Produces:
  - `buildSystem({ lang }) → Anthropic.TextBlockParam[]` — blok 1: peran & aturan (pakai hanya komponen katalog; Arduino Uno `uno`; jangan deklarasikan breadboard; aturan kabel umum: I²C A4/A5, SPI D11–D13, servo di PWM, resistor seri LED, hindari D0/D1; tulis sketch lengkap yang terkompilasi untuk Uno dengan library terpasang; bila komponen tidak ada: isi `missing`, dan bila tujuan tetap tercapai dengan komponen lain isi `substitutions` + `feasible: true`; `summary`/`changes`/alasan dalam bahasa `lang`); blok 2: katalog (`cache_control: { type: 'ephemeral' }`). Tanpa tanggal/ID acak (prefiks stabil).
  - `buildUserContent({ prompt, mode, current }) → string` — `mode: 'new' | 'modify'`; untuk `modify` sertakan diagram logis saat ini (komponen + sambungan pin-ke-pin, tanpa posisi) dan sketch.
  - `createClaude({ apiKey, model = 'claude-opus-5-5', effort = 'medium' }) → { generate({ system, messages, signal }) → Promise<{ result | null, stopReason, usage }> }` — SDK `@anthropic-ai/sdk`, structured output `output_config.format` dengan `CIRCUIT_SCHEMA`, `max_tokens` 16000, `fallbacks: "default"` lewat beta bila diterima; `refusal`/`max_tokens` → `result: null`.
- [ ] **Step 1: Tulis tes gagal** — `tests/ai-prompt.test.js`: `buildSystem` dua kali identik (byte); blok terakhir punya `cache_control`; teks memuat `arduino-uno` dan aturan `A4`; `buildUserContent` mode `modify` memuat `led1:A` dan sketch saat ini.
- [ ] **Step 2: Jalankan** — Expected: FAIL.
- [ ] **Step 3: Implementasikan** (`npm i @anthropic-ai/sdk`); baca `typescript/claude-api/README.md` & bagian Structured Outputs skill claude-api sebelum menulis `ai-claude.mjs`; jangan menebak API SDK.
- [ ] **Step 4: Jalankan** — Expected: PASS; `node -e "import('./server/ai-claude.mjs')"` tanpa error.
- [ ] **Step 5: Commit** — `git commit -m "AI: prompt sistem dengan katalog + klien Claude"`

---

### Task 5: Fungsi server `/api/ai` (login, jatah, perbaikan sekali, laporan)

**Files:**
- Create: `server/ai.mjs`, `api/ai.js`
- Modify: `vite.config.js` (middleware `/api/ai` saat dev), `vercel.json` (`api/ai.js`: `maxDuration` 60), `.env.example` (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — dikomentari, tanpa nilai)
- Test: `tests/ai-server.test.js`

**Interfaces:**
- Consumes: Task 1–4; `snapshotFromTopology`, `checkCircuit`.
- Produces: `handleAi(req, res, deps?)` — `deps = { env, claude, db, compile, now }` (bawaan dari env; tes menyuntik tiruan). Body: `{ prompt (1–1000 karakter), lang, mode: 'new'|'modify', current?: { diagram, sketch } }`. Jawaban JSON:
  - `{ ok: false, code: 'not-enabled' }` bila kunci tidak ada; `'not-signed-in'` (401) bila token tidak sah; `'quota'` (429, `limit`) bila jatah habis; `'invalid'` (400) bila body salah; `'failed'` (`reason`, `missing`) bila gagal setelah perbaikan.
  - `{ ok: true, result, diagram, sketch, issues, compile: { size }, usage: { today, limit | null } }`.
  - Alur: verifikasi token (`db.userFromToken`) → admin? (`db.isAdmin(email)`) → jatah (`db.countToday(userId)` vs `db.limit()`) → `claude.generate` → `validateCircuit` → `layoutCircuit` → `checkCircuit` (danger = gagal) → `compile(sketch)` (lewat `POST /api/compile` di host yang sama) → bila ada kesalahan dan waktu < 30 dtk: kirim kembali kesalahan (validasi, compiler `stderr`, masalah kabel) sebagai pesan pengguna lanjutan, satu kali → hasil akhir. Selalu: `db.recordRequests(userId, prompt, result.missing)` bila `missing` tidak kosong; `db.recordUsage(userId, ok)`.
  - `db` default memakai `@supabase/supabase-js` dengan `SUPABASE_SERVICE_ROLE_KEY` (hanya di file ini).
- [ ] **Step 1: Tulis tes gagal** — `tests/ai-server.test.js` dengan tiruan `claude` (antrean hasil), `db` (memori), `compile` (berhasil/gagal per sketch):
  - `'tanpa kunci → not-enabled'`; `'token salah → not-signed-in'`.
  - `'jatah habis → quota; pengelola tidak dibatasi'` (limit 1, sudah 1 ok hari ini).
  - `'berhasil: mencatat pemakaian ok dan mengembalikan diagram'`.
  - `'keluaran tidak sah → diperbaiki sekali lalu berhasil'` (claude dipanggil 2×, pesan kedua memuat kesalahan validasi).
  - `'kompilasi gagal dua kali → failed, pemakaian ok=false, jatah tidak berkurang'`.
  - `'komponen belum ada dicatat sebagai laporan walau berhasil dengan pengganti'`.
  - `'refusal/max_tokens → failed tanpa perbaikan bila hasil null dua kali'`.
  - `'waktu > 30 dtk → tanpa perbaikan'` (jam tiruan).
- [ ] **Step 2: Jalankan** — Expected: FAIL.
- [ ] **Step 3: Implementasikan** `server/ai.mjs`, `api/ai.js`, middleware dev, `vercel.json`, `.env.example`.
- [ ] **Step 4: Jalankan** — `npm test` PASS; `npm run build` `built`; `curl -X POST localhost:5173/api/ai` tanpa kunci → `not-enabled`.
- [ ] **Step 5: Commit** — `git commit -m "AI: fungsi server /api/ai (login, jatah, perbaikan sekali, laporan)"`

---

### Task 6: Kotak perintah, pratinjau, terima/tolak, urungkan

**Files:**
- Create: `src/ai/client.js`, `src/ai/panel.js`, `src/ai/ai.css`
- Modify: `src/sandbox/main.js`, `sandbox.html` (tombol `#btn-ai` di bilah alat, ikon baru `sparkle` di `src/ui/icons.js`; modal `#ai-modal`), `src/i18n/ui.js` (kunci `ai.*`), `src/account/memory-backend.js` + `dev-backend.js` (token palsu untuk `?fakeauth`)
- Test: `tests/ai-client.test.js`, kunci `ai.*` di `tests/i18n-account.test.js`

**Interfaces:**
- Consumes: `/api/ai` (Task 5), `mountAccount`/backend (proyek 2), `saveToAccount`, `openProject`, `wb.toDiagram`, `layoutCircuit` (hasil server sudah berisi `diagram`).
- Produces:
  - `requestCircuit({ prompt, mode, current, lang, token, fetchImpl }) → Promise<response JSON>` — gagal jaringan → `{ ok: false, code: 'network' }`.
  - `diffCircuits(before, after) → { added: string[], removed: string[], changedProps: string[], wiresAdded: number, wiresRemoved: number, sketchChanged: boolean }` (untuk daftar "apa yang berubah").
  - Backend akun mendapat `accessToken(): Promise<string|null>` (Supabase: `session.access_token`; memori: `'fake-token-<userId>'`).
  - UI: tombol AI → modal: pilihan **Rangkaian baru / Ubah rangkaian ini**, textarea, kirim. Belum login → ajakan masuk; `not-enabled` → "Fitur AI belum diaktifkan"; `quota` → "Jatah hari ini habis (n/hari)"; `failed` → alasan + daftar komponen belum tersedia. Memuat → status bertahap (± 1 menit). Pratinjau: meja 3D kecil (stage + workbench kedua, hanya tampilan), judul, ringkasan, daftar komponen, catatan pengganti/belum tersedia, sketch (hanya baca), daftar perubahan (mode ubah), masalah kabel `warn` bila ada; tombol **Terima** / **Tolak**.
  - Terima baru: bila proyek terbuka hanya di browser dan bukan kosong → `saveToAccount` dulu (toast); buka proyek AI (`openProject`) lalu `saveToAccount`. Terima ubah: simpan `{ diagram, sketch, name }` sebelumnya ke `localStorage['la-ai-undo']`, terapkan, tampilkan chip **"Urungkan perubahan AI"** sampai diklik atau proyek lain dibuka; klik → kembalikan persis.
  - `window.__sb.ai` (DEV) untuk pengujian; `?fakeai=1` (DEV) memakai respons contoh tanpa server.
- [ ] **Step 1: Tulis tes gagal** — `tests/ai-client.test.js`: `requestCircuit` mengirim `Authorization: Bearer <token>` dan body sesuai; fetch melempar → `code: 'network'`; `diffCircuits` (tambah buzzer, hapus LED, ubah warna, sketch berubah) → hasil tepat. Tambah kunci `ai.*` ke tes i18n.
- [ ] **Step 2: Jalankan** — Expected: FAIL.
- [ ] **Step 3: Implementasikan** klien, panel, gaya, kunci teks, token palsu.
- [ ] **Step 4: Verifikasi** — `npm test` PASS, `npm run build` `built`. Headless (`?fakeauth=1&fakeai=1`): belum login → ajakan masuk; masuk → kirim → pratinjau tampil (3D, komponen, sketch); Terima (baru) → proyek baru terbuka & tersimpan di akun, proyek lama tetap di "Proyek saya"; mode ubah → Terima → chip urungkan → klik → diagram & sketch sama persis dengan sebelumnya (bandingkan JSON). Tanpa `fakeai` dan tanpa kunci server → "Fitur AI belum diaktifkan".
- [ ] **Step 5: Commit** — `git commit -m "AI: kotak perintah, pratinjau, terima/tolak, urungkan"`

---

### Task 7: Dokumentasi, deploy, uji dengan kunci sungguhan

**Files:**
- Modify: `docs/PANDUAN-PENGEMBANG.md` (bagian **AI penyusun rangkaian**: alur, variabel lingkungan, biaya & jatah), `README.md` + `README.id.md` (fitur AI), `CHANGELOG.md` (0.9.0), `package.json` (versi `0.9.0`)

- [ ] **Step 1:** Tulis dokumentasi; langkah pemilik: pasang `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` di Vercel (bukan `VITE_`).
- [ ] **Step 2: Verifikasi** — `npm test` PASS, `npm run build` `built`.
- [ ] **Step 3: Commit** — `git commit -m "Docs: AI penyusun rangkaian, versi 0.9.0"`
- [ ] **Step 4 (setelah pemilik memasang kunci):** uji di situs produksi dengan 3 perintah (LED berkedip; monitoring kelembapan tanah — komponen belum ada → pengganti + laporan; ubah: tambah buzzer) dan catat waktu, hasil kompilasi, masalah kabel, jatah, serta laporan di halaman pengelola.
