// Map-only building inventory. Coordinates come from world builders, never from a second map layout.
// Polygons are foot-world coordinates; callers project every vertex (including on the rotating radar).
import { HQ, HQ_TOWERS, PET_LOT, PET_SHOP } from './pumpfun/site.js';
import { RENTABLE_SHOPS, MAIN_ST_SHOPS, SQUAD_HALL } from './island/hillShops.js';
import { PLAZA_V2, HALLS, HOUSES, FISH_MARKET, FACADE_LZ, ROW_D } from './island/plazaTown.js';
import { OUTFIT_STORE } from './island/outfitStore.js';
import { SHIP_STORE } from './island/shipStore.js';
import { COLISEUM_ON, ellPoint } from './island/coliseum.js';
import { CASINO_ON, CASINO_HALL, CASINO_WING } from './island/casinoData.js';
import { FORT } from './island/areas/fort.js';
import { COTTAGES_ON, COTTAGES, COL_SIZES } from './island/areas/cottages.js';
import { MAG, MAG_COLLIDERS } from './island/battery.js';
import { SHOP_ICONS, drawShopIcon } from './mapIcons.js';
import { VILLAGE_ON, VILLAGE_LOTS } from './island/village.js';   // [post-village]

export function rectangle(x, z, w, d, yaw = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b]) => [x + a*w/2*c + b*d/2*s, z - a*w/2*s + b*d/2*c]);
}
const ring = (x,z,r) => Array.from({length: 24}, (_,i) => [x+Math.cos(i*Math.PI/12)*r,z+Math.sin(i*Math.PI/12)*r]);
const mid = r => [(r.lx0+r.lx1)/2,(r.lz0+r.lz1)/2];
const title = s => s.replace(/^E\s*·\s*/, '').split(' · ')[0];

