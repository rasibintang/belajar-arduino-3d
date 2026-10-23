import { phrase } from '../i18n/lessons.js';
import { createLED } from '../parts/led.js';
import { createResistor } from '../parts/resistor.js';

/**
 * LED + resistor 220 Ω di breadboard, lengkap dengan kabel sinyal dan ground.
 * Resistor di kolom col..col+4, LED di col+4 (+) dan col+5 (−).
 * back = pakai separuh belakang breadboard (baris f–j).
 */
export function addLed(kit, { key, col, back = false, color = 'red', pin, gnd, wire = 'orange', lift = 0 }) {
  const [rRow, lRow, sRow, gRow] = back ? ['g', 'i', 'j', 'j'] : ['d', 'b', 'c', 'a'];
  kit.place(`${key}R`, createResistor({ span: 4 * kit.PITCH }), kit.hole(rRow, col), kit.hole(rRow, col + 4));
  const led = kit.place(key, createLED({ color }), kit.hole(lRow, col + 5), kit.hole(lRow, col + 4));
  if (pin) kit.wire(kit.pin(pin), kit.hole(sRow, col), wire, { lift });
  if (gnd) kit.wire(kit.pin(gnd), kit.hole(gRow, col + 5), 'black', { lift: lift + 4 });
  return led;
}

/** Tulis teks di LCD virtual mulai kolom col, baris row (seperti lcd.setCursor + lcd.print). */
export function lcdPrint(state, col, row, text) {
  text = phrase(text);
  state.lcd ??= ['', ''];
  const line = (state.lcd[row] ?? '').padEnd(16);
  state.lcd[row] = (line.slice(0, col) + text + line.slice(col + text.length)).slice(0, 16);
}

/** Tampilkan isi LCD virtual; mati saat sketch tidak berjalan. */
export function showLCD(v, lcd) {
  const on = v.running;
  lcd.userData.setBacklight(on && v.state?.backlight !== false);
  lcd.userData.setText(on ? v.state?.lcd ?? ['', ''] : ['', '']);
}

/** Dua digit: 7 -> "07" */
export const two = (n) => String(n).padStart(2, '0');
