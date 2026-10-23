# Akun & data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Login Google (Supabase) yang membuka fitur tambahan: proyek sandbox tersimpan di akun, progres pelajaran ikut akun, dan halaman pengelola untuk pemilik — tanpa mengubah apa pun bagi pengguna yang tidak login atau saat Supabase belum dikonfigurasi.

**Architecture:** Satu skema Postgres (migrasi SQL di `supabase/migrations/`) dengan Row Level Security sebagai satu-satunya penjaga akses. Browser berbicara ke Supabase lewat lapisan `src/account/` yang punya satu antarmuka *backend* dengan dua implementasi: `supabase-backend.js` (sungguhan, dimuat malas) dan `memory-backend.js` (untuk tes Node dan mode `?fakeauth=1` saat pengembangan). UI (tombol akun, "Proyek saya", halaman pengelola) hanya memakai antarmuka itu.

**Tech Stack:** Vite + JS (tanpa framework), `@supabase/supabase-js` ^2 (dependensi), `@electric-sql/pglite` 0.5.x (devDependency, untuk menguji skema & RLS di `node --test`).

**Spec:** `docs/superpowers/specs/2026-10-23-akun-dan-data-design.md`

## Global Constraints

- Supabase proyek: `https://gsjpkjolxielseltvhnn.supabase.co`. **Password database tidak dipakai dan tidak boleh ditulis di repo, tes, memori, atau log.** Browser hanya memakai anon key (`VITE_SUPABASE_ANON_KEY`); service_role key (`SUPABASE_SERVICE_ROLE_KEY`) hanya untuk fungsi server (proyek 3) — tidak pernah diimpor oleh kode di `src/`.
- `.env`, `.env.local`, `.env.*.local` di-gitignore; repo hanya berisi `.env.example` tanpa kunci.
- Selama `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` kosong: tombol masuk tidak tampil, `@supabase/supabase-js` tidak dimuat, dan semua halaman bekerja seperti v0.7.0.
- Supabase lambat/gagal tidak boleh memperlambat atau merusak sandbox/pelajaran: modul akun dimuat malas (`import()`), semua panggilan jaringan dibungkus dan gagal dengan pesan, bukan error tak tertangkap.
- Tanpa login semua tetap bekerja; login hanya membuka fitur tambahan (proyek di akun; AI di proyek 3).
- Proyek pengguna yang dibuka pengelola **selalu salinan**; RLS melarang pengelola mengubah/menghapus proyek orang lain.
- Pengelola = email di tabel `admins` (diisi manual oleh pemilik lewat SQL; email pemilik tidak ditulis di repo).
- Batas AI per hari disimpan di `settings` (`ai_daily_limit`, awal `1`), bisa diubah di halaman pengelola.
- Dua bahasa: setiap teks baru punya kunci di `src/i18n/ui.js` untuk `id` dan `en` (dijaga tes).
- Tes: `npm test` (`node --test "tests/**/*.test.js"`), tanpa jaringan.

## Review Focus

1. Supabase belum dikonfigurasi atau tidak bisa dihubungi → semua halaman tetap memuat tanpa error; tombol akun tersembunyi (belum dikonfigurasi) atau menampilkan pesan gagal (tidak terhubung). Diuji: Task 4 (backend `fail: true`) dan pemeriksaan halaman tanpa env di Task 4/5/7.
2. Pengelola membuka proyek pengguna → yang terbuka salinan tanpa `cloudId`, sehingga simpan otomatis tidak pernah menulis ke proyek pemilik. Diuji: Task 1 (RLS: admin tidak bisa update/delete) dan Task 5 (`openCopy` tidak membawa id).
3. Sesi kedaluwarsa / keluar saat simpan otomatis → simpanan lokal tetap jalan, pesan gagal muncul sekali, tidak ada data hilang. Diuji: Task 5 (`autosave` dengan backend yang gagal).
4. Login pertama dengan progres lokal dan progres di akun yang berbeda → gabungan (union), tidak ada yang hilang di kedua sisi. Diuji: Task 6 (`mergeDone`).
5. Pengguna biasa mencoba membaca data orang lain atau mengubah pengaturan/laporan → ditolak RLS. Diuji: Task 1.

---

### Task 1: Skema database + RLS (diuji dengan PGlite)

