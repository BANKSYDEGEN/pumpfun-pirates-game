// [clean-water] BANKSY [t393u]: AAA river + lagoon + waterfall plunge. Replaces the milky 12 m unlit ribbon /
// flat falls plane with depth-coloured, sun/storm-lit water that covers the carved bed, meets the lake
// without a stripe, and crashes into a real plunge boil. &riverfx=0 = keep the old foot.js meshes.
import * as THREE from 'three';

export const RIVER_FX = typeof location === 'undefined' || new URLSearchParams(location.search).get('riverfx') !== '0';

// [v348] t1829u/t1830u: where the river mouth runs out over the sea floor (ground h < -0.2) its ribbon eases down to MOUTH_SINK, below the
// deepest ocean trough (sum of the 4 swells ~2.2 m), so only the ONE ocean surface shows there. mouthSink(y, h) = that ribbon height
// (js/dock/world.js uses it too: a swimmer leaving the river mouth rides the higher of the ribbon and the live swell).
export const MOUTH_SINK = -2.6;
export const mouthSea = (h) => isFinite(h) ? Math.min(1, Math.max(0, (-0.2 - h) / 1.0)) : 0;
export function mouthSink(y, h) { const sea = mouthSea(h); return sea > 0 ? Math.min(y, y + (MOUTH_SINK - y) * sea * sea * (3 - 2 * sea)) : y; }

const LAKE_FALLS = (LAKE) => ({ x: LAKE.x - 1, z: LAKE.z - LAKE.r + 4.8 }); // ≈ (-206, -183.2)

