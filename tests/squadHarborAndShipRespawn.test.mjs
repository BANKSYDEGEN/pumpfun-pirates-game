// [v328] BANKSY t1737–t1741 — Harbor co-op squads (size 16, zero FF) + open-island death → ship respawn.
// Arena 2v2 (SQUADS.size = 2) stays unchanged.
import './helpers/threeRegister.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SQUADS, HARBOR_SQUAD_MAX } from '../js/config.js';
import { makeTeams, partyTag } from '../js/squads.js';
import { createCrewFight } from '../js/onfoot/crewFight.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const PVP = read('js/pvp.js');
const BAT = read('js/onfoot/battle.js');
const DOCK = read('js/dock/index.js');
const HALL = read('js/dock/squadHall.js');
const CREW = read('js/onfoot/crewFight.js');
const CFG = read('js/config.js');
const SW = read('sw.js');

test('config: HARBOR_SQUAD_MAX = 16; Arena SQUADS stays 2v2 (size 2, players 4)', () => {
  assert.equal(HARBOR_SQUAD_MAX, 16);
  assert.equal(SQUADS.size, 2);
  assert.equal(SQUADS.players, 4);
  assert.match(CFG, /HARBOR_SQUAD_MAX\s*=\s*16/);
  assert.ok(+((SW.match(/VERSION = 'pfp-v(\d+)'/) || [])[1]) >= 331, 'sw at or past pfp-v331'); // [v330] numeric
});

test('makeTeams still builds 2v2 Arena sides (unchanged)', () => {
  const players = [
    { id: 'a', pc: partyTag('AAAAA') }, { id: 'b', pc: partyTag('AAAAA') },
    { id: 'c', pc: '' }, { id: 'd', pc: '' },
  ];
  const t = makeTeams(players, () => 0.1);
  assert.equal(t.A.length, 2);
  assert.equal(t.B.length, 2);
  // party pair stays together on one side
  const sideA = new Set(t.A), sideB = new Set(t.B);
  assert.ok((sideA.has('a') && sideA.has('b')) || (sideB.has('a') && sideB.has('b')));
});

test('pvp.js: Harbor squad capacity uses HARBOR_SQUAD_MAX; Arena joinBattle gated at SQUADS.size', () => {
  assert.match(PVP, /live\.length \+ 1 > HARBOR_SQUAD_MAX/);
  assert.doesNotMatch(PVP, /live\.length >= SQUADS\.size && live\.every/);
  assert.match(PVP, /partyMates\(\)\.length \+ 1 > SQUADS\.size/);
  assert.match(PVP, /ARENA SQUADS IS 2v2/);
  assert.match(PVP, /HARBOR_SQUAD_MAX/);
});

test('pvp.js: myPc broadcasts in harbor even on SOLO; setMode does not partyLeave', () => {
  assert.match(PVP, /myPc = \(\) => \(where === 'harbor' \|\| mode === 'squads'\) && party\.code/);
  // setMode body must NOT call partyLeave
  const setMode = PVP.match(/function setMode\(m\)[\s\S]{0,700}/);
  assert.ok(setMode, 'setMode present');
  assert.doesNotMatch(setMode[0], /partyLeave\s*\(/);
  assert.match(setMode[0], /do NOT partyLeave|Harbor co-op/);
});

test('pvp.js: isSquadMate via mates map + matching pc; exported on api + publicApi', () => {
  assert.match(PVP, /function isSquadMate\(id\)/);
  assert.match(PVP, /party\.mates\.get\(id\)/);
  assert.match(PVP, /p\?\.pc && p\.pc === pc/);
  assert.match(PVP, /isSquadMate: \(id\) => isSquadMate\(id\)/);
  assert.match(PVP, /api\.publicApi[\s\S]{0,400}isSquadMate/);
});

test('pvp.js: ship + battery friendly fire blocked by isSquadMate', () => {
  assert.match(PVP, /harborPvpCanHit[\s\S]{0,200}!isSquadMate\(shipIdOf\(target\)\) && !isSquadMate\(shipIdOf\(shooter\)\)/);
  assert.match(PVP, /if \(pid && isSquadMate\(pid\)\) continue/); // batteryStep
  assert.match(PVP, /isSquadMate\(m\.s\)\) return/); // onHit battery validation
});

