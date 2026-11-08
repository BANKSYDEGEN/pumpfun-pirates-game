// HQ wall boards for Post's 5 remaining panel slots (BANKSY t2262u "Ok now work on all the boards").
// Same pattern as dexpanel.js: swap the slot mesh's material only (geometry, lighting, decor stay Post's),
// one canvas each (640x512, 320x256 on phones), built lazily with the hall, redrawn on data change / once a minute, no lights.
import * as THREE from 'three';
import { WALL_BOARDS } from './wallboards.js';
export { WALL_BOARDS, drawWallPanel, wallPanelMint, wallRows } from './wallboards.js';
export function attachWallPanels(hq, low = false) { const out = [];
 for (const b of WALL_BOARDS) { try { const mesh = (hq.panels || []).find(m => m.userData.panelSlot === b.slot); if (!mesh) continue;
   const cv = document.createElement('canvas'); cv.width = low ? 320 : 640; cv.height = low ? 256 : 512;
   const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
   mesh.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); mesh.userData.wallBoard = b.key; out.push({ board: b, mesh, cv, tex }); }
  catch (e) { console.warn('[pumpfun] wall board skipped', b.slot, e.message); } }
 return out; }