// Dense Catmull-Rom strip (≈120 × 8) + polar lagoon disc. River half-width 11.5 m covers the ~20 m bed.
export function riverGeometry({ H, LAKE, RIVERP, low, w = 11.5, discR = LAKE.r + 3.5 }) {
  const NA = low ? 4 : 8, pos = [], flow = [], dir = [], dep = [], idx = [];
  let L = 0; for (let i = 1; i < RIVERP.length; i++) L += Math.hypot(RIVERP[i][0] - RIVERP[i - 1][0], RIVERP[i][1] - RIVERP[i - 1][1]);
  const surf = (s) => LAKE.y * (1 - s / L) - 1.2 * (s / L) + 0.2;
  // Resample denser along the polyline so curves stay silky (~120 rows on desktop)
  const step = low ? 6 : Math.max(3.2, L / 120);
  const dens = [];
  for (let i = 0; i < RIVERP.length - 1; i++) {
    const [ax, az] = RIVERP[i], [bx, bz] = RIVERP[i + 1], seg = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(seg / step));
    for (let k = 0; k < n; k++) dens.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  dens.push(RIVERP[RIVERP.length - 1]);
  // Start slightly inside the lake rim (r ~ 50 m) so the strip meets the disc at lake height
  const startR = Math.min(50, LAKE.r - 8);
  let i0 = 0; while (i0 + 1 < dens.length && Math.hypot(dens[i0 + 1][0] - LAKE.x, dens[i0 + 1][1] - LAKE.z) < startR) i0++;
  let s = 0; for (let i = 0; i < i0; i++) s += Math.hypot(dens[i + 1][0] - dens[i][0], dens[i + 1][1] - dens[i][1]);
  // Map s onto the original RIVERP length for the surface curve
  const sAlong = (i) => { let ss = 0; for (let k = 1; k <= i; k++) ss += Math.hypot(dens[k][0] - dens[k - 1][0], dens[k][1] - dens[k - 1][1]); return ss; };
  const MOUTH = 100;
  const sRim = sAlong(i0), rimLift = Math.max(0, LAKE.y + 0.05 - surf(sRim * (L / Math.max(1e-3, sAlong(dens.length - 1)))));
  const scaleS = L / Math.max(1e-3, sAlong(dens.length - 1));
  const n = dens.length;
  for (let i = i0; i < n; i++) {
    const sRaw = sAlong(i) * scaleS;
    const a = dens[Math.max(0, i - 1)], b = dens[Math.min(n - 1, i + 1)], tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const tx = (b[0] - a[0]) / tl, tz = (b[1] - a[1]) / tl, nx = -tz, nz = tx;
    const mt = Math.min(1, Math.max(0, (sRaw - (L - MOUTH)) / MOUTH));
    const yLake = LAKE.y + 0.05;
    const rC = Math.hypot(dens[i][0] - LAKE.x, dens[i][1] - LAKE.z);
    // Seamless lake→river: hold lake elevation until past disc edge (r=58), ease over the next ~30 m
    const tOut = Math.min(1, Math.max(0, (rC - 62.5) / 35));
    const blend = tOut * tOut * (3 - 2 * tOut);
    const y0 = yLake * (1 - blend) + surf(sRaw) * blend;
    const e = mt * mt * (3 - 2 * mt), y = mt > 0 ? Math.min(y0 + 0.3, e * -0.35 + (1 - e) * y0) : y0;
    for (let k = 0; k <= NA; k++) {
      const c = -1 + 2 * k / NA, x = dens[i][0] + nx * c * w, z = dens[i][1] + nz * c * w;
      const h = H(x, z); // [v348] t1829u/t1830u: the mouth over the sea floor
      const yv = mt > 0 ? mouthSink(y, h) : y;   // sinks under the ocean's troughs: no flat river tongue on the sea
      pos.push(x, yv, z); flow.push(sRaw, c, 0); dir.push(tx, tz);
      dep.push(isFinite(h) ? Math.max(0, yv - h) : 3);
    }
  }
  const nRows = n - i0;
  for (let i = 0; i < nRows - 1; i++) for (let k = 0; k < NA; k++) {
    const a = i * (NA + 1) + k, b = a + NA + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); // +Y upward (was a,b,a+1 = -Y backface-culled)
  }

  // Lagoon disc: dense polar grid, same surface height, flow drawn toward the ESE outflow + falls swirl
  const base = pos.length / 3, NR = low ? 12 : 48, NS = low ? 48 : 96, R = discR, y = LAKE.y + 0.05;
  const falls = LAKE_FALLS(LAKE), outX = LAKE.x + 54, outZ = LAKE.z + 22; // ESE outflow ≈ [-151, -108]
  const r0 = dens[i0] || RIVERP[0], r1 = dens[Math.min(dens.length - 1, i0 + 6)] || RIVERP[1];
  const rtl = Math.hypot(r1[0] - r0[0], r1[1] - r0[1]) || 1, rtx = (r1[0] - r0[0]) / rtl, rtz = (r1[1] - r0[1]) / rtl;
  pos.push(LAKE.x, y, LAKE.z); flow.push(0, 0, 1); dir.push(0, 1);
  { const h = H(LAKE.x, LAKE.z); dep.push(isFinite(h) ? Math.max(0, y - h) : 5); }
  for (let j = 1; j <= NR; j++) for (let q = 0; q < NS; q++) {
    const an = q / NS * Math.PI * 2, r = R * Math.sqrt(j / NR), x = LAKE.x + Math.cos(an) * r, z = LAKE.z + Math.sin(an) * r;
    // Blend falls-outward swirl into river tangent across the ESE outflow throat
    let fdx = x - falls.x, fdz = z - falls.z; const fl = Math.hypot(fdx, fdz) || 1; fdx /= fl; fdz /= fl;
    const dOut = Math.hypot(x - outX, z - outZ);
    const nearOut = 1 - Math.min(1, dOut / 42), throatLock = Math.pow(1 - Math.min(1, dOut / 24), 2);
    const swirlX = fdx * 0.55 - fdz * 0.45, swirlZ = fdz * 0.55 + fdx * 0.45;
    const ox = swirlX * (1 - throatLock) + rtx * (nearOut * 0.85 + throatLock * 1.4);
    const oz = swirlZ * (1 - throatLock) + rtz * (nearOut * 0.85 + throatLock * 1.4);
    const ol2 = Math.hypot(ox, oz) || 1;
    pos.push(x, y, z); flow.push(r, 0, 1); dir.push(ox / ol2, oz / ol2);
    const h = H(x, z); dep.push(isFinite(h) ? Math.max(0, y - h) : 3);
  }
  for (let q = 0; q < NS; q++) idx.push(base, base + 1 + (q + 1) % NS, base + 1 + q);
  for (let j = 1; j < NR; j++) for (let q = 0; q < NS; q++) {
    const a = base + 1 + (j - 1) * NS + q, b = base + 1 + (j - 1) * NS + (q + 1) % NS, c = a + NS, d = b + NS;
    idx.push(a, b, c, b, d, c); // +Y (radial×tangential for increasing θ)
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 3));
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 2));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
  g.setIndex(idx); g.computeBoundingSphere();
  g.userData.len = L; g.userData.mouth = MOUTH; g.userData.halfW = w; g.userData.discR = discR;
  return g;
}

