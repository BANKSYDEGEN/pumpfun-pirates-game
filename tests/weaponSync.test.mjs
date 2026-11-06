// [Raul weapon-sync] multiplayer + holstered sync of Legendary weapons and the 3D musket attachments ('wl', js/onfoot/weaponLook.js)
// run: node --import ./tests/helpers/threeRegister.mjs --test tests/weaponSync.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeDom } from './helpers/fakeDom.mjs';

const { doc } = fakeDom();
{ const ce = doc.createElement; doc.createElement = (t) => { const e = ce(t); if (t === 'canvas') e.getContext = () => new Proxy({ measureText: () => ({ width: 50 }) }, { get: (o, k) => (k in o ? o[k] : () => {}), set: () => true }); return e; }; }
const THREE = await import('three');
const WL = await import('../js/onfoot/weaponLook.js');
const { decorateSword, decorateMusket, swordTint, musketTint } = await import('../js/onfoot/weaponDecor.js');
const { swordGeo, musketGeo, legendaryGeoCount } = await import('../js/onfoot/swords.js');
const MU = await import('../js/musketUpgrades.js');
const { _lookCarry } = await import('../js/carryWeapons.js');
const { createFootNet } = await import('../js/onfoot/net.js');
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const { encodeWeaponLook, decodeWeaponLook, localWireLook, setObjLook, COMMON_LOOK } = WL;

const ALL4 = { scope: 'val:acc_scope', bayonet: 'val:acc_bayonet', stock: 'val:acc_stock', horn: 'val:acc_horn' };
const kids = (m, pred) => m.children.filter(pred);
const orn = (m, name) => kids(m, (c) => c.name === name).length;
const accN = (m) => kids(m, (c) => c.userData?.gunacc).length;
const meshCount = (m) => { let n = 0; m.traverse(() => n++); return n; };

test('wl codec: round-trip every sword rarity x musket rarity x 16 attachment sets x gilded', () => {
  for (const s of MU.RANKS) for (const mr of MU.RANKS) for (let a = 0; a < 16; a++) for (const g of [false, true]) {
    const acc = { ...(a & 1 ? { scope: 1 } : {}), ...(a & 2 ? { bayonet: 1 } : {}), ...(a & 4 ? { stock: 1 } : {}), ...(a & 8 ? { horn: 1 } : {}) };
    const v = encodeWeaponLook({ sword: s, musket: mr, acc, gilded: g }); assert.ok(Number.isInteger(v) && v >= 0 && v <= WL.WL_MAX);
    const d = decodeWeaponLook(v);
    assert.equal(d.sword, s); assert.equal(d.musket, mr); assert.equal(d.accBits, a); assert.equal(d.gilded, g);
    assert.deepEqual(Object.keys(d.acc).sort(), Object.keys(acc).sort());
    assert.equal(encodeWeaponLook({ sword: d.sword, musket: d.musket, acc: d.acc, gilded: d.gilded }), v);
  }
  const L = decodeWeaponLook(encodeWeaponLook({ sword: 'legendary', musket: 'legendary', acc: ALL4 }));
  assert.equal(L.v, 255); assert.deepEqual(L.acc, { scope: 1, bayonet: 1, stock: 1, horn: 1 });
  assert.equal(JSON.stringify({ wl: 511 }).length <= 10, true, 'tiny on the wire');
});

test('wl codec: older clients / bots / junk decode to common + no attachments; decoded looks are cached + frozen', () => {
  for (const v of [undefined, null, '', 'legendary', -1, 512, 3.5, NaN, Infinity, {}, [255], '255']) {
    const d = decodeWeaponLook(v); assert.equal(d, COMMON_LOOK); assert.equal(d.sword, 'common'); assert.equal(d.musket, 'common'); assert.equal(d.accBits, 0); assert.deepEqual(d.acc, {}); }
  assert.equal(encodeWeaponLook({ sword: 'mythic', musket: 42 }), 0);
  assert.equal(decodeWeaponLook(255), decodeWeaponLook(255), 'same object (no per-frame allocation)');
  assert.ok(Object.isFrozen(decodeWeaponLook(255)) && Object.isFrozen(decodeWeaponLook(255).acc));
});

