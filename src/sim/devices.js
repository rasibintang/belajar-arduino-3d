import { Meter } from './meter.js';
import { FREQ } from './avr.js';
import { LcdI2C } from './hd44780.js';
import { holdTone } from './audio.js';
import { powered } from './device-utils.js';
import {
  rgbLedDevice,
  ldrDevice,
  indicatorDevice,
  seg7Device,
  npnDevice,
  motorDevice,
  relayDevice,
  joystickDevice,
  keypadDevice,
  hc595Device,
  ws2812Device,
  dhtDevice,
  rtcDevice,
  encoderDevice,
  stepperDevice,
} from './devices-more.js';

/**
 * Perangkat simulasi untuk setiap jenis perilaku komponen (spec.behavior.kind).
 * Setiap fungsi menerima (part, ctx, node) dan mengembalikan objek perangkat:
 *   attach(runner)       — saat emulator dipasang
 *   afterSolve(cycles)   — setelah tegangan rangkaian dihitung ulang
 *   frame(dt, cycles)    — tiap frame animasi: perbarui tampilan 3D
 *   stop()               — simulasi berhenti
 * Lihat Circuit.deviceContext() untuk isi ctx.
 */
const FACTORIES = {
  mcu: unoDevice,
  breadboard: () => null,
  led: ledDevice,
  resistor: (part, ctx, n) => {
    const b = part.spec.behavior;
    ctx.resistor(n(b.a), n(b.b), () => part.props[b.ohmsProp]);
    return null;
  },
  switch: switchDevice,
  pot: potDevice,
  buzzer: buzzerDevice,
  servo: servoDevice,
  'i2c-lcd': lcdDevice,
  hcsr04: sonarDevice,
  'rgb-led': rgbLedDevice,
  ldr: ldrDevice,
  indicator: indicatorDevice,
  seg7: seg7Device,
  npn: npnDevice,
  'dc-motor': motorDevice,
  relay: relayDevice,
  joystick: joystickDevice,
  keypad: keypadDevice,
  hc595: hc595Device,
  ws2812: ws2812Device,
  dht: dhtDevice,
  'i2c-rtc': rtcDevice,
  encoder: encoderDevice,
  stepper: stepperDevice,
};

export function createDevice(part, ctx) {
  const factory = FACTORIES[part.spec.behavior.kind];
  if (!factory) return null;
  return factory(part, ctx, (pin) => `${part.id}:${pin}`);
}

// ---------------------------------------------------------------- Arduino Uno
function unoDevice(part, ctx, n) {
  const ud = part.group.userData;
  const L = new Meter();
  let tx = 0;
  ctx.consumer(n('D13'));
  return {
    attach(runner) {
      const prev = runner.hooks.onSerial;
      runner.hooks.onSerial = (b) => {
        tx = 0.06;
        prev?.(b);
      };
    },
    afterSolve(cycles) {
      const v = ctx.volts(n('D13'));
      L.set(v !== null && v > 2.5 ? 1 : 0, cycles);
    },
    frame(dt, cycles) {
      ud.setLed('ON', 1);
      ud.setLed('L', L.take(cycles));
      tx = Math.max(0, tx - dt);
      ud.setLed('TX', tx > 0 ? 1 : 0);
      ud.setLed('RX', 0);
    },
    stop() {
      for (const name of ['ON', 'L', 'TX', 'RX']) ud.setLed(name, 0);
    },
  };
}

// ---------------------------------------------------------------- LED
function ledDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const A = n(b.anode);
  const K = n(b.cathode);
  const meter = new Meter();
  ctx.consumer(A);
  ctx.consumer(K);
  return {
    afterSolve(cycles) {
      const va = ctx.volts(A);
      const vk = ctx.volts(K);
      let level = 0;
      if (va !== null && vk !== null) {
        const vf = b.vf?.[part.props.color] ?? 2;
        const over = va - vk - vf;
        if (over > 0) {
          const ohms = ctx.seriesOhms(A, K);
          if (ohms < 10) ctx.warn(`led-${part.id}`, `LED ${part.id} tanpa resistor — pada rangkaian nyata LED bisa rusak.`);
          const mA = (over / Math.max(ohms, 10)) * 1000;
          level = Math.min(1, mA / 12);
        }
      }
      meter.set(level, cycles);
    },
    frame(dt, cycles) {
      part.group.userData.setLevel(meter.take(cycles));
    },
    stop() {
      part.group.userData.setLevel(0);
    },
  };
}

// ---------------------------------------------------------------- tombol
function switchDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  for (const [a, c] of b.pressed ?? []) ctx.switch(n(a), n(c), () => !!ud.pressed);
  ud.onChange = () => ctx.changed();
  return {
    stop() {
      ud.onChange = null;
    },
  };
}

