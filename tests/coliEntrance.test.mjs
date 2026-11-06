// [Timothy v294] BANKSY: coliseum entrance off the fish-market plaza, south (+lx) end off the ground edge, musket + sword walled + spectatable.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const run=qs=>JSON.parse(execFileSync('node',['--import','./reg.mjs','coli_check.mjs'],{cwd:new URL('../tools/roundabout_blender/node/',import.meta.url),env:{...process.env,QS:qs},encoding:'utf8'}).trim().split('\n').pop());
const ON=run('?coast=1');
const src=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('fish-market approach: plaza level -> arena level, walk deck on profile, no colliders on the centreline or shoulders, no terrain through the paving',()=>{
  const f=ON.fish; assert.equal(f.on,true);
  assert.ok(Math.abs(f.startY-2.73)<0.02,`start ${f.startY}`); assert.ok(Math.abs(f.endY-9.2)<0.02,`end ${f.endY}`);
  assert.ok(f.maxErr<0.03); assert.ok(f.maxStep<0.15); assert.ok(f.poke<=0.03,`poke ${f.poke}`);
  assert.deepEqual(f.hits,[]); assert.deepEqual(f.edgeHits,[]);
  assert.ok(f.length>30 && 6.47/(f.length-10)<0.3,'gentle ramp');
});
test('fish gate opens the plaza-end wall, east of the FISH MARKET, on the shell',()=>{
  const g=ON.fish.gate; assert.ok(g.lz>-80 && g.lz<-68); assert.ok(g.w>=7);
});
test('south (+lx) end pulled in: shell edge at lx 88, battery gate on it, wall still solid',()=>{
  assert.equal(ON.ell.cx+ON.ell.rx,88); assert.ok(Math.abs(ON.battery.lx-88)<0.3,`battery ${ON.battery.lx}`);
  assert.equal(ON.wallSolid,true); assert.deepEqual(ON.batteryHits,[]); assert.equal(ON.exteriorSummary.unexplained,0);
});
test('musket range + sword pit: stone walls on the coliseum, fence / ropes when &coliseum=0; benches for spectators',()=>{
  const b=src('js/island/battleAreas.js'); assert.match(b,/const wall = \(a, b, y, h = 1\.25\) => \{ if \(!COLISEUM_ON\) return fence/); assert.match(b,/stone ring wall under the ropes/); assert.match(b,/spectator benches/);
  assert.equal(ON.inRange,true);
});
test('&coliseum=0 has no fish approach deck or paint',()=>{ const OFF=run('?coast=1&coliseum=0'); assert.equal(OFF.on,false); assert.equal(OFF.fish.length,undefined); });
// [Timothy v300] BANKSY 5:52 PM "rework the inside of coliseum can make the things fit better inside inner circle"
test('musket range + sword pit sit wholly inside the inner kerb (1.2 m inset), centred on the arena axis, ring walk clear all round',()=>{
  const w=ON.wings; assert.ok(w.n>60,`props checked ${w.n}`); assert.deepEqual(w.out,[]); assert.deepEqual(w.ring,[]);
  assert.equal((ON.range.lx0+ON.range.lx1)/2,ON.ell.cx); assert.equal(ON.pit.lx,ON.ell.cx); assert.equal(ON.pit.y,ON.footY);
  assert.ok(ON.range.lz1<ON.pit.lz-ON.pit.pad-12,'central concourse between the wings');
});
test('wing spawns + gates are clear; floor pads match the wings',()=>{
  assert.deepEqual(ON.wings.spawnHits,[]); assert.deepEqual(ON.wings.gateHits,[]); assert.ok(ON.wings.spawns>40);
  const s=src('js/island/coliseum.js'),R=ON.range,P=ON.pit;
  assert.ok(s.includes(`T(${(R.lx0+R.lx1)/2}, ${(R.lz0+R.lz1)/2}); W(k, box(${R.lx1-R.lx0-1}, 0.08, ${R.lz1-R.lz0-1})`),'yellow pad = RANGE inset 0.5');
  assert.ok(s.includes(`T(${P.lx}, ${P.lz}); W(k, new THREE.CylinderGeometry(${+(P.r+0.6).toFixed(1)}, ${+(P.r+0.6).toFixed(1)}`),'purple pad = PIT r + 0.6');
});
// [Timothy v305] BANKSY coli-round: rounded-oval ends + vaulted MAIN_GATE vomitorium
test('rounded oval: tips pulled off Fish Market cliff / castle, p>2, wings still inside kerb, ring walk clear', () => {
  assert.equal(ON.ell.p, 2.7); assert.equal(ON.ell.rx, 27); assert.equal(ON.ell.rz, 64);
  assert.equal(ON.tips.south, -72); assert.equal(ON.tips.north, -200);
  assert.ok(ON.tips.fishClear >= 14, `fish clearance ${ON.tips.fishClear}`);
  const w = ON.wings; assert.deepEqual(w.out, []); assert.deepEqual(w.ring, []);
});
// [v307] BANKSY: south end must not hang off the cliff — outer shell face ground >= FOOT.y - 0.35
test('south / SE outer shell sits on solid ground (no cliff undercut at off=-1.2)', () => {
  const g = ON.shellGround; assert.ok(g && g.n > 30, `sampled ${g&&g.n}`);
  assert.deepEqual(g.bad, [], `undercut bays ${JSON.stringify(g.bad)}`);
  assert.ok(g.min >= ON.footY - 0.35, `min H ${g.min} < ${ON.footY - 0.35}`);
});
// [v307] BANKSY hole fix: zero unblocked wall gaps around 360° except the 4 intentional gates
test('outer shell has zero wall gaps except the four gate openings', () => {
  const g = ON.shellGaps; assert.ok(g && g.n > 100, `probed ${g&&g.n}`);
  assert.deepEqual(g.gaps, [], `shell gaps ${JSON.stringify(g.gaps)}`);
});
test('all four entrances walk clear end-to-end (stuck=0, hits=0)', () => {
  for (const id of ['main', 'fish', 'castle', 'battery']) {
    const w = ON.walks[id]; assert.ok(w, id); assert.deepEqual(w.hits, [], `${id} hits`); assert.equal(w.stuck, 0, `${id} stuck`); assert.ok(w.n > 10, id);
  }
});
test('MAIN_GATE gallery is vaulted / pilastered (vomitorium art present in source)', () => {
  const s = src('js/island/coliseum.js');
  assert.match(s, /vomitorium|triumphal entrance gallery/i);
  assert.match(s, /transverse Roman rib arch|coffered vault/i);
  assert.match(s, /blind arch|pilaster/i);
  assert.match(s, /contourAt|ellF|baySeg/);
});

// [v310] BANKSY: west Castle Hill slope must never bulge up inside the coliseum floor
test("coliseum interior floor is completely flat at FOOT.y (no hillside bulge)", () => {
  assert.ok(ON.interiorH && ON.interiorH.n > 500, "sampled interior");
  assert.equal(ON.interiorH.bumps, 0, "interior bumps " + JSON.stringify(ON.interiorH.sample));
});
