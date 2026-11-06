// [clean-water] AAA river / lagoon / waterfall + clean bridge→fishing & hill→zipline paths (ZERO clutter)
import { register } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

register('../tools/roundabout_blender/node/hooks.mjs', import.meta.url);
globalThis.location = { search: '?coast=1', href: 'http://x/index.html?coast=1', hostname: 'x' };
globalThis.window = globalThis; globalThis.self = globalThis;
const el = () => ({ getContext: () => null, style: {}, addEventListener() {}, appendChild() {}, setAttribute() {}, classList: { add() {}, remove() {} } });
globalThis.document = globalThis.document || { createElement: el, createElementNS: el, addEventListener() {}, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.performance = globalThis.performance || { now: () => Date.now() };

const FM = await import('../js/island/foot.js');
const RW = await import('../js/island/riverWater.js');
const THREE = await import('three');
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('&riverfx=0 kill switch cleanly preserves fallback', () => {
  const s = src('js/island/riverWater.js');
  assert.match(s, /get\('riverfx'\) !== '0'/);
  assert.match(s, /if \(!RIVER_FX/);
  assert.match(src('js/dock/world.js'), /upgradeRiver/);
  assert.match(src('js/island/main.js'), /riverWater\.js/);
  assert.ok(+((src('sw.js').match(/const VERSION = 'pfp-v(\d+)'/) || [])[1]) >= 331, 'sw at or past pfp-v331'); // [v331] numeric
  assert.match(src('sw.js'), /riverWater\.js/);
});

test('river strip + lagoon disc triangles face +Y (not backface-culled from above)', () => {
  const g = RW.riverGeometry({ H: FM.H, LAKE: FM.LAKE, RIVERP: FM.MAP_PATHS().river, low: false });
  const P = g.attributes.position, I = g.index.array, F = g.attributes.aFlow;
  const faceY = (i0, i1, i2) => {
    const ax = P.getX(i0), az = P.getZ(i0);
    const bx = P.getX(i1) - ax, bz = P.getZ(i1) - az;
    const cx = P.getX(i2) - ax, cz = P.getZ(i2) - az;
    return bz * cx - bx * cz; // ((B-A) × (C-A)).y
  };
  let upR = 0, nR = 0, upL = 0, nL = 0;
  for (let t = 0; t < I.length; t += 3) {
    const ny = faceY(I[t], I[t + 1], I[t + 2]);
    if (F.getZ(I[t]) > 0.5) { nL++; if (ny > 0) upL++; }
    else { nR++; if (ny > 0) upR++; }
  }
  assert.ok(nR > 100 && upR === nR, `river +Y ${upR}/${nR}`);
  assert.ok(nL > 100 && upL === nL, `lagoon +Y ${upL}/${nL}`);
  assert.match(src('js/island/riverWater.js'), /idx\.push\(a, a \+ 1, b/);
  assert.match(src('js/island/riverWater.js'), /frustumCulled = false/);
  assert.match(src('js/island/riverWater.js'), /vec3\(0\.15, 0\.52, 0\.48\)/);
});

test('river width covers carved bed; discards inside lagoon; seamless elevation at r=58', () => {
  const LAKE = FM.LAKE, RIVERP = FM.MAP_PATHS().river;
  const g = RW.riverGeometry({ H: FM.H, LAKE, RIVERP, low: false });
  assert.ok(g.userData.halfW >= 10, `halfW ${g.userData.halfW}`);
  const root = new THREE.Group();
  const old = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } } }));
  old.name = 'foot_freshwater'; root.add(old);
  const m = RW.upgradeRiver(root, { FM, low: true, uTime: { value: 0 } });
  assert.ok(m && old.visible === false);
  assert.ok(m.material.uniforms.uDiscR.value >= LAKE.r && m.material.uniforms.uDiscR.value <= m.geometry.userData.discR - 0.3);
  assert.match(m.material.fragmentShader, /discard/);
  assert.match(m.material.fragmentShader, /min\(col, vec3\(0\.\d+\)\)/);
  // Bloom cap < 0.85
  const cap = m.material.fragmentShader.match(/min\(col, vec3\((0\.\d+)\)\)/);
  assert.ok(cap && +cap[1] < 0.85, cap && cap[1]);
  // Seamless elevation at outflow throat r=58
  const P = m.geometry.attributes.position, F = m.geometry.attributes.aFlow;
  const lakeY = LAKE.y + 0.05; let near = [];
  for (let i = 0; i < P.count; i++) if (F.getZ(i) < 0.5) {
    const r = Math.hypot(P.getX(i) - LAKE.x, P.getZ(i) - LAKE.z);
    if (Math.abs(r - 58) < 2) near.push(P.getY(i));
  }
  assert.ok(near.length, 'river verts near r=58');
  for (const y of near) assert.ok(Math.abs(y - lakeY) < 0.08, `wy ${y} vs lake ${lakeY}`);
});

