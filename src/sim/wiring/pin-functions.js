/**
 * Fungsi setiap titik sambung — dasar aturan panduan kabel.
 * Sumber: dokumentasi Arduino Uno (pin PWM, interupsi, Serial, SPI, I²C) dan datasheet komponen.
 */

export const PIN_FNS = [
  'gnd', 'vcc5', 'vcc33', 'pot-end', 'tie-gnd',
  'i2c-sda', 'i2c-scl', 'spi-mosi', 'spi-miso', 'spi-sck', 'spi-cs',
  'analog-out', 'pwm-in', 'interrupt-out', 'digital-in', 'digital-out', 'digital-io',
  'led-anode', 'led-cathode', 'neutral',
  'mcu-gnd', 'mcu-5v', 'mcu-3v3', 'mcu-vin', 'mcu-digital', 'mcu-analog', 'mcu-other',
  'supply-5v', 'supply-gnd', 'hole', 'rail+', 'rail-',
];

const I2C = { sda: 'i2c-sda', scl: 'i2c-scl' };
const SPI = { mosi: 'spi-mosi', miso: 'spi-miso', sck: 'spi-sck', cs: 'spi-cs' };
const DIN = 'digital-in';
const DOUT = 'digital-out';

/** Peran perilaku → fungsi, per jenis perilaku (nilai larik = semua pin di daftar itu). */
const ROLE_FNS = {
  '*': { vcc: 'vcc5', vdd: 'vcc5', gnd: 'gnd', vss: 'gnd' },
  'i2c-lcd': I2C,
  'i2c-rtc': I2C,
  oled: I2C,
  mpu6050: I2C,
  bmp180: I2C,
  ili9341: { ...I2C, ...SPI, dc: DIN, rst: DIN },
  mfrc522: { ...SPI, rst: DIN },
  microsd: SPI,
  epaper: { ...SPI, busy: DOUT, dc: DIN, rst: DIN },
  pot: { wiper: 'analog-out', end1: 'pot-end', end2: 'pot-end' },
  joystick: { x: 'analog-out', y: 'analog-out', sw: DOUT },
  ntc: { out: 'analog-out' },
  mq2: { aout: 'analog-out', dout: DOUT },
  mux16: { sig: 'analog-out', select: DIN, en: DIN },
  servo: { signal: 'pwm-in' },
  encoder: { clk: 'interrupt-out', dt: DOUT },
  led: { anode: 'led-anode', cathode: 'led-cathode' },
  'rgb-led': { red: 'led-anode', green: 'led-anode', blue: 'led-anode', cathode: 'led-cathode' },
  seg7: { segments: 'led-anode', common: 'led-cathode' },
  'lcd-parallel': { rw: 'tie-gnd', rs: DIN, e: DIN, inputs: DIN },
  pir: { out: DOUT },
  hcsr04: { echo: DOUT, trig: DIN },
  'ir-receiver': { dat: DOUT },
  hx711: { dt: DOUT, sck: DIN },
  gate: { y: DOUT, inputs: DIN },
  mux2: { out: DOUT, a: DIN, b: DIN, sel: DIN },
  dff: { q: DOUT, notq: DOUT, d: DIN, clk: DIN, set: DIN, reset: DIN },
  clock: { clk: DOUT },
  hc165: { q7: DOUT, notq7: DOUT, pl: DIN, cp: DIN, ce: DIN },
  dht: { data: 'digital-io' },
  ds18b20: { dq: 'digital-io' },
  tm1637: { dio: 'digital-io', clk: DIN },
  keypad: { rows: 'digital-io', cols: 'digital-io' },
  relay: { signal: DIN },
  hc595: { data: DIN, shift: DIN, latch: DIN, oe: DIN, mr: DIN },
  ws2812: { din: DIN },
  stepper: { inputs: DIN },
  a4988: { step: DIN, dir: DIN, enable: DIN, sleep: DIN, reset: DIN, ms: DIN },
  indicator: { outputs: DIN },
  buzzer: { plus: DIN, minus: 'gnd' },
  max7219: { din: DIN, cs: DIN, clk: DIN },
  pcd8544: { rst: DIN, ce: DIN, dc: DIN, din: DIN, clk: DIN },
};

/** Cadangan dari id pin bila pin tidak punya peran. */
const ID_FNS = {
  vcc5: ['VCC', 'VDD', 'VIN', 'VMOT', '5V', '+', 'V+', '+5V'],
  vcc33: ['3.3V', '3V3'],
  gnd: ['GND', 'GND2', '-', 'VSS'],
};

/** Komponen pasif: kakinya selalu netral, apa pun namanya (mis. "+" pada motor DC). */
const PASSIVE = ['resistor', 'ldr', 'switch', 'slide-switch', 'dip', 'npn', 'dc-motor', 'bipolar', 'dpdt', 'none'];

function mcuFunction(pinId) {
  if (/^GND/.test(pinId)) return 'mcu-gnd';
  if (pinId === '5V' || pinId === 'IOREF') return 'mcu-5v';
  if (pinId === '3V3') return 'mcu-3v3';
  if (pinId === 'VIN') return 'mcu-vin';
  if (/^D\d+$/.test(pinId)) return 'mcu-digital';
  if (/^A[0-5]$/.test(pinId) || pinId === 'SDA' || pinId === 'SCL') return 'mcu-analog';
  return 'mcu-other';
}

/** Fungsi sebuah pin komponen (salah satu PIN_FNS). */
export function pinFunction(spec, pinId) {
  const b = spec.behavior ?? {};
  if (b.kind === 'mcu') return mcuFunction(pinId);
  if (b.kind === 'breadboard') {
    if (/^(tp|bp)/.test(pinId)) return 'rail+';
    if (/^(tn|bn)/.test(pinId)) return 'rail-';
    return 'hole';
  }
  if (b.kind === 'source') return b.volts === 0 ? 'supply-gnd' : 'supply-5v';

  const table = { ...ROLE_FNS['*'], ...ROLE_FNS[b.kind] };
  for (const [role, fn] of Object.entries(table)) {
    const v = b[role];
    if (v === pinId || (Array.isArray(v) && v.includes(pinId))) {
      if (fn === 'vcc5' && ID_FNS.vcc33.includes(pinId)) return 'vcc33';
      return fn;
    }
  }
  if (PASSIVE.includes(b.kind)) return 'neutral';
  for (const [fn, ids] of Object.entries(ID_FNS)) if (ids.includes(pinId)) return fn;
  return 'neutral';
}

const PWM = [3, 5, 6, 9, 10, 11];
const SPI_PINS = { 11: 'mosi', 12: 'miso', 13: 'sck' };
const I2C_PINS = { A4: 'sda', SDA: 'sda', A5: 'scl', SCL: 'scl' };

/** Kemampuan sebuah pin Arduino Uno. */
export function mcuPinInfo(pinId) {
  const d = /^D(\d+)$/.exec(pinId);
  const n = d ? Number(d[1]) : -1;
  return {
    pwm: PWM.includes(n),
    interrupt: n === 2 || n === 3,
    serial: n === 0 || n === 1,
    spi: SPI_PINS[n] ?? null,
    i2c: I2C_PINS[pinId] ?? null,
    analog: /^A[0-5]$/.test(pinId) || pinId === 'SDA' || pinId === 'SCL',
    digital: d !== null,
  };
}
