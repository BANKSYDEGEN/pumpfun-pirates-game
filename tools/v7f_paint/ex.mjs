import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import { MeshoptDecoder } from 'meshoptimizer'; import fs from 'fs';
await MeshoptDecoder.ready; const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const d = await io.read('female_hi.glb'); const p = d.getRoot().listMeshes()[0].listPrimitives()[0];
const out = {}; for (const s of p.listSemantics()) { const a = p.getAttribute(s); out[s] = { t: a.getArray().constructor.name, n: a.getElementSize(), f: s + '.bin' }; fs.writeFileSync('ex_' + s + '.bin', Buffer.from(a.getArray().buffer, a.getArray().byteOffset, a.getArray().byteLength)); }
const ix = p.getIndices().getArray(); fs.writeFileSync('ex_IDX.bin', Buffer.from(new Uint32Array(ix).buffer)); out.IDX = { t: 'Uint32Array', n: 1 };
const n = d.getRoot().listNodes().find(x => x.getMesh()); console.log(JSON.stringify(out), n.getMatrix(), d.getRoot().listSkins()[0].listJoints().length);
const tex = p.getMaterial().getBaseColorTexture(); fs.writeFileSync('body_tex.' + tex.getMimeType().split('/')[1], tex.getImage());
