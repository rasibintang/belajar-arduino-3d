import arduinoUno from './arduino-uno.js';
import breadboard from './breadboard.js';
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

/**
 * Daftar komponen untuk sandbox. Untuk menambah komponen: buat file spesifikasi
 * (lihat spec.js), lalu daftarkan di sini. Cek hasilnya di /gallery.html.
 */
export const COMPONENTS = [
  arduinoUno,
  breadboard,
  resistor,
  transistor,
  hc595,
  led,
  rgbLed,
  ledBar,
  trafficLight,
  buzzer,
  relay,
  neopixel,
  pushButton,
  potentiometer,
  joystick,
  keypad,
  encoder,
  ldr,
  hcSr04,
  dht11,
  rtc,
  seg7,
  lcdI2c,
  servo,
  dcMotor,
  stepper,
];

export const COMPONENT_BY_TYPE = Object.fromEntries(COMPONENTS.map((c) => [c.type, c]));

export { CATEGORIES, BEHAVIORS, instantiate, validateSpec, defaultProps, resolvePins } from './spec.js';
