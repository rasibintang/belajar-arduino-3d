import * as THREE from 'three';
import { Ease } from './tween.js';

const DEG = Math.PI / 180;

function viewDir(azimuth, elevation) {
  return new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
}

/**
 * Kamera isometrik (ortografis) yang bisa digeser, diputar per 45°, dan di-zoom.
 * - Input pengguna mengejar "goal" secara halus.
 * - animateTo() untuk perpindahan sinematik (reset, fokus, ganti pelajaran).
 */
export class CameraRig {
  constructor({ azimuth = -32, elevation = 38 } = {}) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 6000);
    this.width = 1;
    this.height = 1;
    this.state = { target: new THREE.Vector3(), azimuth: azimuth * DEG, elevation: elevation * DEG, zoom: 4 };
    this.goal = { target: new THREE.Vector3(), azimuth: azimuth * DEG, elevation: elevation * DEG, zoom: 4 };
    this.home = { target: new THREE.Vector3(), azimuth: azimuth * DEG, zoom: 4 };
    this.anim = null;
    this.speed = 1;
    this.minZoom = 0.8;
    this.maxZoom = 30;
    this.apply();
  }

  setSize(w, h) {
    this.width = w;
    this.height = h;
    this.apply();
  }

  /** px layar per mm */
  get zoom() {
    return this.state.zoom;
  }

  get dir() {
    return viewDir(this.state.azimuth, this.state.elevation);
  }

  apply() {
    const { target, azimuth, elevation, zoom } = this.state;
    const cam = this.camera;
    const hw = this.width / 2 / zoom;
    const hh = this.height / 2 / zoom;
    cam.left = -hw;
    cam.right = hw;
    cam.top = hh;
    cam.bottom = -hh;
    cam.position.copy(target).addScaledVector(viewDir(azimuth, elevation), 2500);
    cam.lookAt(target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  /** true jika kamera masih bergerak (untuk menunda hal lain) */
  update(dt) {
    const s = this.state;
    const g = this.goal;
    if (this.anim) {
      const a = this.anim;
      const raw = Math.min(1, (performance.now() - a.t0) / a.duration);
      const k = Ease.inOutCubic(raw);
      s.target.lerpVectors(a.from.target, a.to.target, k);
      s.azimuth = a.from.azimuth + (a.to.azimuth - a.from.azimuth) * k;
      s.zoom = a.from.zoom * Math.pow(a.to.zoom / a.from.zoom, k);
      g.target.copy(s.target);
      g.azimuth = s.azimuth;
      g.zoom = s.zoom;
      if (raw >= 1) this.anim = null;
    } else {
      const k = 1 - Math.exp(-dt * 9);
      s.target.lerp(g.target, k);
      s.azimuth += (g.azimuth - s.azimuth) * k;
      s.elevation += (g.elevation - s.elevation) * k;
      s.zoom *= Math.pow(g.zoom / s.zoom, k);
    }
    this.apply();
    return !!this.anim;
  }

  /** Pindah kamera dengan animasi ke { target, zoom, azimuth }. */
  animateTo(view, duration = 1000) {
    const az = view.azimuth ?? this.state.azimuth;
    // putar lewat jalur terpendek
    const turns = Math.round((this.state.azimuth - az) / (Math.PI * 2));
    this.anim = {
      t0: performance.now(),
      duration: Math.max(1, duration * this.speed),
      from: { target: this.state.target.clone(), azimuth: this.state.azimuth, zoom: this.state.zoom },
      to: { target: view.target.clone(), azimuth: az + turns * Math.PI * 2, zoom: view.zoom ?? this.state.zoom },
    };
  }

  jumpTo(view) {
    this.anim = null;
    for (const v of [this.state, this.goal]) {
      v.target.copy(view.target);
      v.zoom = view.zoom;
      v.azimuth = view.azimuth ?? v.azimuth;
    }
    this.apply();
  }

  stopAnim() {
    this.anim = null;
  }

  /** Geser pandangan sejauh (dx, dy) piksel layar. */
  pan(dx, dy, immediate = false) {
    this.stopAnim();
    const { azimuth, elevation } = this.goal;
    const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
    const forward = new THREE.Vector3(-Math.sin(azimuth), 0, -Math.cos(azimuth));
    const z = this.goal.zoom;
    this.goal.target.addScaledVector(right, -dx / z).addScaledVector(forward, dy / z / Math.sin(elevation));
    if (immediate) this.state.target.copy(this.goal.target);
  }

  rotate(steps) {
    this.stopAnim();
    this.goal.azimuth += steps * 45 * DEG;
  }

  /** Putaran pelan terus-menerus (pengaturan "putar otomatis"). */
  spin(radians) {
    this.goal.azimuth += radians;
    this.state.azimuth += radians;
  }

  zoomBy(factor) {
    this.stopAnim();
    this.goal.zoom = THREE.MathUtils.clamp(this.goal.zoom * factor, this.minZoom, this.maxZoom);
  }

  reset(duration = 1100) {
    this.animateTo(this.home, duration);
  }

  /** Arahkan kamera agar titik dunia `point` berada di tengah, dengan zoom tertentu. */
  focusPoint(point, zoom, duration = 1000) {
    const dir = this.dir;
    const target = point.clone().addScaledVector(dir, -point.y / dir.y);
    this.animateTo({ target, zoom: THREE.MathUtils.clamp(zoom, this.minZoom, this.maxZoom) }, duration);
  }

  /**
   * Hitung pandangan "rumah" agar Box3 pas di area layar (dikurangi inset px).
   * mode: 'instant' | 'animate'
   */
  frame(box, insets = { left: 0, top: 0, right: 0, bottom: 0 }, { instant = false, duration = 1300 } = {}) {
    const az = this.home.azimuth;
    const el = this.goal.elevation;
    const dir = viewDir(az, el);
    const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
    const up = new THREE.Vector3().crossVectors(dir, right).normalize();

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const p = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      const x = p.dot(right);
      const y = p.dot(up);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const availW = Math.max(100, this.width - insets.left - insets.right);
    const availH = Math.max(100, this.height - insets.top - insets.bottom);
    const zoom = Math.min(availW / (maxX - minX), availH / (maxY - minY));

    // pusat bingkai digeser sesuai inset, lalu diturunkan sepanjang arah pandang ke y = 0
    const cx = (minX + maxX) / 2 - (insets.left - insets.right) / 2 / zoom;
    const cy = (minY + maxY) / 2 + (insets.top - insets.bottom) / 2 / zoom;
    const center = right.clone().multiplyScalar(cx).addScaledVector(up, cy);
    center.addScaledVector(dir, -center.y / dir.y);

    this.home.target.copy(center);
    this.home.zoom = zoom;
    this.minZoom = zoom * 0.45;
    this.maxZoom = zoom * 5;
    if (instant) this.jumpTo({ ...this.home });
    else this.animateTo(this.home, duration);
  }

  /** Arah "kompas" untuk ikon reset (derajat) */
  get heading() {
    return (this.state.azimuth - this.home.azimuth) / DEG;
  }
}
