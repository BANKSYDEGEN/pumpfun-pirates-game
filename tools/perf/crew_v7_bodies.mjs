// V7 crew-only LOD derivatives. Never overwrite the locked player source assets.
// npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer draco3dgltf sharp
// node crew_v7_bodies.mjs source_v7_lo.glb destination_v7_crew.glb [triangleBudget=6300]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { simplifyPrimitive, weldPrimitive, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
const [src, dst, budget = '6300'] = process.argv.slice(2);
if (!src || !dst || src === dst || !/_v7_crew\.glb$/.test(dst)) throw new Error('Separate _v7_crew.glb destination required');
await Promise.all([MeshoptSimplifier.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
 'meshopt.decoder': MeshoptDecoder, 'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule()
});
const doc = await io.read(src);
const meshes = doc.getRoot().listMeshes(), before = meshes.reduce((n,m)=>n+m.listPrimitives().reduce((s,p)=>s+p.getIndices().getCount()/3,0),0);
for (const m of meshes) for (const p of m.listPrimitives()) {
 weldPrimitive(p, {});
 const uv = p.getAttribute('TEXCOORD_0'), normal = p.getAttribute('NORMAL');
 const position = p.getAttribute('POSITION').getArray();
 const count = p.getAttribute('POSITION').getCount(), attrs = new Float32Array(count * 5), locks = new Uint8Array(count);
 // Preserve the original painted eye/eyebrow/beard seams: no UV collapse through NFT face artwork.
 for(let i=0;i<count;i++) if(position[i*3+1]>.84 && position[i*3+1]<1.17 && position[i*3+2]>.075 && Math.abs(position[i*3])<.23) locks[i]=2;
 for(let i=0;i<count;i++){attrs[i*5]=uv.getArray()[i*2];attrs[i*5+1]=uv.getArray()[i*2+1];for(let k=0;k<3;k++)attrs[i*5+2+k]=normal.getArray()[i*3+k];}
 // Permissive removes redundant split-vertex borders, while UV/normal errors remain explicitly bounded.
 const simplifier={simplify:(ix,pos,stride,target,error)=>MeshoptSimplifier.simplifyWithAttributes(ix,pos,stride,attrs,5,[.1,.1,.05,.05,.05],locks,target,error,['Permissive'])};
 simplifyPrimitive(p, { simplifier, ratio: Math.min(1, +budget / before), error: .025, lockBorder: false });
}
const after = meshes.reduce((n,m)=>n+m.listPrimitives().reduce((s,p)=>s+p.getIndices().getCount()/3,0),0);
for (const t of doc.getRoot().listTextures()) {
 const size = t.getSize(); if (!size || Math.max(...size) <= 1024) continue;
 const scale = 1024 / Math.max(...size), w = Math.max(1,Math.round(size[0]*scale)), h = Math.max(1,Math.round(size[1]*scale));
 const image = await sharp(Buffer.from(t.getImage())).resize(w,h).webp({quality:88}).toBuffer();
 t.setImage(new Uint8Array(image)).setMimeType('image/webp');
}
await doc.transform(prune());
doc.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({method:KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,encodeSpeed:5,decodeSpeed:5});
await io.write(dst,doc);
console.log(JSON.stringify({src,dst,before,after,animations:doc.getRoot().listAnimations().map(a=>a.getName()),textures:doc.getRoot().listTextures().map(t=>t.getSize())}));
