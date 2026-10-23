import * as THREE from 'three';
import { M, mat, ownMat, box, anchor, markPart, canvasTexture, setEmissive } from './lib.js';
import { createModule, chip } from './module.js';
import { createScreen } from './screen.js';

/** Layar TFT 2,8" ILI9341 240×320 (± layar sentuh kapasitif FT6206). userData.draw(rgbaBuffer) */
export const TFT_PINS = ['VCC', 'GND', 'CS', 'RST', 'D/C', 'MOSI', 'SCK', 'LED', 'MISO'];
export function createTFT({ touch = false } = {}) {
  const names = touch ? [...TFT_PINS, 'SCL', 'SDA'] : TFT_PINS;
  const { g, top } = createModule({
    w: 52,
    d: 86,
    color: '#b8322b',
    headers: [{ names, x: 0, z: -40.5 }],
    key: 'tft',
    name: touch ? 'TFT ILI9341 + sentuh' : 'TFT ILI9341',
    desc: 'Layar warna 240×320 piksel lewat SPI.',
  });
  g.add(box(50, 3.6, 70, mat('#e8e6e1', { metalness: 0.3, roughness: 0.4 }), 0, top, 5, 0.8));
  g.add(box(47, 0.6, 66, mat('#101216', { roughness: 0.15, metalness: 0.3 }), 0, top + 3.6, 5, 0.6));
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(240, 320);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  const screenMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.95, roughness: 0.2 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(43.2, 57.6), screenMat);
  screen.rotation.x = -Math.PI / 2;
  screen.position.set(0, top + 4.25, 5);
  g.add(screen);
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, 240, 320);
  tex.needsUpdate = true;
  g.userData.screen = screen; // untuk mengubah titik klik menjadi koordinat sentuh
  g.userData.draw = (rgba, on = true) => {
    if (!on || !rgba) {
      ctx.fillStyle = '#05070c';
      ctx.fillRect(0, 0, 240, 320);
      screenMat.emissiveIntensity = 0;
    } else {
      img.data.set(rgba);
      ctx.putImageData(img, 0, 0);
      screenMat.emissiveIntensity = 0.95;
    }
    tex.needsUpdate = true;
  };
  if (touch) {
    // tanda sentuh kecil di bawah layar
    const dot = ownMat('#6c7486', { roughness: 0.4 });
    g.add(box(4, 0.3, 4, dot, 20, top + 3.6, 37, 1));
    g.userData.setTouch = (on) => setEmissive(dot, '#4d8dff', on ? 2 : 0);
  }
  g.userData.anchor = anchor(g, 0, top + 8, 5);
  return g;
}

/** Modul e-Paper 2,9" (SSD1680) 296×128, hitam-putih. userData.draw(buffer, flash) */
export const EPD_PINS = ['BUSY', 'RST', 'DC', 'CS', 'CLK', 'DIN', 'GND', 'VCC'];
export function createEPaper() {
  const { g, top } = createModule({
    w: 90,
    d: 40,
    color: '#1b1d22',
    headers: [{ names: EPD_PINS, x: -47, z: 0, axis: 'z' }],
    key: 'epaper',
    name: 'e-Paper 2,9"',
    desc: 'Layar tinta elektronik: gambar tetap terlihat walau tanpa daya.',
  });
  g.add(box(80, 1, 36, mat('#e9e6dd', { roughness: 0.9 }), 3, top, 0, 0.3));
  const screen = createScreen({ w: 66.9, h: 28.9, cols: 296, rows: 128, on: '#1b1c20', off: '#e2dfd5' });
  screen.mesh.material.emissiveIntensity = 0;
  screen.mesh.material.roughness = 0.95;
  screen.mesh.position.set(3, top + 1.02, 0);
  g.add(screen.mesh);
  g.add(box(10, 0.4, 18, M.dark, -38, top, 0, 0)); // kabel fleksibel
  g.userData.draw = screen.draw;
  g.userData.anchor = anchor(g, 3, top + 6, 0);
  return g;
}

/** Modul kartu microSD. Pin: CD DO GND SCK VCC DI CS. userData.setActive(bool) */
export const SD_PINS = ['CD', 'DO', 'GND', 'SCK', 'VCC', 'DI', 'CS'];
export function createMicroSD() {
  const { g, top } = createModule({
    w: 24,
    d: 42,
    color: '#1f4fa8',
    headers: [{ names: SD_PINS, x: 0, z: -19 }],
    key: 'microsd',
    name: 'Modul microSD',
    desc: 'Menyimpan berkas di kartu microSD (FAT16) lewat SPI.',
  });
  const metal = mat('#c9ccd2', { metalness: 0.7, roughness: 0.3 });
  g.add(box(16, 2, 16, metal, 0, top, 9, 0.3));
  // kartu yang menyembul keluar
  const tex = canvasTexture(140, 160, (ctx, w, h) => {
    ctx.fillStyle = '#26282e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e0533f';
    ctx.fillRect(0, h * 0.62, w, h * 0.16);
    ctx.fillStyle = '#f0ede5';
    ctx.font = '700 30px "Barlow Semi Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('micro', w / 2, h * 0.32);
    ctx.font = '800 44px "Barlow Semi Condensed", sans-serif';
    ctx.fillText('SD', w / 2, h * 0.55);
  });
  const dark = mat('#26282e');
  const card = new THREE.Mesh(new THREE.BoxGeometry(11, 0.9, 15), [dark, dark, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), dark, dark, dark]);
  card.position.set(0, top + 2.4, 15);
  g.add(card);
  chip(g, 0, -8, top, 4, 3, 1);
  const led = ownMat('#f2d6cf', { roughness: 0.3 });
  g.add(box(1.6, 0.8, 1, led, 8, top, -10));
  g.userData.setActive = (on) => {
    setEmissive(led, '#ff3b2f', on ? 2.4 : 0);
    led.color.set(on ? '#ff5a4f' : '#f2d6cf');
  };
  g.userData.anchor = anchor(g, 0, top + 6, 8);
  return markPart(g, { key: 'microsd', name: 'Modul microSD', desc: 'Menyimpan berkas di kartu microSD (FAT16) lewat SPI.' });
}
