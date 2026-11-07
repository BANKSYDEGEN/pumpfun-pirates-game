import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import { MeshoptDecoder } from 'meshoptimizer';
import draco3d from '/workspace/raul-v7m-work/compression/node_modules/draco3dgltf/draco3dgltf.js';   // the Lo body is Draco
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'draco3d.decoder': await draco3d.createDecoderModule() });
const [i, o] = process.argv.slice(2); const d = await io.read(i);
for (const e of d.getRoot().listExtensionsUsed()) if (/meshopt|draco/i.test(e.extensionName)) e.dispose();
await io.write(o, d);