**Files:**
- Create: `supabase/migrations/20261024000000_akun_dan_data.sql`
- Create: `tests/db/pg.js` (helper), `tests/db/schema.test.js`
- Modify: `package.json` (devDependency `@electric-sql/pglite@^0.5.11`), `.gitignore` (`.env`, `.env.local`, `.env.*.local`)

**Interfaces:**
- Produces (dipakai Task 3, 7, dan proyek 3):
  - Tabel `profiles(id uuid pk → auth.users, email text, name text, avatar_url text, created_at, last_seen_at)` — terisi otomatis oleh trigger `on_auth_user_created` (security definer) dari `auth.users`.
  - `admins(email text pk)`; fungsi `public.is_admin() returns boolean` (security definer, membandingkan `auth.jwt() ->> 'email'`).
  - `projects(id uuid pk default gen_random_uuid(), owner uuid not null default auth.uid() → auth.users on delete cascade, name text not null check (char_length(name) between 1 and 80), sketch text not null default '', diagram jsonb not null, eeprom jsonb, created_at, updated_at)` + trigger `updated_at`. Batas ukuran: `check (octet_length(sketch) <= 200000 and octet_length(diagram::text) <= 500000)`.
  - `lesson_progress(user_id uuid default auth.uid(), lesson_id text, done_at timestamptz default now(), primary key(user_id, lesson_id))`.
  - `settings(key text pk, value jsonb not null)` dengan baris `('ai_daily_limit', '1')`.
  - `component_requests(id bigint identity pk, user_id uuid → auth.users, prompt text, component text not null, created_at)` dan `ai_usage(id bigint identity pk, user_id uuid not null → auth.users, ok boolean not null, created_at)` — **ditulis hanya oleh server** (service role, proyek 3).
  - View `admin_component_requests` (`security_invoker = true`): `component, count(*) as requests, count(distinct user_id) as users, max(created_at) as last_at, (array_agg(prompt order by created_at desc))[1:3] as examples` dikelompokkan per `lower(component)`.
  - View `admin_users` (`security_invoker = true`): kolom `profiles` + `projects` (jumlah), `ai_today`, `ai_total` (dari `ai_usage` dengan `ok`).
- Kebijakan RLS (semua tabel `enable row level security`, peran `authenticated`; `anon` tanpa akses):
  - `profiles`: select milik sendiri atau `is_admin()`; update milik sendiri (hanya `name`, `avatar_url`, `last_seen_at` lewat grant kolom).
  - `projects`: select milik sendiri atau `is_admin()`; insert/update/delete hanya `owner = auth.uid()`.
  - `lesson_progress`: semua operasi hanya milik sendiri; select juga `is_admin()`.
  - `settings`: select semua `authenticated`; update hanya `is_admin()`.
  - `component_requests`, `ai_usage`: select milik sendiri atau `is_admin()`; tanpa insert/update/delete untuk `authenticated`.
  - `admins`: tanpa akses untuk `authenticated` (hanya lewat `is_admin()`).

- [ ] **Step 1: Tulis helper `tests/db/pg.js`**: `async function freshDb() → { db, as(user, sql, params?) }`. Membuat PGlite baru, memasang stub Supabase (schema `auth`, tabel `auth.users(id uuid pk, email text, raw_user_meta_data jsonb)`, fungsi `auth.uid()` dan `auth.jwt()` yang membaca `current_setting('request.jwt.claims', true)::jsonb`, peran `anon` dan `authenticated`), lalu menjalankan berkas migrasi. `as({ id, email }, sql, params)` menjalankan kueri dalam transaksi dengan `set_config('request.jwt.claims', json, true)` dan `set local role authenticated`; `as(null, …)` memakai peran `anon`. Fungsi `addUser(db, { id, email, name })` menyisipkan ke `auth.users`.
- [ ] **Step 2: Tulis tes yang gagal** — `tests/db/schema.test.js`, satu tes per baris:
  - `'pengguna baru otomatis punya profil'` — `addUser` → `profiles` berisi email & nama.
  - `'pemilik bisa simpan & baca proyeknya; pengguna lain tidak melihatnya'` — A insert; A select = 1 baris; B select = 0 baris.
  - `'anon tidak bisa membaca proyek'` — `as(null, 'select * from projects')` → 0 baris atau error izin.
  - `'pengelola melihat semua proyek tetapi tidak bisa mengubah atau menghapus milik orang lain'` — admin select = 1; `update … set name='x'` dan `delete` → 0 baris terdampak; nama tetap.
  - `'pengguna tidak bisa membuat proyek atas nama orang lain'` — A insert `owner = B` → error RLS.
  - `'batas AI awal 1; hanya pengelola yang bisa mengubahnya'` — A select `value` = 1; A update → 0 baris; admin update ke 3 → terbaca 3.
  - `'progres pelajaran hanya milik sendiri'` — A upsert 2 lesson; B select = 0.
  - `'pengguna tidak bisa menulis laporan komponen atau pemakaian AI'` — A insert ke `component_requests`/`ai_usage` → error.
  - `'laporan komponen dikelompokkan untuk pengelola'` — sisipkan (sebagai superuser) 3 permintaan "Soil sensor"/"soil sensor"/"Pompa"; admin baca view → baris `soil sensor` dengan `requests = 2`, `users` sesuai; A baca view → hanya miliknya.
  - `'admin_users menghitung proyek dan pemakaian AI hari ini'`.
  - `'nama proyek kosong ditolak'` — insert `name = ''` → error check.
