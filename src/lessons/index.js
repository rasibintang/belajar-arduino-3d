// --- Dasar ---
import board from './01-board.js';
import blink from './02-blink.js';
import button from './03-button.js';
import knob from './04-knob.js';
import rgb from './05-rgb.js';
import light from './06-light.js';
import distance from './07-distance.js';
import sound from './08-sound.js';
import motor from './09-motor.js';
import servo from './10-servo.js';
import project from './11-project.js';
// --- Menengah ---
import millis from './intermediate/01-millis.js';
import debounce from './intermediate/02-debounce.js';
import lcd from './intermediate/03-lcd.js';
import dht from './intermediate/04-dht.js';
import arrays from './intermediate/05-arrays.js';
import shift from './intermediate/06-shift.js';
import keypad from './intermediate/07-keypad.js';
import joystick from './intermediate/08-joystick.js';
import relay from './intermediate/09-relay.js';
import thermostat from './intermediate/10-thermostat.js';
// --- Mahir ---
import interrupt from './expert/01-interrupt.js';
import stepper from './expert/02-stepper.js';
import hbridge from './expert/03-hbridge.js';
import serialCmd from './expert/04-serial.js';
import rtc from './expert/05-rtc.js';
import eeprom from './expert/06-eeprom.js';
import neopixel from './expert/07-neopixel.js';
import stateMachine from './expert/08-state.js';
import robot from './expert/09-robot.js';

/**
 * Level pelajaran. Untuk menambah pelajaran: buat file baru lalu daftarkan di
 * level yang sesuai. Untuk menambah level: tambahkan objek baru di sini.
 */
export const LEVELS = [
  { id: 'basic', title: 'Dasar', lessons: [board, blink, button, knob, rgb, light, distance, sound, motor, servo, project] },
  { id: 'intermediate', title: 'Menengah', lessons: [millis, debounce, lcd, dht, arrays, shift, keypad, joystick, relay, thermostat] },
  { id: 'expert', title: 'Mahir', lessons: [interrupt, stepper, hbridge, serialCmd, rtc, eeprom, neopixel, stateMachine, robot] },
];

/** Semua pelajaran berurutan; tiap pelajaran tahu level & nomornya di level itu. */
export const LESSONS = LEVELS.flatMap((level) =>
  level.lessons.map((lesson, i) => Object.assign(lesson, { level: level.id, num: i + 1 }))
);

export const levelOf = (lesson) => LEVELS.find((l) => l.id === lesson.level);

/** Nilai awal parameter sebuah pelajaran. */
export function defaultParams(lesson) {
  return Object.fromEntries((lesson.params ?? []).map((p) => [p.key, p.value]));
}

/**
 * Isi template kode dengan nilai parameter.
 * {{key.field}} -> potongan kode dari opsi yang dipilih (boleh berisi {{key}} lagi);
 * {{key}} -> nilai parameter.
 * Mengembalikan daftar potongan: string biasa atau { key, value }.
 */
export function codeSegments(lesson, params) {
  const expanded = lesson.code.replace(/\{\{(\w+)\.(\w+)\}\}/g, (_, key, field) => {
    const def = lesson.params.find((p) => p.key === key);
    const opt = def?.options?.find((o) => o.value === params[key]);
    return opt?.code?.[field] ?? '';
  });
  const out = [];
  let last = 0;
  for (const m of expanded.matchAll(/\{\{(\w+)\}\}/g)) {
    out.push(expanded.slice(last, m.index));
    out.push({ key: m[1], value: String(params[m[1]]) });
    last = m.index + m[0].length;
  }
  out.push(expanded.slice(last));
  return out;
}

export function codeText(lesson, params) {
  return codeSegments(lesson, params)
    .map((s) => (typeof s === 'string' ? s : s.value))
    .join('');
}
