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
export const STORM_FOG = new THREE.Color(0x121f27); // [aaa water] late-wave mood target (waves 6 -> 12+)
export const MAX_HULLS = 12;

// [aaa water] Stylized storm sea, polished: see-through turquoise near the camera / hulls / thin crests fading to
// deep navy far out (fresnel + distance), subtle toon banding, small ripples layered on the big swell (normal-map style),
// sun glints that follow uSun, soft crest foam that builds on wave tops and dissolves slowly after the crest passes,
// foam collars + bow waves around hulls, lingering foam where cannonballs land, and a 0..1 storm mood (uStorm).
// The ship wakes are separate trail ribbons (wake.js). Same wave field as the CPU buoyancy above.
export function createOcean(quality) {
  const low = quality === 'low', ultra = quality === 'ultra'; // [ultra] bigger, denser sea + sharper sun glints
  const size = low ? 700 : ultra ? 1200 : 900;
  const seg = low ? 140 : ultra ? 440 : 260;
  const NS = low ? 6 : 10; // lingering splash foam spots
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const uniforms = {
    uTime: { value: 0 },
    uWaves: { value: W.map(v => new THREE.Vector4(v.dx, v.dz, v.a, v.k)) },
    uSun: { value: new THREE.Vector3(-0.45, 0.42, 0.78).normalize() },
    uFogColor: { value: FOG_COLOR.clone() },
    uFogDensity: { value: 0.0042 },
    uFlash: { value: 0 },
    uStorm: { value: 0 },
    uHulls: { value: Array.from({ length: MAX_HULLS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uHullCount: { value: 0 },
    uHullV: { value: new Array(MAX_HULLS).fill(0) },
    uSplash: { value: Array.from({ length: NS }, () => new THREE.Vector4(0, 0, -1e4, 1)) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    defines: low ? { LOW_Q: 1 } : ultra ? { ULTRA_Q: 1 } : {},
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
      uniform float uTime; uniform vec3 uSun; uniform vec3 uFogColor; uniform float uFogDensity; uniform float uFlash; uniform float uStorm;
      uniform vec4 uWaves[4];
      uniform vec4 uHulls[${MAX_HULLS}]; uniform int uHullCount; uniform float uHullV[${MAX_HULLS}];
      uniform vec4 uSplash[${NS}];
      varying vec3 vWorld; varying vec3 vNormal; varying float vH; varying float vFogDepth;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm2(vec2 p){ return noise(p) * 0.62 + noise(p * 2.13 + 7.1) * 0.38; }
      // one small directional ripple: slope (gradient) of a*sin(k*d.p - s*t)
      vec2 rip(vec2 p, vec2 d, float k, float a, float s){ return a * k * cos(k * dot(d, p) - s * uTime) * d; }
      void main() {
        vec2 p = vWorld.xz; float dist = vFogDepth; float st = uStorm;
        vec3 V = normalize(cameraPosition - vWorld);
        // --- small ripples on the big swell (fade out with distance so far water doesn't shimmer)
        float rf = 1.0 - smoothstep(45.0, 230.0, dist);
        vec2 g = rip(p, vec2(0.82, 0.57), 2.6, 0.035, 4.6) + rip(p, vec2(-0.35, 0.94), 3.7, 0.025, 5.4)
               + rip(p, vec2(0.98, -0.2), 5.3, 0.016, 6.6) + rip(p, vec2(-0.7, -0.71), 7.9, 0.01, 8.1);
        #ifndef LOW_Q
          g += rip(p, vec2(0.25, -0.97), 11.0, 0.007, 9.6);
          g += rip(p, vec2(0.6, -0.8), 4.4, 0.02, 6.0) + rip(p, vec2(-0.95, 0.31), 9.3, 0.008, 9.0) + rip(p, vec2(0.13, 0.99), 14.0, 0.0045, 11.0);
        #endif
        vec3 n = normalize(vNormal + vec3(-g.x, 0.0, -g.y) * (0.6 + 0.6 * st) * rf);
        float facing = max(dot(n, V), 0.0);
        float fres = pow(1.0 - facing, 4.0);
        float nearC = 1.0 - smoothstep(18.0, 170.0, dist);
        float hh = clamp(vH * 0.32 + 0.45, 0.0, 1.0);

        // --- hulls: foam collar, bow wave, and a clear turquoise halo
        float hullFoam = 0.0, halo = 0.0;
        for (int i = 0; i < ${MAX_HULLS}; i++) {
          if (i >= uHullCount) break;
          vec4 s = uHulls[i]; vec2 dp = p - s.xy;
          float c = cos(s.z), sn = sin(s.z);
          float lx = dp.x * c - dp.y * sn, lz = dp.x * sn + dp.y * c; // lz forward along the keel
          float L = s.w * 0.52, B = s.w * 0.17 + 0.6;
          float e = length(vec2(lx / B, lz / L));
          if (e > 3.0) continue;
          float spd = clamp(uHullV[i] / 13.0, 0.0, 1.0);
          float wob = noise(p * 1.4 + uTime * 1.5) * 0.28;
          float collar = smoothstep(1.4 + wob + spd * 0.25, 1.15, e) * smoothstep(0.85, 1.0, e);
          float bow = smoothstep(0.0, 0.5, lz / L - 0.45) * (1.0 - smoothstep(0.0, 0.35 + spd * 0.25, abs(abs(lx) - (1.2 - lz / L) * B * 0.9))) * step(e, 2.0 + spd * 0.6);
          hullFoam = max(hullFoam, max(collar * (0.45 + 0.55 * spd), bow * smoothstep(0.05, 0.8, spd)));
          halo = max(halo, smoothstep(2.6, 1.05, e));
        }

        // --- palette: deep navy far out / grazing -> clear turquoise near, around hulls and through thin crests
        vec3 deep = mix(vec3(0.006, 0.032, 0.06), vec3(0.004, 0.015, 0.028), st);
        vec3 mid = mix(vec3(0.016, 0.13, 0.17), vec3(0.01, 0.065, 0.085), st);
        vec3 clear = mix(vec3(0.04, 0.33, 0.37), vec3(0.04, 0.19, 0.21), st);
        vec3 col = mix(mid, deep, clamp((1.0 - nearC) * 0.85 + fres * 0.5, 0.0, 1.0));
        col *= 0.8 + 0.3 * smoothstep(0.1, 0.8, hh);
        float clarity = clamp(nearC * (1.0 - fres) * 0.6 * smoothstep(0.2, 0.85, hh + 0.2) + halo * 0.85, 0.0, 1.0);
        col = mix(col, clear, clarity * 0.8);
        vec3 sunH = normalize(vec3(uSun.x, 0.0, uSun.z));
        float sss = pow(max(dot(-V, sunH), 0.0), 2.0) * smoothstep(0.4, 1.8, vH) * (0.4 + 0.6 * nearC);
        col += clear * sss * 0.7 * (1.0 - 0.5 * st);
        // subtle toon banding (mostly smooth so it still matches the cel-shaded ships)
        float d = dot(n, uSun);
        float lit = mix(0.62 + 0.42 * clamp(d, 0.0, 1.0), 0.62 + 0.24 * smoothstep(0.05, 0.12, d) + 0.2 * smoothstep(0.5, 0.56, d), 0.35) * (1.0 - 0.3 * st);
        col *= lit;
        // sky reflection (fresnel), softly stepped
        vec3 skyLo = mix(vec3(0.12, 0.2, 0.25), vec3(0.055, 0.085, 0.11), st), skyHi = mix(vec3(0.27, 0.34, 0.43), vec3(0.11, 0.14, 0.19), st);
        float r = clamp(reflect(-V, n).y * 2.0, 0.0, 1.0);
        col = mix(col, mix(skyLo, skyHi, mix(r, floor(r * 3.0) / 3.0, 0.4)), 0.05 + fres * 0.6);
        // sun glints: tight sparkles on the ripples + a broad warm sheen, both follow uSun
        float ndh = max(dot(n, normalize(uSun + V)), 0.0);
        float sunward = smoothstep(-0.3, 0.8, dot(-V, sunH));
        float sparkle = smoothstep(0.55, 0.95, pow(ndh, 900.0)) * rf * rf * rf;
        col += vec3(1.0, 0.86, 0.66) * (sparkle * 1.0 + pow(ndh, 60.0) * 0.12) * sunward * (1.0 - 0.75 * st);
        #ifdef ULTRA_Q
        col += vec3(1.0, 0.9, 0.74) * (pow(ndh, 2400.0) * 1.6 + pow(ndh, 220.0) * 0.07) * sunward * (1.0 - 0.75 * st); // [ultra] tighter specular core
        #endif

        // --- crest foam: builds just before a big crest, then dissolves slowly behind it
        float ph0 = uWaves[0].w * dot(uWaves[0].xy, p) - sqrt(9.8 * uWaves[0].w) * uTime;
        float ph1 = uWaves[1].w * dot(uWaves[1].xy, p) - sqrt(9.8 * uWaves[1].w) * uTime;
        float tc0 = fract((1.5708 - ph0) / 6.2832), tc1 = fract((1.5708 - ph1) / 6.2832); // 0 at the crest, grows after it passes
        float fn = fbm2(p * 0.11 + vec2(uTime * 0.03, -uTime * 0.02));
        float thr = 0.85 - 0.35 * st;
        float cov = max(exp(-tc0 * 2.6), smoothstep(0.93, 1.0, tc0)) * smoothstep(thr, thr + 0.7, vH - uWaves[0].z * sin(ph0) + fn * 0.65)
                  + max(exp(-tc1 * 3.2), smoothstep(0.93, 1.0, tc1)) * smoothstep(thr + 0.2, thr + 0.9, vH - uWaves[1].z * sin(ph1) + fn * 0.65) * 0.8;
        float ft = fbm2(p * 0.8 + vec2(uTime * 0.12, uTime * 0.05));
        #ifndef LOW_Q
          ft = ft * 0.7 + noise(p * 1.9 - uTime * 0.2) * 0.3;
        #endif
        cov = clamp(cov * smoothstep(0.2, 1.3, vH), 0.0, 1.0);
        float foam = smoothstep(1.0 - cov, 1.35 - cov, ft) * 0.8 * smoothstep(0.0, 0.2, cov);
        // lingering foam where cannonballs hit the water
        float spl = 0.0;
        for (int i = 0; i < ${NS}; i++) {
          vec4 s = uSplash[i]; float age = uTime - s.z;
          if (age < 0.0 || age > 6.0) continue;
          float rr = length(p - s.xy), R = s.w * (0.7 + age * 0.55), a = 1.0 - age / 6.0;
          spl = max(spl, smoothstep(R, R * 0.3, rr) * a * a + smoothstep(0.3 * s.w, 0.0, abs(rr - R)) * a * 0.8);
        }
        foam = max(foam, smoothstep(1.0 - spl, 1.25 - spl, ft) * min(spl * 3.0, 1.0));
        foam = max(foam, hullFoam);
        vec3 foamCol = mix(vec3(0.58, 0.68, 0.72), vec3(0.92, 0.98, 1.0), clamp(d * 0.8 + 0.55, 0.0, 1.0)) * (1.0 - 0.35 * st);
        col = mix(col, foamCol, clamp(foam, 0.0, 1.0));
        col += uFlash * vec3(0.35, 0.45, 0.55) * (0.35 + fres + foam * 0.6);
        float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
        gl_FragColor = vec4(mix(col, uFogColor * (1.0 + uFlash * 1.5), fog), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.userData.step = size / seg;
  let si = 0;
  // foam patch where a cannonball lands (ring of NS slots, no allocation)
  function addSplash(x, z, size, t) { uniforms.uSplash.value[si].set(x, z, t, size); si = (si + 1) % NS; }
  function clearSplashes() { for (const v of uniforms.uSplash.value) v.z = -1e4; }
  return { mesh, uniforms, addSplash, clearSplashes };
}

// Stylized storm sky: stepped cloud bands, a smouldering sunset seam on the horizon, lightning-lit undersides.
export function createSky() {
  const geo = new THREE.SphereGeometry(1000, 32, 16);
  const uniforms = { uTime: { value: 0 }, uFlash: { value: 0 }, uFogColor: { value: FOG_COLOR.clone() }, uBolt: { value: new THREE.Vector3(0, 0, 1) }, uStorm: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uFlash; uniform vec3 uFogColor; uniform vec3 uBolt; uniform float uStorm; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
      void main(){
        vec3 d = normalize(vDir);
        float y = max(d.y, 0.0);
        vec3 top = mix(vec3(0.03, 0.04, 0.075), vec3(0.012, 0.016, 0.03), uStorm);
        vec3 col = mix(uFogColor, top, pow(y, 0.5));
        // smouldering sunset seam low in one direction, mostly hidden behind clouds
        float sunDir = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(-0.45, 0.0, 0.78))), 0.0);
        float seam = exp(-y * 16.0) * pow(sunDir, 3.0);
        seam *= 1.0 - 0.75 * uStorm; // [aaa water] later waves: the sunset seam closes up
        col += vec3(1.0, 0.42, 0.16) * seam * 0.55;
        // cloud field, quantized into 3 painted tones with bright rims
        vec2 uv = d.xz / (d.y + 0.22) * 1.4 + vec2(uTime * 0.025, uTime * 0.012);
        float c = fbm(uv) + 0.15 * fbm(uv * 3.0 - uTime * 0.05);
        float m = smoothstep(0.0, 0.25, y);
        c += 0.12 * uStorm; // heavier overcast
        vec3 cDark = vec3(0.06, 0.08, 0.11), cMid = vec3(0.13, 0.17, 0.22), cLite = vec3(0.24, 0.3, 0.37);
        float sd = 1.0 - 0.5 * uStorm; cDark *= sd; cMid *= sd; cLite *= sd;
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
  const uniforms = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uFlash: { value: 0 }, uAlpha: { value: 0.28 } };
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
    fragmentShader: `uniform float uFlash; uniform float uAlpha; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.7,0.78,0.85) + uFlash, uAlpha * (1.0 - vA * 0.6)); }`,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  return { mesh: lines, uniforms };
}
