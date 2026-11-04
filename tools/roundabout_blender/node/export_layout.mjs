// [Timothy rb-blender] runs js/island/areas/hillRound.js register + build in node (no browser) and writes the structural pieces it records
// (RB_LAYOUT) -> assets/island/rb_plaza_layout.json: the input of tools/roundabout_blender/rb_plaza_blender.py and the runtime match check.
//   cd tools/roundabout_blender/node && node --import ./reg.mjs export_layout.mjs
import { writeFileSync } from 'node:fs';
const root = new URL('../../../', import.meta.url).href;
const F = await import(root + 'js/island/foot.js');
const HR = await import(root + 'js/island/areas/hillRound.js');
const R = new Proxy({}, { get: () => [0, 0, 1, 1] }); for (const fn of ['buildStreet', 'buildInland', 'buildCoast']) F[fn](R, true, []);
const THREE = await import('three'); const mat = new THREE.MeshBasicMaterial();
const MATS = new Proxy({}, { get: () => mat }), OUT = mat;
globalThis.fetch = undefined; HR.default.build({ MATS, OUT, low: false, H: F.H });
const r = (v) => +v.toFixed(4);
const pieces = HR.RB_LAYOUT.map(p => ({ kind: p.kind, w: r(p.w), h: r(p.h), d: r(p.d), c: p.c, e: p.e.map(r) }));
writeFileSync(new URL('../../../assets/island/rb_plaza_layout.json', import.meta.url), JSON.stringify({ note: 'hillRound.js RB_LAYOUT (world Matrix4 column-major e, box w x h x d, kit colour c). origin = RB_ORIGIN. Regenerate: tools/roundabout_blender/node/export_layout.mjs', origin: HR.RB_ORIGIN, pieces }) + '\n');
const k = {}; for (const p of pieces) k[p.kind] = (k[p.kind] || 0) + 1; console.log('pieces', pieces.length, JSON.stringify(k), 'anchors', JSON.stringify(HR.FOUNTAIN_ANCHORS));
