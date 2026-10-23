import * as THREE from 'three';

/**
 * Layar piksel monokrom (OLED, Nokia 5110, matriks titik) sebagai bidang datar bertekstur.
 *   w, h        ukuran fisik (mm)
 *   cols, rows  resolusi piksel
 *   on, off     warna piksel menyala / padam
 * Kembalikan { mesh, draw(buffer, opts) } — buffer: Uint8Array cols×rows (0/1), baris demi baris.
 * opts.invert membalik warna; opts.dim (0..1) meredupkan; buffer null = layar mati.
 */
export function createScreen({ w, h, cols, rows, on = '#9fe3ff', off = '#05070c' }) {
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(cols, rows);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const material = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.9, roughness: 0.25 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.rotation.x = -Math.PI / 2;
  const cOn = new THREE.Color(on);
  const cOff = new THREE.Color(off);
  const rgb = (c, k) => [Math.round(c.r * 255 * k), Math.round(c.g * 255 * k), Math.round(c.b * 255 * k)];
  let last = '';
  function draw(buffer, { invert = false, dim = 1 } = {}) {
    const key = buffer ? `${invert}${dim}${hash(buffer)}` : 'off';
    if (key === last) return;
    last = key;
    const a = rgb(cOn, dim);
    const b = rgb(cOff, 1);
    const d = img.data;
    for (let i = 0; i < cols * rows; i++) {
      const lit = buffer ? !!buffer[i] !== invert : false;
      const c = lit ? a : b;
      d[i * 4] = c[0];
      d[i * 4 + 1] = c[1];
      d[i * 4 + 2] = c[2];
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tex.needsUpdate = true;
  }
  draw(null);
  return { mesh, draw };
}

/** Sidik cepat isi buffer (agar tekstur hanya diunggah ulang saat berubah). */
function hash(buf) {
  let h = 2166136261;
  for (let i = 0; i < buf.length; i++) h = Math.imul(h ^ buf[i], 16777619);
  return h >>> 0;
}