- [ ] **Step 3: Jalankan** — `npm i -D @electric-sql/pglite@^0.5.11` lalu `npm test` · Expected: FAIL (berkas migrasi belum ada).
- [ ] **Step 4: Tulis migrasi** sesuai Interfaces. Migrasi harus bisa dijalankan apa adanya di SQL Editor Supabase (memakai `auth.users`, `auth.uid()`, `auth.jwt()` milik Supabase; stub di tes hanya meniru itu). Akhiri dengan komentar cara menambah pengelola: `-- insert into public.admins (email) values ('email-google-pemilik@contoh.com');`
- [ ] **Step 5: Jalankan** — `npm test` · Expected: semua tes lama + tes skema PASS.
- [ ] **Step 6: Commit** — `git commit -m "Akun & data: skema database + RLS (diuji dengan PGlite)"`

---

### Task 2: Antarmuka backend + backend memori

**Files:**
- Create: `src/account/memory-backend.js`
- Create: `tests/account-contract.js` (tes kontrak yang bisa dipakai ulang), `tests/account-memory.test.js`

**Interfaces:**
- Produces — antarmuka **Backend** (dipakai Task 3–7; `supabase-backend.js` di Task 3 wajib memenuhi kontrak yang sama):
  - `user(): { id, email, name, avatarUrl } | null` (sinkron, dari sesi terakhir) · `onAuthChange(fn): () => void` · `signIn(): Promise<void>` · `signOut(): Promise<void>` · `touch(): Promise<void>` (perbarui `last_seen_at`)
  - `projects.list(): Promise<[{ id, name, updatedAt }]>` (milik sendiri, terbaru dulu) · `projects.get(id): Promise<{ id, owner, name, sketch, diagram, eeprom, updatedAt }>` · `projects.save({ id?, name, sketch, diagram, eeprom }): Promise<{ id, updatedAt }>` (tanpa `id` = baru) · `projects.rename(id, name)` · `projects.remove(id)`
  - `progress.pull(): Promise<string[]>` · `progress.push(ids: string[]): Promise<void>` (upsert, tidak menghapus)
  - `admin.isAdmin(): Promise<boolean>` · `admin.requests(): Promise<[{ component, requests, users, lastAt, examples }]>` · `admin.projects(): Promise<[{ id, name, ownerEmail, updatedAt }]>` · `admin.users(): Promise<[{ id, email, name, projects, aiToday, aiTotal, lastSeenAt }]>` · `admin.getLimit(): Promise<number>` · `admin.setLimit(n: number): Promise<void>`
  - Kesalahan: semua metode async melempar `AccountError { code: 'not-signed-in' | 'forbidden' | 'network' | 'invalid', message }`.
- `createMemoryBackend({ users?, admins?, fail? }) → Backend` — data di memori; `users` daftar akun palsu, `signIn()` masuk sebagai pengguna pertama (atau `signInAs(email)` khusus memori); `fail: true` membuat setiap panggilan melempar `AccountError('network')`.

