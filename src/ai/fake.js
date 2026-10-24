// Jawaban AI contoh untuk pengembangan (`?fakeai=1`, hanya `npm run dev`): seluruh alur kotak AI
// bisa diuji tanpa kunci penyedia AI. ?fakeai=fail / ?fakeai=quota meniru kegagalan.
import { layoutCircuit } from './layout.js';

const BLINK = `const int LED = 13;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(LED, HIGH);
  delay(500);
  digitalWrite(LED, LOW);
  delay(500);
}
`;

export async function fakeRequest({ mode, current, variant = '1' }) {
  await new Promise((r) => setTimeout(r, 1200));
  if (variant === 'quota') return { ok: false, code: 'quota', limit: 1 };
  if (variant === 'fail') {
    return { ok: false, code: 'failed', reason: 'compile', details: ["sketch.ino:4: error: 'pump' was not declared in this scope"], missing: [{ component: 'Pompa air mini', reason: 'tidak ada di katalog' }] };
  }
  let result;
  let previous = null;
  if (mode === 'modify' && current) {
    previous = { diagram: current.diagram, inserted: new Map(current.inserted) };
    result = {
      title: 'Rangkaian + buzzer',
      summary: 'Buzzer ditambahkan di pin D8 dan berbunyi singkat setiap detik (jawaban contoh).',
      feasible: true,
      parts: [...current.parts.map((p) => ({ id: p.id, type: p.type, props: Object.entries(p.props ?? {}).map(([key, value]) => ({ key, value: String(value) })) })), { id: 'bz1', type: 'buzzer', props: [] }],
      connections: [...current.connections, { from: 'uno:D8', to: 'bz1:+' }, { from: 'bz1:-', to: 'uno:GND.2' }],
      sketch: `${current.sketch}\n// buzzer contoh di D8\n`,
      substitutions: [],
      missing: [],
      changes: ['Menambah buzzer di D8 (contoh)'],
    };
  } else {
    result = {
      title: 'LED berkedip (contoh)',
      summary: 'LED merah di pin 13 lewat resistor 220 Ω, berkedip setiap setengah detik (jawaban contoh).',
      feasible: true,
      parts: [
        { id: 'uno', type: 'arduino-uno', props: [] },
        { id: 'r1', type: 'resistor', props: [{ key: 'ohms', value: '220' }] },
        { id: 'led1', type: 'led', props: [{ key: 'color', value: 'red' }] },
      ],
      connections: [
        { from: 'uno:D13', to: 'r1:1' },
        { from: 'r1:2', to: 'led1:A' },
        { from: 'led1:K', to: 'uno:GND.1' },
      ],
      sketch: BLINK,
      substitutions: [{ requested: 'lampu', used: 'led', reason: 'Contoh pengganti.' }],
      missing: [],
      changes: [],
    };
  }
  const { diagram } = layoutCircuit(result, { previous });
  return { ok: true, result, diagram, sketch: result.sketch, issues: [], compile: { size: 924 }, usage: { today: 1, limit: 1 } };
}
