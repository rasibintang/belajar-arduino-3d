// Rangkaian setara di sandbox untuk setiap pelajaran (tombol "Buka di sandbox").
// Diagram dibangun dari komponen standar; kodenya = kode pelajaran dengan parameter terpilih.

import { EXAMPLES } from '../sandbox/examples.js';
import { codeText } from './index.js';

const UNO = { id: 'uno', type: 'arduino-uno', x: -82, z: 22 };
const BB = { id: 'bb', type: 'breadboard', x: 44, z: 0 };
const w = (from, to, color) => ({ from, to, color });
const ex = (id) => structuredClone(EXAMPLES.find((e) => e.id === id).diagram);

/** Ubah props satu komponen dalam diagram. */
function withProps(diagram, id, props) {
  const part = diagram.parts.find((p) => p.id === id);
  part.props = { ...(part.props ?? {}), ...props };
  return diagram;
}

/** LED + resistor 220 Ω: resistor di kolom col..col+4, anoda di col+4, katoda di col+5. */
function led(id, col, { back = false, color = 'red' } = {}) {
  const [rRow, lRow] = back ? ['g', 'i'] : ['d', 'b'];
  return [
    { id: `${id}r`, type: 'resistor', board: 'bb', hole: `${rRow}${col}`, props: { ohms: 220, span: 4 } },
    { id, type: 'led', board: 'bb', hole: `${lRow}${col + 5}`, rot: 180, props: { color } },
  ];
}

const LCD_WIRES = (lcd = 'lcd1') => [w('uno:GND', `${lcd}:GND`, 'black'), w('uno:5V', `${lcd}:VCC`, 'red'), w('uno:A4', `${lcd}:SDA`, 'blue'), w('uno:A5', `${lcd}:SCL`, 'yellow')];

