import './helpers/threeRegister.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
globalThis.location={search:''};
const {mapOverlayViewport}=await import('../js/islandMap.js');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('fit view leaves real clear space between open/folded overlay panels on desktop and phone',()=>{
 for(const [w,h,l,r] of [[1440,800,280,268],[1024,700,248,268],[390,650,70,180],[390,650,180,180],[320,480,68,150],[1440,800,70,160]]){
  const v=mapOverlayViewport(w,h,l,r),k=Math.min(v.width/2620,v.height/2620);
  assert.ok(v.width>0&&v.height>0);
  assert.ok(v.x-1250*k>=Math.min(l,w*.48)-1e-6);
  assert.ok(v.x+1250*k<=w-r+1e-6);
  assert.ok(v.y-1250*k>=0&&v.y+1250*k<=h);
 }
});
test('cursor zoom math preserves the same world point around the overlay-safe view centre',()=>{
 const v=mapOverlayViewport(1440,800,280,268),k=.25,fx=-80,fz=-40,px=750,py=350;
 const worldX=fx+(px-v.x)/k,worldZ=fz+(py-v.y)/k,nk=k*2;
 const nx=worldX-(px-v.x)/nk,nz=worldZ-(py-v.y)/nk;
 assert.equal(nx+(px-v.x)/nk,worldX);assert.equal(nz+(py-v.y)/nk,worldZ);
});
test('polish is map-scoped translucent background, readable key and accessible native disclosure groups',()=>{
 const c=read('css/style.css').split('/* Island chart only:')[1],s=read('js/islandMap.js');
 assert.ok(c.includes('--im-glass:rgba(12,23,31,.82)'));
 assert.ok(c.includes('html.isle-map-open #soc-panel'));
 assert.ok(c.includes('backdrop-filter:blur(14px)'));
 assert.ok(c.includes('font:500 12px/1.45'));
 assert.ok(c.includes(':focus-visible'));
 assert.ok(c.includes('prefers-reduced-motion'));
 assert.ok(!c.includes('--im-social-width'));
 assert.ok(s.includes("group.className='im-key-group'"));
 assert.ok(s.includes("group.open=!closed.has(name)"));
 assert.ok(s.includes("e.target.closest('.im-building-key, .im-key')"));
 assert.ok(s.includes('const ox = view.x'));
});
test('preview executes production UI and social components against labeled local-only fixtures',()=>{
 const h=read('dev/map-ui-preview.html'),s=read('dev/map-ui-preview.js');
 assert.ok(h.includes('../css/style.css'));assert.ok(h.includes('ACTUAL DOM / CSS PREVIEW'));
 assert.ok(s.includes("from '../js/islandMap.js'"));assert.ok(s.includes("from '../js/social.js'"));
 assert.ok(s.includes('room:{send(){}}'));assert.ok(!s.includes('fetch('));
});
