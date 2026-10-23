import { createNTC, createPIR, createMQ2 } from '../parts/sensors-extra.js';
import { createDHT } from '../parts/dht.js';
import { createRTC } from '../parts/rtc.js';
import { legsAlongX, headerPins } from './spec.js';
import dht11 from './dht11.js';
import rtc from './rtc.js';

export const ntc = {
  type: 'ntc-sensor',
  name: 'Sensor suhu NTC',
  category: 'sensor',
  icon: 'thermo',
  desc: 'Keluaran analog: makin panas, tegangan OUT makin kecil. Hitung suhu dengan rumus β.',
  surface: 'floor',
  create: () => createNTC(),
  props: [{ key: 'temp', label: 'Suhu (simulasi)', type: 'range', min: -24, max: 80, step: 1, value: 24, unit: '°C' }],
  pins: headerPins({ GND: 'Ground', VCC: '5 V', OUT: 'Keluaran analog' }),
  behavior: { kind: 'ntc', vcc: 'VCC', out: 'OUT', gnd: 'GND', tempProp: 'temp', beta: 3950 },
};

export const pir = {
  type: 'pir-sensor',
  name: 'Sensor gerak PIR',
  category: 'sensor',
  icon: 'sonar',
  desc: 'OUT HIGH selama ± 5 detik setelah ada gerakan. Klik sensor saat simulasi untuk memicu.',
  surface: 'floor',
  create: () => createPIR(),
  props: [{ key: 'hold', label: 'Lama aktif', type: 'range', min: 1, max: 20, step: 1, value: 5, unit: 'detik' }],
  pins: headerPins({ VCC: '5 V', OUT: 'Keluaran', GND: 'Ground' }),
  behavior: { kind: 'pir', vcc: 'VCC', out: 'OUT', gnd: 'GND', holdProp: 'hold' },
};

export const mq2 = {
  type: 'mq2-sensor',
  name: 'Sensor gas MQ2',
  category: 'sensor',
  icon: 'sun',
  desc: 'AOUT naik sesuai kadar gas/asap; DOUT menjadi LOW bila melewati ambang.',
  surface: 'floor',
  create: () => createMQ2(),
  props: [
    { key: 'gas', label: 'Kadar gas (simulasi)', type: 'range', min: 0, max: 1023, step: 1, value: 120 },
    { key: 'threshold', label: 'Ambang DOUT', type: 'range', min: 0, max: 1023, step: 1, value: 500 },
  ],
  pins: headerPins({ VCC: '5 V', GND: 'Ground', DOUT: 'Keluaran digital', AOUT: 'Keluaran analog' }),
  behavior: { kind: 'mq2', vcc: 'VCC', gnd: 'GND', dout: 'DOUT', aout: 'AOUT', gasProp: 'gas', thresholdProp: 'threshold' },
};

export const dht22 = {
  ...dht11,
  type: 'dht22',
  name: 'Sensor suhu & kelembapan DHT22',
  desc: 'Lebih teliti dari DHT11 (resolusi 0,1). Pakai library DHT dengan tipe DHT22.',
  create: () => createDHT({ variant: 'dht22' }),
  props: [
    { key: 'temp', label: 'Suhu (simulasi)', type: 'range', min: -40, max: 80, step: 0.1, value: 24.5, unit: '°C' },
    { key: 'hum', label: 'Kelembapan (simulasi)', type: 'range', min: 0, max: 100, step: 0.1, value: 55, unit: '%' },
  ],
  pins: legsAlongX(
    [
      ['VCC', '5 V'],
      ['DATA', 'Data'],
      ['GND', 'Ground'],
    ],
    -1.8
  ),
  behavior: { ...dht11.behavior, format: 'dht22' },
};

export const ds1307 = {
  ...rtc,
  type: 'rtc-ds1307',
  name: 'Jam real-time DS1307',
  desc: 'Jam lewat I²C (alamat 0x68), tanpa sensor suhu. Pakai RTC_DS1307 dari RTClib.',
  create: () => createRTC({ chip: 'DS1307' }),
  behavior: { ...rtc.behavior, chip: 'ds1307' },
};
