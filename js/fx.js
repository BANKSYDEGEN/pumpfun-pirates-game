import * as THREE from 'three';
import { waveHeight } from './ocean.js';

// Pooled GPU point particles. Two pools: normal-blend (smoke, spray, foam) and additive (fire, flashes).
class Pool {
  constructor(cap, additive) {
    this.cap = cap; this.n = 0;
    this.pos = new Float32Array(cap * 3); this.vel = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
    this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.grav = new Float32Array(cap);
    this.grow = new Float32Array(cap); this.float = new Uint8Array(cap); this.drag = new Float32Array(cap); this.a0 = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uScale: { value: 400 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `uniform float uScale; attribute vec3 aColor; attribute float aSize; attribute float aAlpha; varying vec3 vC; varying float vA;
        void main(){ vC=aColor; vA=aAlpha; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = aSize * uScale / max(-mv.z, 0.1); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard; gl_FragColor=vec4(vC, vA*smoothstep(0.5,0.15,r)); }`,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false;
  }
  emit(p, v, { color = [1, 1, 1], size = 1, life = 1, grav = 0, grow = 0, alpha = 1, float = false, drag = 0 } = {}) {
    let i = this.n < this.cap ? this.n++ : Math.floor(Math.random() * this.cap);
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3); this.col.set(color, i * 3);
    this.size[i] = size; this.life[i] = life; this.max[i] = life; this.grav[i] = grav; this.grow[i] = grow;
    this.a0[i] = alpha; this.alpha[i] = alpha; this.float[i] = float ? 1 : 0; this.drag[i] = drag;
  }
  update(dt, t) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this._kill(i); continue; }
      const k = i * 3, dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[k] *= dr; this.vel[k + 2] *= dr; this.vel[k + 1] = this.vel[k + 1] * dr - this.grav[i] * dt;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.float[i]) this.pos[k + 1] = waveHeight(this.pos[k], this.pos[k + 2], t) + 0.15;
      this.size[i] += this.grow[i] * dt;
      const f = this.life[i] / this.max[i];
      this.alpha[i] = this.a0[i] * Math.min(1, f * 2.2);
      i++;
    }
    const g = this.points.geometry;
    g.setDrawRange(0, this.n);
    for (const a of ['position', 'aColor', 'aSize', 'aAlpha']) g.attributes[a].needsUpdate = true;
  }
  _kill(i) {
    const j = --this.n;
    if (i === j) return;
    for (const [arr, s] of [[this.pos, 3], [this.vel, 3], [this.col, 3]]) arr.copyWithin(i * s, j * s, j * s + s);
    for (const arr of [this.size, this.alpha, this.life, this.max, this.grav, this.grow, this.float, this.drag, this.a0]) arr[i] = arr[j];
  }
  clear() { this.n = 0; }
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rnd = (a, b) => a + Math.random() * (b - a);

