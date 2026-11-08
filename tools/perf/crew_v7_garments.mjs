// Crew-only V7 outfit LODs. Player garments and their fit coordinates remain untouched.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { simplifyPrimitive, weldPrimitive, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { V7M_FITS } from '../../js/v7mFitData.js';
import { V7F_FITS } from '../../js/v7fFitData.js';
import { mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url).pathname;
await Promise.all([MeshoptSimplifier.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'draco3d.decoder':await draco3d.createDecoderModule(),'draco3d.encoder':await draco3d.createEncoderModule()});
const map={},audit=[];await mkdir(root+'assets/pirates/items/v7_crew',{recursive:true});
for(const [id,file] of [['cloth_tank','cloth_tank'],['cloth_tshirt','cloth_tshirt'],['cloth_coat','cloth_coat'],['shirt','cloth_shirt'],['suit','cloth_suit'],['cloth_singlet','cloth_singlet']]) for(const sex of ['male','female']){
 const src=(sex==='male'?V7M_FITS[id]:V7F_FITS[id])?.lo || `assets/pirates/items/v5/${file}_${sex}_lo.glb`;
 const dst=`assets/pirates/items/v7_crew/${file}_${sex}_lo.glb`;const doc=await io.read(root+src);
 const primitives=doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives());const before=primitives.reduce((n,p)=>n+p.getIndices().getCount()/3,0);
 for(const p of primitives){
  weldPrimitive(p,{});const count=p.getAttribute('POSITION').getCount();const attrs=new Float32Array(count*9);
  const uv=p.getAttribute('TEXCOORD_0')?.getArray(),normal=p.getAttribute('NORMAL')?.getArray(),color=p.getAttribute('COLOR_0')?.getArray(),tint=p.getAttribute('_TINT')?.getArray();
  const stride=p.getAttribute('COLOR_0')?.getElementSize()||3;
  for(let i=0;i<count;i++){for(let k=0;k<2;k++)attrs[i*9+k]=uv?.[i*2+k]||0;for(let k=0;k<3;k++){attrs[i*9+2+k]=normal?.[i*3+k]||0;attrs[i*9+5+k]=color?.[i*stride+k]||0;}attrs[i*9+8]=(tint?.[i]||0)/8;}
  const simplifier={simplify:(ix,pos,s,target,error)=>MeshoptSimplifier.simplifyWithAttributes(ix,pos,s,attrs,9,[.1,.1,.05,.05,.05,.05,.05,.05,.1],null,target,error,['Permissive'])};
  simplifyPrimitive(p,{simplifier,ratio:Math.min(1,800/before),error:.08,lockBorder:false});
 }
 for(const t of doc.getRoot().listTextures()){const size=t.getSize();if(!size)continue;const k=Math.min(1,512/Math.max(...size));const image=await sharp(Buffer.from(t.getImage())).resize(Math.max(1,Math.round(size[0]*k)),Math.max(1,Math.round(size[1]*k))).webp({quality:88}).toBuffer();t.setImage(new Uint8Array(image)).setMimeType('image/webp');}
 // Crew garments borrow the two shared body rigs/clips; duplicate garment animation tracks are never read.
 for(const clip of doc.getRoot().listAnimations())clip.dispose();
 await doc.transform(prune());for(const ext of doc.getRoot().listExtensionsUsed())if(ext.extensionName==='EXT_meshopt_compression')ext.dispose();doc.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({method:KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,encodeSpeed:5,decodeSpeed:5});await io.write(root+dst,doc);
 const after=primitives.reduce((n,p)=>n+p.getIndices().getCount()/3,0);map[src]=dst;audit.push({src,dst,before,after});
}
await writeFile(root+'js/crewItemLods.js','// Crew-only V7 garment LODs, preserving the live native-space refits. No player asset is replaced.\nexport const CREW_ITEM_LODS = '+JSON.stringify(map,null,2)+';\n');
console.log(JSON.stringify(audit));
