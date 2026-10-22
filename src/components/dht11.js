import { createDHT } from '../parts/dht.js';
import { legsAlongX } from './spec.js';

export default {
  type: 'dht11',
  name: 'Sensor suhu & kelembapan DHT11',
  category: 'sensor',
  icon: 'thermo',
  desc: 'Mengirim suhu dan kelembapan lewat satu kabel data. Pakai library DHT (DHT11).',
  surface: 'breadboard',
  create: () => createDHT(),
  props: [
    { key: 'temp', label: 'Suhu (simulasi)', type: 'range', min: 0, max: 50, step: 1, value: 27, unit: '°C' },
    { key: 'hum', label: 'Kelembapan (simulasi)', type: 'range', min: 20, max: 90, step: 1, value: 60, unit: '%' },
  ],
  pins: legsAlongX(
    [
      ['VCC', '5 V'],
      ['DATA', 'Data'],
      ['GND', 'Ground'],
    ],
    -1.8
  ),
  behavior: { kind: 'dht', vcc: 'VCC', data: 'DATA', gnd: 'GND', tempProp: 'temp', humProp: 'hum' },
};
