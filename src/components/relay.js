import { createRelay } from '../parts/relay.js';
import { headerPins } from './spec.js';

export default {
  type: 'relay-module',
  name: 'Modul relay 5 V',
  category: 'output',
  icon: 'relay',
  desc: 'Saklar mekanis yang digerakkan sinyal S. LED merah menyala dan terdengar “klik” saat aktif.',
  surface: 'floor',
  create: () => createRelay(),
  pins: headerPins({ S: 'Sinyal', '+': '5 V', '-': 'Ground' }),
  behavior: { kind: 'relay', signal: 'S', vcc: '+', gnd: '-' },
};