export class FX {
  constructor(scene, quality) {
    const cap = quality === 'low' ? 1400 : 3500;
    this.soft = new Pool(cap, false); this.glow = new Pool(Math.floor(cap / 2), true);
    scene.add(this.soft.points, this.glow.points);
    this.q = quality === 'low' ? 0.5 : 1;
  }
  setScale(h) { this.soft.uniforms.uScale.value = this.glow.uniforms.uScale.value = h * 0.55; }
  n(c) { return Math.max(1, Math.round(c * this.q)); }
  muzzle(p, dir) {
    for (let i = 0; i < this.n(10); i++) this.glow.emit(p, V(dir.x * rnd(4, 12) + rnd(-1, 1), rnd(-0.5, 2), dir.z * rnd(4, 12) + rnd(-1, 1)), { color: [1, rnd(0.5, 0.8), 0.2], size: rnd(1, 2.2), life: rnd(0.12, 0.3), drag: 4 });
    for (let i = 0; i < this.n(10); i++) this.soft.emit(p, V(dir.x * rnd(2, 8), rnd(0.5, 2.5), dir.z * rnd(2, 8)), { color: [0.72, 0.72, 0.7], size: rnd(1.5, 2.5), grow: 3, life: rnd(1.2, 2.2), alpha: 0.55, drag: 1.5 });
  }
  splash(p) {
    for (let i = 0; i < this.n(26); i++) { const a = Math.random() * 6.28, s = rnd(0.5, 3.5); this.soft.emit(p, V(Math.cos(a) * s, rnd(5, 13), Math.sin(a) * s), { color: [0.85, 0.92, 0.95], size: rnd(0.4, 1.0), life: rnd(0.8, 1.4), grav: 18, alpha: 0.9 }); }
    for (let i = 0; i < this.n(10); i++) { const a = Math.random() * 6.28; this.soft.emit(p, V(Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5), { color: [0.85, 0.9, 0.92], size: rnd(1, 2), life: rnd(1.5, 2.5), float: true, alpha: 0.6, drag: 1.2 }); }
  }
  hit(p) {
    for (let i = 0; i < this.n(24); i++) { const d = V(rnd(-1, 1), rnd(-0.2, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(3, 11)); this.glow.emit(p, d, { color: [1, rnd(0.35, 0.7), 0.12], size: rnd(1.2, 3), life: rnd(0.25, 0.6), drag: 3 }); }
    for (let i = 0; i < this.n(18); i++) { const d = V(rnd(-1, 1), rnd(0.3, 1.5), rnd(-1, 1)).multiplyScalar(rnd(3, 9)); this.soft.emit(p, d, { color: [0.35, 0.22, 0.12], size: rnd(0.3, 0.6), life: rnd(1, 1.8), grav: 16 }); } // wood splinters
    for (let i = 0; i < this.n(14); i++) this.soft.emit(p, V(rnd(-1.5, 1.5), rnd(1, 3), rnd(-1.5, 1.5)), { color: [0.18, 0.18, 0.18], size: rnd(2, 3.5), grow: 3, life: rnd(1.5, 3), alpha: 0.6, drag: 1 });
  }
  smoke(p, fire) {
    this.soft.emit(p, V(rnd(-0.4, 0.4), rnd(2, 4), rnd(-0.4, 0.4)), { color: [0.12, 0.12, 0.12], size: rnd(1.5, 2.5), grow: 2.5, life: rnd(2, 3.5), alpha: 0.55 });
    if (fire) this.glow.emit(p, V(rnd(-0.5, 0.5), rnd(1.5, 3), rnd(-0.5, 0.5)), { color: [1, 0.45, 0.1], size: rnd(0.8, 1.6), life: rnd(0.3, 0.6) });
  }
  wake(p, side) {
    this.soft.emit(p, V(side.x * rnd(0.6, 1.6), 0, side.z * rnd(0.6, 1.6)), { color: [0.82, 0.88, 0.9], size: rnd(1.2, 2.2), grow: 0.9, life: rnd(2.5, 4), float: true, alpha: 0.5, drag: 0.6 });
  }
  spray(p, v) { this.soft.emit(p, v, { color: [0.85, 0.9, 0.93], size: rnd(0.5, 1), life: rnd(0.5, 0.9), grav: 16, alpha: 0.7 }); }
  bubbles(p) { this.soft.emit(V(p.x + rnd(-3, 3), p.y, p.z + rnd(-5, 5)), V(0, 0, 0), { color: [0.8, 0.88, 0.9], size: rnd(1, 2.5), grow: 1, life: rnd(1, 2), float: true, alpha: 0.7 }); }
  sparkle(p) { this.glow.emit(V(p.x + rnd(-1, 1), p.y + rnd(0, 1.5), p.z + rnd(-1, 1)), V(0, rnd(0.5, 1.5), 0), { color: [1, 0.8, 0.45], size: rnd(0.4, 0.9), life: rnd(0.4, 0.9) }); }
  trail(p) { this.soft.emit(p, V(rnd(-0.3, 0.3), rnd(0, 0.5), rnd(-0.3, 0.3)), { color: [0.78, 0.78, 0.76], size: rnd(0.6, 1.0), grow: 1.5, life: rnd(0.5, 0.9), alpha: 0.4 }); if (Math.random() < 0.5) this.glow.emit(p, V(0, 0, 0), { color: [1, 0.55, 0.2], size: 0.7, life: 0.12 }); }
  update(dt, t) { this.soft.update(dt, t); this.glow.update(dt, t); }
  clear() { this.soft.clear(); this.glow.clear(); }
}