test('outflow terrain throat has wet bed H<19.3 across the river mouth', () => {
  let wet = 0, n = 0;
  for (let x = -155; x <= -135; x += 2) for (let z = -112; z <= -98; z += 2) {
    const ld = Math.hypot(x - FM.LAKE.x, z - FM.LAKE.z);
    if (ld > 54 && ld < 68) { n++; if (FM.H(x, z) < 19.3) wet++; }
  }
  assert.ok(n > 20 && wet / n > 0.85, `wet ${wet}/${n}`);
  assert.match(src('js/island/foot.js'), /sm\(11, 18, rd\)/);
});

test('curved waterfall plunges below lake surface; GROTTO stays clear', () => {
  const g = RW.waterfallGeometry({ H: FM.H, LAKE: FM.LAKE, low: false });
  const P = g.attributes.position; let minY = 1e9, grottoHits = 0;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    minY = Math.min(minY, y);
    if (x > -214 && x < -198 && z > -199 && z < -188 && y > 20.5 && y < 27) grottoHits++;
  }
  assert.ok(minY < FM.LAKE.y + 0.05, `plunge y ${minY}`);
  assert.equal(grottoHits, 0, 'grotto clear behind curtain');
  // Spot-check grotto ground stays walkable
  assert.ok(FM.H(-206, -193) >= 20.5 && FM.H(-206, -193) <= 22.5, `grotto H ${FM.H(-206, -193)}`);
});

test('shader colours stay under High bloom threshold', () => {
  const s = src('js/island/riverWater.js');
  assert.match(s, /min\(col, vec3\(0\.7[0-9]\)\)/);
  assert.match(s, /min\(col, vec3\(0\.80\)\)/);
  assert.doesNotMatch(s, /vec3\(1\.0,\s*1\.0,\s*1\.0\)/);
});

function walkMax(pts, step = 1) {
  let maxStep = 0, prev = null;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = FM.H(x, z);
      if (prev) { const d = Math.hypot(x - prev[0], z - prev[1]) || 1e-6; maxStep = Math.max(maxStep, Math.abs(y - prev[2]) / d); }
      prev = [x, z, y];
    }
  }
  return maxStep;
}

test('continuous walkable grade: Bridge→Fishing < 0.45, Plateau→Ziplines < 0.55', () => {
  const areas = FM.MAP_PATHS().areas;
  const fish = areas.find(p => p.id === 'rb_plateau_path') || areas.find(p => p.id === 'fish_approach');
  const hill = areas.find(p => p.id === 'wf_hill_trail');
  assert.ok(fish?.pts?.length > 5, 'fish path');
  assert.ok(hill?.pts?.length > 10, 'hill path');
  const mf = walkMax(fish.pts), mh = walkMax(hill.pts);
  assert.ok(mf < 0.45, `bridge→fishing maxStep ${mf}`);
  assert.ok(mh < 0.55, `plateau→ziplines maxStep ${mh}`);
  // Ends near targets
  const fl = fish.pts.at(-1); assert.ok(Math.hypot(fl[0] + 205, fl[1] + 61.5) < 3, JSON.stringify(fl));
  const hl = hill.pts.at(-1); assert.ok(Math.hypot(hl[0] + 200, hl[1] + 219) < 4, JSON.stringify(hl)); // [v332] cliff-edge skull zip
});

test('ZERO falls.glb / added rock mounds / trail lanterns / bridge signs', () => {
  assert.equal(existsSync(new URL('../assets/island/falls.glb', import.meta.url)), false);
  assert.equal(existsSync(new URL('../js/island/fallsBlender.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../js/island/areas/waterfallCorridor.js', import.meta.url)), false);
  const hr = src('js/island/areas/hillRound.js'), lg = src('js/island/areas/lagoon.js');
  assert.match(hr, /id: 'wf_hill_trail'/);
  assert.match(hr, /id: 'rb_plateau_path'/);
  assert.doesNotMatch(hr, /falls\.glb|fallsBlender|waterfallCorridor|hb_belvedere/);
  assert.doesNotMatch(lg, /falls\.glb|Angler Pavilion|fallsBlender|waterfallCorridor/);
  assert.doesNotMatch(src('js/island/riverWater.js'), /falls\.glb/);
  // Natural splat west of town (no masonry on waterfall hill)
  assert.match(src('js/island/foot.js'), /organic grey cracked rock|natural grey cracked cliff rock/);
  assert.doesNotMatch(src('js/island/foot.js'), /westNatural/);
  // Anchors untouched
  assert.deepEqual(FM.LAKE, { x: -205, z: -130, r: 58, y: 20 });
  assert.match(lg, /const DOCK = \{ x: -205, z0: -63, z1: -97/);
  assert.match(lg, /const GILL = \{ x: -199\.5, z: -61\.5 \}/);
  assert.match(lg, /const GROTTO = \{ x0: -214, x1: -198, z0: -199, z1: -188, y: 21\.0 \}/);
});