- [ ] **Step 1: Tulis kontrak gagal** — `tests/account-contract.js` mengekspor `runContract(name, makeBackend)` berisi tes: masuk/keluar memicu `onAuthChange`; `projects.save` tanpa id membuat proyek baru, dengan id memperbarui; `list` hanya milik sendiri, terbaru dulu; `rename` dan `remove`; `get` proyek orang lain sebagai non-admin → `forbidden`; sebagai admin → berhasil; `save` dengan id milik orang lain (admin) → `forbidden`; nama kosong → `invalid`; `progress.push` lalu `pull` = gabungan tanpa duplikat; non-admin `admin.setLimit` → `forbidden`; panggilan tanpa login → `not-signed-in`. `tests/account-memory.test.js` menjalankan `runContract('memori', () => createMemoryBackend({ users: [...], admins: [...] }))` plus tes `fail: true` → setiap metode async melempar `code === 'network'`.
- [ ] **Step 2: Jalankan** — `npm test` · Expected: FAIL (modul belum ada).
- [ ] **Step 3: Implementasikan `createMemoryBackend`** memenuhi kontrak (aturan akses sama dengan RLS Task 1).
- [ ] **Step 4: Jalankan** — `npm test` · Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "Akun & data: antarmuka backend + backend memori (tes kontrak)"`

---

### Task 3: Backend Supabase + konfigurasi

**Files:**
- Create: `src/account/config.js`, `src/account/supabase-backend.js`, `src/account/index.js`
- Create: `.env.example`
- Test: `tests/account-config.test.js`
- Modify: `package.json` (dependensi `@supabase/supabase-js@^2`)

**Interfaces:**
- Consumes: skema Task 1; antarmuka Backend Task 2.
- Produces:
  - `readConfig(env) → { url, anonKey } | null` — `null` bila salah satu kosong, berisi spasi, atau masih nilai contoh dari `.env.example` (`your-anon-key`).
  - `createSupabaseBackend({ url, anonKey }) → Backend` — memakai `supabase-js` (`signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } })`); memetakan baris snake_case ↔ objek camelCase lewat `fromProjectRow(row)` dan `toProjectRow(project)` (diekspor untuk tes); memetakan error PostgREST/RLS ke `AccountError` (`42501`/0 baris pada update milik orang lain → `forbidden`, `23514` → `invalid`, `fetch`/timeout → `network`).
  - `getAccount(): Promise<Backend | null>` di `src/account/index.js` — urutan: `?fakeauth=1` **hanya saat `import.meta.env.DEV`** → backend memori (pengguna palsu `pengguna@contoh.test`, admin `admin@contoh.test`, `?fakeauth=admin` masuk sebagai admin, `?fakeauth=offline` → `fail: true`); `readConfig(import.meta.env)` → `import('./supabase-backend.js')` (dimuat malas); selain itu `null`. Hasil di-cache per halaman.
- `.env.example`: `VITE_SUPABASE_URL=https://gsjpkjolxielseltvhnn.supabase.co`, `VITE_SUPABASE_ANON_KEY=your-anon-key`, dan (dikomentari, hanya server/proyek 3) `SUPABASE_SERVICE_ROLE_KEY=`.

- [ ] **Step 1: Tulis tes gagal** — `tests/account-config.test.js`: `readConfig({})` → `null`; `readConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'your-anon-key' })` → `null`; nilai sah → `{ url, anonKey }`; `fromProjectRow({ id:'1', owner:'u', name:'A', sketch:'', diagram:{parts:[],wires:[]}, eeprom:null, updated_at:'2026-10-24T00:00:00Z' })` → `{ id:'1', owner:'u', name:'A', sketch:'', diagram:{…}, eeprom:null, updatedAt:'2026-10-24T00:00:00Z' }`; `toProjectRow({ name:'A', sketch:'s', diagram:{}, eeprom:null, id:'1', updatedAt:'x' })` hanya berisi `name, sketch, diagram, eeprom` (tanpa id/owner/updated_at).
- [ ] **Step 2: Jalankan** — `npm test` · Expected: FAIL.
- [ ] **Step 3: Implementasikan** `config.js`, `supabase-backend.js` (impor `@supabase/supabase-js` hanya di berkas ini), `index.js`; tambah `.env.example`.
- [ ] **Step 4: Jalankan** — `npm test` · Expected: PASS. `npm run build` · Expected: `built`, dan tanpa `.env.local` tidak ada chunk berisi `supabase` yang dimuat oleh `sandbox`/`main` saat start (periksa: `grep -l "supabase" dist/assets/*.js` hanya menemukan chunk terpisah, bukan entri halaman).
- [ ] **Step 5: Commit** — `git commit -m "Akun & data: backend Supabase, konfigurasi env, pemuatan malas"`