test('localWireLook: inventory rarity + the EQUIPPED musket instance attachments (+ gilded), allocation-free reads', () => {
  globalThis.PFP_WEAPON_RARITY = { sword: 'legendary', musket: 'legendary' };
  MU.setGunInstances([{ gid: 'g1', item: 'wpn:musket:navy:legendary', place: 'equip', acc: { ...ALL4 } }, { gid: 'g2', item: 'wpn:musket:navy:epic', place: 'bag', acc: {} }]);
  assert.equal(localWireLook(), 255);
  MU.applyLocalAcc('g1', 'horn', null); assert.equal(decodeWeaponLook(localWireLook()).accBits, 7);
  MU.applyLocalAcc('g1', 'horn', 'val:acc_horn'); assert.equal(localWireLook(), 255);
  MU.setMuskLevels({ reload: 3, range: 3, acc: 3, skin: true }); assert.equal(decodeWeaponLook(localWireLook()).gilded, true);
  MU.setMuskLevels({ reload: 0, range: 0, acc: 0, skin: false }); assert.equal(localWireLook(), 255);
});

test('net.js: wl rides in your state + a peer packet sets their look on the avatar root (missing wl = common)', () => {
  const docking = { onPeer() { return false; }, berth: null, mode: 'sea', fresh() { return 0; }, dropPeer() {} };
  const f = createFootNet({ scene: new THREE.Scene(), low: true, world: { ground: () => 0 }, docking });
  assert.equal(f.netState({ active: false }).wl, 255);
  f.onPeerState({ i: 'legend01', n: 'LEGEND', ft: [0, 0, 0, 0], wl: 255 });
  const p = f.peers.get('legend01'); assert.ok(p);
  assert.equal(p.look.v, 255); assert.equal(p.pirate.object.userData.wlook, p.look);
  f.onPeerState({ i: 'legend01', n: 'LEGEND', ft: [0, 0, 0, 0], wl: 255 }); assert.equal(p.pirate.object.userData.wlook.v, 255);
  f.onPeerState({ i: 'oldclnt1', n: 'OLD', ft: [1, 1, 0, 0] });   // an older client: no 'wl'
  assert.equal(f.peers.get('oldclnt1').look, COMMON_LOOK);
  f.onPeerState({ i: 'legend01', n: 'LEGEND', ft: [0, 0, 0, 0], wl: 4 }); assert.equal(p.look.musket, 'rare'); assert.equal(p.look.sword, 'common');
  f.clear();
  // transport: 'wl' is STATIC (re-sent only when it changes / every 3 s)
  assert.match(src('js/transport.js'), /const STATIC = \[[^\]]*'wl'\]/);
});

// a stand-in for a pirate's carry state (js/carryWeapons.js syncCarry): root (pirate.object) > body > spine / hip bones > weapons
function carryRig(swordId = 'cutlass', musketId = 'navy') {
  const root = new THREE.Group(), body = new THREE.Group(), spine = new THREE.Group(), hip = new THREE.Group(); root.add(body); body.add(spine); body.add(hip);
  const s = new THREE.Mesh(swordGeo(swordId), new THREE.MeshBasicMaterial()); s.userData.id = swordId; hip.add(s);
  const m = new THREE.Mesh(musketGeo(musketId), new THREE.MeshBasicMaterial()); m.userData.id = musketId; spine.add(m);
  return { root, st: { body, sword: s, musket: m, swV: -1, muV: -1, crew: false } };
}

test('local holstered: hip sword + back musket wear YOUR Legendary ornaments, rank tint + all 4 fitted 3D attachments', () => {
  globalThis.PFP_WEAPON_RARITY = { sword: 'legendary', musket: 'legendary' };
  MU.setGunInstances([{ gid: 'g1', item: 'wpn:musket:navy:legendary', place: 'equip', acc: { ...ALL4 } }]);
  const { root, st } = carryRig(); setObjLook(root, WL.localWeaponLook());   // battle.js dress does this for you every frame
  _lookCarry(st);
  assert.equal(orn(st.sword, 'legendarySwordOrn'), 1); assert.equal(orn(st.musket, 'legendaryMusketOrn'), 1);
  assert.equal(accN(st.musket), 4);
  assert.equal(st.musket.material.emissive.getHex(), 0x7a4b00, 'legendary gold gleam on the slung musket');
  assert.equal(st.sword.material.emissive.getHex(), 0x7a4b00, 'legendary gold gleam on the hip sword');
  const n0 = meshCount(st.musket); for (let i = 0; i < 50; i++) _lookCarry(st); assert.equal(meshCount(st.musket), n0, 'no per-frame rebuild');
});

