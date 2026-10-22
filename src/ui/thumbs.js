import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ToonPipeline } from '../core/toon.js';

/**
 * Membuat gambar kecil (data URL) untuk setiap pelajaran dengan merender
 * komponen utamanya memakai gaya garis yang sama dengan panggung.
 */
export async function renderThumbs(lessons, { width = 240, height = 150, onProgress } = {}) {
  const canvas = document.createElement('canvas');
  // gambar kecil ditampilkan diperkecil, jadi dirender rapat (≥ 2×) supaya tajam
  const PR = Math.max(2, (window.devicePixelRatio || 1) * 1.5);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(PR);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.autoClear = false;
  const toon = new ToonPipeline(renderer);
  toon.setSize(width, height, PR);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  scene.add(new THREE.HemisphereLight('#fffaf3', '#c2ae90', 1.25));
  const sun = new THREE.DirectionalLight('#fff6ea', 1.9);
  sun.position.set(-1, 2.2, 1.4);
  scene.add(sun);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
  const az = (-32 * Math.PI) / 180;
  const el = (30 * Math.PI) / 180;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));

  const urls = [];
  for (let i = 0; i < lessons.length; i++) {
    const obj = lessons[i].thumb();
    // cahaya pendar (layer 1) tampak sebagai kotak di latar transparan
    obj.traverse((o) => {
      if (o.layers.mask === 2) o.visible = false;
    });
    scene.add(obj);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3();
    obj.traverse((o) => {
      if (o.isMesh && o.layers.mask === 1 && o.visible) box.expandByObject(o);
    });
    const center = box.getCenter(new THREE.Vector3());
    camera.position.copy(center).addScaledVector(dir, 1500);
    camera.lookAt(center);
    camera.updateMatrixWorld();

    // ukuran kotak dalam ruang kamera
    const inv = camera.matrixWorldInverse;
    let hx = 0;
    let hy = 0;
    for (let k = 0; k < 8; k++) {
      const p = new THREE.Vector3(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).applyMatrix4(inv);
      hx = Math.max(hx, Math.abs(p.x));
      hy = Math.max(hy, Math.abs(p.y));
    }
    const pad = 1.08;
    const aspect = width / height;
    const halfH = Math.max(hy, hx / aspect) * pad;
    Object.assign(camera, { left: -halfH * aspect, right: halfH * aspect, top: halfH, bottom: -halfH });
    camera.updateProjectionMatrix();

    toon.render(scene, camera, (halfH * 2) / (height * PR));
    urls.push(canvas.toDataURL('image/png'));
    scene.remove(obj);
    onProgress?.((i + 1) / lessons.length);
    // beri kesempatan browser menggambar layar loading
    await new Promise((r) => setTimeout(r, 0));
  }

  toon.dispose();
  pmrem.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return urls;
}