---

### Task 4: Tombol akun di semua halaman

**Files:**
- Create: `src/account/ui.js`, `src/account/account.css`
- Modify: `index.html`, `sandbox.html`, `gallery.html` (wadah `<div class="account-slot"></div>` di bilah atas), `src/main.js`, `src/sandbox/main.js`, `src/sandbox/gallery.js` (panggil `mountAccount`)
- Modify: `src/i18n/ui.js` (kunci `acct.*`)
- Test: `tests/i18n-account.test.js`

**Interfaces:**
- Consumes: `getAccount()` (Task 3).
- Produces:
  - `mountAccount(slot: HTMLElement, { menuItems?: () => [{ label, onClick }] }) → Promise<{ backend: Backend | null, user(): User | null, onChange(fn) }>` — `backend === null` → slot dikosongkan (tidak tampil apa pun). Belum masuk → tombol **"Masuk dengan Google"**. Sudah masuk → avatar/inisial + menu: item dari `menuItems`, **"Halaman pengelola"** (hanya bila `admin.isAdmin()`), **"Keluar"**. Gagal (`network`) → tombol tetap tampil; klik menampilkan pesan `acct.offline`.
  - Pemberitahuan sekali per pengguna setelah masuk (`acct.notice`: proyek yang disimpan di akun dapat dilihat pengelola situs), diingat di `localStorage` kunci `la-account-notice:<userId>` (dibungkus try/catch).
  - `backend.touch()` dipanggil sekali setelah masuk.
- Kunci i18n (id & en): `acct.signIn`, `acct.signOut`, `acct.admin`, `acct.offline`, `acct.notice`, `acct.noticeOk`, `acct.menu`.

- [ ] **Step 1: Tulis tes gagal** — `tests/i18n-account.test.js`: setiap kunci di atas ada dan tidak kosong di `UI.id` dan `UI.en`.
- [ ] **Step 2: Jalankan** — Expected: FAIL.
- [ ] **Step 3: Implementasikan** `ui.js` + CSS (gaya `top-btn`/`sb-btn` yang ada), pasang di ketiga halaman, tambahkan kunci teks.
- [ ] **Step 4: Verifikasi** — `npm test` PASS; `npm run build` `built`. Headless (puppeteer-core, Chrome lokal) dengan `npm run dev`:
  - tanpa env: `/`, `/sandbox.html`, `/gallery.html` tanpa `pageerror`, `.account-slot` kosong;
  - `?fakeauth=1`: tombol "Masuk dengan Google" → klik → avatar tampil, pemberitahuan muncul sekali (muat ulang → tidak muncul lagi);
  - `?fakeauth=admin`: menu berisi "Halaman pengelola";
  - `?fakeauth=offline`: halaman tetap memuat, sandbox & simulasi contoh "blink" tetap jalan, klik tombol → pesan offline.
- [ ] **Step 5: Commit** — `git commit -m "Akun & data: tombol masuk Google di semua halaman"`

---

### Task 5: Proyek di akun (sandbox)

**Files:**
- Create: `src/account/cloud-projects.js`
- Modify: `src/sandbox/main.js` (menu akun, modal "Proyek saya", simpan otomatis, buka salinan), `sandbox.html` (modal `#projects-modal`), `src/sandbox/sandbox.css`, `src/sandbox/project.js` (proyek lokal menyimpan `cloudId?`)
- Modify: `src/i18n/ui.js` (kunci `proj.*`)
- Test: `tests/cloud-projects.test.js`

**Interfaces:**
- Consumes: Backend (Task 2/3), `mountAccount` (Task 4).
- Produces (`src/account/cloud-projects.js`, murni, diuji dengan backend memori):
  - `saveToAccount(backend, project) → Promise<project>` — simpan baru bila `project.cloudId` kosong, perbarui bila ada; kembalikan proyek dengan `cloudId`.
  - `openFromAccount(backend, id, { copy }) → Promise<project>` — `copy: true` → proyek tanpa `cloudId`, nama `t('proj.copyName', { name, owner })`; selain itu proyek dengan `cloudId = id`.
  - `createAutosave(backend, { delayMs = 2000, onError }) → { schedule(project), flush(): Promise }` — hanya menyimpan bila `project.cloudId` ada; gagal → `onError(err)` **sekali** per rangkaian kegagalan (berhasil lagi → bisa melapor lagi); tidak melempar.