test('pvp.js: partyInfo returns mates[] + count; harborUi lists all mates', () => {
  assert.match(PVP, /partyInfo\(\)[\s\S]{0,200}mates[\s\S]{0,120}count:/);
  assert.match(PVP, /mates\.map\(x => esc\(x\.n\)\)\.join/);
  assert.match(PVP, /pp\.hidden = !\(mode === 'squads' \|\| !!party\.code\)/);
});

test('isSquadMate pure logic: mates map OR matching pc tag', () => {
  const myId = 'me';
  const party = { code: 'ABCDE', mates: new Map() };
  const peers = new Map();
  const pc = partyTag(party.code);
  function isSquadMate(id) {
    if (!id || id === myId || !party.code) return false;
    const m = party.mates.get(id);
    if (m && performance.now() - m.at < 15000) return true;
    const p = peers.get(id);
    return !!(pc && p?.pc && p.pc === pc);
  }
  assert.equal(isSquadMate(null), false);
  assert.equal(isSquadMate(myId), false);
  assert.equal(isSquadMate('x'), false);
  party.mates.set('bob', { n: 'BOB', at: performance.now() });
  assert.equal(isSquadMate('bob'), true);
  peers.set('carol', { pc });
  assert.equal(isSquadMate('carol'), true);
  peers.set('dave', { pc: 'other' });
  assert.equal(isSquadMate('dave'), false);
});

test('onPartyBeat capacity: 3rd…16th mates are NOT kicked; 17th is', () => {
  // Simulate the live.length + 1 > HARBOR_SQUAD_MAX gate
  const mates = new Map();
  const t0 = 1000;
  for (let i = 0; i < 15; i++) mates.set('p' + i, { n: 'P' + i, t: t0 + i, at: performance.now() });
  const live = [...mates.values()];
  // adding 16th (live already 15 → live+1 = 16) OK
  assert.equal(live.length + 1 > HARBOR_SQUAD_MAX, false);
  mates.set('p15', { n: 'P15', t: t0 + 15, at: performance.now() });
  const live16 = [...mates.values()];
  assert.equal(live16.length, 16);
  assert.equal(live16.length + 1 > HARBOR_SQUAD_MAX, true); // 17th would kick
});

test('joinBattle Arena gate: Harbor squad of 4 blocks 2v2 queue', () => {
  const harborCount = 4; // me + 3 mates
  assert.ok(harborCount > SQUADS.size);
  assert.ok(harborCount <= HARBOR_SQUAD_MAX);
});

test('battle.js: isSquadMate + isMate block sword/musket + incoming bh; ship respawn hook', () => {
  assert.match(BAT, /isSquadMate = null/);
  assert.match(BAT, /respawnOnShip = null/);
  assert.match(BAT, /const isMate = \(id, r\) =>/);
  assert.match(BAT, /canHitPeer\(r, p, Z_PIT, id\)/);
  assert.match(BAT, /canHitPeer\(r, p, Z_RANGE, id\)/);
  assert.match(BAT, /!isMate\(m\.i, r\)\) takeHit/);
  assert.match(BAT, /respawning on your ship/);
  assert.match(BAT, /if \(respawnOnShip\?\.\(\)\) return/);
});

test('dock/index.js: respawnOnShip moored OR offshore-anchored; canoe cleared on ship-sink', () => {
  assert.match(DOCK, /function respawnOnShip\(\)/);
  assert.match(DOCK, /canoe\.mode === 'canoe' \|\| canoe\.mode === 'beached'/);
  assert.match(DOCK, /docking\.mode === 'sea' && s\.alive/);
  assert.match(DOCK, /docking\.mode === 'docked' && s\.alive/);
  assert.match(DOCK, /RESPAWNED ON YOUR SHIP · HARBOR/);
  assert.match(DOCK, /RESPAWNED ON YOUR ANCHORED SHIP/);
  assert.match(DOCK, /isSquadMate: \(id\) => isSquadMateDock\(id\)/);
  assert.match(DOCK, /respawnOnShip: \(\) => respawnOnShip\(\)/);
  assert.match(DOCK, /canoe\?\.clearAll\?\.\(s, controls\); spawnNow\(s\)/);
});

