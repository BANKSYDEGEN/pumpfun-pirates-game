import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const d = await io.read(process.argv[2]); const R = d.getRoot();
for (const a of R.listAccessors()) if (a.listParents().every(p => p === R)) a.dispose();
await io.write(process.argv[2], d); console.log(R.listAccessors().length);
