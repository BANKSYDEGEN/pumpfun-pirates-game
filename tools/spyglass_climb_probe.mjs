// Probe fort climb path + war-room decks/colliders
const F = await import('../js/island/foot.js');
const fort = await import('../js/island/areas/fort.js');
const R = new Proxy({}, { get: () => [0, 0, 1, 1] });
for (const fn of ['buildStreet', 'buildInland', 'buildCoast']) {
  try { F[fn](R, true, []); } catch (e) { console.error('build', fn, e.message.slice(0,120)); }
}
const pts = [
  [-417.5,-34.75,'stair_mid'],[-410,-34.75,'stair_mid2'],[-406,-34.75,'stair_upper'],
  [-404.5,-34.75,'stair_near_top'],[-404,-34.75,'stair_top'],[-403.5,-34.75,'gap_E'],
  [-403,-34.75,'gap_E2'],[-402,-34.75,'land_S'],[-401.5,-34.5,'land'],[-401.5,-33.5,'land_N'],
  [-401.5,-32.4,'land_to_wall'],[-404,-32.4,'wall_n_W'],[-400,-32.4,'wall_n_mid'],
  [-397.6,-32.4,'near_spy'],[-396.6,-32.6,'spy'],[-396.6,-31.0,'spy_N'],[-395.0,-32.6,'spy_E'],
  [-408,-44,'yard_W'],[-405.2,-44,'table_interact'],[-403,-44,'table'],[-403,-42,'keep_N'],
  [-400,-44,'keep_E'],[-403,-46,'keep_S'],[-403,-39.5,'keep_N_wall'],[-403,-39.2,'just_N_of_keep'],
];
function aboveAt(x,z){
  const decks = F.AREA_DECKS || [];
  const out=[];
  for (const dk of decks) {
    if (!dk || dk.off || !(dk.y > 37)) continue;
    const dx = x - dk.x, dz = z - dk.z;
    let inside=false;
    if (dk.r != null) inside = dx*dx+dz*dz <= dk.r*dk.r;
    else {
      const c = dk.c ?? Math.cos(dk.yaw||0), s = dk.s ?? Math.sin(dk.yaw||0);
      inside = Math.abs(dx*c - dz*s) <= dk.hw + 1e-6 && Math.abs(dx*s + dz*c) <= dk.hl + 1e-6;
    }
    if (inside) out.push({ id: dk.id, y: +dk.y.toFixed(2), hw: dk.hw, hl: dk.hl, r: dk.r });
  }
  return out;
}
const rows = pts.map(([x,z,id]) => {
  const y = F.groundAt?.(x,z);
  const d = F.areaDeckAt?.(x,z);
  const hit = F.hitCollider?.(x,z,0.45);
  const hitS = F.hitCollider?.(x,z,0.05);
  let why=null; try{ why=F.whyBlocked?.(x,z,x+0.02,z); }catch(e){}
  return { id,x,z, y: y==null?null:+(+y).toFixed(3), deck:d==null?null:+(+d).toFixed(3), hit:!!hit, hitS:!!hitS, why, above: aboveAt(x,z) };
});
console.log(JSON.stringify(rows, null, 2));
const decks = (F.AREA_DECKS||[]).filter(d => /^fort_/.test(d.id||''));
console.log('FORT_DECKS', JSON.stringify(decks.map(d => ({ id:d.id, x:+d.x.toFixed(2), z:+d.z.toFixed(2), y:d.y, hw:d.hw, hl:d.hl, r:d.r, yaw:d.yaw })), null, 2));
// Sample colliders near stair/landing
const boxes = F.AREA_BOXES || F.BOXES || [];
console.log('boxKeys', Object.keys(F).filter(k=>/BOX|COLL|HIT|AREA/.test(k)).slice(0,40));