test('respawnOnShip pure: offshore canoe → snap to (ax,az,ayaw); docked keeps berth', () => {
  function sim({ mode, canoeMode, ax, az, ayaw, alive = true }) {
    const s = { x: 1, z: 2, yaw: 0.1, speed: 5, sail: 1, turn: 0.2, anchor: false, alive, sinking: 0, hp: 10, maxHp: 100, mesh: { visible: false }, _offshore: true, _canoeAway: true };
    const docking = { mode, release() { docking.mode = 'free'; }, berth: mode === 'docked' ? { id: 'b0' } : null };
    const canoe = { mode: canoeMode, state: { ax, az, ayaw }, cleared: false, clearAll() { canoe.cleared = true; canoe.mode = 'stowed'; } };
    const toast = [];
    const away = canoe && (canoe.mode === 'canoe' || canoe.mode === 'beached') && Number.isFinite(ax) && Number.isFinite(az);
    if (away) {
      canoe.clearAll();
      s.x = ax; s.z = az; s.yaw = ayaw; s.speed = 0; s.sail = 0; s.turn = 0; s.anchor = true; s._offshore = false; s._canoeAway = false;
    } else if (docking.mode === 'sea' && s.alive) {
      canoe.clearAll(); s.speed = 0; s.sail = 0; s.turn = 0; s.anchor = true; s._offshore = false; s._canoeAway = false;
    } else if (docking.mode === 'docked' && s.alive) {
      canoe.clearAll();
    } else {
      canoe.clearAll(); s.alive = true; s.sinking = 0; s.hp = s.maxHp; s.mesh.visible = true; docking.release(); s.x = 99; s.z = 99; // spawnNow stand-in
    }
    toast.push(docking.mode === 'docked' ? 'HARBOR' : 'ANCHORED');
    return { s, canoe, docking, toast };
  }
  const off = sim({ mode: 'sea', canoeMode: 'beached', ax: -120, az: 40, ayaw: 1.2 });
  assert.equal(off.s.x, -120); assert.equal(off.s.z, 40); assert.equal(off.s.yaw, 1.2);
  assert.equal(off.s.anchor, true); assert.equal(off.canoe.cleared, true);
  assert.deepEqual(off.toast, ['ANCHORED']);

  const moored = sim({ mode: 'docked', canoeMode: 'stowed', ax: NaN, az: NaN, ayaw: 0 });
  assert.equal(moored.s.x, 1); // berth position kept
  assert.equal(moored.docking.mode, 'docked');
  assert.deepEqual(moored.toast, ['HARBOR']);
});

test('crewFight: engage/remote/tick refuse squadmate targets', () => {
  assert.match(CREW, /isSquadMate = \(\) => false/);
  assert.match(CREW, /attacker === 'me' && isSquadMate\(target\)/);
  assert.match(CREW, /isSquadMate\(peerId\)/);
  assert.match(CREW, /forms mid-fight/);

  const mates = new Set(['bob']);
  const cf = createCrewFight({
    isSquadMate: (id) => mates.has(id),
    crewOf: () => [{ x: 0, z: 0, yaw: 0, speed: 0, p: { object: { visible: true, userData: {} } } }],
    captainOf: () => ({ x: 0, z: 0 }),
    inSafe: () => false,
    now: () => 1,
  });
  assert.equal(cf.engage('me', 'sword', 'bob'), false);
  assert.equal(cf.fights.has('me'), false);
  assert.equal(cf.engage('me', 'sword', 'eve'), true);
  assert.equal(cf.fights.has('me'), true);
  cf.remote('bob', 1, 'my-id', 'my-id'); // squadmate peer → stop
  assert.equal(cf.fights.has('bob'), false);
});

test('squadHall partyBar lists all mates + Harbor co-op copy', () => {
  assert.match(HALL, /mates\.map\(m => esc\(m\.n\)\)\.join/);
  assert.match(HALL, /Harbor co-op PvE \(up to 16\)/);
  assert.match(HALL, /NEW SQUAD/);
});