export function mapBuildings(FM, interactions = []) {
  const out = [], town = p => FM.townToWorld(...p);
  const add = (id, name, icon, polygons, center, aliases = []) => out.push({id,name,icon: SHOP_ICONS[icon] || SHOP_ICONS.shop, polygons, x:center[0],z:center[1],aliases});
  const tr = (id,name,icon,r,aliases=[]) => add(id,name,icon,[rectangle(...mid(r),r.lx1-r.lx0,r.lz1-r.lz0).map(town)],town(mid(r)),aliases);
  const shop = (s,name,icon,aliases=[]) => tr(s.id,name,icon,{lx0:s.lx-s.w/2,lx1:s.lx+s.w/2,lz0:s.facadeLz-s.depth,lz1:s.facadeLz},aliases);
  if (PLAZA_V2) {
    tr(HQ.id,'PUMPFUN PIRATES HQ',HQ.id,HQ);
    out.at(-1).polygons.push(...HQ_TOWERS.map(t => ring(t.lx,t.lz,t.r).map(town)));
    shop(OUTFIT_STORE,OUTFIT_STORE.name,OUTFIT_STORE.id,OUTFIT_STORE.areas.map(a=>a.id));
    shop(SHIP_STORE,'SHIP STORE · UPGRADES & SKINS',SHIP_STORE.id,SHIP_STORE.counters.map(a=>a.id));
    for (const h of HALLS) tr(h.id,h.market?'MARKETPLACE':'Harbor hall',h.market?'market':'shop',{lx0:h.lx-h.w/2,lx1:h.lx+h.w/2,lz0:FACADE_LZ-ROW_D,lz1:FACADE_LZ},h.market?['invshop_market']:[]);
    tr('fish_market','FISH MARKET','fish_stand',{lx0:FISH_MARKET.lx-FISH_MARKET.w/2,lx1:FISH_MARKET.lx+FISH_MARKET.w/2,lz0:FISH_MARKET.lz-FISH_MARKET.d/2,lz1:FISH_MARKET.lz+FISH_MARKET.d/2},['invshop_fish']);
    for (const h of HOUSES) tr(h.id,'Harbor house '+h.id,'shop',{lx0:h.lx-h.w/2,lx1:h.lx+h.w/2,lz0:FACADE_LZ-ROW_D,lz1:FACADE_LZ});
  }
  // LOTS_MAP records only the buildings actually placed, including GLB fallbacks and merged weapon lots.
  // It also contains the open square and casino: neither is an extra hill shop.
  const known = [...RENTABLE_SHOPS,...MAIN_ST_SHOPS,SQUAD_HALL];
  const seen = new Set();
  for (const lot of FM.LOTS_MAP || []) {
    if (/CASINO|HIGH SEAS|SQUARE/i.test(lot.label || '')) continue;
    const src = known.reduce((a,b) => Math.hypot(b.lx-lot.lx,b.lz-lot.z)<Math.hypot(a.lx-lot.lx,a.lz-lot.z)?b:a,known[0]);
    const matched = Math.hypot(src.lx-lot.lx,src.lz-lot.z)<4;
    const petLot = /^PET STORE/.test(lot.label || ''), id = petLot ? PET_LOT.id : matched ? src.id : 'hill_'+lot.side+'_'+lot.z;
    if (seen.has(id)) continue; seen.add(id);
    const isPet = petLot;
    const aliases = isPet ? [PET_SHOP.id] : matched && src.id===SQUAD_HALL.id ? ['squadhall'] : matched && src.id==='rent_1' ? ['invshop_antiques'] : [];
    const inside = interactions.find(q=>q.id?.startsWith('mm_') && Math.abs(q.lx-lot.lx)<lot.d/2 && Math.abs(q.lz-lot.z)<lot.w/2);
    const name = isPet ? PET_SHOP.name : inside ? title(inside.label) : matched && src.id===SQUAD_HALL.id ? 'SQUAD HALL' : matched && src.id==='rent_1' ? 'TREASURE TRADER' : matched && MAIN_ST_SHOPS.includes(src) ? SHOP_ICONS[src.id][4] : 'Hill shop '+(matched?src.lot:id);
    const icon = isPet ? PET_SHOP.id : matched && src.id===SQUAD_HALL.id ? 'squadhall' : matched && src.id==='rent_1' ? 'antiques' : matched && MAIN_ST_SHOPS.includes(src) ? src.id : inside?.id==='mm_fight' ? 'battle' : 'shop';
    tr(id,name,icon,{lx0:lot.lx-lot.d/2,lx1:lot.lx+lot.d/2,lz0:lot.z-lot.w/2,lz1:lot.z+lot.w/2},aliases);
  }
  if (VILLAGE_ON && PLAZA_V2) for (const o of VILLAGE_LOTS) tr('village_'+o.n,(o.n===7?'RUM ROW MANOR':'RENTAL')+' #'+o.n+' · FOR RENT','shop',{lx0:o.lx0,lx1:o.lx1,lz0:o.lz0,lz1:o.lz1});   // [post-village] BANKSY's numbered lots
  if (CASINO_ON && (FM.LOTS_MAP || []).some(l=>/CASINO/i.test(l.label || ''))) {
    tr('casino',CASINO_HALL.name+' CASINO','casino',CASINO_HALL.rect);
    if ((FM.LOTS_MAP || []).some(l=>/HIGH SEAS/i.test(l.label || ''))) tr('casino_wing','THE HIGH SEAS ROOM','casino',CASINO_WING.rect);
  }
  if (COLISEUM_ON) {
    const points = Array.from({length:64},(_,i)=>town(ellPoint(i*Math.PI/32)));
    const center = points.reduce((a,p)=>[a[0]+p[0]/64,a[1]+p[1]/64],[0,0]);
    add('coliseum','BLOODSTONE COLOSSEUM','battle',[points],center);
  }
  // Current walk-in fort is in foot coordinates (NOT the old coast.FORT prompt).
  add('castle','CROWN CITADEL','castle',[rectangle(FORT.x,FORT.z,FORT.half*2,FORT.half*2),...[-1,1].flatMap(x=>[-1,1].map(z=>ring(FORT.x+x*FORT.half,FORT.z+z*FORT.half,3.6)))],[FORT.x,FORT.z]);
  const k=FORT.keep; add('castle_keep','CITADEL KEEP · WAR ROOM','castle',[rectangle(k.x,k.z,k.half*2,k.half*2)],[k.x,k.z],['fort_table']);
  if (COTTAGES_ON) for (const c of COTTAGES) add('cottage_'+c.id,c.kind.toUpperCase()+' COTTAGE','camp',[rectangle(c.x,c.z,...COL_SIZES[c.kind],c.ry)],[c.x,c.z]);
  const [mx,mz]=MAG_COLLIDERS[0].box;
  add('powder_magazine','CANNON HEADLAND · POWDER MAGAZINE','fort',[rectangle(mx,mz,MAG.w,MAG.d,MAG.a).map(town)],town([mx,mz]));
  for (const l of FM.LIGHTHOUSES || []) add(l.id,l.id==='sandbar_lh'?'SANDBAR LIGHTHOUSE':'LIGHTHOUSE','fort',[ring(l.x,l.z,l.opts.baseR || (l.opts.height || 18)*0.16+0.2)],[l.x,l.z]);
  // The keeper's cottage is built alongside the primary lighthouse in foot.buildInland.
  const l = FM.LIGHTHOUSES?.find(l=>l.id==='lighthouse');
  if(l) add('keeper_cottage',"LIGHTHOUSE KEEPER'S COTTAGE",'camp',[rectangle(l.x+11,l.z+6,6,5,-1.2)],[l.x+11,l.z+6]);
  return out;
}

// Same screen-space path on fit, zoomed, and rotating maps. Never inflate the world footprint to fit a badge.
export function drawBuildingFootprints(ctx, buildings, project, {theme={}, dpr=1}={}) {
  ctx.save(); ctx.lineJoin='round'; ctx.lineWidth= Math.max(0.8,dpr);
  ctx.fillStyle=theme.badge==='line'?'#244c73':theme.badge==='paper'?'#ae8d61':'#b68357';
  ctx.strokeStyle=theme.badge==='line'?'#d3e8ff':'#35271e';
  for(const b of buildings) for(const polygon of b.polygons) {
    ctx.beginPath(); polygon.forEach(([x,z],i)=>{const [a,c]=project(x,z); i?ctx.lineTo(a,c):ctx.moveTo(a,c);}); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
export function buildingEmblems(buildings, project, maxRadius=10, minRadius=3) {
  return buildings.map(b=>{
    const [x,y]=project(b.x,b.z), pts=b.polygons[0].map(p=>project(...p));
    const w=Math.max(...pts.map(p=>p[0]))-Math.min(...pts.map(p=>p[0]));
    const h=Math.max(...pts.map(p=>p[1]))-Math.min(...pts.map(p=>p[1]));
    return {b,x,y,r:Math.min(maxRadius,Math.min(w,h)*0.34)};
  }).filter(p=>p.r>=minRadius);
}
export function drawBuildingEmblems(ctx,buildings,project,{theme={},maxRadius=10,minRadius=3}={}) {
  for(const p of buildingEmblems(buildings,project,maxRadius,minRadius)) drawShopIcon(ctx,p.b.icon,p.x,p.y,p.r,theme.badge);
}
