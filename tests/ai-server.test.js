import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleAi } from '../server/ai.mjs';

const LED = () => ({
  title: 'LED berkedip',
  summary: 'LED di D13.',
  feasible: true,
  parts: [
    { id: 'uno', type: 'arduino-uno', props: [] },
    { id: 'r1', type: 'resistor', props: [] },
    { id: 'led1', type: 'led', props: [] },
  ],
  connections: [
    { from: 'uno:D13', to: 'r1:1' },
    { from: 'r1:2', to: 'led1:A' },
    { from: 'led1:K', to: 'uno:GND.1' },
  ],
  sketch: 'void setup(){pinMode(13,OUTPUT);}\nvoid loop(){}\n',
  substitutions: [],
  missing: [],
  changes: [],
});

function fakeDb({ limit = 1, okToday = {}, admins = ['admin@contoh.test'] } = {}) {
  const users = { 'tok-ani': { id: 'u1', email: 'ani@contoh.test' }, 'tok-admin': { id: 'u2', email: 'admin@contoh.test' } };
  const db = {
    usage: [],
    requests: [],
    userFromToken: async (t) => users[t] ?? null,
    isAdmin: async (email) => admins.includes(email),
    limit: async () => limit,
    countToday: async (id) => (okToday[id] ?? 0) + db.usage.filter((u) => u.userId === id && u.ok).length,
    recordUsage: async (userId, ok) => db.usage.push({ userId, ok }),
    recordRequests: async (userId, prompt, missing) => missing.forEach((m) => db.requests.push({ userId, prompt, component: m.component })),
  };
  return db;
}

/** AI tiruan: setiap panggilan mengambil jawaban berikutnya (objek hasil, null, atau Error). */
function fakeAi(...answers) {
  const ai = { calls: [] };
  ai.generate = async ({ messages }) => {
    ai.calls.push(structuredClone(messages));
    const a = answers.shift();
    if (a instanceof Error) throw a;
    return { result: a ?? null, stopReason: a ? 'end_turn' : 'refusal' };
  };
  return ai;
}

async function call(deps, { method = 'POST', token = 'tok-ani', body = { prompt: 'LED berkedip', lang: 'id', mode: 'new' } } = {}) {
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(b) {
      this.body = b ? JSON.parse(b) : null;
    },
  };
  const req = { method, headers: token ? { authorization: `Bearer ${token}` } : {}, body };
  let t = 0;
  await handleAi(req, res, {
    info: { provider: 'anthropic', label: 'Anthropic' },
    compile: async (sketch) => (sketch.includes('ERR') ? { ok: false, stderr: "sketch.ino:2: error: 'x' was not declared" } : { ok: true, size: 924 }),
    now: () => (t += 1000),
    ...deps,
  });
  return res;
}

test('tanpa kunci → not-enabled; GET memberi tahu penyedia', async () => {
  assert.equal((await call({ ai: null, db: fakeDb() })).body.code, 'not-enabled');
  assert.deepEqual((await call({ ai: fakeAi(), db: fakeDb() }, { method: 'GET' })).body, { enabled: true, provider: 'anthropic', label: 'Anthropic' });
  assert.deepEqual((await call({ ai: null, db: null }, { method: 'GET' })).body, { enabled: false, provider: null, label: null });
});

test('token salah → not-signed-in (401); body salah → invalid (400)', async () => {
  const bad = await call({ ai: fakeAi(LED()), db: fakeDb() }, { token: 'palsu' });
  assert.equal(bad.statusCode, 401);
  assert.equal(bad.body.code, 'not-signed-in');
  const empty = await call({ ai: fakeAi(LED()), db: fakeDb() }, { body: { prompt: '', mode: 'new' } });
  assert.equal(empty.statusCode, 400);
  assert.equal(empty.body.code, 'invalid');
});

test('jatah habis → quota; pengelola tidak dibatasi', async () => {
  const db = fakeDb({ okToday: { u1: 1, u2: 5 } });
  const full = await call({ ai: fakeAi(LED()), db });
  assert.equal(full.statusCode, 429);
  assert.deepEqual([full.body.code, full.body.limit], ['quota', 1]);
  assert.equal((await call({ ai: fakeAi(LED()), db }, { token: 'tok-admin' })).body.ok, true);
});

