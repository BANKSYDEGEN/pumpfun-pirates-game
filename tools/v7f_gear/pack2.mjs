import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'; import { prune, dedup, draco, meshopt } from '@gltf-transform/functions';
import draco3d from '/workspace/raul-v7m-work/compression/node_modules/draco3dgltf/draco3dgltf.js'; import fs from 'fs'; import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'; await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const [src, dst, orig] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule(), 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const o = await io.read(orig); const useDraco = o.getRoot().listExtensionsUsed().some(e => e.extensionName === 'KHR_draco_mesh_compression');
const d = await io.read(src); await d.transform(prune(), dedup());
if (process.env.MESHOPT) { await d.transform((doc) => { doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE }); }); } else if (useDraco) await d.transform(draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeGeneric: 12 }));
await io.write(dst, d); console.log(dst, process.env.MESHOPT ? 'meshopt' : useDraco ? 'draco' : 'plain', fs.statSync(orig).size, '->', fs.statSync(dst).size);
