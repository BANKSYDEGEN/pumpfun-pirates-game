import { boardCanvas, boardTexture } from './boardtexture.js';
// HQ wall boards for Post's 5 remaining panel slots (BANKSY t2262u "Ok now work on all the boards").
// Same pattern as dexpanel.js: swap the slot mesh's material only (geometry, lighting, decor stay Post's),
// one canvas each (1280x1024, 640x512 on phones), built lazily with the hall, redrawn on data change / once a minute, no lights.
import * as THREE from 'three';
import { WALL_BOARDS } from './wallboards.js';
export { WALL_BOARDS, drawWallPanel, wallPanelMint, wallRows } from './wallboards.js';
export function attachWallPanels(hq, low = false, compact = false) { const out = [];
 for (const b of WALL_BOARDS) { try { const mesh = (hq.panels || []).find(m => m.userData.panelSlot === b.slot) || (hq.squadBoards || []).find(m => m.userData.pumpAction === b.slot); if (!mesh) continue;
   const cv = boardCanvas(640, 512, low, compact);
   const tex = boardTexture(cv, low);
   const ph = mesh.userData.placeholderMat || mesh.material; mesh.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); if (ph) { ph.map?.dispose?.(); ph.dispose?.(); mesh.userData.placeholderMat = null; } mesh.userData.wallBoard = b.key; out.push({ board: b, mesh, cv, tex }); }
  catch (e) { console.warn('[pumpfun] wall board skipped', b.slot, e.message); } }
 return out; }
