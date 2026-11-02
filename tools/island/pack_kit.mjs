// [Raul] PUMPFUN PIRATES island: compress a Blender kit for the web (run from a dir with @gltf-transform + sharp + meshoptimizer).
//   node pack_kit.mjs RAW.glb OUT_DIR NAME [--nature]
// Meshes: dedup, weld, quantize, meshopt (EXT_meshopt_compression). Textures: webp first (fallback files NAME*.webp.glb), then
// KTX2 / Basis (KHR_texture_basisu) via the KTX-Software `ktx` CLI when it is on PATH: ETC1S for albedo / cut-out cards,
// UASTC for the normal map.  High: 2048 albedo (+ 2048 normal for the town kit).  Low: LOD1 meshes only, 1024, no normal map.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRTextureBasisu } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { execFileSync } from 'child_process';
import { statSync } from 'fs';
const [, , src, out, name = 'town_kit', flag] = process.argv, nature = flag === '--nature';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
let ktx = true; try { execFileSync('ktx', ['--version']); } catch { ktx = false; }
const kb = (f) => (statSync(f).size / 1024).toFixed(0) + ' KB';
for (const low of [false, true]) {
  const doc = await io.read(src), root = doc.getRoot();
  if (low) { for (const n of root.listNodes()) if (/_LOD0$/.test(n.getName())) n.dispose();
    for (const m of root.listMaterials()) m.setNormalTexture(null); }
  await doc.transform(dedup(), weld(), prune(), reorder({ encoder: MeshoptEncoder }), quantize({ quantizeColor: 8, quantizeNormal: 8, quantizeTexcoord: 14 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: low ? [1024, 1024] : [2048, 2048], quality: low ? 80 : 88 }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  if (ktx) { const w = `${out}/${name}${low ? '_low' : ''}.webp.glb`; await io.write(w, doc); console.log(w, kb(w)); } // fallback (no KTX2 transcoder)
  const base = `${out}/${name}${low ? '_low' : ''}`;
  if (ktx) { // KTX2 / Basis: albedo + cut-out cards ETC1S (sRGB, alpha kept), normal map UASTC + zstd; mipmaps baked in
    const { mkdtempSync, writeFileSync, readFileSync } = await import('fs'), dir = mkdtempSync('/tmp/kitktx');
    for (const [i, t] of root.listTextures().entries()) {
      const isN = root.listMaterials().some(m => m.getNormalTexture() === t), png = `${dir}/t${i}.png`, k2 = `${dir}/t${i}.ktx2`;
      writeFileSync(png, await (isN ? sharp(Buffer.from(t.getImage())).resize(1024, 1024) : sharp(Buffer.from(t.getImage()))).ensureAlpha().png().toBuffer()); // normal map: 1024 is plenty for the trim detail
      execFileSync('ktx', ['create', '--format', isN ? 'R8G8B8A8_UNORM' : 'R8G8B8A8_SRGB', '--assign-tf', isN ? 'linear' : 'srgb', '--generate-mipmap',
        ...(isN ? ['--encode', 'uastc', '--uastc-quality', '2', '--zstd', '18'] : ['--encode', 'basis-lz', '--clevel', '2', '--qlevel', low ? '160' : '220']), png, k2]);
      t.setImage(readFileSync(k2)).setMimeType('image/ktx2').setURI(`t${i}.ktx2`);
    }
    doc.createExtension(KHRTextureBasisu).setRequired(true);
  }
  const f = `${base}.glb`; await io.write(f, doc); console.log(f, kb(f));
}
