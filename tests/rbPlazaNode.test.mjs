// [plaza-fix] the Blender plaza / fountain GLBs are KHR_mesh_quantization: their size lives on the node, so hillRound.js must keep it
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../js/island/areas/hillRound.js', import.meta.url), 'utf8');
const glbJson = (f) => { const b = readFileSync(new URL('../assets/island/' + f, import.meta.url)); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()); };
test('plaza + fountain GLBs: quantized, the node scale is the real size', () => {
  for (const f of ['rb_plaza.glb', 'rb_plaza_low.glb', 'rb_fountain.glb', 'rb_fountain_low.glb']) { const j = glbJson(f);
    if (!(j.extensionsUsed || []).includes('KHR_mesh_quantization')) continue; assert.ok(j.nodes.some(n => n.mesh !== undefined && n.scale && n.scale[0] > 2), f); }
});
test('hillRound.js keeps the node transform (never just mesh.geometry on a bare Mesh)', () => {
  assert.match(src, /function keepNode\(src, mat, name\)/); assert.match(src, /matrixWorld\.decompose/);
  assert.doesNotMatch(src, /new THREE\.Mesh\(mesh\.geometry, solid\)/);
  assert.match(src, /keepNode\(mesh, solid, 'rb_plaza_glb'\)/); assert.match(src, /keepNode\(mesh, solid, 'rb_fountain_glb'\)/);
});
