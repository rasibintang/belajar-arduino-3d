import * as THREE from 'three';
import { createArduino } from '../parts/arduino.js';
import { createBreadboard } from '../parts/breadboard.js';
import { createWire } from '../parts/wire.js';
import { mountBetween, PITCH } from '../parts/lib.js';

// Posisi standar: Arduino di kiri, breadboard di kanan.
export const BOARD_AT = [-82, 22];
export const BREADBOARD_AT = [44, 0];

/**
 * Alat bantu menyusun rangkaian sebuah pelajaran.
 * Semua posisi dalam koordinat dunia (root berada di titik asal).
 */
export function createKit() {
  const root = new THREE.Group();
  const parts = {};
  let board = null;
  let bb = null;

  const kit = {
    root,
    parts,
    PITCH,

    board(x = BOARD_AT[0], z = BOARD_AT[1]) {
      board = createArduino();
      board.position.set(x, 0, z);
      root.add(board);
      board.updateMatrixWorld(true);
      parts.board = board;
      return board;
    },

    breadboard(x = BREADBOARD_AT[0], z = BREADBOARD_AT[1]) {
      bb = createBreadboard();
      bb.position.set(x, 0, z);
      root.add(bb);
      bb.updateMatrixWorld(true);
      parts.breadboard = bb;
      return bb;
    },

    /** Pakai papan yang sudah dibuat & dipasang sendiri (mis. di atas sasis robot). */
    useBoard(b) {
      board = b;
      board.updateMatrixWorld(true);
      parts.board = board;
      return board;
    },

    /** Posisi dunia ujung pin header Arduino, mis. 'D13', 'GND', '5V', 'A0'. */
    pin(name) {
      board.updateMatrixWorld(true);
      return board.localToWorld(board.userData.pin(name));
    },

    /** Posisi dunia pin header sebuah modul (part.userData.pins[name]). */
    pinOf(part, name) {
      part.updateMatrixWorld(true);
      return part.localToWorld(part.userData.pins[name].clone());
    },

    /** Posisi dunia permukaan lubang breadboard, mis. hole('c', 12). */
    hole(row, col) {
      return bb.localToWorld(bb.userData.hole(row, col));
    },

    /** Pasang komponen berkaki di antara dua lubang (lihat mountBetween). */
    place(key, part, a, b) {
      mountBetween(part, a, b);
      root.add(part);
      parts[key] = part;
      return part;
    },

    /** Taruh objek bebas di lantai. */
    put(key, part, x, z, rotY = 0) {
      part.position.set(x, 0, z);
      part.rotation.y = rotY;
      root.add(part);
      parts[key] = part;
      return part;
    },

    /** opts.parent: masukkan kabel ke grup lain (mis. robot yang bergerak). */
    wire(a, b, color, opts = {}) {
      const w = createWire(a, b, color, opts);
      (opts.parent ?? root).add(w);
      return w;
    },

    /** Tombol yang mengangkangi parit breadboard, berpusat di kolom col. */
    groove(col) {
      return bb.localToWorld(bb.userData.hole('e', col).setZ(0));
    },
  };
  return kit;
}

/** Kecerahan LED (0..1) berdasarkan nilai resistor seri. */
export function ledBrightness(ohms) {
  if (ohms <= 220) return 1;
  if (ohms <= 330) return 0.85;
  if (ohms <= 1000) return 0.55;
  return 0.14;
}
