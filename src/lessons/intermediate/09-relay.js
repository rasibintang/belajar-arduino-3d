import { createRelay } from '../../parts/relay.js';
import { createBulb, createPlug } from '../../parts/bulb.js';
import { click } from '../../sim/audio.js';

let lastOn = false;

/** Rangkaian relay + bohlam + steker (dipakai juga di pelajaran termostat). */
export function buildMains(kit, { relayAt, bulbAt, plugAt }) {
  const relay = kit.put('relay', createRelay(), ...relayAt);
  const bulb = kit.put('bulb', bulbAt.load ? bulbAt.load() : createBulb(), bulbAt.x, bulbAt.z, bulbAt.rot ?? 0);
  const plug = kit.put('plug', createPlug(), ...plugAt);
  const t = (part, v) => {
    part.updateMatrixWorld(true);
    return part.localToWorld(v.clone());
  };
  const loadTerms = bulb.userData.terms;
  kit.wire(t(plug, plug.userData.term), t(relay, relay.userData.terms.COM), 'brown', { bare: true, radius: 1.6, lift: 6 });
  kit.wire(t(relay, relay.userData.terms.NO), t(bulb, loadTerms.a), 'brown', { bare: true, radius: 1.6, lift: 4 });
  kit.wire(t(bulb, loadTerms.b), t(plug, plug.userData.term).add({ x: 3, y: 0, z: 0 }), 'blue', { bare: true, radius: 1.6, lift: 14 });
  return { relay, bulb, plug };
}

/** Bunyi klik saat relay berpindah. */
export function relayClick(on) {
  if (on !== lastOn) {
    lastOn = on;
    click();
  }
}

export default {
  id: 'relay',
  title: 'Relay & lampu',
  heading: 'Relay & lampu',
  thumb: () => createRelay(),
  summary:
    'Pin Arduino hanya mampu 5 V dan beberapa miliampere. Relay adalah saklar mekanis yang digerakkan elektromagnet: sinyal kecil dari Arduino membuka atau menutup kontak untuk listrik rumah yang jauh lebih besar.',
  features: [
    { icon: 'relay', html: 'Dengar bunyi “klik” saat kontak berpindah' },
    { icon: 'bulb', html: 'Bohlam AC menyala lewat kontak NO' },
    { icon: 'clock', html: 'Klik relay untuk mengatur jadwal' },
  ],

  callouts: [
    { slot: 'tc', icon: 'relay', title: 'Modul relay', text: 'Klik untuk mengatur lama nyala/mati.', anchor: (p) => p.relay.userData.anchor },
    { slot: 'tr', icon: 'bulb', title: 'Bohlam', text: 'Disambung lewat COM dan NO.', anchor: (p) => p.bulb.userData.anchor },
    { slot: 'bl', icon: 'pin', title: 'Pin 7', text: 'HIGH = kumparan aktif, kontak menutup.', anchor: (p) => p.board.userData.pinAnchor('D7') },
    { slot: 'br', icon: 'bolt', title: 'Listrik AC', text: 'Bahaya! Hanya simulasi di sini.', anchor: (p) => p.plug.userData.anchor },
  ],

  build(kit) {
    kit.board(-82, 0);
    const { relay } = buildMains(kit, { relayAt: [-2, 55], bulbAt: { x: 70, z: 50 }, plugAt: [70, 112] });
    kit.wire(kit.pin('D7'), kit.pinOf(relay, 'S'), 'orange', { lift: 6 });
    kit.wire(kit.pin('5V'), kit.pinOf(relay, '+'), 'red', { lift: 2 });
    kit.wire(kit.pin('GND'), kit.pinOf(relay, '-'), 'black', { lift: 4 });
  },

  params: [
    { key: 'on', part: 'relay', label: 'Lama nyala', type: 'range', min: 300, max: 5000, step: 100, value: 2000, unit: 'ms' },
    { key: 'off', part: 'relay', label: 'Lama mati', type: 'range', min: 300, max: 5000, step: 100, value: 1500, unit: 'ms' },
  ],

  code: `const int RELAY = 7;

void setup() {
  pinMode(RELAY, OUTPUT);
}

void loop() {
  digitalWrite(RELAY, HIGH);   // lampu nyala
  delay({{on}});
  digitalWrite(RELAY, LOW);    // lampu mati
  delay({{off}});
}`,
  explain: [
    'Pin 7 HIGH mengalirkan arus ke kumparan relay; medan magnetnya menarik kontak sehingga <b>COM</b> tersambung ke <b>NO</b>.',
    'Bohlam berada di rangkaian AC yang <i>terpisah</i> dari Arduino — hanya kontak relay yang menyambungkannya.',
    'Pin LOW melepas kumparan; pegas mengembalikan kontak ke <b>NC</b> dan bohlam padam.',
  ],
  tip: '⚠ Listrik rumah (220 V) berbahaya. Untuk latihan, pakai lampu LED 12 V atau minta bantuan orang dewasa yang paham kelistrikan.',
  pinout: [
    { pin: 'D7', to: 'S (sinyal relay)', color: 'orange' },
    { pin: '5V', to: '+ relay', color: 'red' },
    { pin: 'GND', to: '− relay', color: 'black' },
    { pin: 'COM · NO', to: 'Memutus kabel fasa ke bohlam', color: 'brown' },
  ],
  specs: {
    name: 'Relay SRD-05VDC-SL-C',
    rows: [
      ['Tegangan kumparan', '5 V DC'],
      ['Arus kumparan', '± 70 mA'],
      ['Beban maks', '10 A @ 250 V AC'],
      ['Kontak', 'COM, NO, NC'],
      ['Waktu respons', '± 10 ms'],
      ['Pelindung', 'Dioda + optocoupler di modul'],
    ],
  },

  sketch: {
    *setup(io) {
      lastOn = false;
      io.mark('pinMode(RELAY');
      io.pinMode(7, io.OUTPUT);
      yield 100;
    },
    *loop(io, p) {
      io.mark('digitalWrite(RELAY, HIGH)');
      io.digitalWrite(7, io.HIGH);
      io.log('Relay NYALA · lampu menyala');
      yield 100;
      io.mark('delay(', 0);
      yield p.on - 100;
      io.mark('digitalWrite(RELAY, LOW)');
      io.digitalWrite(7, io.LOW);
      io.log('Relay mati · lampu padam');
      yield 100;
      io.mark('delay(', 1);
      yield p.off - 100;
    },
  },
  quietPins: [7],
  update(v, parts, dt) {
    const on = (v.pins[7] ?? 0) > 0;
    relayClick(on);
    parts.relay.userData.setOn(on);
    parts.relay.userData.tick(dt);
    parts.bulb.userData.setLevel(on ? 1 : 0);
  },
};
