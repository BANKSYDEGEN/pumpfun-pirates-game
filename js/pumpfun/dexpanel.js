import { BOARD_ROWS, WALL_ROW_Y0, WALL_ROW_H } from './boardgrid.js';
import { boardCanvas, boardTexture } from './boardtexture.js';
// DEX JUST PAID wall panel (BANKSY 2026-11-07 "Also show dex just paid board"). Uses Post's HQ wall slot by swapping its material only:
// geometry, lighting and decor stay Post's. One canvas texture, built lazily with the hall; no lights; redraw on data change / once a minute.
// Look: shared pirate board kit (boardkit.js, BANKSY t2275u "Work on board ui").
import * as THREE from 'three';
import { frame, banner, tokenRow, footer, emptyState, usd, ago } from './boardkit.js';
export const DEX_PANEL_SLOT = 'east_1';
export const DEX_PANEL_ROWS = BOARD_ROWS, DEX_PANEL_ROW_Y0 = WALL_ROW_Y0, DEX_PANEL_ROW_H = WALL_ROW_H; // logical 640x512 space
export function attachDexPanel(hq,low=false){
 const mesh=(hq.panels||[]).find(m=>m.userData.panelSlot===DEX_PANEL_SLOT);if(!mesh)return null;
 const cv=boardCanvas(640,512,low);
 const tex=boardTexture(cv,low);
 const ph=mesh.userData.placeholderMat;mesh.material=new THREE.MeshBasicMaterial({map:tex,toneMapped:false});if(ph){ph.map?.dispose?.();ph.dispose?.();mesh.userData.placeholderMat=null;}mesh.userData.dexPaid=true;
 return {mesh,cv,tex};
}
export function drawDexPanel(cv,state,now=Date.now()){const g=cv.getContext('2d'),W=640,H=512;g.save();g.setTransform(cv.width/W,0,0,cv.height/H,0,0);
 frame(g,W,H);banner(g,W,'DEX JUST PAID','paid',{sub:'Verified paid DexScreener profiles · pump.fun tokens'});
 const rows=(state.dexpaid||[]).slice(0,DEX_PANEL_ROWS),status=state.status?.dexpaid||'Loading…';
 if(!rows.length)emptyState(g,W,status);
 rows.forEach((r,i)=>tokenRow(g,W,i,DEX_PANEL_ROW_Y0+i*DEX_PANEL_ROW_H,DEX_PANEL_ROW_H-2,r,{name:r.symbol||r.mint.slice(0,6),midLabel:'MC',mid:usd(r.mcUsd),right:{text:ago(r.paidAt,now)+' ago'}}));
 footer(g,W,H,rows.length?status:'',state.updated?.dexpaid,now);g.restore();}
// uv (three.js, v up) -> row index or -1
export function dexPanelRow(uv){const y=(1-uv.y)*512;const i=Math.floor((y-DEX_PANEL_ROW_Y0)/DEX_PANEL_ROW_H);return i>=0&&i<DEX_PANEL_ROWS?i:-1;}
