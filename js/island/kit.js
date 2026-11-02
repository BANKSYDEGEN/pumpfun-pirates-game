// [Raul] PUMPFUN PIRATES island art: merge kit. Every prop is added as plain geometry + a flat colour into a
// "bucket" (one material each); build() merges each bucket into ONE mesh and every outlined piece into ONE
// inverted-hull outline mesh, so the whole island is a handful of draw calls on phones.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { outlineFor } from '../toon.js';

const _c = new THREE.Color(), _v = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();

// matrix from position / rotation (radians, YXZ so yaw reads naturally) / scale (number or [x,y,z])
export function M(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
  if (Array.isArray(s)) _s.set(s[0], s[1], s[2]); else _s.set(s, s, s);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.clone(), _s.clone());
}

export class Kit {
  constructor({ outlineK = 0.09 } = {}) { this.b = new Map(); this.out = []; this.stack = [new THREE.Matrix4()]; this.outlineK = outlineK; }
  // run fn with every add() placed inside parent matrix m
  at(m, fn) { this.stack.push(this.stack[this.stack.length - 1].clone().multiply(m)); fn(); this.stack.pop(); }
  // geo: any BufferGeometry (consumed). color: hex | (localPos, i) => hex. opts: bucket, m (Matrix4), outline, sway (fn localPos -> 0..1)
  add(geo, color, { bucket = 'toon', m = null, outline = true, sway = null } = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    const P = g.attributes.position, n = P.count;
    if (bucket !== 'atlas') {
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        _c.set(typeof color === 'function' ? color(_v.fromBufferAttribute(P, i), i) : color);
        col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.deleteAttribute('uv');
    }
    if (bucket === 'sway') {
      const w = new Float32Array(n);
      for (let i = 0; i < n; i++) w[i] = sway ? sway(_v.fromBufferAttribute(P, i)) : 0;
      g.setAttribute('aSway', new THREE.BufferAttribute(w, 1));
    }
    g.deleteAttribute('uv1'); g.deleteAttribute('uv2');
    const mm = this.stack[this.stack.length - 1].clone(); if (m) mm.multiply(m);
    g.applyMatrix4(mm);
    if (!this.b.has(bucket)) this.b.set(bucket, []);
    this.b.get(bucket).push(g);
    if (outline) {
      const o = outlineFor(new THREE.Mesh(g), 1).geometry; // smooth-normal shell (thickness set by the merged material)
      for (const k of Object.keys(o.attributes)) if (k !== 'position' && k !== 'normal' && !(bucket === 'sway' && k === 'aSway')) o.deleteAttribute(k);
      if (bucket === 'sway' && !o.attributes.aSway) o.setAttribute('aSway', g.attributes.aSway.clone());
      const k = outline === true ? 1 : outline, N = o.attributes.normal; // per-piece thickness rides in the normal length
      for (let i = 0; i < N.count; i++) { _v.fromBufferAttribute(N, i).normalize().multiplyScalar(k); N.setXYZ(i, _v.x, _v.y, _v.z); }
      this.out.push({ g: o, sway: bucket === 'sway' });
    }
    return g;
  }
  // merge: { bucket: material }, outline materials { plain, sway }. Returns a Group of merged meshes.
  build(mats, outlineMats) {
    const grp = new THREE.Group(), stats = {};
    for (const [k, list] of this.b) {
      const g = mergeGeometries(list, false); list.forEach(x => x.dispose());
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mats[k]); mesh.name = 'island_' + k; mesh.userData.bucket = k;
      grp.add(mesh); stats[k] = g.attributes.position.count / 3;
    }
    for (const sw of [false, true]) {
      const list = this.out.filter(o => o.sway === sw).map(o => o.g); if (!list.length) continue;
      const g = mergeGeometries(list, false); list.forEach(x => x.dispose()); g.computeBoundingSphere();
      const o = new THREE.Mesh(g, sw ? outlineMats.sway : outlineMats.plain); o.name = sw ? 'island_outline_sway' : 'island_outline'; o.userData.outline = true;
      grp.add(o);
    }
    this.b.clear(); this.out = [];
    grp.userData.tris = stats;
    return grp;
  }
}

// inverted-hull outline material (+ optional palm sway) driven by a shared time uniform
export function outlineMaterial(thickness, uTime = null) {
  const m = new THREE.MeshBasicMaterial({ color: 0x161616, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.uOutline = { value: thickness };
    if (uTime) s.uniforms.uTime = uTime;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uOutline;' + (uTime ? SWAY_DECL : ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (uTime ? SWAY_BODY : '') + 'transformed += normal * uOutline;');
  };
  m.customProgramCacheKey = () => 'isl_outline' + (uTime ? '_sway' : '');
  return m;
}
// palm fronds: world-space merged geometry, per-vertex sway weight (0 at the trunk, 1 at the leaf tip)
export const SWAY_DECL = '\nuniform float uTime; attribute float aSway;\n';
export const SWAY_BODY = `{ float ph = dot(position.xz, vec2(0.071, 0.053)); float w = aSway * aSway;
  transformed.x += (sin(uTime * 1.35 + ph) * 0.38 + sin(uTime * 3.1 + ph * 2.0) * 0.08) * w;
  transformed.z += cos(uTime * 1.05 + ph * 1.3) * 0.26 * w; transformed.y += sin(uTime * 2.2 + ph) * 0.14 * w; }\n`;
