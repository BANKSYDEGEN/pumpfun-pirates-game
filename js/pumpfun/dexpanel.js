// DEX JUST PAID wall panel (BANKSY 2026-11-07 "Also show dex just paid board"). Uses Post's HQ wall slot by swapping its material only:
// geometry, lighting and decor stay Post's. One canvas texture, built lazily with the hall; no lights; redraw on data change / once a minute.
import * as THREE from 'three';
export const DEX_PANEL_SLOT = 'east_1';
export const DEX_PANEL_ROWS = 5, DEX_PANEL_ROW_Y0 = 136, DEX_PANEL_ROW_H = 58; // logical 640x512 space
const usd=v=>v==null?'MC —':'MC $'+(v>=1e6?(v/1e6).toFixed(2)+'M':v>=1e3?(v/1e3).toFixed(1)+'K':Math.round(v));
const ago=(t,now)=>{const m=Math.max(0,Math.floor((now-t)/60000));return m<60?m+'m ago':Math.floor(m/60)+'h '+(m%60)+'m ago';};
export function attachDexPanel(hq,low=false){
 const mesh=(hq.panels||[]).find(m=>m.userData.panelSlot===DEX_PANEL_SLOT);if(!mesh)return null;
 const cv=document.createElement('canvas');cv.width=low?320:640;cv.height=low?256:512;
 const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
 mesh.material=new THREE.MeshBasicMaterial({map:tex,toneMapped:false});mesh.userData.dexPaid=true;
 return {mesh,cv,tex};
}
export function drawDexPanel(cv,state,now=Date.now()){const g=cv.getContext('2d'),W=640,H=512;g.save();g.setTransform(cv.width/W,0,0,cv.height/H,0,0);
 g.fillStyle='#101f1c';g.fillRect(0,0,W,H);g.strokeStyle='#54d08a';g.lineWidth=8;g.strokeRect(6,6,W-12,H-12);g.textBaseline='middle';
 const text=(s,x,y,n,c='#e9e5d6',a='left')=>{g.font=`${n}px "Just Another Hand",Georgia,sans-serif`;g.fillStyle=c;g.textAlign=a;g.fillText(String(s),x,y);};
 text('DEX JUST PAID',W/2,48,58,'#ffcd77','center');text('Verified paid DexScreener profiles · pump.fun tokens',W/2,98,26,'#a8bfb0','center');
 const rows=(state.dexpaid||[]).slice(0,DEX_PANEL_ROWS),status=state.status?.dexpaid||'Loading…';
 if(!rows.length){text(status==='Loading…'?'Loading…':/offline/i.test(status)?'Feed offline':'No recent paid profiles',W/2,260,46,'#e9e5d6','center');text(status==='Loading…'?'Fetching a free snapshot':'Retrying while you are nearby',W/2,312,26,'#a8bfb0','center');}
 rows.forEach((r,i)=>{const y=DEX_PANEL_ROW_Y0+i*DEX_PANEL_ROW_H;g.fillStyle='#254038';g.fillRect(28,y,W-56,DEX_PANEL_ROW_H-10);const cy=y+(DEX_PANEL_ROW_H-10)/2;
  text(`${i+1}. ${String(r.symbol||r.mint.slice(0,6)).slice(0,14)}`,44,cy,38,'#54d08a');text(usd(r.mcUsd),390,cy,28,'#e9e5d6','right');text(ago(r.paidAt,now),W-44,cy,28,'#ffcd77','right');});
 text(rows.length?status.slice(0,60):'',W/2,H-58,22,'#a8bfb0','center');text('Tap a token to open it on pump.fun · not financial advice',W/2,H-30,22,'#a8bfb0','center');g.restore();}
// uv (three.js, v up) -> row index or -1
export function dexPanelRow(uv){const y=(1-uv.y)*512;const i=Math.floor((y-DEX_PANEL_ROW_Y0)/DEX_PANEL_ROW_H);return i>=0&&i<DEX_PANEL_ROWS?i:-1;}