// ---------------------------------------------------------------- potensiometer
function potDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const pos = () => Math.min(1, Math.max(0, part.props[b.positionProp] / 1023));
  // posisi 1023 = wiper di ujung 1 (bila ujung 1 = 5V, terbaca 1023)
  ctx.resistor(n(b.end1), n(b.wiper), () => Math.max(1, b.ohms * (1 - pos())));
  ctx.resistor(n(b.wiper), n(b.end2), () => Math.max(1, b.ohms * pos()));
  part.onPropsChange = () => ctx.changed();
  return {
    stop() {
      part.onPropsChange = null;
    },
  };
}

// ---------------------------------------------------------------- buzzer
function buzzerDevice(part, ctx, n) {
  const b = part.spec.behavior;
  let lastRise = 0;
  let lastEdge = -1e12;
  let hz = 0;
  ctx.watch(n(b.plus), (high, cycles) => {
    lastEdge = cycles;
    if (!high) return;
    const period = cycles - lastRise;
    lastRise = cycles;
    if (period > 0) hz = FREQ / period;
  });
  return {
    frame(dt, cycles) {
      const active = cycles - lastEdge < FREQ * 0.05 && hz > 20 && hz < 20000;
      const tone = active ? hz : 0;
      holdTone(tone);
      part.group.userData.setTone(tone);
      part.group.userData.tick(dt);
    },
    stop() {
      holdTone(0);
      part.group.userData.setTone(0);
    },
  };
}

// ---------------------------------------------------------------- servo
function servoDevice(part, ctx, n) {
  const b = part.spec.behavior;
  let rise = 0;
  let target = 90;
  let shown = 90;
  ctx.watch(n(b.signal), (high, cycles) => {
    if (high) {
      rise = cycles;
      return;
    }
    const us = ((cycles - rise) / FREQ) * 1e6;
    if (us > 400 && us < 2700) {
      target = Math.min(180, Math.max(0, ((us - b.minPulseUs) / (b.maxPulseUs - b.minPulseUs)) * 180));
    }
  });
  return {
    frame(dt) {
      if (!powered(ctx, n(b.vcc), n(b.gnd))) {
        ctx.warn(`servo-${part.id}`, `Servo ${part.id} belum mendapat daya (sambungkan V+ ke 5V dan GND).`);
        return;
      }
      const step = 600 * dt; // ± 0,1 detik / 60°
      shown += Math.max(-step, Math.min(step, target - shown));
      part.group.userData.setAngle(shown);
    },
  };
}

// ---------------------------------------------------------------- LCD I²C
function lcdDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  const lcd = new LcdI2C(part.props[b.addressProp], { cols: b.cols, rows: b.rows });
  const sdaPin = ctx.mcuPinOf(n(b.sda));
  const sclPin = ctx.mcuPinOf(n(b.scl));
  return {
    attach(runner) {
      if (sdaPin === 'A4' && sclPin === 'A5') runner.i2c.devices.set(lcd.address, lcd);
      else ctx.warn(`lcd-${part.id}`, `LCD ${part.id}: sambungkan SDA ke A4/SDA dan SCL ke A5/SCL.`);
    },
    frame() {
      const on = powered(ctx, n(b.vcc), n(b.gnd));
      ud.setBacklight(on && lcd.backlight);
      ud.setText(on && lcd.displayOn ? lcd.lines() : ['', '']);
    },
    stop() {
      ud.setBacklight(false);
      ud.setText(['', '']);
    },
  };
}

// ---------------------------------------------------------------- HC-SR04
function sonarDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  let rise = 0;
  let echo = false;
  let pingAt = -1;
  ctx.drive(n(b.echo), () => (powered(ctx, n(b.vcc), n(b.gnd)) ? (echo ? 5 : 0) : null));
  ctx.watch(n(b.trig), (high, cycles) => {
    if (high) {
      rise = cycles;
      return;
    }
    const us = ((cycles - rise) / FREQ) * 1e6;
    if (us < 8 || echo || !powered(ctx, n(b.vcc), n(b.gnd))) return;
    // 8 gelombang 40 kHz dikirim (± 200 µs), lalu echo HIGH selama waktu tempuh suara
    const cm = part.props[b.distanceProp];
    ctx.schedule(FREQ * 200e-6, () => {
      echo = true;
      pingAt = performance.now();
      ctx.changed();
      ctx.schedule(FREQ * cm * 58e-6, () => {
        echo = false;
        ctx.changed();
      });
    });
  });
  return {
    frame() {
      const t = (performance.now() - pingAt) / 400;
      ud.setPing(t >= 0 && t < 1.3 ? t : -1, Math.min(300, part.props[b.distanceProp] * 4));
    },
    stop() {
      ud.setPing(-1);
    },
  };
}
