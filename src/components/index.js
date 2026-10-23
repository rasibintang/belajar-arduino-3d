import arduinoUno from './arduino-uno.js';
import breadboard, { breadboardFull, breadboardMini } from './breadboard.js';
import led from './led.js';
import rgbLed from './rgb-led.js';
import ledBar from './led-bar.js';
import trafficLight from './traffic-light.js';
import seg7 from './seg7.js';
import resistor from './resistor.js';
import transistor from './transistor.js';
import hc595 from './hc595.js';
import pushButton from './button.js';
import potentiometer from './potentiometer.js';
import joystick from './joystick.js';
import keypad from './keypad.js';
import encoder from './encoder.js';
import ldr from './ldr.js';
import hcSr04 from './hc-sr04.js';
import dht11 from './dht11.js';
import rtc from './rtc.js';
import buzzer from './buzzer.js';
import relay from './relay.js';
import neopixel from './neopixel.js';
import lcdI2c from './lcd-i2c.js';
import servo from './servo.js';
import dcMotor from './dc-motor.js';
import stepper from './stepper.js';
import { button6, slideSwitch, dipSwitch8, slidePot } from './inputs-extra.js';
import { ntc, pir, mq2, dht22, ds1307 } from './sensors-extra.js';
import { lcd1602, lcd2004, lcd2004i2c, seg7x4, neopixel as neopixelSingle, neopixelStrip, neopixelMatrix, neopixelMeter } from './displays-extra.js';
import { gates, mux2, flipFlops, clockGen, hc165, mux16 } from './logic.js';
import { vcc, gnd, text, junction, relayDPDT, a4988, nema17, biaxial } from './misc.js';

/**
 * Daftar komponen untuk sandbox. Untuk menambah komponen: buat file spesifikasi
 * (lihat spec.js), lalu daftarkan di sini. Cek hasilnya di /gallery.html.
 */
export const COMPONENTS = [
  arduinoUno,
  breadboard,
  breadboardFull,
  breadboardMini,
  resistor,
  transistor,
  hc595,
  led,
  rgbLed,
  ledBar,
  trafficLight,
  buzzer,
  relay,
  relayDPDT,
  neopixel,
  neopixelSingle,
  neopixelStrip,
  pushButton,
  button6,
  slideSwitch,
  dipSwitch8,
  potentiometer,
  slidePot,
  joystick,
  keypad,
  encoder,
  ldr,
  ntc,
  pir,
  mq2,
  hcSr04,
  dht11,
  dht22,
  rtc,
  ds1307,
  seg7,
  seg7x4,
  lcdI2c,
  lcd1602,
  lcd2004i2c,
  lcd2004,
  neopixelMatrix,
  neopixelMeter,
  servo,
  dcMotor,
  stepper,
  nema17,
  biaxial,
  a4988,
  ...gates,
  mux2,
  ...flipFlops,
  clockGen,
  hc165,
  mux16,
  vcc,
  gnd,
  junction,
  text,
];

export const COMPONENT_BY_TYPE = Object.fromEntries(COMPONENTS.map((c) => [c.type, c]));

export { CATEGORIES, BEHAVIORS, instantiate, validateSpec, defaultProps, resolvePins } from './spec.js';
