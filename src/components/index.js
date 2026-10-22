import arduinoUno from './arduino-uno.js';
import breadboard from './breadboard.js';
import led from './led.js';
import resistor from './resistor.js';
import pushButton from './button.js';
import potentiometer from './potentiometer.js';
import buzzer from './buzzer.js';
import servo from './servo.js';
import lcdI2c from './lcd-i2c.js';
import hcSr04 from './hc-sr04.js';

/**
 * Daftar komponen untuk sandbox. Untuk menambah komponen: buat file spesifikasi
 * (lihat spec.js), lalu daftarkan di sini. Cek hasilnya di /gallery.html.
 */
export const COMPONENTS = [arduinoUno, breadboard, led, resistor, pushButton, potentiometer, buzzer, servo, lcdI2c, hcSr04];

export const COMPONENT_BY_TYPE = Object.fromEntries(COMPONENTS.map((c) => [c.type, c]));

export { CATEGORIES, BEHAVIORS, instantiate, validateSpec, defaultProps, resolvePins } from './spec.js';
