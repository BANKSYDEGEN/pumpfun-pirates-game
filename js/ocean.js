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
// [v348] BANKSY t1828u "increase the distance see the sea rn it just cuts off": ONE continuous grid (1 draw call, 0 seams, 0 overlap).
// The inner size x size m keeps its exact seg x seg spacing (waves, crest foam, splashes, uHullPad unchanged); `extra` more rows a side
// are pushed out with a separable cubic warp (slope 1 at the seam = no crease) so the sea reaches SEA_REACH m in every direction.
export const SEA_REACH = 5600;
export function seaGeometry(size, seg, extra, reach = SEA_REACH) {
  const step = size / seg, hi = size / 2, band = extra * step, n = seg + 2 * extra, tot = size + 2 * band;
  const geo = new THREE.PlaneGeometry(tot, tot, n, n); geo.rotateX(-Math.PI / 2);
  const warp = (u) => { const a = Math.abs(u); if (a <= hi + 1e-6) return u; const q = (a - hi) / band; return Math.sign(u) * (a + (reach - hi - band) * q * q * q); };
  const P = geo.attributes.position; for (let i = 0; i < P.count; i++) P.setXYZ(i, warp(P.getX(i)), 0, warp(P.getZ(i)));
  P.needsUpdate = true; geo.computeBoundingSphere(); geo.userData = { step, inner: hi, reach }; return geo;
}
export function createOcean(quality) {
  const low = quality === 'low', ultra = quality === 'ultra'; // [ultra] bigger, denser sea + sharper sun glints
  const size = low ? 700 : ultra ? 1200 : 900;
  const seg = low ? 140 : ultra ? 440 : 260;
  const NS = low ? 6 : 10; // lingering splash foam spots
  const geo = seaGeometry(size, seg, low ? 22 : 34); // [v348] t1828u/t1833u: denser skirt so mid-range (past inner ~450 m) stays smooth out past the SAIL arena (~1250 m)
  const uniforms = {
    uTime: { value: 0 },
    uWaves: { value: W.map(v => new THREE.Vector4(v.dx, v.dz, v.a, v.k)) },
    uSun: { value: new THREE.Vector3(-0.45, 0.42, 0.78).normalize() },
    uSunColor: { value: new THREE.Color(1.0, 0.92, 0.78) }, // [v343] live sun/moon tint for specular path
    uSkyZenith: { value: new THREE.Color(0.18, 0.42, 0.78) },
    uSkyHorizon: { value: new THREE.Color(0.72, 0.86, 0.94) },
    uFogColor: { value: FOG_COLOR.clone() },
    uFogDensity: { value: 0.0042 },
    uFlash: { value: 0 },
    uStorm: { value: 0 },
    uHulls: { value: Array.from({ length: MAX_HULLS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uHullCount: { value: 0 },
    uHullV: { value: new Array(MAX_HULLS).fill(0) },
    // [v84] hull water cap: per hull (lid plane height at the hull centre, slope along the keel, slope across, half-beam; 0 = off)
    uHullY: { value: Array.from({ length: MAX_HULLS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uHullPad: { value: (size / seg) * 1.45 },
    uSplash: { value: Array.from({ length: NS }, () => new THREE.Vector4(0, 0, -1e4, 1)) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    defines: low ? { LOW_Q: 1 } : ultra ? { ULTRA_Q: 1 } : {},
    vertexShader: /* glsl */`
      uniform float uTime; uniform vec4 uWaves[4];
      uniform vec4 uHulls[${MAX_HULLS}]; uniform int uHullCount; uniform vec4 uHullY[${MAX_HULLS}]; uniform float uHullPad;
      varying vec3 vWorld; varying vec3 vNormal; varying float vH; varying float vFogDepth;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float h = 0.0; vec2 g = vec2(0.0);
        // [v348] t1833u: damp each swell only once the skirt is too coarse for its wavelength. Playable SAIL arena is ~1250 m
        // from the camera (ocean mesh follows the player): the old farA(700,2200) flattened water under ships across the map
        // while floatShip still used full waveHeight (boats dipped under / floated above the rendered sea).
        float rFar = length(position.xz);
        float farBig = 1.0 - smoothstep(1350.0, 2600.0, rFar); // 46 m + 27 m swells: full amp across the SAIL arena (~1250 m)
        float farTiny = 1.0 - smoothstep(1250.0, 2200.0, rFar); // 15 m + 9 m ripples: full amp to the arena edge, then fade (keeps |GPU-CPU| < 0.15 m in-play)
        for (int i = 0; i < 4; i++) {
          vec2 d = uWaves[i].xy; float a = uWaves[i].z * (i < 2 ? farBig : farTiny); float k = uWaves[i].w;
          float ph = k * dot(d, wp.xz) - sqrt(9.8 * k) * uTime;
          h += a * sin(ph); g += a * k * cos(ph) * d;
        }
        // [v84] water never rises into a hull: under (and one grid cell around) every afloat ship the surface is capped
        // just under that ship's gunwale plane (its water-mask lid, pitch + roll included). The cap is a plane, so the
        // flat-interpolated triangles between capped vertices stay under the deck too, on every grid density (Low / High / Ultra).
        // Only bites when a crest actually reaches the deck; normal seas around the ship are untouched.
        for (int i = 0; i < ${MAX_HULLS}; i++) {
          if (i >= uHullCount) break;
          vec4 hy = uHullY[i]; if (hy.w <= 0.0) continue;
          vec4 s = uHulls[i]; vec2 dp = wp.xz - s.xy;
          float c = cos(s.z), sn = sin(s.z);
          float lx = dp.x * c - dp.y * sn, lz = dp.x * sn + dp.y * c;
          float hb = hy.w + uHullPad, hl = s.w * 0.5 + uHullPad;
          float qx = abs(lx) / hb, qz = abs(lz) / hl;
          if (qx > 1.6 || qz > 1.6) continue;
          float e = sqrt(sqrt(qx * qx * qx * qx + qz * qz * qz * qz)); // rounded-rectangle footprint
          float w = 1.0 - smoothstep(0.0, 3.0, (e - 1.0) * hb);
          float cap = hy.x + lz * hy.y + lx * hy.z - 0.3;
          h = mix(h, min(h, cap), w);
        }
        wp.y = h; vH = h;
        vNormal = normalize(vec3(-g.x, 1.0, -g.y));
        vWorld = wp.xyz;
        vec4 mv = viewMatrix * wp; vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uSun; uniform vec3 uSunColor; uniform vec3 uSkyZenith; uniform vec3 uSkyHorizon; uniform vec3 uFogColor; uniform float uFogDensity; uniform float uFlash; uniform float uStorm;
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
        // [v343] sky reflection follows live zenith/horizon (sunrise gold / night indigo / storm)
        vec3 skyLo = mix(uSkyHorizon, vec3(0.055, 0.085, 0.11), st);
        vec3 skyHi = mix(uSkyZenith, vec3(0.11, 0.14, 0.19), st);
        float r = clamp(reflect(-V, n).y * 2.0, 0.0, 1.0);
        col = mix(col, mix(skyLo, skyHi, mix(r, floor(r * 3.0) / 3.0, 0.4)), 0.05 + fres * 0.6);
        // [v343] sun/moon specular path — molten gold at sunrise/sunset, silver at night
        float ndh = max(dot(n, normalize(uSun + V)), 0.0);
        float sunward = smoothstep(-0.3, 0.8, dot(-V, sunH));
        float sparkle = smoothstep(0.55, 0.95, pow(ndh, 900.0)) * rf * rf * rf;
        float path = pow(max(dot(-V, sunH), 0.0), 4.0) * smoothstep(0.0, 0.35, uSun.y + 0.15);
        float hiSun = 1.0 - 0.7 * smoothstep(0.35, 0.9, uSun.y); // [v386] BANKSY 'work on daytime water glare': the broad haze + path fade as the sun climbs (golden-hour paths unchanged)
        col += uSunColor * (sparkle * mix(0.75, 1.15, hiSun) + pow(ndh, 60.0) * 0.14 * hiSun + path * 0.22 * hiSun) * sunward * (1.0 - 0.75 * st);
        #ifdef ULTRA_Q
        col += uSunColor * (pow(ndh, 2400.0) * mix(1.0, 1.6, hiSun) + pow(ndh, 220.0) * 0.07 * hiSun) * sunward * (1.0 - 0.75 * st);
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
        vec3 seaC = mix(col, uFogColor * (1.0 + uFlash * 1.5), fog);
        // [v348] t1828u: the far sea melts into the sky dome's horizon colour (fair: uSkyHorizon, storm: uFogColor) - no edge, ever
        float hz = smoothstep(2400.0, 5200.0, length(vWorld.xz - cameraPosition.xz));
        gl_FragColor = vec4(mix(seaC, mix(uSkyHorizon, uFogColor, st) * (1.0 + uFlash * 1.5), hz), 1.0);
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

// [v343] AAA Caribbean sky: sunny day + sunrise/sunset Mie glow + starry night + moon, storm-blended.
// Procedural FBM clouds + star cells in ONE dome shader (zero textures, zero extra draws). Driven by js/skyCycle.js.
export const SKY_R = 6500;
export function createSky() {
  const geo = new THREE.SphereGeometry(SKY_R, 48, 24); // [v348] 1000 -> 6500 m: well past the sea's horizon skirt (camera.far 9000)
  const uniforms = {
    uTime: { value: 0 }, uFlash: { value: 0 }, uFogColor: { value: FOG_COLOR.clone() },
    uBolt: { value: new THREE.Vector3(0, 0, 1) }, uStorm: { value: 0 },
    uSunDir: { value: new THREE.Vector3(-0.45, 0.55, 0.7).normalize() },
    uMoonDir: { value: new THREE.Vector3(0.45, 0.55, -0.7).normalize() },
    uZenith: { value: new THREE.Color(0.18, 0.42, 0.78) },
    uMid: { value: new THREE.Color(0.38, 0.62, 0.92) },
    uHorizon: { value: new THREE.Color(0.72, 0.86, 0.94) },
    uSunColor: { value: new THREE.Color(1.0, 0.92, 0.78) },
    uSunVis: { value: 1 }, uMoonVis: { value: 0 }, uStarVis: { value: 0 },
    uCloudWarm: { value: 0 }, uGolden: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uFlash; uniform vec3 uFogColor; uniform vec3 uBolt; uniform float uStorm;
      uniform vec3 uSunDir; uniform vec3 uMoonDir; uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uHorizon;
      uniform vec3 uSunColor; uniform float uSunVis; uniform float uMoonVis; uniform float uStarVis;
      uniform float uCloudWarm; uniform float uGolden;
      varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        float y01 = max(y, 0.0);
        // --- base atmosphere gradient (zenith → mid → horizon), live from skyCycle
        float hMix = pow(1.0 - y01, 2.2); // thinner horizon haze — more blue mid-sky
        float mMix = pow(y01, 0.35);
        vec3 col = mix(uHorizon, uMid, clamp(1.0 - hMix * 0.85, 0.0, 1.0));
        col = mix(col, uZenith, mMix * (1.0 - hMix * 0.2));
        // opposite-horizon belt-of-Venus pastel during golden hour
        vec3 flatD = normalize(vec3(d.x, 0.001, d.z));
        vec3 sunFlat = normalize(vec3(uSunDir.x, 0.001, uSunDir.z));
        float sunAz = max(dot(flatD, sunFlat), 0.0);
        float antiAz = max(dot(flatD, -sunFlat), 0.0);
        float horizonBand = exp(-max(y, 0.0) * 10.0);
        col += uSunColor * vec3(1.0, 0.55, 0.25) * pow(sunAz, 3.0) * horizonBand * uGolden * 0.85 * uSunVis;
        col += vec3(0.55, 0.35, 0.55) * pow(antiAz, 2.0) * horizonBand * uGolden * 0.35;

        // --- sun disc + Mie corona
        float sunDot = max(dot(d, normalize(uSunDir)), 0.0);
        float disc = smoothstep(0.9994, 0.99985, sunDot);
        float corona = pow(sunDot, 48.0) * 0.40 + pow(sunDot, 12.0) * 0.12 + pow(sunDot, 4.0) * 0.04; // [v392] BANKSY 'lower the sun glare': tighter, dimmer halo (was 32/8/2.5 @ .55/.25/.12 x1.45)
        col += uSunColor * (disc * 3.0 + corona * 0.9) * uSunVis * (1.0 - uStorm * 0.85);

        // --- moon disc + soft lunar halo
        float moonDot = max(dot(d, normalize(uMoonDir)), 0.0);
        float moonDisc = smoothstep(0.9975, 0.9994, moonDot);
        float moonHalo = pow(moonDot, 48.0) * 0.40 + pow(moonDot, 12.0) * 0.08; // [v393] BANKSY 'do same with moon glare': tighter, dimmer halo (was 28/5 @ .65/.22)
        col += vec3(0.85, 0.90, 1.0) * (moonDisc * 2.4 + moonHalo * 0.8) * uMoonVis * (1.0 - uStorm);

        // --- fair-weather cumulus (SPARSE) / storm overcast — never grey-out sunny Caribbean sky
        vec2 uv = d.xz / (abs(d.y) + 0.22) * 1.2 + vec2(uTime * 0.014, uTime * 0.007);
        float c = fbm(uv) + 0.12 * fbm(uv * 2.5 - uTime * 0.035);
        c += 0.22 * uStorm;
        float m = smoothstep(0.02, 0.35, y); // keep horizon clearer
        // higher threshold = fewer clouds in fair weather; storm drops threshold for heavy cover
        float cover = mix(0.68, 0.28, uStorm);
        float s1 = smoothstep(cover, cover + 0.06, c);
        float s2 = smoothstep(cover + 0.10, cover + 0.16, c);
        float s3 = smoothstep(cover + 0.20, cover + 0.26, c);
        // fair-weather day clouds (white) vs night moonlit indigo — never wash the starfield grey
        vec3 dayDark = vec3(0.62, 0.68, 0.78), dayMid = vec3(0.88, 0.91, 0.95), dayLite = vec3(1.0, 1.0, 1.0);
        vec3 nightDark = vec3(0.03, 0.05, 0.11), nightMid = vec3(0.06, 0.09, 0.18), nightLite = vec3(0.11, 0.16, 0.28);
        float dayW = clamp(uSunVis, 0.0, 1.0);
        vec3 fairDark = mix(nightDark, dayDark, dayW);
        vec3 fairMid  = mix(nightMid, dayMid, dayW);
        vec3 fairLite = mix(nightLite, dayLite, dayW);
        vec3 cDark = mix(fairDark, vec3(0.06, 0.08, 0.11), uStorm);
        vec3 cMid  = mix(fairMid,  vec3(0.13, 0.17, 0.22), uStorm);
        vec3 cLite = mix(fairLite, vec3(0.24, 0.30, 0.37), uStorm);
        float rim = pow(max(dot(normalize(vec3(d.x, 0.15, d.z)), normalize(uSunDir)), 0.0), 2.0);
        cLite = mix(cLite, mix(uSunColor, vec3(1.0, 0.55, 0.3), uCloudWarm), rim * uSunVis * (0.35 + 0.55 * uCloudWarm));
        vec3 cloud = mix(cDark, cMid, s2);
        cloud = mix(cloud, cLite, s3);
        cloud += uSunColor * vec3(1.0, 0.5, 0.25) * uCloudWarm * (s1 - s2 * 0.4) * 0.9;
        // [v345] night: ~18% cloud cover so 82%+ is crystal starry indigo; storm: solid overcast
        float fairAmt = mix(0.55, 0.12, clamp(uStarVis, 0.0, 1.0));
        float cloudAmt = s1 * m * mix(fairAmt, 0.96, uStorm);
        col = mix(col, cloud, cloudAmt);

        // --- [v345] cubed-sphere 2D cell starfield (multi-pixel heroes — no 3D lattice sub-pixel miss)
        float starGate = uStarVis * (1.0 - cloudAmt * 0.95) * smoothstep(0.01, 0.09, y01);
        if (starGate > 0.001) {
          // cube-map face UV from largest abs axis (uniform density, zero pole pinch)
          vec3 ad = abs(d);
          vec2 fuv; float face;
          if (ad.x >= ad.y && ad.x >= ad.z) { fuv = vec2(d.z, d.y) / max(ad.x, 1e-6); face = d.x >= 0.0 ? 0.0 : 1.0; }
          else if (ad.y >= ad.x && ad.y >= ad.z) { fuv = vec2(d.x, d.z) / max(ad.y, 1e-6); face = d.y >= 0.0 ? 2.0 : 3.0; }
          else { fuv = vec2(d.x, d.y) / max(ad.z, 1e-6); face = d.z >= 0.0 ? 4.0 : 5.0; }
          fuv = fuv * 0.5 + 0.5;
          // tier helper: N density, pKeep occupancy, soft radius + gain
          // Tier 1 heroes
          {
            float N = 26.0; vec2 suv = fuv * N; vec2 cell = floor(suv);
            float h1 = hash(cell + vec2(face * 19.0, 3.1)); float h2 = hash(cell + vec2(face * 41.0, 7.7));
            float h3 = hash(cell + vec2(face * 73.0, 11.3));
            if (h3 < 0.12) {
              vec2 ctr = cell + vec2(0.22 + 0.56 * h1, 0.22 + 0.56 * h2);
              float dist = length(suv - ctr);
              float tw = 0.72 + 0.28 * sin(uTime * (1.8 + h1 * 4.5) + h2 * 20.0);
              vec3 sc = mix(vec3(1.0, 0.94, 0.78), mix(vec3(0.78, 0.88, 1.0), vec3(1.0, 1.0, 1.0), fract(h2 * 9.0)), fract(h1 * 13.0));
              float core = smoothstep(0.12, 0.012, dist) * 5.2;
              float glow = exp(-dist * 14.0) * 0.55;
              col += sc * (core + glow) * tw * starGate;
            }
          }
          // Tier 2 medium
          {
            float N = 52.0; vec2 suv = fuv * N; vec2 cell = floor(suv);
            float h1 = hash(cell + vec2(face * 23.0, 5.5)); float h2 = hash(cell + vec2(face * 47.0, 9.9));
            float h3 = hash(cell + vec2(face * 89.0, 15.1));
            if (h3 < 0.18) {
              vec2 ctr = cell + vec2(0.22 + 0.56 * h1, 0.22 + 0.56 * h2);
              float dist = length(suv - ctr);
              float tw = 0.75 + 0.25 * sin(uTime * (2.2 + h2 * 3.5) + h1 * 14.0);
              vec3 sc = mix(vec3(0.85, 0.9, 1.0), vec3(1.0, 0.95, 0.82), fract(h1 * 7.0));
              col += sc * smoothstep(0.14, 0.02, dist) * 2.8 * tw * starGate;
            }
          }
          // Tier 3 fine dust
          {
            float N = 95.0; vec2 suv = fuv * N; vec2 cell = floor(suv);
            float h1 = hash(cell + vec2(face * 29.0, 2.2)); float h2 = hash(cell + vec2(face * 61.0, 8.4));
            float h3 = hash(cell + vec2(face * 97.0, 12.6));
            if (h3 < 0.22) {
              vec2 ctr = cell + vec2(0.22 + 0.56 * h1, 0.22 + 0.56 * h2);
              float dist = length(suv - ctr);
              col += vec3(0.82, 0.88, 1.0) * smoothstep(0.22, 0.04, dist) * 1.3 * starGate;
            }
          }
          // richer Milky Way band
          vec2 mwd = d.xz; float mwl = length(mwd); mwd = mwl > 1e-4 ? mwd / mwl : vec2(0.6, 0.8);
          float mw = exp(-pow(d.y * 1.8 - 0.15, 2.0) * 2.5) * exp(-pow(dot(mwd, vec2(0.6, 0.8)), 2.0) * 1.2);
          float mwN = fbm(d.xz * 6.0 + d.y * 3.0);
          col += vec3(0.55, 0.6, 0.85) * mw * mwN * starGate * 0.75;
        }

        // lightning flash (storm)
        float near = pow(max(dot(d, normalize(uBolt)), 0.0), 6.0);
        col += uFlash * vec3(0.5, 0.58, 0.8) * (0.25 + c * 0.6 + near * 2.0 * s1) * uStorm;

        // below horizon: fog/sea color
        if (y < 0.0) {
          float down = smoothstep(0.0, -0.15, y);
          col = mix(uHorizon, uFogColor, down);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
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
