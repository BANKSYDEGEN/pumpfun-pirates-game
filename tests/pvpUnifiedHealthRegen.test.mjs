// [t1724u] BANKSY "For PvP use same heath bar, do the same if don't get hit for 20 seconds regain health"
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { footRegenStep, FOOT_REGEN } from '../js/onfoot/stances.js';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const battle = read('js/onfoot/battle.js'), main = read('js/main.js'), pvp = read('js/pvp.js');

// pull main.js's real HP-bar functions out and run them against a tiny fake DOM
function mainHp({ dock = null, player }) {
  const bar = { style: { width: '' }, parentElement: { classList: new Set() } };
  bar.parentElement.classList.toggle = function (c, on) { on ? this.add(c) : this.delete(c); };
  const root = { classList: { set: new Set(), toggle(c, on) { on ? this.set.add(c) : this.set.delete(c); }, contains(c) { return this.set.has(c); } } };
  const src = main.slice(main.indexOf('const PLAYER_REPAIR'), main.indexOf('function updateHud()'));
  const f = new Function('$', 'dock', 'player', 'document', 'updateHud', src + '\nreturn { syncHpBar, updatePlayerRepair, footHp };');
  const api = f((id) => (id === 'player-hp' ? bar : null), dock, player, { documentElement: root }, () => api.syncHpBar());
  return { ...api, bar };
}

test('t1724u one HP bar: #bt-hud has no second HP bar and no KOs / DOWNS clutter', () => {
  assert.doesNotMatch(battle, /class="hp"/);
  assert.doesNotMatch(battle, /#bt-hud \.hp/);
  assert.doesNotMatch(battle, /`KOs \$\{me\.kos\} · DOWNS/);
  assert.match(battle, /showH = STANCES_ON \? !!\(me\.arena \|\| me\.down > 0\)/); // open island: no #bt-hud at all
  assert.match(battle, /hpState: \(\) => \(\{ hp: me\.hp, maxHp: ARENA\.hp, repairing: !!me\.repairing/);
  assert.match(read('index.html'), /id="player-hp"/);
});

test('t1724u #player-hp shows on-foot HP on foot and ship HP once aboard', () => {
  const foot = { hp: 62, maxHp: 100, repairing: false };
  const dock = { on: true, onFoot: true, battle: { hpState: () => foot } };
  const player = { hp: 300, maxHp: 400, calm: 0, repT: 0 };
  const m = mainHp({ dock, player });
  m.syncHpBar(); assert.equal(m.bar.style.width, '62%');
  m.updatePlayerRepair(30); // a ship tick while on foot never overwrites the bar
  assert.equal(m.bar.style.width, '62%');
  foot.repairing = true; m.syncHpBar(); assert.ok(m.bar.parentElement.classList.has('repairing'));
  dock.onFoot = false; m.syncHpBar(); // boarded
  assert.match(m.bar.style.width, /^(75|80)%$/); // ship HP (300/400, or after the repair tick 320/400)
  assert.ok(m.bar.parentElement.classList.has('repairing')); // the ship has been calm 30 s: its own pulse
  const sea = mainHp({ dock: null, player: { hp: 50, maxHp: 100, calm: 0 } }); sea.syncHpBar(); assert.equal(sea.bar.style.width, '50%');
});

test('t1724u on foot: no regen at 6 s / 10 s / 19.9 s after a hit, regen from 20 s, a new hit restarts the wait', () => {
  assert.deepEqual({ ...FOOT_REGEN }, { wait: 20, every: 4, pct: 0.05 });
  const me = { hp: 40, lastHitT: 0, down: 0 };
  for (const t of [6, 10, 19.9]) { footRegenStep(me, 0.1, t); assert.equal(me.hp, 40, `t=${t}`); assert.equal(me.repairing, false); }
  footRegenStep(me, 0.1, 20); assert.equal(me.hp, 45); assert.equal(me.repairing, true);
  footRegenStep(me, 2, 22); assert.equal(me.hp, 45);
  footRegenStep(me, 2, 24); assert.equal(me.hp, 50);
  me.lastHitT = 25; me.hp = 30; me.repT = 0; me.repairing = false; // hit again (battle.js takeHit resets these)
  footRegenStep(me, 0.1, 30); footRegenStep(me, 0.1, 44.9); assert.equal(me.hp, 30);
  footRegenStep(me, 0.1, 45); assert.equal(me.hp, 35);
  let t = 45; while (t < 200) { t += 0.5; footRegenStep(me, 0.5, t); } assert.equal(me.hp, 100); assert.equal(me.repairing, false);
  const ko = { hp: 0, lastHitT: 0, down: 2 }; footRegenStep(ko, 1, 99); assert.equal(ko.hp, 0);
  // wiring: every on-foot hit + KO respawn + leaving reset the timer
  assert.match(battle, /me\.lastHitT = t; me\.repT = 0; me\.repairing = false;/);
  assert.match(battle, /me\.hp = ARENA\.hp; me\.repT = 0; me\.repairing = false; me\.down = 0;/);
  assert.match(battle, /footRegen\(dt\); \/\/ \[t1724u\]/);
  assert.doesNotMatch(battle, /t - me\.lastHitT > 6/);
});

test('t1724u ship PvP: incoming pirate hits reset calm; 20 s without a hit repairs in pvp mode', () => {
  assert.match(pvp, /function localDamage\([^)]*\) \{[\s\S]{0,400}K\.damage\(pl, amt/); // every remote cannonball / cliff gun
  assert.match(main, /if \(s === player\) \{ s\.calm = 0; s\.repT = 0;/);
  assert.match(main, /if \(game\.state === 'playing' && player\.alive\) \{[\s\S]{0,1200}updatePlayerRepair\(dt\);/); // not gated on mode
  const player = { hp: 50, maxHp: 100, calm: 0, repT: 0 };
  const m = mainHp({ player });
  for (let i = 0; i < 199; i++) m.updatePlayerRepair(0.1); assert.equal(player.hp, 50); // 19.9 s
  for (let i = 0; i < 50; i++) m.updatePlayerRepair(0.1); assert.equal(player.hp, 55); // 24.9 s: first +5%
  assert.ok(m.bar.parentElement.classList.has('repairing'));
  player.calm = 0; player.repT = 0; m.updatePlayerRepair(0.1); assert.ok(!m.bar.parentElement.classList.has('repairing'));
});