test('remote peer: decoded packet -> holstered AND in-hand weapons Legendary + attachments; switching never leaks or duplicates', () => {
  const docking = { onPeer() { return false; }, berth: null, mode: 'sea', fresh() { return 0; }, dropPeer() {} };
  const f = createFootNet({ scene: new THREE.Scene(), low: true, world: { ground: () => 0 }, docking });
  f.onPeerState({ i: 'peer0001', n: 'PEER', ft: [0, 0, 0, 0], wl: 255 }); const p = f.peers.get('peer0001');
  const { root, st } = carryRig('blade_gold', 'blunder_gold'); p.pirate.object.add(root);   // their carried copies under their avatar
  _lookCarry(st);
  assert.equal(orn(st.sword, 'legendarySwordOrn'), 1); assert.equal(orn(st.musket, 'legendaryMusketOrn'), 1); assert.equal(accN(st.musket), 4);
  // in hand (battle.js dress builds the held copy from the same look: decorateSword / decorateMusket + swordTint / musketTint)
  const held = decorateMusket(new THREE.Mesh(musketGeo('navy')), 'navy', p.look), blade = decorateSword(new THREE.Mesh(swordGeo('cutlass')), 'cutlass', p.look);
  assert.equal(accN(held), 4); assert.equal(orn(held, 'legendaryMusketOrn'), 1); assert.equal(orn(blade, 'legendarySwordOrn'), 1);
  assert.equal(musketTint(p.look).id, 'legendary'); assert.equal(swordTint(p.look).id, 'legendary');
  // scope / bayonet / stock / horn sit where the musket frame says (butt origin, barrel +Z)
  const zs = Object.fromEntries(kids(held, (c) => c.userData?.gunacc).map((c, i) => [['scope', 'bayonet', 'stock', 'horn'][i], c.position.z]));
  assert.ok(zs.bayonet > zs.scope && zs.scope > zs.horn && zs.horn > zs.stock, JSON.stringify(zs));
  // switch: epic, scope only -> then common, nothing; geometry count stays flat (shared ornament geos), children never duplicate
  const g0 = legendaryGeoCount(), geos = new Set(); const grab = (m) => m.traverse((o) => o.geometry && geos.add(o.geometry));
  for (let k = 0; k < 20; k++) {
    for (const v of [encodeWeaponLook({ sword: 'epic', musket: 'epic', acc: { scope: 1 } }), 0, 255]) {
      f.onPeerState({ i: 'peer0001', n: 'PEER', ft: [0, 0, 0, 0], wl: v }); _lookCarry(st); decorateMusket(held, 'navy', p.look); decorateSword(blade, 'cutlass', p.look); grab(held); grab(st.musket);
      const want = decodeWeaponLook(v);
      assert.equal(accN(st.musket), [1, 0, 4][[encodeWeaponLook({ sword: 'epic', musket: 'epic', acc: { scope: 1 } }), 0, 255].indexOf(v)]);
      assert.equal(accN(held), accN(st.musket));
      assert.equal(orn(st.musket, 'legendaryMusketOrn'), want.musket === 'legendary' ? 1 : 0); assert.equal(orn(held, 'legendaryMusketOrn'), want.musket === 'legendary' ? 1 : 0);
      assert.equal(orn(st.sword, 'legendarySwordOrn'), want.sword === 'legendary' ? 1 : 0); assert.equal(orn(blade, 'legendarySwordOrn'), want.sword === 'legendary' ? 1 : 0);
    }
  }
  assert.equal(legendaryGeoCount(), g0, 'ornament geometry is shared: no new buffers per switch');
  assert.ok(geos.size < 60, 'bounded geometry set across 60 re-dresses: ' + geos.size);
  // blade_gold keeps its own gold material on the hip; others take the rank tint
  assert.equal(st.sword.material.emissive.getHex(), 0x6b4a00);
  f.clear();
});