export function riverMaterial({ uTime, ocean = null, low, LAKE, discR = LAKE.r }) {
  const sun = ocean?.uSun || { value: new THREE.Vector3(-0.45, 0.42, 0.78).normalize() };
  const falls = LAKE_FALLS(LAKE);
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, defines: low ? { LOW_Q: 1 } : {},
    uniforms: {
      ...THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uFalls: { value: new THREE.Vector2(falls.x, falls.z) },
        uLakeR: { value: LAKE.r },
        uDiscR: { value: discR },
        uMouth: { value: new THREE.Vector2(1e6, 100) },
        uLakeC: { value: new THREE.Vector2(LAKE.x, LAKE.z) },
      }]),
      uTime, uSun: sun, uStorm: ocean?.uStorm || { value: 0 }, uFlash: ocean?.uFlash || { value: 0 },
    },
    vertexShader: /* glsl */`attribute vec3 aFlow; attribute vec2 aDir; attribute float aDepth;
      varying vec3 vF; varying vec2 vDir; varying float vD; varying vec3 vW; varying vec3 vL;
      uniform float uTime; uniform vec2 uFalls; uniform float uLakeR;
      #include <fog_pars_vertex>
      void main(){
        vF = aFlow; vDir = aDir; vD = aDepth; vL = position;
        vec3 p = position;
        if (aFlow.z > 0.5) {
          float rf = length(p.xz - uFalls);
          float ring = sin(rf * 0.55 - uTime * 2.4) * exp(-rf * 0.085) * 0.11;
          float ring2 = sin(rf * 1.15 - uTime * 3.6) * exp(-rf * 0.14) * 0.045;
          p.y += (ring + ring2) * smoothstep(26.0, 0.0, rf);
        }
        vec4 wp = modelMatrix * vec4(p, 1.0); vW = wp.xyz; vL = p;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`uniform float uTime; uniform vec3 uSun; uniform float uStorm; uniform float uFlash;
      uniform vec2 uFalls; uniform float uLakeR; uniform float uDiscR; uniform vec2 uMouth; uniform vec2 uLakeC;
      varying vec3 vF; varying vec2 vDir; varying float vD; varying vec3 vW; varying vec3 vL;
      #include <common>
      #include <fog_pars_fragment>
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
      vec2 rip(vec2 p, vec2 d, float k, float a, float s){ return a * k * cos(k * dot(d, p) - s * uTime) * d; }
      vec2 rot(vec2 d, float a){ float c = cos(a), s = sin(a); return vec2(d.x * c - d.y * s, d.x * s + d.y * c); }
      void main(){
        float st = uStorm, lake = step(0.5, vF.z), d = max(vD, 0.0);
        float rLake = length(vL.xz - uLakeC);
        // Pixel-exact single-surface handoff at uDiscR: zero overlap lip and zero gap
        if (lake > 0.5 && rLake > uDiscR) discard;
        if (lake < 0.5 && rLake <= uDiscR) discard;
        vec2 p = vL.xz, fd = normalize(vDir + 1e-4);
        vec2 outThroat = uLakeC + vec2(54.0, 22.0);
        float outBlend = lake > 0.5 ? smoothstep(34.0, 6.0, length(p - outThroat)) : 1.0;
        float sp = mix(0.32, 1.0, outBlend);
        vec3 V = normalize(cameraPosition - vW); float dist = length(cameraPosition - vW), rf = 1.0 - smoothstep(30.0, 170.0, dist);
        vec2 g = rip(p, fd, 1.55, 0.048, 3.1 * sp) + rip(p, rot(fd, 0.55), 2.65, 0.028, 4.3 * sp) + rip(p, rot(fd, -0.7), 4.0, 0.016, 5.5 * sp);
        #ifndef LOW_Q
          g += rip(p, rot(fd, 0.25), 6.6, 0.009, 7.4 * sp) + rip(p, rot(fd, -0.3), 9.2, 0.0055, 8.8 * sp);
          vec2 q = p * 0.68 - fd * uTime * 1.35 * sp; float e = 0.35, n0 = vn(q);
          g += vec2(vn(q + vec2(e, 0.0)) - n0, vn(q + vec2(0.0, e)) - n0) / e * 0.048;
        #endif
        // Plunge rings add chop on the lagoon near the falls
        float pr = length(p - uFalls);
        if (lake > 0.5) {
          float ang = atan(p.y - uFalls.y, p.x - uFalls.x);
          g += normalize(p - uFalls + 1e-4) * (0.04 * sin(pr * 0.7 - uTime * 2.6 + ang * 2.0) * exp(-pr * 0.09));
        }
        vec3 nl = normalize(vec3(-g.x, 1.0, -g.y) * vec3(0.9 + 0.55 * st, 1.0, 0.9 + 0.55 * st) * vec3(rf, 1.0, rf) + vec3(0.0, 0.0001, 0.0));
        vec3 n = normalize(nl); // water mesh is axis-aligned in world (no modelMatrix in frag)
        float facing = max(dot(n, V), 0.0), fres = pow(1.0 - facing, 4.0);
        // Beer-Lambert depth: crystal shallow banks -> rich emerald/sapphire channel (all < 0.78)
        vec3 shallow = mix(vec3(0.15, 0.52, 0.48), vec3(0.08, 0.28, 0.26), st);
        vec3 mid = mix(vec3(0.055, 0.33, 0.37), vec3(0.028, 0.16, 0.18), st);
        vec3 deep = mix(vec3(0.022, 0.17, 0.23), vec3(0.012, 0.08, 0.11), st);
        float dm = smoothstep(0.08, 1.5, d), dd = smoothstep(1.3, 5.0, d);
        vec3 col = mix(mix(shallow, mid, dm), deep, dd);
        float lit = (0.70 + 0.40 * clamp(dot(n, uSun), 0.0, 1.0)) * (1.0 - 0.30 * st);
        col *= lit;
        vec3 sky = mix(mix(vec3(0.12, 0.19, 0.24), vec3(0.22, 0.30, 0.37), clamp(reflect(-V, n).y * 2.0, 0.0, 1.0)), vec3(0.07, 0.10, 0.13), st);
        col = mix(col, sky, 0.04 + fres * 0.40);
        float ndh = max(dot(n, normalize(uSun + V)), 0.0);
        col += vec3(1.0, 0.88, 0.70) * (pow(ndh, 90.0) * 0.11 * rf) * (1.0 - 0.85 * st);
        #ifndef LOW_Q
          col += vec3(1.0, 0.9, 0.75) * smoothstep(0.6, 0.95, pow(ndh, 700.0)) * 0.30 * rf * rf * (1.0 - 0.9 * st);
        #endif
        float fn = vn(p * 0.55 - fd * uTime * 0.9 * sp) * 0.6 + vn(p * 1.7 - fd * uTime * 1.8 * sp) * 0.4;
        float bank = smoothstep(0.55, 0.0, d + (fn - 0.5) * 0.5) * smoothstep(0.25, 0.6, fn + 0.15);
        // Aerated plunge boil (r 0..8.5) -> broken frothy wakes (8.5..22), never rigid circles
        float boil = 0.0, wake = 0.0;
        if (lake > 0.5) {
          float angN = vn(vec2(atan(p.y - uFalls.y, p.x - uFalls.x) * 2.2 + uTime * 0.4, pr * 0.15));
          float churn = vn(p * 0.85 - vec2(uTime * 1.1, uTime * 0.7)) * 0.55 + vn(p * 2.1 + uTime * 0.9) * 0.45;
          boil = smoothstep(8.5, 0.0, pr) * smoothstep(0.25, 0.75, churn + 0.2) * (0.75 + 0.25 * angN);
          wake = smoothstep(22.0, 8.5, pr) * smoothstep(7.5, 10.0, pr)
               * smoothstep(0.35, 0.8, churn + 0.15 * sin(pr * 0.9 - uTime * 2.4 + angN * 6.0));
        }
        float streak = (1.0 - lake) * smoothstep(uDiscR, uDiscR + 16.0, rLake) * smoothstep(0.62, 0.9, vn(vec2(vF.x * 0.12 - uTime * 1.6, vF.y * 5.0)) * vn(vec2(vF.x * 0.05 - uTime * 0.7, vF.y * 2.0 + 3.0)) * 1.6) * 0.32 * rf;
        float foam = clamp(bank * 0.72 + boil * 0.85 + wake * 0.55 + streak, 0.0, 1.0);
        vec3 foamCol = vec3(0.58, 0.66, 0.68) * (0.85 + 0.2 * clamp(dot(n, uSun), 0.0, 1.0)) * (1.0 - 0.35 * st);
        col = mix(col, foamCol, foam);
        col += uFlash * vec3(0.22, 0.30, 0.38) * (0.28 + fres + foam * 0.45);
        col = min(col, vec3(0.78));
        // Shallow banks show the bed (alpha ~0.28); deep channel ~0.92
        float a = mix(0.42, 0.93, smoothstep(0.04, 2.0, d));
        a = max(a, foam * 0.82) * smoothstep(-0.12, 0.10, vD);
        a *= 1.0 - (1.0 - lake) * smoothstep(uMouth.x - uMouth.y * 0.75, uMouth.x - 4.0, vF.x);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// Contoured waterfall curtain hugging the cliff notch, clearing GROTTO behind, plunging below lake surface.
export function waterfallGeometry({ H, LAKE, low }) {
  const NX = low ? 16 : 32, NY = low ? 32 : 64;
  const x0 = -213.5, x1 = -198.5, falls = LAKE_FALLS(LAKE);
  // Sample the actual cliff face where it drops toward the grotto roof (z ~ -193..-190, y ~ 56→21)
  const zFace0 = LAKE.z - LAKE.r - 5; // ≈ -193 — wet cliff notch above grotto
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= NY; j++) {
    const v = j / NY; // 0 = crest, 1 = plunge foot
    for (let i = 0; i <= NX; i++) {
      const u = i / NX, x = x0 + (x1 - x0) * u;
      const flute = Math.sin(u * Math.PI * 3.2) * 0.55 + Math.sin(u * Math.PI * 7.1 + 1.3) * 0.25;
      const xc = x + flute * (1 - v) * 0.35;
      // Walk a few metres into the cliff to find the wet notch height, then tuck 0.6 m inside the rock
      let zNotch = zFace0, topY = LAKE.y + 28;
      for (let s = 0; s <= 8; s++) {
        const zz = zFace0 - s * 0.6; // step north into the cliff face
        const hh = H(xc, zz);
        if (isFinite(hh) && hh > LAKE.y + 8) { zNotch = zz; topY = hh; }
      }
      topY -= 0.6; // tuck crest lip inside the rock face
      const lip = v < 0.14 ? (v / 0.14) * (v / 0.14) : 1;
      const arch = Math.sin(Math.min(1, Math.max(0, (v - 0.05) / 0.45)) * Math.PI) * 5.2;
      // Start tucked in the notch, roll over the lip, arch past GROTTO, plunge below lake
      let z = zNotch + lip * 2.4 + arch + v * v * 9.5;
      const y = topY * (1 - v) + 19.55 * v + (v > 0.85 ? 0 : Math.sin(v * Math.PI) * 0.35);
      if (v > 0.08) z = Math.max(z, -183.6);
      if (v >= 0.85) z = Math.max(z, -183.2);
      pos.push(xc, y, z); uv.push(u, 1 - v);
    }
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + NX + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  g.userData.falls = falls;
  return g;
}

export function waterfallMaterial({ uTime, low }) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime }]),
    vertexShader: /* glsl */`varying vec2 vUv; varying float vY; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vY = position.y; vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`uniform float uTime; varying vec2 vUv; varying float vY; varying vec3 vW;
      #include <common>
      #include <fog_pars_fragment>
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hsh(i), hsh(i + vec2(1,0)), f.x), mix(hsh(i + vec2(0,1)), hsh(i + vec2(1,1)), f.x), f.y); }
      void main(){
        // Accelerating vertical flow (v stretched by gravity)
        float speed = 1.2 + (1.0 - vUv.y) * 2.8;
        float flow = fract(vUv.y * (2.4 + (1.0 - vUv.y) * 3.5) - uTime * speed + sin(vUv.x * 22.0 + uTime) * 0.03);
        float streak = smoothstep(0.12, 0.5, flow) * smoothstep(1.0, 0.65, flow);
        float lace = vn(vec2(vUv.x * 18.0, vUv.y * 8.0 - uTime * 2.8));
        // Translucent deep-aqua core between lacy whitewater streams
        vec3 core = vec3(0.12, 0.38, 0.42);
        vec3 white = vec3(0.72, 0.78, 0.80);
        vec3 col = mix(core, white, clamp(streak * 0.75 + lace * 0.35, 0.0, 1.0));
        // Mist brightening near bottom third
        col = mix(col, vec3(0.65, 0.72, 0.74), smoothstep(0.55, 0.0, vUv.y) * 0.35);
        col = min(col, vec3(0.80));
        float sideN = vn(vec2(vUv.y * 6.5 - uTime * 1.4, 2.3)) * 0.13 + vn(vec2(vUv.y * 14.0 - uTime * 2.2, 7.1)) * 0.06;
        float edge = smoothstep(0.02 + sideN, 0.18 + sideN, vUv.x) * smoothstep(0.98 - sideN, 0.82 - sideN, vUv.x);
        float crest = smoothstep(0.88, 1.0, vUv.y + (lace - 0.5) * 0.08);
        float a = (0.45 + 0.45 * streak + 0.2 * lace) * edge * (1.0 - crest * 0.25);
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.92));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// Rolling whitewater splash collar + soft rising mist at the curtain foot.
export function plungeFX({ uTime, LAKE, low }) {
  const falls = LAKE_FALLS(LAKE);
  const group = new THREE.Group(); group.name = 'foot_plunge_fx';
  // Toroidal / billowing skirt hugging y = 20.02..22.2
  const NR = low ? 12 : 24, NS = low ? 20 : 36, pos = [], uv = [], idx = [];
  for (let j = 0; j <= NR; j++) {
    const v = j / NR, y = 20.02 + v * 2.2, rad = 3.2 + v * 5.5 + Math.sin(v * Math.PI) * 1.4;
    for (let i = 0; i <= NS; i++) {
      const u = i / NS, a = u * Math.PI * 2;
      // Front/sides bias (open slightly toward +z / lake)
      const bias = 1.0 + 0.18 * Math.cos(a - 0.2);
      pos.push(falls.x + Math.cos(a) * rad * bias, y, falls.z + Math.sin(a) * rad * bias * 0.85);
      uv.push(u, v);
    }
  }
  for (let j = 0; j < NR; j++) for (let i = 0; i < NS; i++) {
    const a = j * (NS + 1) + i, b = a + NS + 1; idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime },
    vertexShader: `varying vec2 vUv; uniform float uTime; void main(){
      vUv = uv; vec3 p = position;
      p.y += sin(uTime * 3.2 + uv.x * 18.0) * 0.12 * uv.y;
      float outward = 1.0 + 0.04 * sin(uTime * 2.5 + uv.x * 12.0) * uv.y;
      p.x = mix(p.x, (p.x - ${falls.x.toFixed(2)}) * outward + ${falls.x.toFixed(2)}, uv.y);
      p.z = mix(p.z, (p.z - ${falls.z.toFixed(2)}) * outward + ${falls.z.toFixed(2)}, uv.y);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }
      void main(){
        float churn = vn(vec2(vUv.x * 10.0 - uTime * 1.4, vUv.y * 4.0 + uTime * 0.8));
        vec3 col = mix(vec3(0.45, 0.58, 0.62), vec3(0.70, 0.76, 0.78), churn);
        col = min(col, vec3(0.80));
        float a = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.55, vUv.y) * (0.35 + 0.45 * churn);
        a *= smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x) + 0.5; // continuous around
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.7));
      }`,
  });
  const collar = new THREE.Mesh(g, m); collar.renderOrder = 5; collar.frustumCulled = false; group.add(collar);

  if (!low) {
    const N = 160, pp = new Float32Array(N * 3), sd = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 6;
      pp[i * 3] = Math.cos(a) * r; pp[i * 3 + 1] = Math.random() * 5; pp[i * 3 + 2] = Math.sin(a) * r * 0.8; sd[i] = Math.random();
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    pg.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
    const mist = new THREE.Points(pg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uTime },
      vertexShader: `attribute float aSeed; uniform float uTime; varying float vA;
        void main(){ float t = fract(uTime * 0.22 + aSeed); vec3 p = position; p.y = 0.2 + t * 5.3; p.x *= 1.0 + t * 0.5; p.z *= 1.0 + t * 0.5;
          vA = sin(t * 3.14159) * 0.28; vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (28.0 + 50.0 * aSeed) * (28.0 / max(1.0, -mv.z)); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vec3(0.85, 0.90, 0.92), smoothstep(0.5, 0.0, d) * vA); }`,
    }));
    mist.position.set(falls.x, 20.2, falls.z); mist.renderOrder = 6; mist.frustumCulled = false; mist.name = 'foot_plunge_mist';
    group.add(mist);
  }
  return group;
}

