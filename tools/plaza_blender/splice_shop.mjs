// [clothes-aaa] swap ONE shop's subtree (root node named ID + its LOD children) from a freshly packed plaza_shops*.glb into the shipped
// one, so a single-shop rebuild never re-jitters the other storefronts (the Blender build seeds its colour jitter with Python's
// per-process str hash). Both inputs are pack_shops.mjs output (quantized + meshopt); run from a dir with @gltf-transform + meshoptimizer.
//   [DROP=shop_crew] node splice_shop.mjs SHIPPED.glb FRESH.glb OUT.glb shop_clothes
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, mergeDocuments } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { statSync } from 'fs';
const [, , oldF, newF, outF, id] = process.argv;
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(oldF), src = await io.read(newF);
const kill = (n) => { for (const c of n.listChildren()) kill(c); n.dispose(); };
const oldRoot = doc.getRoot().listNodes().find(n => n.getName() === id); if (!oldRoot) throw new Error('no ' + id + ' in ' + oldF);
const scene = doc.getRoot().listScenes()[0], parent = oldRoot.getParentNode();
kill(oldRoot);
// DROP=a,b: also remove whole shop subtrees that left the game ([outfit-store] the old standalone CREW / Accessories building)
for (const d of (process.env.DROP || '').split(',').filter(Boolean)) { const n = doc.getRoot().listNodes().find(n => n.getName() === d && !n.getParentNode()); if (n) kill(n); }
// keep only the wanted subtree in the fresh doc, then merge it in
for (const s of src.getRoot().listScenes()) for (const n of s.listChildren()) if (n.getName() !== id) kill(n);
mergeDocuments(doc, src);
const fresh = doc.getRoot().listNodes().find(n => n.getName() === id);
for (const s of doc.getRoot().listScenes()) if (s !== scene) { for (const n of s.listChildren()) s.removeChild(n); s.dispose(); }
if (parent) parent.addChild(fresh); else scene.addChild(fresh);
{ const bufs = doc.getRoot().listBuffers(), keep = bufs[0];   // one GLB buffer
  for (const a of doc.getRoot().listAccessors()) a.setBuffer(keep); for (const b of bufs.slice(1)) b.dispose(); }
await doc.transform(dedup(), prune({ keepAttributes: true }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(outF, doc); console.log(outF, (statSync(outF).size / 1024).toFixed(0) + ' KB', doc.getRoot().listNodes().filter(n => !n.getParentNode()).map(n => n.getName()).join(','));