test('wiring: battle.js dresses peers from their wl (r.look) + yours from localWeaponLook, int-keyed rebuilds; kill switch &wsync=0', () => {
  const b = src('js/onfoot/battle.js'), n = src('js/onfoot/net.js'), c = src('js/carryWeapons.js');
  assert.match(b, /r\.look = WSYNC_ON \? decodeWeaponLook\(m\.wl\) : COMMON_LOOK/);
  assert.match(b, /const LK = R === mineR \? localWeaponLook\(\) : \(R\.look \|\| R\.obj\?\.userData\?\.wlook \|\| COMMON_LOOK\); if \(R\.obj\) setObjLook\(R\.obj, LK\)/);
  assert.match(b, /R\.swordLook !== LK\.sw/); assert.match(b, /R\.musketLook !== LK\.mu/);
  assert.match(b, /decorateMusket\(m, musketId, LK\)/); assert.match(b, /decorateSword\(s, swordId, LK\)/);
  assert.doesNotMatch(b, /Object\.keys\(acc\)\.sort\(\)/, 'no per-frame string signature');
  assert.match(n, /wl: localWireLook\(\)/); assert.match(n, /decodeWeaponLook\(WSYNC_ON \? m\.wl : 0\)/);
  assert.match(c, /lookCarry\(st\);/); assert.match(c, /st\.swV = -1; st\.muV = -1;/);
  assert.equal(WL.wsyncOn('?wsync=0'), false); assert.equal(WL.wsyncOn('?x=1'), true);
  // ba is untouched (older clients validate its length 7..9)
  assert.match(b, /m\.ba\.length >= 7 && m\.ba\.length <= 9/);
});

test('transport pass-through: wl rides the Batcher as STATIC (re-sent on change), merges on receive; older peers without wl still dispatch', async () => {
  const { Batcher } = await import('../js/transport.js');
  const out = [], tx = new Batcher('sender01', { hz: 10, soloHz: 10, keepalive: 5 }, (m) => { out.push(JSON.parse(JSON.stringify(m))); return true; }); tx.stop();
  const got = [], rx = new Batcher('recv0001', { hz: 10, soloHz: 10, keepalive: 5 }, () => true); rx.stop(); rx.on('s', (s) => got.push(s));
  let st = { n: 'LEGEND', ft: [0, 0, 0, 0], wl: 255 }; tx.setState(() => ({ ...st }));
  tx.flush(true); assert.equal(out.at(-1).s.wl, 255); rx.receive(out.at(-1)); assert.equal(got.at(-1).wl, 255);
  st = { ...st, ft: [5, 5, 0, 0] }; tx.flush(true); assert.equal('wl' in out.at(-1).s, false, 'unchanged wl is not re-sent with the pose');
  rx.receive(out.at(-1)); assert.equal(got.at(-1).wl, 255, 'receiver keeps the merged static wl');
  st = { ...st, wl: 4 }; tx.flush(true); assert.equal(out.at(-1).s.wl, 4); rx.receive(out.at(-1)); assert.equal(decodeWeaponLook(got.at(-1).wl).musket, 'rare');
  rx.receive({ i: 'oldclnt1', s: { n: 'OLD', ft: [1, 1, 0, 0] } }); assert.equal(decodeWeaponLook(got.at(-1).wl), COMMON_LOOK);
});

test('server relay: no payload-key whitelist (wl forwarded untouched); only prototype keys + the id are dropped', () => {
  const r = src('server/relay.js');
  assert.match(r, /for \(const \[k, v\] of Object\.entries\(m\.s\)\) \{ if \(k === '__proto__' \|\| k === 'constructor' \|\| k === 'prototype' \|\| k === 'i'\) continue;[^\n]*f\[k\] = v; \}/);
  assert.doesNotMatch(r, /ALLOWED|allowKeys|KEYS\.includes/);
});

test('wiring: YOUR look sits on your pirate root every on-foot frame (holsters outside arenas) + peers fall back to the net.js root look', () => {
  const b = src('js/onfoot/battle.js');
  assert.match(b, /hookBody\(mineR\); if \(WSYNC_ON\) setObjLook\(pirate\.object, localWeaponLook\(\)\);/);
  assert.match(b, /R\.look \|\| R\.obj\?\.userData\?\.wlook \|\| COMMON_LOOK/);
  assert.ok(b.indexOf('setObjLook(R.obj, LK)') < b.indexOf('if (!R.v4 || !R.bones) return;', b.indexOf('function dress(')), 'look set before the v4 early-out');
});