const DIAGRAMS = {
  // --- Dasar ---
  board: () => ex('blink'),
  blink: (p) => withProps(withProps(ex('led'), 'r1', { ohms: p.ohms }), 'led1', { color: p.color }),
  button: () => ex('button'),
  knob: (p) => withProps(withProps(ex('pot'), 'pot1', { value: p.value }), 'led1', { color: p.color }),
  rgb: () => ex('rgb'),
  light: () => ex('ldr'),
  distance: (p) => withProps(ex('sonar'), 'sonar1', { distance: p.dist }),
  sound: () => ex('buzzer'),
  motor: () => ex('motor'),
  servo: () => ex('servo'),
  project: (p) => ({
    parts: [
      UNO,
      BB,
      { id: 'sonar1', type: 'hc-sr04', board: 'bb', hole: 'a6', props: { distance: p.dist } },
      { id: 'tl1', type: 'traffic-light', board: 'bb', hole: 'a22' },
    ],
    wires: [
      w('uno:5V', 'bb:c6', 'red'),
      w('uno:D9', 'bb:c7', 'purple'),
      w('uno:D10', 'bb:c8', 'blue'),
      w('uno:GND', 'bb:c9', 'black'),
      w('uno:GND.1', 'bb:c22', 'black'),
      w('uno:D4', 'bb:c23', 'red'),
      w('uno:D3', 'bb:c24', 'yellow'),
      w('uno:D2', 'bb:c25', 'green'),
    ],
  }),
  // --- Menengah ---
  millis: () => ({
    parts: [UNO, BB, ...led('ledA', 6, { color: 'red' }), ...led('ledB', 17, { back: true, color: 'green' })],
    wires: [w('uno:D13', 'bb:c6', 'orange'), w('uno:GND.1', 'bb:a11', 'black'), w('uno:D12', 'bb:j17', 'yellow'), w('uno:GND', 'bb:j22', 'black')],
  }),
  debounce: () => ex('button'),
  lcd: () => ex('lcd'),
  dht: (p) => withProps(ex('dht'), 'dht1', { temp: p.temp, hum: p.hum }),
  arrays: (p) => ({
    parts: [UNO, BB, { id: 'bar1', type: 'led-bar', board: 'bb', hole: 'c10', props: { color: p.color } }],
    wires: [
      ...[2, 3, 4, 5, 6, 7, 8, 9].map((pin, i) => w(`uno:D${pin}`, `bb:a${11 + i}`, ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'white', 'brown'][i])),
      w('uno:GND', 'bb:a10', 'black'),
    ],
  }),
  shift: () => ex('hc595'),
  keypad: () => {
    const d = ex('keypad');
    d.parts.push(BB, ...led('ok', 6, { color: 'green' }), ...led('bad', 18, { color: 'red' }));
    d.wires.push(w('uno:D12', 'bb:c6', 'green'), w('uno:GND', 'bb:a11', 'black'), w('uno:D11', 'bb:c18', 'red'), w('uno:GND.1', 'bb:a23', 'black'));
    return d;
  },
  joystick: () => {
    const d = ex('joystick');
    d.parts.push({ id: 'servo1', type: 'servo-sg90', x: 42, z: 0, rot: 180 });
    d.wires.push(w('uno:GND', 'servo1:GND', 'brown'), w('uno:5V', 'servo1:V+', 'red'), w('uno:D9', 'servo1:SIG', 'orange'));
    return d;
  },
  relay: () => ex('relay'),
  thermostat: (p) => ({
    parts: [
      UNO,
      BB,
      { id: 'dht1', type: 'dht11', board: 'bb', hole: 'c14', props: { temp: Math.round(p.temp), hum: 60 } },
      { id: 'lcd1', type: 'lcd-i2c', x: 150, z: 0 },
      { id: 'rl1', type: 'relay-module', x: -40, z: 72 },
    ],
    wires: [
      w('uno:5V', 'bb:a14', 'red'),
      w('uno:D2', 'bb:a15', 'green'),
      w('uno:GND', 'bb:a16', 'black'),
      ...LCD_WIRES(),
      w('uno:D7', 'rl1:S', 'orange'),
      w('uno:5V', 'rl1:+', 'red'),
      w('uno:GND.2', 'rl1:-', 'black'),
    ],
  }),
  // --- Mahir ---
  interrupt: () => {
    const d = ex('encoder');
    d.parts.push({ id: 'lcd1', type: 'lcd-i2c', x: 42, z: -6 });
    d.wires.push(...LCD_WIRES());
    return d;
  },
  stepper: () => ex('stepper'),
  serial: () => ex('rgb'),
  rtc: () => ex('rtc'),
  eeprom: () => ex('button'),
  neopixel: () => ex('neopixel'),
  state: () => ({
    parts: [
      UNO,
      BB,
      { id: 'tl1', type: 'traffic-light', board: 'bb', hole: 'a26' },
      { id: 'btn1', type: 'push-button', board: 'bb', hole: 'f5' },
      { id: 'pd', type: 'resistor', board: 'bb', hole: 'c7', props: { ohms: 10000, span: 4 } },
      ...led('stop', 13, { back: true, color: 'red' }),
      ...led('walk', 20, { back: true, color: 'green' }),
      { id: 'bz1', type: 'buzzer', board: 'bb', hole: 'c15' },
    ],
    wires: [
      w('uno:GND.1', 'bb:c26', 'black'),
      w('uno:D4', 'bb:c27', 'red'),
      w('uno:D3', 'bb:c28', 'yellow'),
      w('uno:D2', 'bb:c29', 'green'),
      w('uno:5V', 'bb:j5', 'red'),
      w('uno:D7', 'bb:a7', 'blue'),
      w('uno:GND', 'bb:a11', 'black'),
      w('uno:D12', 'bb:j13', 'orange'),
      w('uno:GND.2', 'bb:j18', 'black'),
      w('uno:D11', 'bb:j20', 'green'),
      w('uno:GND', 'bb:j25', 'black'),
      w('uno:D8', 'bb:a18', 'purple'),
      w('uno:GND.2', 'bb:a15', 'black'),
    ],
  }),
};

/** Proyek sandbox untuk pelajaran, atau null bila komponennya belum tersedia di sandbox. */
export function sandboxProject(lesson, params) {
  const make = DIAGRAMS[lesson.id];
  if (!make) return null;
  return { name: lesson.heading, sketch: codeText(lesson, params), diagram: make(params) };
}

export const hasSandbox = (lesson) => lesson.id in DIAGRAMS;