- UI: item menu akun **"Simpan ke akun"** (bila proyek belum punya `cloudId`) dan **"Proyek saya"** (modal: daftar nama + waktu ubah; tombol Buka, Ubah nama, Hapus dengan konfirmasi). Proyek yang terbuka ber-`cloudId` disimpan otomatis ke akun (selain simpanan lokal yang sudah ada). Penanda kecil di samping nama proyek: "Tersimpan di akun" / "Hanya di browser ini". Keluar → `cloudId` tetap di proyek lokal, simpan otomatis berhenti sampai masuk lagi. Parameter URL `?project=<id>&copy=1` → `openFromAccount(…, { copy: true })` (dipakai halaman pengelola).

- [ ] **Step 1: Tulis tes gagal** — `tests/cloud-projects.test.js` dengan backend memori:
  - `'simpan ke akun membuat proyek baru lalu memperbaruinya'` — `saveToAccount` dua kali → `list()` berisi 1 proyek dengan isi terbaru.
  - `'membuka salinan tidak membawa id pemilik'` — admin `openFromAccount(id, { copy: true })` → `cloudId` `undefined`, nama berisi nama asli; lalu `saveToAccount` salinan → proyek baru milik admin, proyek asli tidak berubah.
  - `'simpan otomatis melewati proyek tanpa cloudId'`.
  - `'simpan otomatis gagal melapor sekali dan tidak melempar'` — backend `fail: true`, `schedule` 3× lalu `flush` → `onError` dipanggil 1×.
- [ ] **Step 2: Jalankan** — Expected: FAIL.
- [ ] **Step 3: Implementasikan** `cloud-projects.js`, lalu UI sandbox + kunci teks (id & en; tambahkan juga ke `tests/i18n-account.test.js`).
- [ ] **Step 4: Verifikasi** — `npm test` PASS; headless `?fakeauth=1`: masuk → "Simpan ke akun" → penanda berubah; ubah kode → setelah 2 dtk tersimpan (`list()` lewat `window.__sb`); "Proyek saya" → ubah nama, hapus; `?fakeauth=admin&project=<id milik pengguna>&copy=1` → terbuka sebagai salinan, mengubahnya tidak mengubah asli. Tanpa env: tidak ada item/penanda akun, simpan lokal tetap.
- [ ] **Step 5: Commit** — `git commit -m "Akun & data: proyek sandbox tersimpan di akun"`

---

### Task 6: Progres pelajaran ikut akun

**Files:**
- Modify: `src/ui/store.js` (`allDone(): string[]`, `mergeDone(ids: string[]): boolean`, `onDone(fn)`), `src/main.js` (sinkron saat masuk & saat pelajaran selesai)
- Create: `src/account/progress-sync.js`
- Test: `tests/progress-sync.test.js`

**Interfaces:**
- Consumes: Backend (Task 2/3), `mountAccount` (Task 4).
- Produces: `syncProgress(backend, store) → Promise<{ added: number }>` — `pull()`, `store.mergeDone(remote)`, lalu `push(store.allDone())`; gagal → tidak mengubah progres lokal, melempar `AccountError` ke pemanggil (UI menampilkan pesan kecil). `mergeDone` = gabungan tanpa duplikat; tidak pernah menghapus.

- [ ] **Step 1: Tulis tes gagal** — `tests/progress-sync.test.js` (store tiruan berbasis array, backend memori):
  - `'login pertama menggabungkan progres lokal dan akun'` — lokal `['blink','button']`, akun `['button','servo']` → lokal dan akun sama-sama `['blink','button','servo']` (urutan diabaikan).
  - `'gagal jaringan tidak mengubah progres lokal'` — backend `fail: true` → melempar `network`, lokal tetap.
- [ ] **Step 2: Jalankan** — Expected: FAIL.
- [ ] **Step 3: Implementasikan** `progress-sync.js`, tambahan `store`, dan pemanggilan di `src/main.js` (setelah masuk; setiap `markDone` saat masuk → `push([id])`, gagal diabaikan diam-diam karena progres lokal tetap tercatat). Kartu progres diperbarui setelah sinkron.
- [ ] **Step 4: Verifikasi** — `npm test` PASS; headless `/?fakeauth=1`: progres lokal 2 pelajaran → masuk → kartu progres tidak berkurang.
- [ ] **Step 5: Commit** — `git commit -m "Akun & data: progres pelajaran ikut akun"`

