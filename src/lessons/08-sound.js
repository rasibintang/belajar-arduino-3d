import { createBuzzer } from '../parts/buzzer.js';

// Frekuensi nada (Hz). 262 Hz = C tengah.
const MELODIES = {
  scale: { label: 'Tangga nada', notes: [262, 294, 330, 349, 392, 440, 494, 523] },
  twinkle: { label: 'Bintang kecil', notes: [262, 262, 392, 392, 440, 440, 392, 349, 349, 330, 330, 294, 294, 262] },
  ode: { label: 'Ode to Joy', notes: [330, 330, 349, 392, 392, 349, 330, 294, 262, 262, 294, 330, 330, 294, 294] },
};

function notesCode(notes) {
  const rows = [];
  for (let i = 0; i < notes.length; i += 8) rows.push('  ' + notes.slice(i, i + 8).join(', '));
  return `int melody[] = {\n${rows.join(',\n')}\n};`;
}

export default {
  id: 'sound',
  title: 'Bunyikan nada',
  heading: 'Bunyikan nada',
  thumb: () => createBuzzer(),
  summary:
    'Buzzer piezo berbunyi “klik” setiap kali pinnya berganti keadaan. Lakukan ratusan kali per detik dan terdengarlah nada — itulah yang dikerjakan <code>tone()</code>.',
  features: [
    { icon: 'sound', html: 'Mainkan nada dengan <code>tone(pin, Hz, ms)</code>' },
    { icon: 'clock', html: 'Klik buzzer untuk memilih lagu dan tempo' },
    { icon: 'volume', html: 'Suara bisa dimatikan di Pengaturan' },
  ],

  callouts: [
    { slot: 'tc', icon: 'sound', title: 'Buzzer piezo', text: '<code>tone()</code> menggetarkannya sesuai nada.', anchor: (p) => p.buzzer.userData.anchor },
    { slot: 'tr', icon: 'pin', title: 'Pin 8', text: 'Timer di chip menjaga nadanya tetap pas.', anchor: (p) => p.board.userData.pinAnchor('D8') },
    { slot: 'bl', icon: 'gnd', title: 'GND', text: 'Kaki pendek buzzer ke ground.', anchor: (p) => p.board.userData.pinAnchor('GND') },
  ],

  build(kit) {
    kit.board();
    kit.breadboard();
    kit.place('buzzer', createBuzzer(), kit.hole('c', 15), kit.hole('c', 18));
    kit.wire(kit.pin('D8'), kit.hole('a', 18), 'orange', { lift: 4 });
    kit.wire(kit.pin('GND'), kit.hole('a', 15), 'black', { lift: 10 });
  },

  params: [
    {
      key: 'melody',
      part: 'buzzer',
      label: 'Lagu',
      type: 'choice',
      value: 'twinkle',
      options: Object.entries(MELODIES).map(([value, m]) => ({ value, label: m.label, code: { notes: notesCode(m.notes) } })),
    },
    { key: 'note', part: 'buzzer', label: 'Panjang nada', type: 'range', min: 100, max: 600, step: 25, value: 300, unit: 'ms' },
  ],

  code: `const int BUZZER = 8;
{{melody.notes}}
const int N = sizeof(melody) / sizeof(int);

void setup() {}

void loop() {
  for (int i = 0; i < N; i++) {
    tone(BUZZER, melody[i], {{note}});
    delay({{note}} + 50);
  }
  delay(1000);
}`,
  explain: [
    'Larik <code>melody</code> menyimpan frekuensi tiap nada dalam hertz: 262 Hz adalah C tengah.',
    '<code>tone(BUZZER, hz, ms)</code> memainkan gelombang kotak selama <code>ms</code> milidetik.',
    '<code>delay</code> setelah tiap nada memberi jeda singkat agar nada yang sama tetap terdengar terpisah.',
    'Setelah nada terakhir, loop beristirahat satu detik lalu mulai lagi.',
  ],
  tip: 'Buzzer <b>aktif</b> hanya bisa berbunyi satu nada. Untuk lagu, pakai buzzer <b>pasif</b> seperti di sini.',
  pinout: [
    { pin: 'D8', to: 'Kaki + buzzer', color: 'orange' },
    { pin: 'GND', to: 'Kaki − buzzer', color: 'black' },
  ],
  specs: {
    name: 'Buzzer piezo pasif',
    rows: [
      ['Tegangan', '3–5 V'],
      ['Rentang nada', '± 100 Hz – 10 kHz'],
      ['Paling nyaring', '± 2–4 kHz'],
      ['Arus', '< 30 mA'],
      ['Diameter', '12 mm'],
    ],
  },

  sketch: {
    *loop(io, p) {
      const notes = MELODIES[p.melody].notes;
      for (let i = 0; i < notes.length; i++) {
        io.mark('tone(BUZZER');
        io.tone(8, notes[i], p.note);
        yield p.note * 0.5;
        io.mark(' + 50');
        yield p.note * 0.5 + 50;
      }
      io.mark('delay(1000)');
      yield 1000;
    },
  },
  update(v, parts, dt) {
    parts.buzzer.userData.setTone(v.tone);
    parts.buzzer.userData.tick(dt);
  },
};
