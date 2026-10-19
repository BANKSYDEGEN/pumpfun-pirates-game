import * as THREE from 'three';
import { waveHeight } from './ocean.js';
import { toonRamp } from './toon.js';

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
        void main(){ vC=aColor; vA=aAlpha; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = min(aSize * uScale / max(-mv.z, 0.1), 160.0); gl_Position = projectionMatrix*mv; }`,
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

// Chunky cartoon puffs: instanced low-poly balls that swell then shrink away (no alpha fade).
class Puffs {
  constructor(cap, material) {
    this.cap = cap; this.n = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), material, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.p = new Float32Array(cap * 3); this.v = new Float32Array(cap * 3); this.s = new Float32Array(cap); this.life = new Float32Array(cap); this.max = new Float32Array(cap);
    this.rot = new Float32Array(cap); this.c = new Float32Array(cap * 3); this.drag = new Float32Array(cap); this.lift = new Float32Array(cap);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
  }
  emit(p, v, { size = 1, life = 1, color = [1, 1, 1], drag = 1.5, lift = 0 } = {}) {
    const i = this.n < this.cap ? this.n++ : Math.floor(Math.random() * this.cap);
    this.p.set([p.x, p.y, p.z], i * 3); this.v.set([v.x, v.y, v.z], i * 3); this.c.set(color, i * 3);
    this.s[i] = size; this.life[i] = life; this.max[i] = life; this.rot[i] = Math.random() * 6; this.drag[i] = drag; this.lift[i] = lift;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this._kill(i); continue; }
      const k = i * 3, dr = Math.max(0, 1 - this.drag[i] * dt);
      this.v[k] *= dr; this.v[k + 1] = this.v[k + 1] * dr + this.lift[i] * dt; this.v[k + 2] *= dr;
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      i++;
    }
    for (let j = 0; j < this.n; j++) {
      const f = 1 - this.life[j] / this.max[j];               // 0 -> 1
      const sc = this.s[j] * (f < 0.18 ? 0.4 + f / 0.18 * 0.6 : 1 - Math.pow((f - 0.18) / 0.82, 2) * 0.95) * (1 + f * 0.6);
      this._v.set(this.p[j * 3], this.p[j * 3 + 1], this.p[j * 3 + 2]);
      this._q.setFromEuler(this._e.set(this.rot[j], this.rot[j] * 0.7 + f, 0));
      this._m.compose(this._v, this._q, this._s.set(sc, sc, sc));
      this.mesh.setMatrixAt(j, this._m);
      this.mesh.instanceColor.setXYZ(j, this.c[j * 3], this.c[j * 3 + 1], this.c[j * 3 + 2]);
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  }
  _kill(i) {
    const j = --this.n; if (i === j) return;
    for (const [a, s] of [[this.p, 3], [this.v, 3], [this.c, 3]]) a.copyWithin(i * s, j * s, j * s + s);
    for (const a of [this.s, this.life, this.max, this.rot, this.drag, this.lift]) a[i] = a[j];
  }
  clear() { this.n = 0; this.mesh.count = 0; }
}

// Flat expanding foam rings on the water (splashes, sinking, landing loot)
class Rings {
  constructor(cap) {
    this.items = [];
    const geo = new THREE.RingGeometry(0.75, 1, 28, 1); geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < cap; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xe6f7f8, transparent: true, depthWrite: false, opacity: 0 }));
      m.visible = false; m.frustumCulled = false; m.renderOrder = 1;
      this.items.push({ m, life: 0, max: 1, r0: 1, r1: 5 });
    }
    this.next = 0;
  }
  emit(p, r0 = 0.8, r1 = 6, life = 1.2) {
    const it = this.items[this.next]; this.next = (this.next + 1) % this.items.length;
    Object.assign(it, { life, max: life, r0, r1, x: p.x, z: p.z }); it.m.visible = true;
  }
  update(dt, t) {
    for (const it of this.items) {
      if (!it.m.visible) continue;
      it.life -= dt; if (it.life <= 0) { it.m.visible = false; continue; }
      const f = 1 - it.life / it.max, r = it.r0 + (it.r1 - it.r0) * (1 - Math.pow(1 - f, 2.2));
      it.m.scale.set(r, 1, r); it.m.position.set(it.x, waveHeight(it.x, it.z, t) + 0.12, it.z);
      it.m.material.opacity = 0.85 * (1 - f);
    }
  }
  clear() { for (const it of this.items) it.m.visible = false; }
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rnd = (a, b) => a + Math.random() * (b - a);

export class FX {
  constructor(scene, quality) {
    const cap = quality === 'low' ? 1400 : 3500;
    this.soft = new Pool(cap, false); this.glow = new Pool(Math.floor(cap / 2), true);
    scene.add(this.soft.points, this.glow.points);
    this.q = quality === 'low' ? 0.5 : 1;
    const low = quality === 'low';
    this.puff = new Puffs(low ? 120 : 320, new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonRamp() }));
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); fireMat.color.setScalar(1);
    this.fire = new Puffs(low ? 60 : 160, fireMat);
    this.rings = new Rings(low ? 10 : 22);
    scene.add(this.puff.mesh, this.fire.mesh, ...this.rings.items.map(i => i.m));
  }
  setScale(s) { this.soft.uniforms.uScale.value = this.glow.uniforms.uScale.value = s; }
  n(c) { return Math.max(1, Math.round(c * this.q)); }
  muzzle(p, dir) {
    this.fire.emit(p, V(dir.x * 6, 0.5, dir.z * 6), { size: rnd(0.7, 1.0), life: 0.18, color: [3, 2.2, 0.9], drag: 6 });
    for (let i = 0; i < this.n(4); i++) this.puff.emit(V(p.x + dir.x * rnd(0.5, 2), p.y + rnd(-0.2, 0.4), p.z + dir.z * rnd(0.5, 2)), V(dir.x * rnd(3, 7), rnd(0.5, 1.8), dir.z * rnd(3, 7)), { size: rnd(0.7, 1.2), life: rnd(1.0, 1.7), color: [0.82, 0.84, 0.86], drag: 1.8, lift: 0.6 });
    for (let i = 0; i < this.n(10); i++) this.glow.emit(p, V(dir.x * rnd(4, 12) + rnd(-1, 1), rnd(-0.5, 2), dir.z * rnd(4, 12) + rnd(-1, 1)), { color: [1, rnd(0.5, 0.8), 0.2], size: rnd(1, 2.2), life: rnd(0.12, 0.3), drag: 4 });
    for (let i = 0; i < this.n(10); i++) this.soft.emit(p, V(dir.x * rnd(2, 8), rnd(0.5, 2.5), dir.z * rnd(2, 8)), { color: [0.72, 0.72, 0.7], size: rnd(1.5, 2.5), grow: 3, life: rnd(1.2, 2.2), alpha: 0.55, drag: 1.5 });
  }
  splash(p) {
    this.rings.emit(p, 0.6, 5.5, 1.3); this.rings.emit(p, 0.3, 3, 0.9);
    for (let i = 0; i < this.n(4); i++) this.puff.emit(V(p.x + rnd(-0.6, 0.6), p.y + 0.2, p.z + rnd(-0.6, 0.6)), V(rnd(-1.5, 1.5), rnd(5, 9), rnd(-1.5, 1.5)), { size: rnd(0.45, 0.8), life: rnd(0.6, 0.9), color: [0.8, 0.95, 0.98], drag: 0.6, lift: -14 });
    for (let i = 0; i < this.n(26); i++) { const a = Math.random() * 6.28, s = rnd(0.5, 3.5); this.soft.emit(p, V(Math.cos(a) * s, rnd(5, 13), Math.sin(a) * s), { color: [0.85, 0.92, 0.95], size: rnd(0.4, 1.0), life: rnd(0.8, 1.4), grav: 18, alpha: 0.9 }); }
    for (let i = 0; i < this.n(10); i++) { const a = Math.random() * 6.28; this.soft.emit(p, V(Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5), { color: [0.85, 0.9, 0.92], size: rnd(1, 2), life: rnd(1.5, 2.5), float: true, alpha: 0.6, drag: 1.2 }); }
  }
  hit(p) {
    // chunky toon explosion: hot core, orange balls, then dark smoke balls rolling up
    this.fire.emit(p, V(0, 0, 0), { size: 1.8, life: 0.28, color: [3.2, 2.6, 1.2], drag: 0 });
    for (let i = 0; i < this.n(7); i++) { const d = V(rnd(-1, 1), rnd(0, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(2, 6)); this.fire.emit(p, d, { size: rnd(0.6, 1.2), life: rnd(0.3, 0.55), color: [2.6, rnd(0.9, 1.5), 0.25], drag: 3 }); }
    for (let i = 0; i < this.n(6); i++) this.puff.emit(V(p.x + rnd(-1, 1), p.y + rnd(0, 1), p.z + rnd(-1, 1)), V(rnd(-1.5, 1.5), rnd(1.5, 3.5), rnd(-1.5, 1.5)), { size: rnd(0.9, 1.6), life: rnd(1.4, 2.2), color: [0.16, 0.16, 0.18], drag: 1.2, lift: 0.8 });
    for (let i = 0; i < this.n(24); i++) { const d = V(rnd(-1, 1), rnd(-0.2, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(3, 11)); this.glow.emit(p, d, { color: [1, rnd(0.35, 0.7), 0.12], size: rnd(1.2, 3), life: rnd(0.25, 0.6), drag: 3 }); }
    for (let i = 0; i < this.n(18); i++) { const d = V(rnd(-1, 1), rnd(0.3, 1.5), rnd(-1, 1)).multiplyScalar(rnd(3, 9)); this.soft.emit(p, d, { color: [0.35, 0.22, 0.12], size: rnd(0.3, 0.6), life: rnd(1, 1.8), grav: 16 }); } // wood splinters
    for (let i = 0; i < this.n(14); i++) this.soft.emit(p, V(rnd(-1.5, 1.5), rnd(1, 3), rnd(-1.5, 1.5)), { color: [0.18, 0.18, 0.18], size: rnd(2, 3.5), grow: 3, life: rnd(1.5, 3), alpha: 0.6, drag: 1 });
  }
  smoke(p, fire) {
    if (Math.random() < 0.35) this.puff.emit(p, V(rnd(-0.4, 0.4), rnd(2, 3.5), rnd(-0.4, 0.4)), { size: rnd(0.7, 1.2), life: rnd(1.6, 2.4), color: fire ? [0.12, 0.11, 0.11] : [0.3, 0.31, 0.33], drag: 0.8, lift: 0.4 });
    if (fire && Math.random() < 0.4) this.fire.emit(p, V(rnd(-0.3, 0.3), rnd(1.5, 2.5), rnd(-0.3, 0.3)), { size: rnd(0.4, 0.75), life: rnd(0.3, 0.5), color: [2.6, 1.0, 0.2], drag: 1 });
    this.soft.emit(p, V(rnd(-0.4, 0.4), rnd(2, 4), rnd(-0.4, 0.4)), { color: [0.12, 0.12, 0.12], size: rnd(1.5, 2.5), grow: 2.5, life: rnd(2, 3.5), alpha: 0.55 });
    if (fire) this.glow.emit(p, V(rnd(-0.5, 0.5), rnd(1.5, 3), rnd(-0.5, 0.5)), { color: [1, 0.45, 0.1], size: rnd(0.8, 1.6), life: rnd(0.3, 0.6) });
  }
  wake(p, side) {
    this.soft.emit(p, V(side.x * rnd(0.6, 1.6), 0, side.z * rnd(0.6, 1.6)), { color: [0.82, 0.88, 0.9], size: rnd(1.2, 2.2), grow: 0.9, life: rnd(2.5, 4), float: true, alpha: 0.5, drag: 0.6 });
  }
  spray(p, v) { this.soft.emit(p, v, { color: [0.85, 0.9, 0.93], size: rnd(0.5, 1), life: rnd(0.5, 0.9), grav: 16, alpha: 0.7 }); }
  ring(p, r0, r1, life) { this.rings.emit(p, r0, r1, life); }
  bubbles(p) {
    if (Math.random() < 0.05) this.rings.emit(V(p.x + rnd(-3, 3), 0, p.z + rnd(-4, 4)), 1, 6, 1.6); this.soft.emit(V(p.x + rnd(-3, 3), p.y, p.z + rnd(-5, 5)), V(0, 0, 0), { color: [0.8, 0.88, 0.9], size: rnd(1, 2.5), grow: 1, life: rnd(1, 2), float: true, alpha: 0.7 }); }
  sparkle(p) { this.glow.emit(V(p.x + rnd(-1, 1), p.y + rnd(0, 1.5), p.z + rnd(-1, 1)), V(0, rnd(0.5, 1.5), 0), { color: [1, 0.8, 0.45], size: rnd(0.4, 0.9), life: rnd(0.4, 0.9) }); }
  trail(p) { this.soft.emit(p, V(rnd(-0.3, 0.3), rnd(0, 0.5), rnd(-0.3, 0.3)), { color: [0.78, 0.78, 0.76], size: rnd(0.6, 1.0), grow: 1.5, life: rnd(0.5, 0.9), alpha: 0.4 }); if (Math.random() < 0.5) this.glow.emit(p, V(0, 0, 0), { color: [1, 0.55, 0.2], size: 0.7, life: 0.12 }); }
  update(dt, t) { this.soft.update(dt, t); this.glow.update(dt, t); this.puff.update(dt); this.fire.update(dt); this.rings.update(dt, t); }
  clear() { this.soft.clear(); this.glow.clear(); this.puff.clear(); this.fire.clear(); this.rings.clear(); }
}
