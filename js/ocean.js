import * as THREE from 'three';

// Shared wave field: identical math on CPU (ship buoyancy) and GPU (ocean mesh).
// [dirX, dirZ, amplitude, wavelength]
export const WAVES = [
  [1.0, 0.35, 1.05, 46],
  [0.55, 1.0, 0.62, 27],
  [-0.45, 0.9, 0.34, 15],
  [0.95, -0.4, 0.2, 9],
];
const W = WAVES.map(([x, z, a, l]) => {
  const n = Math.hypot(x, z), k = (2 * Math.PI) / l;
  return { dx: x / n, dz: z / n, a, k, w: Math.sqrt(9.8 * k) };
});

export function waveHeight(x, z, t) {
  let h = 0;
  for (const v of W) h += v.a * Math.sin(v.k * (v.dx * x + v.dz * z) - v.w * t);
  return h;
}

export const FOG_COLOR = new THREE.Color(0x24414d);
export const MAX_HULLS = 12;

// Stylized storm sea: banded toon shading, crisp foam lines on crests, foam collars around hulls,
// glints, and a lightning flash. Same wave field as the CPU buoyancy above.
export function createOcean(quality) {
  const low = quality === 'low';
  const size = low ? 700 : 900;
  const seg = low ? 140 : 260;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const uniforms = {
    uTime: { value: 0 },
    uWaves: { value: W.map(v => new THREE.Vector4(v.dx, v.dz, v.a, v.k)) },
    uSun: { value: new THREE.Vector3(-0.45, 0.42, 0.78).normalize() },
    uFogColor: { value: FOG_COLOR.clone() },
    uFogDensity: { value: 0.0042 },
    uFlash: { value: 0 },
    uHulls: { value: Array.from({ length: MAX_HULLS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uHullCount: { value: 0 },
    uHullV: { value: new Array(MAX_HULLS).fill(0) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    defines: low ? { LOW_Q: 1 } : {},
    vertexShader: /* glsl */`
      uniform float uTime; uniform vec4 uWaves[4];
      varying vec3 vWorld; varying vec3 vNormal; varying float vH; varying float vFogDepth;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float h = 0.0; vec2 g = vec2(0.0);
        for (int i = 0; i < 4; i++) {
          vec2 d = uWaves[i].xy; float a = uWaves[i].z; float k = uWaves[i].w;
          float ph = k * dot(d, wp.xz) - sqrt(9.8 * k) * uTime;
          h += a * sin(ph); g += a * k * cos(ph) * d;
        }
        wp.y = h; vH = h;
        vNormal = normalize(vec3(-g.x, 1.0, -g.y));
        vWorld = wp.xyz;
        vec4 mv = viewMatrix * wp; vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uSun; uniform vec3 uFogColor; uniform float uFogDensity; uniform float uFlash;
      uniform vec4 uHulls[${MAX_HULLS}]; uniform int uHullCount; uniform float uHullV[${MAX_HULLS}];
      varying vec3 vWorld; varying vec3 vNormal; varying float vH; varying float vFogDepth;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      // distance to the nearest cell edge (animated) -> cartoon foam lattice
      float cellEdge(vec2 p, float t){
        vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec2 o = vec2(float(x), float(y)); vec2 h = hash2(i + o);
          h = 0.5 + 0.45 * sin(t + 6.2831 * h);
          float d = length(o + h - f);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        return d2 - d1;
      }
      void main() {
        vec3 n = vNormal; vec2 p = vWorld.xz;
        float rn = noise(p * 0.35 + uTime * 0.6);
        n.x += (rn - 0.5) * 0.3 + sin(p.x * 1.3 + uTime * 2.1) * 0.04;
        n.z += (noise(p * 0.35 - uTime * 0.5 + 17.0) - 0.5) * 0.3 + sin(p.y * 1.1 - uTime * 1.7) * 0.04;
        n = normalize(n);
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        // palette: deep storm navy -> teal -> bright turquoise on crests
        vec3 deep = vec3(0.008, 0.04, 0.065), mid = vec3(0.018, 0.13, 0.17), crest = vec3(0.06, 0.32, 0.36);
        float hh = clamp(vH * 0.32 + 0.45, 0.0, 1.0);
        vec3 col = mix(deep, mid, smoothstep(0.15, 0.55, hh));
        col = mix(col, crest, smoothstep(0.62, 0.9, hh) * 0.85);
        // toon bands
        float d = dot(n, uSun);
        float band = 0.62 + 0.24 * smoothstep(0.05, 0.12, d) + 0.22 * smoothstep(0.5, 0.56, d);
        col *= band;
        // stepped sky reflection
        vec3 skyLo = vec3(0.12, 0.2, 0.25), skyHi = vec3(0.26, 0.33, 0.42);
        float r = clamp(reflect(-V, n).y * 2.0, 0.0, 1.0);
        vec3 skyRef = mix(skyLo, skyHi, floor(r * 3.0) / 3.0);
        col = mix(col, skyRef, 0.08 + smoothstep(0.35, 0.6, fres) * 0.4);
        // glints
        vec3 H = normalize(uSun + V);
        float sp = pow(max(dot(n, H), 0.0), 90.0);
        col += vec3(0.9, 0.95, 1.0) * step(0.55, sp) * 0.5;
        // crest foam: solid caps with crisp edges + lattice foam lines on the upper slopes
        float fn = noise(p * 0.18 + uTime * 0.15) * 0.9 + noise(p * 0.8 - uTime * 0.2) * 0.35;
        float capH = vH + fn * 0.65;
        float foam = smoothstep(1.85, 1.92, capH);
        #ifndef LOW_Q
          float ce = cellEdge(p * 0.16 + vec2(uTime * 0.05, -uTime * 0.03), uTime * 0.6);
          float lines = (1.0 - smoothstep(0.025, 0.05, ce)) * smoothstep(0.9, 1.5, capH);
          foam = max(foam, lines * 0.85);
          float ce2 = cellEdge(p * 0.45 - vec2(uTime * 0.1), uTime);
          foam = max(foam, (1.0 - smoothstep(0.015, 0.035, ce2)) * smoothstep(1.45, 1.8, capH) * 0.7);
        #else
          foam = max(foam, smoothstep(0.86, 0.9, noise(p * 0.5 + uTime * 0.25)) * smoothstep(0.6, 1.3, capH) * 0.7);
        #endif
        // foam collars around hulls + bow wave + short wake
        for (int i = 0; i < ${MAX_HULLS}; i++) {
          if (i >= uHullCount) break;
          vec4 s = uHulls[i]; vec2 dp = p - s.xy;
          float c = cos(s.z), sn = sin(s.z);
          float lx = dp.x * c - dp.y * sn, lz = dp.x * sn + dp.y * c; // lz forward along the keel
          float L = s.w * 0.52, B = s.w * 0.17 + 0.6;
          float e = length(vec2(lx / B, lz / L));
          float wob = noise(p * 1.4 + uTime * 1.5) * 0.28;
          float collar = smoothstep(1.45 + wob, 1.18, e) * smoothstep(0.85, 1.0, e);
          float bow = smoothstep(0.0, 0.5, lz / L - 0.45) * (1.0 - smoothstep(0.0, 0.35, abs(abs(lx) - (1.2 - lz / L) * B * 0.9))) * step(e, 2.0);
          float spd = clamp(uHullV[i] / 9.0, 0.0, 1.0);
          float zl = -lz / L; // 0 at midship, >1 astern
          float wakeW = B * (0.5 + (zl - 1.0) * 0.35);
          float wake = smoothstep(0.95, 1.2, zl) * smoothstep(3.6 * spd + 1.0, 1.2, zl) * (1.0 - smoothstep(0.6, 1.0, abs(lx) / max(wakeW, 0.1)));
          wake *= step(0.5, noise(p * 0.7 + vec2(uTime * 0.4)) + 0.2) * spd;
          foam = max(foam, max(collar * (0.55 + 0.45 * spd), max(bow * spd, wake * 0.75)));
        }
        vec3 foamCol = vec3(0.86, 0.95, 0.97) * (0.8 + 0.2 * band);
        col = mix(col, foamCol, clamp(foam, 0.0, 1.0));
        col += uFlash * vec3(0.35, 0.45, 0.55) * (0.35 + fres + foam * 0.6);
        float fog = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
        gl_FragColor = vec4(mix(col, uFogColor * (1.0 + uFlash * 1.5), fog), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.userData.step = size / seg;
  return { mesh, uniforms };
}

// Stylized storm sky: stepped cloud bands, a smouldering sunset seam on the horizon, lightning-lit undersides.
export function createSky() {
  const geo = new THREE.SphereGeometry(1000, 32, 16);
  const uniforms = { uTime: { value: 0 }, uFlash: { value: 0 }, uFogColor: { value: FOG_COLOR.clone() }, uBolt: { value: new THREE.Vector3(0, 0, 1) } };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uFlash; uniform vec3 uFogColor; uniform vec3 uBolt; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
      void main(){
        vec3 d = normalize(vDir);
        float y = max(d.y, 0.0);
        vec3 top = vec3(0.03, 0.04, 0.075);
        vec3 col = mix(uFogColor, top, pow(y, 0.5));
        // smouldering sunset seam low in one direction, mostly hidden behind clouds
        float sunDir = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(-0.45, 0.0, 0.78))), 0.0);
        float seam = exp(-y * 16.0) * pow(sunDir, 3.0);
        col += vec3(1.0, 0.42, 0.16) * seam * 0.55;
        // cloud field, quantized into 3 painted tones with bright rims
        vec2 uv = d.xz / (d.y + 0.22) * 1.4 + vec2(uTime * 0.025, uTime * 0.012);
        float c = fbm(uv) + 0.15 * fbm(uv * 3.0 - uTime * 0.05);
        float m = smoothstep(0.0, 0.25, y);
        vec3 cDark = vec3(0.06, 0.08, 0.11), cMid = vec3(0.13, 0.17, 0.22), cLite = vec3(0.24, 0.3, 0.37);
        float s1 = smoothstep(0.47, 0.5, c), s2 = smoothstep(0.6, 0.63, c), s3 = smoothstep(0.72, 0.745, c);
        vec3 cloud = mix(cDark, cMid, s2);
        cloud = mix(cloud, cLite, s3);
        cloud += vec3(1.0, 0.5, 0.25) * seam * 1.2 * (s1 - s2 * 0.5);
        col = mix(col, cloud, s1 * m);
        // lightning: whole sky pulses, clouds near the strike glow hardest
        float near = pow(max(dot(d, normalize(uBolt)), 0.0), 6.0);
        col += uFlash * vec3(0.5, 0.58, 0.8) * (0.25 + c * 0.6 + near * 2.0 * s1);
        if (d.y < 0.0) col = uFogColor;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  return { mesh, uniforms };
}

// Jagged lightning bolt ribbon placed far off when lightning strikes (HDR so it blooms on high).
export function createBolt() {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.8, 3.4), transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = -0.5;
  function strike(cam, yawHint = Math.random() * 6.28) {
    const pts = []; let x = 0, y = 260;
    while (y > 0) { pts.push([x, y]); y -= 18 + Math.random() * 26; x += (Math.random() - 0.5) * 40; }
    pts.push([x, -5]);
    const pos = [], idx = [];
    pts.forEach(([px, py], i) => { const w = 4.5 * (1 - i / pts.length) + 1.2; pos.push(px - w, py, 0, px + w, py, 0); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
    // a side fork
    const k = Math.floor(pts.length * 0.4), b = pos.length / 3; let [fx, fy] = pts[k];
    for (let i = 0; i < 4; i++) { const w = 1.5 - i * 0.3; pos.push(fx - w, fy, 0, fx + w, fy, 0); if (i) { const a = b + (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } fx += 14 + Math.random() * 10; fy -= 20 + Math.random() * 10; }
    mesh.geometry.dispose();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    mesh.geometry = g;
    const dist = 520;
    mesh.position.set(cam.x + Math.sin(yawHint) * dist, 0, cam.z + Math.cos(yawHint) * dist);
    mesh.lookAt(cam.x, 0, cam.z);
    mesh.visible = true;
    return new THREE.Vector3(Math.sin(yawHint), 0.25, Math.cos(yawHint)).normalize();
  }
  return { mesh, strike };
}

// GPU rain: streaks wrap in a box around the camera.
export function createRain(count) {
  const box = new THREE.Vector3(140, 70, 140);
  const pos = new Float32Array(count * 2 * 3), end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * box.x, y = Math.random() * box.y, z = Math.random() * box.z;
    for (let j = 0; j < 2; j++) { pos.set([x, y, z], (i * 2 + j) * 3); end[i * 2 + j] = j; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const uniforms = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uFlash: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `
      uniform float uTime; uniform vec3 uCam; uniform vec3 uBox; attribute float aEnd; varying float vA;
      void main(){
        vec3 vel = vec3(-6.0, -42.0, 3.0);
        vec3 p = position + vel * uTime;
        p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;
        p -= vel * 0.035 * aEnd;
        vA = aEnd;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform float uFlash; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.7,0.78,0.85) + uFlash, 0.28 * (1.0 - vA * 0.6)); }`,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  return { mesh: lines, uniforms };
}
