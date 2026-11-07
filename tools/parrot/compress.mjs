// Run after build.py in an environment with @gltf-transform/core, extensions, functions and meshoptimizer.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const path = process.argv[2] || 'assets/pirates/items/v7/parrot_flight.glb';
const doc = await io.read(path);
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(path, doc);
