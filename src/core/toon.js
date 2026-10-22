import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/**
 * Render bergaya ilustrasi: scene digambar biasa, lalu garis tepi gelap
 * ditambahkan di tempat normal permukaan atau kedalaman berubah tajam.
 *
 * Objek di layer 1 (lihat noOutline()) ikut tampil tetapi tidak diberi garis.
 */
export class ToonPipeline {
  constructor(renderer, { lineColor = '#141a2c' } = {}) {
    this.renderer = renderer;
    this.colorRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.normalRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.normalRT.depthTexture = new THREE.DepthTexture(1, 1);
    this.normalRT.depthTexture.type = THREE.FloatType;
    this.normalMaterial = new THREE.MeshNormalMaterial();
    this.enabled = true;

    this.quad = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: {
          tColor: { value: this.colorRT.texture },
          tNormal: { value: this.normalRT.texture },
          tDepth: { value: this.normalRT.depthTexture },
          texel: { value: new THREE.Vector2(1, 1) },
          thickness: { value: 1.3 },
          depthRange: { value: 1000 },
          depthThreshold: { value: 1.5 },
          normalThreshold: { value: 0.22 },
          lineColor: { value: new THREE.Color(lineColor) },
          enabled: { value: 1 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D tColor;
          uniform sampler2D tNormal;
          uniform sampler2D tDepth;
          uniform vec2 texel;
          uniform float thickness;
          uniform float depthRange;
          uniform float depthThreshold;
          uniform float normalThreshold;
          uniform vec3 lineColor;
          uniform float enabled;
          varying vec2 vUv;

          float depthAt(vec2 uv) { return texture2D(tDepth, uv).r * depthRange; }

          // Kekuatan tepi antara piksel tengah dan sepasang tetangga yang berseberangan.
          float edgePair(vec2 uv, vec2 off, float d0, vec4 n0) {
            vec4 na = texture2D(tNormal, uv + off);
            vec4 nb = texture2D(tNormal, uv - off);
            // siluet terhadap latar kosong
            float e = max(abs(na.a - n0.a), abs(nb.a - n0.a));
            if (n0.a > 0.5) {
              float da = depthAt(uv + off);
              float db = depthAt(uv - off);
              // turunan kedua: bidang miring rata = 0, hanya "anak tangga" yang terdeteksi
              float lap = abs(da + db - 2.0 * d0);
              float stepA = na.a > 0.5 ? abs(da - d0) : 0.0;
              float stepB = nb.a > 0.5 ? abs(db - d0) : 0.0;
              e = max(e, smoothstep(depthThreshold, depthThreshold * 2.0, min(lap, max(stepA, stepB) * 2.0)));
              // lipatan: arah normal berubah tajam
              vec3 c = n0.xyz * 2.0 - 1.0;
              float ca = na.a > 0.5 ? 1.0 - dot(c, na.xyz * 2.0 - 1.0) : 0.0;
              float cb = nb.a > 0.5 ? 1.0 - dot(c, nb.xyz * 2.0 - 1.0) : 0.0;
              e = max(e, 0.9 * smoothstep(normalThreshold, normalThreshold * 2.2, max(ca, cb)));
            }
            return e;
          }

          void main() {
            vec4 col = texture2D(tColor, vUv);
            vec4 n0 = texture2D(tNormal, vUv);
            float d0 = depthAt(vUv);
            vec2 o = texel * thickness;
            float e = max(edgePair(vUv, vec2(o.x, 0.0), d0, n0), edgePair(vUv, vec2(0.0, o.y), d0, n0));
            // diagonal sedikit lebih lemah agar sudut garis membulat
            e = max(e, 0.75 * max(edgePair(vUv, o * 0.7071, d0, n0), edgePair(vUv, vec2(o.x, -o.y) * 0.7071, d0, n0)));
            e = clamp(e, 0.0, 1.0) * enabled;

            gl_FragColor = vec4(mix(col.rgb, lineColor, e), max(col.a, e));
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })
    );
  }

  setSize(width, height, pixelRatio) {
    const w = Math.max(1, Math.round(width * pixelRatio));
    const h = Math.max(1, Math.round(height * pixelRatio));
    this.colorRT.setSize(w, h);
    this.normalRT.setSize(w, h);
    const u = this.quad.material.uniforms;
    u.texel.value.set(1 / w, 1 / h);
    // tebal garis mengikuti kepadatan piksel (± 1,3–1,7 px layar)
    u.thickness.value = 1.3 * Math.max(1, pixelRatio / 1.5);
  }

  /** mmPerPixel dipakai agar ambang kedalaman menyesuaikan zoom. */
  render(scene, camera, mmPerPixel = 0.3) {
    const r = this.renderer;
    const u = this.quad.material.uniforms;
    u.depthRange.value = camera.far - camera.near;
    u.depthThreshold.value = Math.max(0.8, mmPerPixel * 4);
    u.enabled.value = this.enabled ? 1 : 0;

    const prevClear = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    r.setClearColor(0x000000, 0);

    camera.layers.set(0);
    camera.layers.enable(1);
    r.setRenderTarget(this.colorRT);
    r.clear();
    r.render(scene, camera);

    camera.layers.set(0);
    scene.overrideMaterial = this.normalMaterial;
    r.setRenderTarget(this.normalRT);
    r.clear();
    r.render(scene, camera);
    scene.overrideMaterial = null;
    camera.layers.enable(1);

    r.setRenderTarget(null);
    r.clear();
    this.quad.render(r);
    r.setClearColor(prevClear, prevAlpha);
  }

  dispose() {
    this.colorRT.dispose();
    this.normalRT.dispose();
    this.quad.dispose();
  }
}
