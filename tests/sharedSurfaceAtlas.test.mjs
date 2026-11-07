import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three-0.165.0/build/three.module.js';
import { MeshoptDecoder } from '../vendor/three-0.165.0/examples/jsm/libs/meshopt_decoder.module.js';
import { TOWN_SURFACE_RULES } from '../js/island/sharedSurfaceData.js';
const read = p => readFileSync(new URL('../' + p, import.meta.url));
const town = read('js/island/townkit.js').toString();
const remap = vm.runInNewContext('(' + town.slice(town.indexOf('export function remapTownGeometry(')+7,town.indexOf('async function loadTownKit0(')) + ')', {THREE,TOWN_SURFACE_RULES});
function glb(path) { const b=read(path),n=b.readUInt32LE(12);return {d:JSON.parse(b.subarray(20,20+n)),b:b.subarray(28+n)}; }
test('atlas build preserves every decoded meshopt buffer; output GLBs embed no duplicate textures', async () => {
 await MeshoptDecoder.ready;
 for(const suffix of ['', '_low']) {
  const a=glb(`assets/island/town_kit${suffix}.glb`),b=glb(`assets/island/town_shared${suffix}.glb`);
  assert.equal(b.d.images,undefined);assert.equal(b.d.textures,undefined);
  for(let i=0;i<b.d.bufferViews.length;i++) {
   const x=a.d.bufferViews[i].extensions?.EXT_meshopt_compression,y=b.d.bufferViews[i].extensions?.EXT_meshopt_compression;if(!y)continue;
   const ax=new Uint8Array(x.count*x.byteStride),by=new Uint8Array(y.count*y.byteStride);
   MeshoptDecoder.decodeGltfBuffer(ax,x.count,x.byteStride,a.b.subarray(x.byteOffset,x.byteOffset+x.byteLength),x.mode,x.filter);
   MeshoptDecoder.decodeGltfBuffer(by,y.count,y.byteStride,b.b.subarray(y.byteOffset,y.byteOffset+y.byteLength),y.mode,y.filter);
   assert.deepEqual(by,ax);
  }
 }
});
test('wood/stone surfaces remap to plaza codes; unique window UVs remain in fixture sheet', () => {
 const g=new THREE.BufferGeometry();g.setAttribute('uv',new THREE.Float32BufferAttribute([0.2,.50,.3,.50,.2,.51, .15,.90,.20,.90,.15,.95],2));
 g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(18).fill(1),3));remap(g);
 assert.equal(Math.floor(g.attributes.uv.getX(0)*16),7); // shared weathered planks
 assert.equal(Math.floor(g.attributes.uv.getX(3)*16),0); // unique unlit window
 assert.ok(g.attributes.aFixtureUv.getY(3)>0&&g.attributes.aFixtureUv.getY(3)<1);
 const once=g.attributes.color.getX(0);assert.ok(once>0&&once<1);
});
test('same existing compressed plaza atlas; measured texture payload falls and unique assets stay separate', () => {
 assert.deepEqual(read('assets/island/tex/island_surfaces.ktx2'),read('assets/island/tex/lib_lo.ktx2'));
 const stats=JSON.parse(read('assets/island/tex/shared_surfaces_report.json'));
 assert.ok(stats.desktop_texture_download_bytes.after<stats.desktop_texture_download_bytes.before/4);
 assert.ok(stats.desktop_gpu_bytes_estimate_BC7.after<stats.desktop_gpu_bytes_estimate_BC7.before/4);
 const main=read('js/main.js').toString();assert.doesNotMatch(main,/const art = .*town_kit/);
 assert.match(main,/island_surfaces.ktx2/);
});