export function lakeDiscR(old, LAKE) {
  const P = old?.geometry?.attributes?.position, F = old?.geometry?.attributes?.aFlow;
  if (!P || !F) return LAKE.r + 3.5;
  let r = 0; for (let i = 0; i < P.count; i++) if (F.getZ(i) > 0.5) r = Math.max(r, Math.hypot(P.getX(i) - LAKE.x, P.getZ(i) - LAKE.z));
  return r > 1 ? r : LAKE.r + 3.5;
}

export function upgradeRiver(footRoot, { FM, low, uTime, ocean = null }) {
  if (!RIVER_FX || !footRoot || !FM?.MAP_PATHS || !FM.LAKE || !FM.H) return null;
  let old = null, oldFall = null, oldMist = null;
  footRoot.traverse(o => {
    if (!old && o.name === 'foot_freshwater') old = o;
    if (!oldFall && (o.name === 'foot_waterfall' || o.name === 'waterfall_aaa')) oldFall = o;
    if (!oldMist && o.name === 'foot_waterfall_mist') oldMist = o;
  });
  // Fallback: unnamed waterfall plane sitting near the falls cliff
  if (!oldFall) footRoot.traverse(o => {
    if (oldFall || !o.isMesh || !o.geometry?.type) return;
    if (o.geometry.type === 'PlaneGeometry' && o.position && Math.hypot(o.position.x + 206, (o.position.z || 0) + 186) < 20) oldFall = o;
  });
  if (!old) return null;
  const RIVERP = FM.MAP_PATHS().river; if (!RIVERP?.length) return null;
  const discMeshR = FM.LAKE.r + 3.5;
  const discardR = FM.LAKE.r + 3.0; // 61.0 m — inside 96-gon chord (61.47 m), zero double-alpha lip
  const g = riverGeometry({ H: FM.H, LAKE: FM.LAKE, RIVERP, low, discR: discMeshR });
  const m = riverMaterial({ uTime: uTime || old.material?.uniforms?.uTime || { value: 0 }, ocean, low, LAKE: FM.LAKE, discR: discardR });
  m.uniforms.uDiscR.value = discardR;
  m.uniforms.uMouth.value.set(g.userData.len, g.userData.mouth);
  const mesh = new THREE.Mesh(g, m); mesh.name = 'foot_freshwater_fx'; mesh.renderOrder = old.renderOrder || 3; mesh.frustumCulled = false;
  mesh.position.copy(old.position); mesh.quaternion.copy(old.quaternion); mesh.scale.copy(old.scale);
  old.parent.add(mesh); old.visible = false; old.userData.replacedBy = mesh;

  // Replace stiff falls plane with contoured curtain + plunge FX
  const parent = oldFall?.parent || old.parent;
  if (oldFall) { oldFall.visible = false; oldFall.userData.replacedBy = 'curtain'; }
  if (oldMist) { oldMist.visible = false; }
  const curtain = new THREE.Mesh(
    waterfallGeometry({ H: FM.H, LAKE: FM.LAKE, low }),
    waterfallMaterial({ uTime: uTime || { value: 0 }, low }),
  );
  curtain.name = 'foot_waterfall_fx'; curtain.renderOrder = 4; curtain.frustumCulled = false;
  parent.add(curtain);
  const plunge = plungeFX({ uTime: uTime || { value: 0 }, LAKE: FM.LAKE, low });
  parent.add(plunge);
  mesh.userData.curtain = curtain; mesh.userData.plunge = plunge;
  return mesh;
}