test('berhasil: diagram tertata, pemakaian ok tercatat', async () => {
  const db = fakeDb();
  const res = await call({ ai: fakeAi(LED()), db });
  assert.equal(res.body.ok, true);
  assert.ok(res.body.diagram.parts.some((p) => p.id === 'r1' && p.hole));
  assert.deepEqual(res.body.issues, []);
  assert.deepEqual(res.body.usage, { today: 1, limit: 1 });
  assert.deepEqual(db.usage, [{ userId: 'u1', ok: true }]);
});

test('keluaran tidak sah → diperbaiki sekali lalu berhasil', async () => {
  const wrong = LED();
  wrong.parts.push({ id: 's1', type: 'soil-sensor', props: [] });
  const ai = fakeAi(wrong, LED());
  const res = await call({ ai, db: fakeDb() });
  assert.equal(res.body.ok, true);
  assert.equal(ai.calls.length, 2);
  assert.match(ai.calls[1].at(-1).content, /unknown component type "soil-sensor"/);
});

test('kompilasi gagal dua kali → failed, pemakaian ok=false, jatah tidak berkurang', async () => {
  const broken = { ...LED(), sketch: 'void setup(){ERR}' };
  const db = fakeDb();
  const res = await call({ ai: fakeAi(broken, broken), db });
  assert.deepEqual([res.body.ok, res.body.code, res.body.reason], [false, 'failed', 'compile']);
  assert.match(res.body.details.join('\n'), /not declared/);
  assert.deepEqual(db.usage, [{ userId: 'u1', ok: false }]);
  assert.equal(await db.countToday('u1'), 0);
});

test('komponen belum ada dicatat walau berhasil dengan pengganti', async () => {
  const sub = { ...LED(), missing: [{ component: 'Sensor kelembapan tanah', reason: 'tidak ada di katalog' }], substitutions: [{ requested: 'soil sensor', used: 'potentiometer', reason: 'simulasi' }] };
  const db = fakeDb();
  const res = await call({ ai: fakeAi(sub), db }, { body: { prompt: 'monitoring kelembapan tanah', lang: 'id', mode: 'new' } });
  assert.equal(res.body.ok, true);
  assert.deepEqual(db.requests, [{ userId: 'u1', prompt: 'monitoring kelembapan tanah', component: 'Sensor kelembapan tanah' }]);
});

test('tidak mungkin dibuat → failed tanpa perbaikan, laporan tetap dicatat', async () => {
  const ai = fakeAi({ ...LED(), feasible: false, sketch: '', missing: [{ component: 'Kamera', reason: 'x' }] });
  const db = fakeDb();
  const res = await call({ ai, db });
  assert.deepEqual([res.body.code, res.body.reason], ['failed', 'not-feasible']);
  assert.equal(ai.calls.length, 1);
  assert.equal(db.requests.length, 1);
});

test('tanpa hasil (refusal/max_tokens) dua kali → failed no-result; galat penyedia → failed provider', async () => {
  assert.equal((await call({ ai: fakeAi(null, null), db: fakeDb() })).body.reason, 'no-result');
  const db = fakeDb();
  const res = await call({ ai: fakeAi(new Error('503 overloaded')), db });
  assert.equal(res.body.reason, 'provider');
  assert.deepEqual(db.usage, [{ userId: 'u1', ok: false }]);
});

test('waktu > 30 dtk → tanpa perbaikan', async () => {
  const wrong = { ...LED(), sketch: 'ERR' };
  const ai = fakeAi(wrong, LED());
  let t = 0;
  const res = await call({ ai, db: fakeDb(), now: () => (t += 40000) }); // tiap pembacaan jam: +40 dtk
  assert.equal(res.body.code, 'failed');
  assert.equal(ai.calls.length, 1);
});

test('mode ubah: rangkaian saat ini dikirim ke AI dan posisi lama dipertahankan', async () => {
  const ai = fakeAi(LED());
  const current = {
    parts: [{ id: 'uno', type: 'arduino-uno', props: {} }, { id: 'led1', type: 'led', props: {} }],
    connections: [{ from: 'uno:D13', to: 'led1:A' }],
    sketch: 'void loop(){}',
    diagram: { version: 1, parts: [{ id: 'uno', type: 'arduino-uno', x: -120, z: 5, rot: 0, props: {} }], wires: [] },
    inserted: [],
  };
  const res = await call({ ai, db: fakeDb() }, { body: { prompt: 'tambah resistor', lang: 'id', mode: 'modify', current } });
  assert.equal(res.body.ok, true);
  assert.match(ai.calls[0][0].content, /uno:D13 → led1:A/);
  assert.equal(res.body.diagram.parts.find((p) => p.id === 'uno').x, -120);
});
