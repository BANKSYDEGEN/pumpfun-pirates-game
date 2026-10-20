import * as THREE from 'three';
import { FOG_COLOR } from './ocean.js';

// [aaa water] Ship wakes: a trail ribbon per ship that follows the ship's real path (ring buffer of stern samples),
// shaded as a Kelvin wake: two foam arms opening at ~19.5 deg (half-width = tan(19.47 deg) x distance travelled since
// that sample was laid), feathered divergent waves inside the arms, and a turbulent white centre trail that spreads and
// fades over several seconds. Everything scales smoothly with the speed stored at each sample (no popping): stopped ->
// nothing, slow -> short faint trail, full sail (+SAILS upgrades) -> long, wide, white and foamy.
// Fixed-size buffers, no per-frame allocation. Rendered after the ocean (and after the hull water masks), so it can
// never show inside a hull.
export function createWakes(quality, wavesUniform) {
  const low = quality === 'low';
  const SLOTS = low ? 8 : 16;      // player + nearest ships
  const K = low ? 30 : 44;         // samples per trail
  const X = low ? 7 : 9;           // vertices across the ribbon (so it hugs the swell)
  const DT = low ? 0.21 : 0.15;    // seconds between samples -> ~6.3 s of trail
  const NV = SLOTS * K * X;
  const px = new Float32Array(SLOTS * K), pz = new Float32Array(SLOTS * K), birth = new Float32Array(SLOTS * K).fill(-1e4);
  const spd = new Float32Array(SLOTS * K), dist = new Float32Array(SLOTS * K);
  const slots = Array.from({ length: SLOTS }, () => ({ owner: null, beam: 1, last: -1e4, sx: 1, sz: 0 }));
  const aPos = new Float32Array(NV * 2), aSide = new Float32Array(NV * 2), aInfo = new Float32Array(NV * 4), aLat = new Float32Array(NV);
  for (let v = 0; v < NV; v++) aLat[v] = (v % X) / (X - 1) * 2 - 1;
  const idx = new Uint16Array(SLOTS * (K - 1) * (X - 1) * 6); let q = 0;
  for (let s = 0; s < SLOTS; s++) for (let i = 0; i < K - 1; i++) for (let j = 0; j < X - 1; j++) {
    const a = (s * K + i) * X + j, b = a + X;
    idx[q++] = a; idx[q++] = b; idx[q++] = a + 1; idx[q++] = a + 1; idx[q++] = b; idx[q++] = b + 1;
  }
  const geo = new THREE.BufferGeometry();
  const mk = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
  const atPos = mk(aPos, 2), atSide = mk(aSide, 2), atInfo = mk(aInfo, 4);
  geo.setAttribute('aPos', atPos); geo.setAttribute('aSide', atSide); geo.setAttribute('aInfo', atInfo);
  geo.setAttribute('aLat', new THREE.BufferAttribute(aLat, 1));
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NV * 3), 3)); // unused, keeps three happy
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const uniforms = {
    uTime: { value: 0 }, uWaves: wavesUniform, uFlash: { value: 0 }, uStorm: { value: 0 },
    uFogColor: { value: FOG_COLOR.clone() }, uFogDensity: { value: 0.0042 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    defines: low ? { LOW_Q: 1 } : {},
    vertexShader: /* glsl */`
      uniform float uTime; uniform vec4 uWaves[4];
      attribute vec2 aPos; attribute vec2 aSide; attribute vec4 aInfo; attribute float aLat; // aInfo: birth, speed, path distance, half beam
      varying vec2 vXZ; varying float vLatM; varying float vArm; varying float vW; varying float vAge; varying float vSpd; varying float vS; varying float vB; varying float vFog;
      void main() {
        float age = max(uTime - aInfo.x, 0.0), sp = aInfo.y, B = aInfo.w;
        // Kelvin arm half-width: the sample was laid 'age' seconds ago, the ship is sp*age ahead -> tan(19.47deg)*sp*age
        float arm = min(B * 1.05 + 0.354 * sp * min(age, 7.0) + 0.3 * age, B * 1.05 + 26.0);
        float W = arm * 1.15 + 1.6;
        vec2 xz = aPos + aSide * aLat * W;
        float h = 0.0;
        for (int i = 0; i < 4; i++) { float k = uWaves[i].w; h += uWaves[i].z * sin(k * dot(uWaves[i].xy, xz) - sqrt(9.8 * k) * uTime); }
        vec4 mv = viewMatrix * vec4(xz.x, h + 0.1 + 0.02 * W * abs(aLat), xz.y, 1.0); // lift the wide outer parts so the swell can't poke through between vertices
        vXZ = xz; vLatM = aLat * W; vArm = arm; vW = W; vAge = age; vSpd = sp; vS = aInfo.z; vB = B; vFog = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uFlash; uniform float uStorm; uniform vec3 uFogColor; uniform float uFogDensity;
      varying vec2 vXZ; varying float vLatM; varying float vArm; varying float vW; varying float vAge; varying float vSpd; varying float vS; varying float vB; varying float vFog;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main() {
        float sN = clamp(vSpd / 13.0, 0.0, 1.4);
        float inten = smoothstep(0.0, 0.22, sN) * (0.62 + 0.38 * smoothstep(0.25, 1.0, sN)) + 0.3 * clamp((sN - 0.9) / 0.5, 0.0, 1.0); // stopped -> none, slow -> faint, fast -> white
        float life = 3.2 + 4.3 * smoothstep(0.2, 1.15, sN);                                    // faster -> longer
        float fade = clamp(1.0 - vAge / life, 0.0, 1.0); fade *= fade;
        float fadeArm = pow(clamp(1.0 - vAge / (life * 1.15), 0.0, 1.0), 1.5);
        float la = abs(vLatM);
        float turb = noise(vXZ * 0.5 + vec2(vAge * 0.7, -vAge * 0.45)) * 0.6 + noise(vXZ * 1.3 - vec2(vAge * 0.9, uTime * 0.2)) * 0.4;
        #ifndef LOW_Q
          turb = turb * 0.8 + noise(vXZ * 3.1 + uTime * 0.5) * 0.2;
        #endif
        // turbulent centre trail: starts hull-wide, spreads with age (and with speed), broken up by churn
        float coreW = vB * (0.5 + 0.3 * sN) * (1.0 + 0.28 * vAge);
        float core = exp(-(la * la) / (coreW * coreW) * 1.6);
        float coreFoam = smoothstep(0.36, 0.85, core * (0.3 + 1.05 * turb) * (1.0 - 0.35 * vAge / life));
        // Kelvin arms (thin broken foam lines) + faint feathered divergent waves just inside them
        float armW = 0.35 + 0.06 * vAge + 0.35 * sN;
        float dA = la - vArm, inside = vArm - la;
        float armLine = exp(-(dA * dA) / (armW * armW)) * smoothstep(0.25, 0.65, turb);
        float feather = smoothstep(0.5, 0.95, sin((vS * 0.95 - inside * 1.25) * 1.5)) * exp(-max(inside, 0.0) / (1.0 + sN * 1.5)) * step(-armW, inside) * turb;
        float armF = max(armLine, feather * 0.35) * smoothstep(0.1, 0.7, vAge) * fadeArm;
        float foam = clamp(max(coreFoam * fade * 0.9, armF * 0.7) * inten, 0.0, 0.9);
        // aerated, clearer turquoise water around the centre trail
        float tint = exp(-(la * la) / (coreW * coreW * 5.0)) * 0.22 * fade * inten;
        vec3 foamCol = vec3(0.9, 0.97, 1.0) * (1.0 - 0.35 * uStorm), tintCol = vec3(0.4, 0.8, 0.82) * (1.0 - 0.4 * uStorm);
        float a = clamp(foam + tint * (1.0 - foam), 0.0, 1.0);
        vec3 col = (foamCol * foam + tintCol * tint * (1.0 - foam)) / max(a, 1e-3);
        col += uFlash * vec3(0.35, 0.45, 0.55) * 0.8;
        float fog = 1.0 - exp(-uFogDensity * uFogDensity * vFog * vFog);
        a *= (1.0 - fog) * (1.0 - smoothstep(vW * 0.88, vW, la));
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 3;

  function resetSlot(si, x, z) {
    const b = si * K; px.fill(x, b, b + K); pz.fill(z, b, b + K); birth.fill(-1e4, b, b + K); spd.fill(0, b, b + K); dist.fill(0, b, b + K);
  }
  function feed(sh, t) {
    let si = -1, free = -1, oldest = -1, oldT = 1e9;
    for (let i = 0; i < SLOTS; i++) {
      const sl = slots[i];
      if (sl.owner === sh) { si = i; break; }
      if (!sl.owner && free < 0) free = i;
      if (sl.owner && sl.last < t - 0.5 && sl.last < oldT) { oldT = sl.last; oldest = i; }
    }
    const ud = sh.mesh.userData, n = Math.sin(sh.yaw), c = Math.cos(sh.yaw), back = ud.len * 0.42;
    const sx = sh.x - n * back, sz = sh.z - c * back;
    if (si < 0) { si = free >= 0 ? free : oldest; if (si < 0) return; slots[si].owner = sh; resetSlot(si, sx, sz); }
    const sl = slots[si]; sl.last = t; sl.beam = (ud.beam || ud.len * 0.3) * 0.5; sl.sx = c; sl.sz = -n;
    const b = si * K, v = sh.alive && !(sh.sinking > 0) ? Math.max(0, sh.speed) : 0;
    if (t - birth[b + 1] >= DT || birth[b + 1] > t) {
      px.copyWithin(b + 1, b, b + K - 1); pz.copyWithin(b + 1, b, b + K - 1); birth.copyWithin(b + 1, b, b + K - 1);
      spd.copyWithin(b + 1, b, b + K - 1); dist.copyWithin(b + 1, b, b + K - 1);
    }
    px[b] = sx; pz[b] = sz; birth[b] = t; spd[b] = v; dist[b] = dist[b + 1] + Math.hypot(sx - px[b + 1], sz - pz[b + 1]);
  }
  function write(si) {
    const sl = slots[si], b = si * K;
    for (let i = 0; i < K; i++) {
      const a = b + Math.max(0, i - 1), c = b + Math.min(K - 1, i + 1);
      let dx = px[a] - px[c], dz = pz[a] - pz[c]; const L = Math.hypot(dx, dz);
      let sx, sz; if (L > 1e-3) { sx = dz / L; sz = -dx / L; } else { sx = sl.sx; sz = sl.sz; }
      for (let j = 0; j < X; j++) {
        const v = (b + i) * X + j;
        aPos[v * 2] = px[b + i]; aPos[v * 2 + 1] = pz[b + i]; aSide[v * 2] = sx; aSide[v * 2 + 1] = sz;
        aInfo[v * 4] = birth[b + i]; aInfo[v * 4 + 1] = spd[b + i]; aInfo[v * 4 + 2] = dist[b + i]; aInfo[v * 4 + 3] = sl.beam;
      }
    }
  }
  // ships: the player first, then the rest (nearest first when there are more ships than slots)
  function update(player, others, t) {
    uniforms.uTime.value = t;
    if (player) feed(player, t);
    let n = 1;
    for (let i = 0; i < others.length && n < SLOTS; i++) { if (others[i].sinking > 4) continue; feed(others[i], t); n++; }
    for (let i = 0; i < SLOTS; i++) { const sl = slots[i]; if (sl.owner && t - sl.last > 8) sl.owner = null; write(i); }
    atPos.needsUpdate = atSide.needsUpdate = atInfo.needsUpdate = true;
  }
  function clear() { for (let i = 0; i < SLOTS; i++) { slots[i].owner = null; birth.fill(-1e4, i * K, i * K + K); } }
  return { mesh, uniforms, update, clear };
}