---

### Task 7: Halaman pengelola

**Files:**
- Create: `admin.html`, `src/admin/main.js`, `src/admin/admin.css`
- Modify: `vite.config.js` (input `admin: 'admin.html'`), `src/i18n/ui.js` (kunci `adm.*`)
- Test: tambah kunci `adm.*` ke `tests/i18n-account.test.js`

**Interfaces:**
- Consumes: `getAccount()`, `mountAccount` (Task 3/4), `backend.admin.*` (Task 2/3).
- Produces: halaman `/admin.html` (tidak ditautkan untuk pengguna biasa; tautan hanya di menu akun pengelola):
  - Belum masuk → tombol masuk; masuk tetapi bukan pengelola → `adm.forbidden`; Supabase belum dikonfigurasi → `adm.notConfigured`.
  - Tab **Laporan komponen** (`admin.requests()`: komponen, jumlah permintaan, jumlah pengguna, terakhir, contoh perintah; terbanyak dulu) — kosong → `adm.noRequests`.
  - Tab **Proyek pengguna** (`admin.projects()`: nama, pemilik, terakhir diubah; tombol **"Buka salinan di sandbox"** → `/sandbox.html?project=<id>&copy=1` di tab baru).
  - Tab **Pengguna** (`admin.users()`: email, nama, jumlah proyek, AI hari ini / total, terakhir aktif).
  - Tab **Pengaturan**: angka batas AI per hari (`getLimit`/`setLimit`, bilangan bulat 0–100; di luar itu ditolak dengan pesan).
  - Gaya mengikuti katalog (`gallery.css` bilah atas, kartu), dua bahasa.

- [ ] **Step 1: Tulis tes gagal** — tambah daftar kunci `adm.*` (`adm.title`, `adm.forbidden`, `adm.notConfigured`, `adm.tab.requests`, `adm.tab.projects`, `adm.tab.users`, `adm.tab.settings`, `adm.noRequests`, `adm.openCopy`, `adm.limit`, `adm.limitHelp`, `adm.saved`, `adm.invalidLimit`) ke `tests/i18n-account.test.js`.
- [ ] **Step 2: Jalankan** — Expected: FAIL.
- [ ] **Step 3: Implementasikan** halaman, gaya, kunci teks, input Vite.
- [ ] **Step 4: Verifikasi** — `npm test` PASS; `npm run build` menghasilkan `dist/admin.html`. Headless: `/admin.html` tanpa env → `adm.notConfigured`; `?fakeauth=1` (bukan admin) → `adm.forbidden`; `?fakeauth=admin` dengan data contoh (backend memori di DEV diisi 2 pengguna, 2 proyek, 3 laporan) → keempat tab terisi; ubah batas ke 3 → tersimpan; isi `-1` → pesan tidak valid; "Buka salinan" membuka sandbox berisi salinan.
- [ ] **Step 5: Commit** — `git commit -m "Akun & data: halaman pengelola"`

---

### Task 8: Dokumentasi & langkah pemilik

**Files:**
- Modify: `README.md` (bagian **Akun & data**: cara kerja, `npm run dev` dengan `?fakeauth=1`, langkah pemilik), `CHANGELOG.md` (0.8.0), `package.json` (versi `0.8.0`)

- [ ] **Step 1:** README — langkah pemilik, berurutan: (1) Supabase → Authentication → Providers → Google: aktifkan, isi Client ID/Secret dari Google Cloud Console (OAuth consent + redirect `https://gsjpkjolxielseltvhnn.supabase.co/auth/v1/callback`); (2) Authentication → URL Configuration: Site URL + redirect `http://localhost:5173/**` dan domain produksi; (3) SQL Editor: jalankan `supabase/migrations/20261024000000_akun_dan_data.sql`, lalu `insert into public.admins (email) values ('<email Google Anda>');`; (4) salin anon key ke `.env.local` (lokal) dan Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); service_role key hanya ke Vercel untuk proyek 3; (5) ganti password database. CHANGELOG 0.8.0 merangkum fitur Task 4–7.
- [ ] **Step 2: Verifikasi** — `npm test` PASS, `npm run build` `built`.
- [ ] **Step 3: Commit** — `git commit -m "Docs: akun & data (langkah pemilik), versi 0.8.0"`
