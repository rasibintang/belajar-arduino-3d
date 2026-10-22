import { createTransistor } from '../parts/transistor.js';
import { createResistor } from '../parts/resistor.js';
import { createMotor } from '../parts/motor.js';

export default {
  id: 'motor',
  title: 'Putar motor',
  heading: 'Kendalikan motor',
  thumb: () => createMotor(),
  summary:
    'Pin Arduino tidak kuat menggerakkan motor sendirian, jadi transistor yang mengangkat beban beratnya. PWM menyalakan-matikannya sangat cepat untuk mengatur kecepatan.',
  features: [
    { icon: 'pwm', html: 'Kecepatan 0–255 dengan <code>analogWrite()</code>' },
    { icon: 'transistor', html: 'TIP120 mengalirkan arus motor' },
    { icon: 'motor', html: 'Klik motor untuk mengubah tanjakan' },
  ],

  callouts: [
    { slot: 'tl', icon: 'pwm', title: 'Pin ~6 (PWM)', text: '<code>analogWrite()</code> mengatur kecepatan, 0–255.', anchor: (p) => p.board.userData.pinAnchor('D6') },
    { slot: 'tc', icon: 'resistor', title: 'Resistor 1 kΩ', text: 'Menjaga arus basis tetap aman untuk pin.', anchor: (p) => p.resistor.userData.anchor },
    { slot: 'tr', icon: 'transistor', title: 'Transistor', text: 'Arus kecil di basis menyalakan motor.', anchor: (p) => p.transistor.userData.anchor },
    { slot: 'br', icon: 'motor', title: 'Motor DC', text: 'Klik untuk mengubah tanjakan kecepatan.', anchor: (p) => p.motor.userData.anchor },
  ],

  build(kit) {
    kit.board();
    kit.breadboard();
    kit.place('transistor', createTransistor(), kit.hole('c', 20), kit.hole('c', 22));
    kit.place('resistor', createResistor({ ohms: 1000, span: 4 * kit.PITCH }), kit.hole('b', 16), kit.hole('b', 20));
    const motor = kit.put('motor', createMotor(), 6, 66);
    motor.updateMatrixWorld(true);
    const plus = motor.userData.terminals.plus.getWorldPosition(motor.position.clone());
    const minus = motor.userData.terminals.minus.getWorldPosition(motor.position.clone());

    kit.wire(kit.pin('D6'), kit.hole('a', 16), 'orange', { lift: 4 });
    kit.wire(kit.pin('GND'), kit.hole('a', 22), 'black', { lift: 12 });
    kit.wire(plus, kit.pin('5V'), 'red', { lift: 2 });
    kit.wire(minus, kit.hole('e', 21), 'black', { lift: 2 });
  },

  params: [
    { key: 'top', part: 'motor', label: 'Kecepatan puncak', type: 'range', min: 50, max: 255, step: 5, value: 255 },
    {
      key: 'step',
      part: 'motor',
      label: 'Langkah tanjakan',
      type: 'choice',
      value: 5,
      options: [1, 5, 15].map((v) => ({ value: v, label: `+${v}` })),
    },
  ],

  code: `const int MOTOR = 6;  // pin PWM

void setup() {
  pinMode(MOTOR, OUTPUT);
}

void loop() {
  for (int s = 0; s <= {{top}}; s += {{step}}) {
    analogWrite(MOTOR, s);
    delay(40);
  }
  delay(1500);
  analogWrite(MOTOR, 0);
  delay(1500);
}`,
  explain: [
    '<code>analogWrite(MOTOR, s)</code> mengatur siklus kerja PWM: 0 mati, 255 menyala penuh.',
    'Loop <code>for</code> menaikkan <code>s</code> sedikit demi sedikit setiap 40 ms — tanjakan yang halus.',
    'Setelah bertahan di kecepatan puncak, menulis 0 membuat motor melambat sampai berhenti.',
  ],
  tip: 'Pada rangkaian sungguhan, pasang dioda (mis. 1N4001) sejajar motor untuk meredam lonjakan tegangan saat motor dimatikan.',
  pinout: [
    { pin: '~6', to: 'Resistor 1 kΩ → basis transistor', color: 'orange' },
    { pin: 'GND', to: 'Emitor transistor', color: 'black' },
    { pin: '5V', to: 'Terminal + motor', color: 'red' },
    { pin: '—', to: 'Terminal − motor → kolektor', color: 'black' },
  ],
  specs: {
    name: 'TIP120 + motor DC 130',
    rows: [
      ['Transistor', 'NPN Darlington TIP120'],
      ['Arus kolektor maks', '5 A'],
      ['Penguatan (hFE)', '≥ 1000'],
      ['Motor', '3–6 V DC'],
      ['Putaran tanpa beban', '± 9.000 rpm @ 3 V'],
    ],
  },

  sketch: {
    *setup(io) {
      io.pinMode(6, io.OUTPUT);
    },
    *loop(io, p) {
      for (let s = 0; s <= p.top; s += p.step) {
        io.mark('analogWrite(MOTOR, s)');
        io.analogWrite(6, s);
        yield 40;
      }
      io.mark('delay(1500)', 0);
      yield 1500;
      io.mark('analogWrite(MOTOR, 0)');
      io.analogWrite(6, 0);
      yield 100;
      io.mark('delay(1500)', 1);
      yield 1400;
    },
  },
  update(v, parts, dt) {
    parts.motor.userData.setSpeed(v.pins[6] ?? 0);
    parts.motor.userData.tick(dt);
  },
};
