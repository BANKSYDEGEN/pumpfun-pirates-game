// [perf v461] build the crew-only V6 bodies: node crew_bodies.mjs <src_v6_lo.glb> <dst_v6_crew.glb> 0.25 0.25 (npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer draco3dgltf sharp)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { weld, simplify, textureCompress, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
const [src, dst, ratio, texScale] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() });
const doc = await io.read(src);
await MeshoptSimplifier.ready;
// simplify ONLY the body mesh (keep the painted eyes + tattoo untouched)
const body = doc.getRoot().listMeshes().find(m => m.listPrimitives().some(p => p.getAttribute('_TINT')));
const others = doc.getRoot().listMeshes().filter(m => m !== body);
const t0 = body.listPrimitives().reduce((a, p) => a + p.getIndices().getCount() / 3, 0);
// temporarily detach others by simplifying via a filtered document is complex: use the per-primitive API
import { simplifyPrimitive, weldPrimitive } from '@gltf-transform/functions';
for (const p of body.listPrimitives()) { weldPrimitive(p, {}); simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio: +ratio, error: 0.01, lockBorder: false }); }
const t1 = body.listPrimitives().reduce((a, p) => a + p.getIndices().getCount() / 3, 0);
console.log('body tris', t0, '->', t1);
for (const t of doc.getRoot().listTextures()) { const sz = t.getSize(); if (!sz || Math.max(...sz) < 256) continue;
  const k = /tattoo/.test(t.getName()) ? 0.5 : +texScale; const p2 = (v) => 2 ** Math.round(Math.log2(v)); const w = p2(sz[0] * k), h = p2(sz[1] * k);
  const out = await sharp(Buffer.from(t.getImage())).resize(w, h).webp({ quality: 85 }).toBuffer(); t.setImage(new Uint8Array(out)); console.log('tex', t.getName(), sz, '->', [w, h]); }
await doc.transform(prune());
doc.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({ method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER, encodeSpeed: 5, decodeSpeed: 5 });
await io.write(dst, doc);
