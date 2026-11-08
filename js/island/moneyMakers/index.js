import { batchShopFront } from './staticBatch.js';
import { formatGoldAmount } from '../../goldFormat.js';
import { itemIconHtml } from '../../inventory/itemIcon.js';
// [v349 money-makers] BANKSY t203u "How else could they make money on island?" -> t204u "Add the first 5". Loaded with a dynamic
// import() from js/dock/index.js (the harbor preload list stays as it is). Everything here hangs off a few 1-line hooks:
//   dock/index.js   interact (q.mm) · the 'bounties' case · tick · netState / onPeer (the smuggler crate others can see + loot)
//   onfoot/battle.js  globalThis.PFP_PVE sword / musket checks · 'pfp-pvp-kill' / 'pfp-pvp-down' events
//   onfoot/walker.js  w.carryK (80% speed while hauling) · dock/zipline.js  w.noZipline (no ziplines while hauling)
//   dock/houses.js    globalThis.PFP_MM houseRoom / stillPrompt / stillAct (the copper rum still inside your cottage)
//   inventory/ui.js   'pfp-inv-render' (the ISLAND GOODS strip + SELL at the Fish Market / Treasure Trader)
// Gold: api.js (server first via migration 053 + island.ts, practice mode on this device otherwise).
import * as THREE from 'three';
import * as C from './config.js';
import * as P from './props.js';
import { createEnemies } from './enemies.js';
import { shopFront } from './shopFronts.js';
import { createMMApi, rid } from './api.js';
import { createMMUi, esc, gfmt } from './ui.js';
import { ISLAND_GOODS, islKey, islPrice, ISL_SHOP_NAMES } from '../../inventory/islandGoods.js';
import { RENTABLE_SHOPS as HILL_RENTABLE } from '../hillShops.js';
import { VILLAGE_RENTABLE } from '../village.js';   // [post-village v3] the village rentals use the same rent-shop data path
const RENTABLE_SHOPS = [...HILL_RENTABLE, ...VILLAGE_RENTABLE];
import { t2w, t2wYaw, toHarbor } from '../coast.js';
// [v372] BANKSY t1973u "move each stand into an empty rental shop": the counter stands move off the plaza / wharf / concourse into empty
// hill-street rent shops (rent_1 = the Treasure Trader, so never that one). Each stand sits against the shop's back wall facing the door,
// on the shop floor (floorY follows the street slope); the E prompt is in front of it, inside. A name board hangs over each shop door.
const inShop = (id, name) => { const S = RENTABLE_SHOPS.find(r => r.id === id); if (!S) return null; const I = S.interior, f = Math.sin(S.facing) >= 0 ? 1 : -1;
  const lx = f > 0 ? I.lx0 + 1.5 : I.lx1 - 1.5, lz = S.lz, y = I.floorY.atLz0 + (lz - I.lz0) / (I.lz1 - I.lz0) * (I.floorY.atLz1 - I.floorY.atLz0);
  const [x, z] = toHarbor(...t2w(lx, lz)), ry = t2wYaw(S.facing), [dx, dz] = toHarbor(...t2w(S.door.lx + f * 1.1, S.door.lz));
  return { x, z, y: y + 0.02, ry, fx: Math.sin(ry), fz: Math.cos(ry), shop: id, name, door: { x: dx, z: dz, y: S.doorY, out: 1.1 } }; };

export const MM_ON = C.MM_ON;
// ---------------- where everything stands (harbor frame; checked flush + off the paths, see tools in the v349 report) ----------------
export const SITES = {
  wanted: inShop('rent_2', 'WANTED BOARD') || { x: 298, z: 58.6, ry: 0 },          // [v372] hill-street shop L1 (was Harbor Plaza)
  fight: inShop('rent_16', 'FIGHT MASTER') || { x: 374, z: 106.5, ry: 0 },         // [v372] hill-street shop R5 by the coliseum (was the concourse)
  arena: { x: 374, z: 106.5 },                                         // prize-fight foes still spawn on the coliseum concourse
  horde: { x: 374.5, z: 124, r: 7 },                                  // the Skeleton Horde ring on the concourse floor
  rum: inShop('rent_3', 'RUM EXPORT') || { x: 297, z: 160, ry: -Math.PI / 2 },   // [v372] hill-street shop L2 (was the wharf)
  crates: { wharf: { x: 258, z: 150, ry: Math.PI / 2, name: 'Harbor Wharf' }, cove: { x: 1086, z: 430, ry: Math.PI / 2, name: "Smugglers' Cove" } },
  buyers: { fort: { x: 474, z: 104, ry: Math.PI / 2, name: 'Fort Quartermaster' }, jungle: { x: 884, z: -228, ry: Math.PI / 2, name: 'Jungle Outpost' }, harbor: { ...(inShop('rent_4', 'HARBOR FENCE') || { x: 300, z: 140, ry: -Math.PI / 2 }), name: 'Harbor Fence' } },   // [v372] harbor fence: hill-street shop L3
  raiders: { x: 1096, z: 446, r: 9 }, stalkers: { x: 930, z: -300, r: 9 },
  dive: [{ id: 'wreck_a', x: 1135, z: 460, kind: 'chest', where: 'Dead Man\'s Cove wreck' }, { id: 'wreck_b', x: 1152, z: 448, kind: 'chest', where: 'Dead Man\'s Cove wreck' },
    { id: 'wreck_c', x: 1146, z: 468, kind: 'clam', where: 'Dead Man\'s Cove wreck' }, { id: 'lagoon_a', x: 680, z: 15, kind: 'clam', where: 'Lagoon' }, { id: 'lagoon_b', x: 690, z: 26, kind: 'clam', where: 'Lagoon' }],
  pots: [{ id: 'quay_a', x: 245.4, z: 127.5 }, { id: 'quay_b', x: 245.4, z: 133 }, { id: 'quay_c', x: 245.4, z: 156 }],
  mine: [{ id: 'iron', x: 975.1, z: 340.5, ry: Math.PI / 2, kind: 'iron' }, { id: 'saltpeter', x: 984.9, z: 344.5, ry: -Math.PI / 2, kind: 'saltpeter' }, { id: 'gold', x: 981.8, z: 349.7, ry: Math.PI, kind: 'gold' }],
};
export const ROUTES = [
  { id: 'wharf_std', from: 'wharf', to: 'fort', tier: 'standard' }, { id: 'wharf_cut', from: 'wharf', to: 'jungle', tier: 'cutthroat' },
  { id: 'cove_std', from: 'cove', to: 'jungle', tier: 'standard' }, { id: 'cove_cut', from: 'cove', to: 'harbor', tier: 'cutthroat' },
];
const plotSpot = (c, door) => { // behind the cottage: centre - (door - centre) direction, 2.4 m past its back wall
  const dx = door.x - c.x, dz = door.z - c.z, d = Math.hypot(dx, dz) || 1, back = d + 2.6; return { x: c.x - dx / d * back, z: c.z - dz / d * back, ry: Math.atan2(dx, dz) }; };

export function createMoneyMakers(ctx) {
  const { scene, world, layout, walker, pirate, battle, houses, fnet, game, toast, sfx, touch } = ctx;
  if (!C.MM_ON) return null;
  const root = new THREE.Group(); root.name = 'mm_money_makers'; world.root.add(root);
  const api = createMMApi({ pvp: ctx.pvp, game, updateHud: ctx.updateHud, sfx });
  const ui = createMMUi();
  const G = (x, z) => world.ground(x, z);
  const put = (o, x, z, ry = 0, y = null) => { o.position.set(x, y ?? G(x, z), z); o.rotation.y = ry; root.add(o); if(o.isGroup) batchShopFront(o); return o; };
  const myName = () => { try { return ctx.pvp?.()?.name || 'PIRATE'; } catch { return 'PIRATE'; } };
  const W = () => walker.w;
  const say = (m, ms = 2200) => toast?.(m, ms);
  const spots = [];   // interact points (world.footInteract): { id, kind: 'mm', mm, x, z, r, label, used }
  const spot = (id, mm, x, z, r, label, extra = {}) => { const q = { id: 'mm_' + id, kind: 'mm', mm, x, z, r, label, used: false, ...extra }; spots.push(q); world.footInteract.push(q); return q; };

  // ======================= props =======================
  const fx = (S, d) => S.x + (S.fx ?? 0) * d, fz = (S, d) => S.z + (S.fz ?? 1) * d;   // [v372] a point d m in front of a stand (toward the shop door)
  const FRONT = { 'WANTED BOARD': 'wanted', 'FIGHT MASTER': 'fight', 'RUM EXPORT': 'rum', 'HARBOR FENCE': 'fence' };
  const FRONT_ID = { rent_2: 'wanted', rent_16: 'fight', rent_3: 'rum', rent_4: 'fence' };   // [hill-shopfronts] by shop id (the fence site is named 'Harbor Fence')
  const doorBoard = (S) => { if (!S.door) return null; try { const f = shopFront(S, FRONT_ID[S.shop] || FRONT[S.name]); if (f) { batchShopFront(f); root.add(f); } return f; } catch (e) { console.warn('[mm-front]', e); return null; } };   // [v373] dressed shop fronts
  // [hill-shopfronts v3] in the 4 hill-street shops the business is FITTED into the room (shopFronts.js interior: joinery + counter + the wanted board /
  // the gong); the freestanding v349 stall prop is only built where there is no shop (or if the fitted room failed). E spots below are unchanged.
  const fitted = (S, make) => (S.door && doorBoard(S)) || make();
  const wanted = fitted(SITES.wanted, () => put(P.wantedBoard(), SITES.wanted.x, SITES.wanted.z, SITES.wanted.ry, SITES.wanted.y)); spot('wanted', 'board', fx(SITES.wanted, 1.6), fz(SITES.wanted, 1.6), 3.0, 'WANTED BOARD · CONTRACTS + BOUNTIES');
  const fm = fitted(SITES.fight, () => put(P.fightMaster(), SITES.fight.x, SITES.fight.z, SITES.fight.ry, SITES.fight.y)); spot('fight', 'coliseum', fx(SITES.fight, 1.6), fz(SITES.fight, 1.6), 3.0, 'FIGHT MASTER · PRIZE FIGHTS · BETS · HORDE');
  const hordeRing = put(P.ring(SITES.horde.r, 0xb3121a), SITES.horde.x, SITES.horde.z); hordeRing.position.y += 0.06; hordeRing.visible = false;
  fitted(SITES.rum, () => put(P.rumStall(), SITES.rum.x, SITES.rum.z, SITES.rum.ry, SITES.rum.y)); spot('rum', 'rum', fx(SITES.rum, 1.4), fz(SITES.rum, 1.4), 3.0, 'HARBOR RUM EXPORT STALL · SELL RUM');
  for (const [k, s] of Object.entries(SITES.crates)) { put(P.crateStack(k === 'cove' ? "COVE CONTRABAND" : 'WHARF CONTRABAND'), s.x, s.z, s.ry); spot('crate_' + k, 'crate', s.x, s.z, 3.2, `SMUGGLER CRATES · ${s.name.toUpperCase()}`, { from: k }); }
  const buyerMk = {};
  for (const [k, s] of Object.entries(SITES.buyers)) { fitted(s, () => put(P.buyerPost(s.name.toUpperCase(), k === 'fort' ? '#2a4a6a' : k === 'jungle' ? '#2a5a2a' : '#5a2a2a'), s.x, s.z, s.ry, s.y));
    const ringM = put(P.ring(s.door ? 2.4 : C.CRATE.deliverR, 0xffcd77), s.x, s.z, 0, s.y); ringM.position.y += 0.08; const bc = put(P.beacon(), s.door ? s.door.x : s.x, s.door ? s.door.z : s.z, 0, s.door ? s.door.y : null); ringM.visible = bc.visible = false; buyerMk[k] = { ring: ringM, beacon: bc };
    spot('buyer_' + k, 'buyer', s.x, s.z, C.CRATE.deliverR, `${s.name.toUpperCase()} · DELIVER CRATE`, { to: k }); }
  const diveM = {};
  for (const d of SITES.dive) { const o = d.kind === 'chest' ? P.wreckChest() : P.clam(); put(o, d.x, d.z, d.x % 3); const bub = P.diveBuoy(); const wy = world.water(d.x, d.z); put(bub, d.x + 1.2, d.z, 0, (wy ?? G(d.x, d.z))); diveM[d.id] = { o, bub };
    spot('dive_' + d.id, 'dive', d.x, d.z, 3.4, d.kind === 'chest' ? 'DIVE · PRY THE WRECK CHEST' : 'DIVE · PRY THE GIANT CLAM', { d }); }
  const potM = {};
  for (const p of SITES.pots) { const o = put(P.crabPot(), p.x, p.z, 0); const lb = P.label(''); lb.position.y = 1.55; o.add(lb); potM[p.id] = { o, lb }; spot('pot_' + p.id, 'pot', p.x, p.z, 2.4, 'SET CRAB POT', { p }); }
  const mineM = {};
  for (const m of SITES.mine) { const K = C.MINE.kinds[m.kind]; const o = put(P.oreVein(m.kind, K.color, K.glow), m.x, m.z, m.ry); mineM[m.id] = { o }; spot('mine_' + m.id, 'mine', m.x, m.z, 2.6, `MINE ${m.kind.toUpperCase()} VEIN`, { m }); }
  const plotM = {};
  try { const cs = houses?.cottages?.() || [], doors = houses?.doors || [];
    for (const c of cs) { const door = doors.find(d => d.id === c.id); if (!door) continue; const [hx, hz] = layout.footToHarbor(c.x, c.z); const ps = plotSpot({ x: hx, z: hz }, door);
      const o = put(P.spicePlot(), ps.x, ps.z, ps.ry); const lb = P.label(''); lb.position.y = 2.1; o.add(lb); plotM[c.id] = { o, lb, x: ps.x, z: ps.z, name: c.name || c.id };
      spot('plot_' + c.id, 'plot', ps.x, ps.z, 2.6, 'SPICE PLOT', { cid: c.id }); } } catch (e) { console.warn('[money-makers] plots', e); }
  // the crate on your back + dropped crates (yours / a peer's)
  const myCrate = P.carriedCrate(); myCrate.visible = false;
  const drops = new Map();  // key -> { o, x, z, tier, run, until, peer }
  const peerCr = new Map(); // peer id -> mesh on their back

  // ======================= enemies (PvE) =======================
  const pve = createEnemies({ root, ground: G, blocked: (x, z) => world.blocked(x, z), me: () => ({ x: W().x, z: W().z, alive: walkerOn() && !(battle?.me?.down > 0) && !houses?.inHouse }),
    hurt: (n, kind) => hurt(n, kind) });
  globalThis.PFP_PVE = { sword: (Wk, f, S) => pve.sword(Wk, f, S), shot: (x, z, f, best, dmg) => pve.shot(x, z, f, best, dmg), list: pve.list };
  const walkerOn = () => !!(ctx.onFoot?.() && W().active);
  function hurt(n, kind) {
    const me = battle?.me; if (!me || me.down > 0 || (me.guard || 0) > 0) return;
    me.hp = Math.max(0, (me.hp ?? 100) - n); me.lastHitT = performance.now() / 1000; try { sfx?.playerHit?.(0.6); } catch {}
    if (me.hp <= 0) { me.hp = 100; overwhelmed(kind); }
  }
  function overwhelmed(kind) {
    const H = horde; if (H.on) { endHorde(false, 'the horde overwhelmed you'); }
    if (carry) dropCrate('ko');
    const w = W(), s = kind === 'gladiator' || kind === 'captain' ? SITES.arena : kind === 'stalker' ? SITES.buyers.jungle : SITES.crates.cove; const x = s.x + 2, z = s.z + 2;
    w.x = x; w.z = z; w.y = G(x, z); walker.snapCam?.(); battle.me.guard = 3;
    say('💀 OVERWHELMED<small>you crawl back to safety · no haul lost</small>', 2400);
  }
  addEventListener('pfp-pve-kill', (e) => { const k = e.detail?.kind; if (!k) return; const pr = api.onKill(k);
    const c = C.CONTRACTS.find(c => c.kind === k); if (c && (pr[c.id] | 0) <= c.need && !api.st.claimed[c.id]) say(`${c.icon} ${c.name.toUpperCase()} ${pr[c.id]}/${c.need}${pr[c.id] >= c.need ? '<small>contract done · claim it at the WANTED board</small>' : ''}`, 1500);
    if (horde.on && e.detail.tag === 'horde') horde.kills++; });

  // camps: keep raiders / stalkers topped up while you are near (perf: nothing when far)
  const camps = [{ kind: 'raider', s: SITES.raiders, n: 5, tag: 'raiders', t: 0 }, { kind: 'stalker', s: SITES.stalkers, n: 4, tag: 'stalkers', t: 0 }];
  function tickCamps(dt) { const w = W();
    for (const c of camps) { const d = Math.hypot(w.x - c.s.x, w.z - c.s.z), al = pve.alive(c.tag).length;
      if (d > 140) { if (al) pve.clear(c.tag); continue; }
      c.t -= dt; if (al < c.n && c.t <= 0 && d > 14) { c.t = al === 0 ? 0 : 7; const a = Math.random() * 6.28, r = Math.random() * c.s.r; const x = c.s.x + Math.cos(a) * r, z = c.s.z + Math.sin(a) * r;
        if (!world.blocked(x, z) && world.water(x, z) == null) pve.spawn(c.kind, x, z, { home: [c.s.x, c.s.z], leash: c.s.r + 8, tag: c.tag }); } } }

  // ======================= 1. WANTED board: contracts + bounties =======================
  let board = { wanted: [], duels: [], claims: [] }, boardAt = 0, tab = 'contracts', lastClaimSeen = '';
  async function pullBoard(force = false) { if (!force && performance.now() - boardAt < 8000) return board; boardAt = performance.now();
    const r = await api.call('isl_board'); if (r?.ok && !r.practice) { board = { wanted: r.wanted || [], duels: r.duels || [], claims: r.claims || [] }; wanted.userData.setPosters(board.wanted.slice(0, 3));
      const c = board.claims[0]; const sig = c ? `${c.killer}:${c.target}:${c.at}` : ''; if (c && sig !== lastClaimSeen && lastClaimSeen !== '') say(`🪙 BOUNTY CLAIMED<small>${esc(c.killer)} took ${gfmt(c.gold)} for ${esc(c.target)}</small>`, 3000); lastClaimSeen = sig; }
    return board; }
  const practiceNote = () => api.live === false ? '<div class="mm-prac">⚓ PRACTICE MODE · the island gold server is offline here: contracts, hauls and goods pay this device. Bounties, prize fights + bets open when it is live.</div>' : '';
  function boardView() {
    return { html: () => {
      const cs = api.contracts(); let h = `<h2>☠ WANTED BOARD</h2><div class="mm-sub">daily contracts · live bounties on pirates</div>${practiceNote()}<div class="mm-tabs"><button data-a="t:contracts" class="${tab === 'contracts' ? 'on' : ''}">CONTRACTS</button><button data-a="t:wanted" class="${tab === 'wanted' ? 'on' : ''}">WANTED</button><button data-a="t:post" class="${tab === 'post' ? 'on' : ''}">POST A BOUNTY</button></div>`;
      if (tab === 'contracts') h += cs.map(c => `<div class="mm-row"><div class="ic">${c.icon}</div><div class="tx">${c.name}<small>${c.where} · ${c.prog}/${c.need}</small><div class="mm-bar"><i style="width:${Math.round(100 * c.prog / c.need)}%"></i></div></div><div class="g">${gfmt(c.gold)}</div><button class="mm-btn grn" data-a="claim:${c.id}" ${c.done && !c.claimed ? '' : 'disabled'}>${c.claimed ? 'PAID ✓' : 'CLAIM'}</button></div>`).join('') + '<div class="mm-note">progress resets at midnight (Indianapolis) · each pays once a day</div>';
      else if (tab === 'wanted') h += (board.wanted.length ? board.wanted.map(w => `<div class="mm-row"><div class="ic">💀</div><div class="tx">${esc(w.name)}<small>${w.posts | 0} poster${(w.posts | 0) === 1 ? '' : 's'} · KO them outside a Safe Zone</small></div><div class="g">${gfmt(w.pot)}</div></div>`).join('') : '<div class="mm-note">no bounties posted · be the first</div>')
        + (board.claims.length ? `<div class="mm-note">recent: ${board.claims.slice(0, 3).map(c => `${esc(c.killer)} → ${esc(c.target)} ${gfmt(c.gold)}`).join(' · ')}</div>` : '');
      else { const me0 = C.nameKey(myName() || ''), names = [...new Set([...(fnet?.peers?.values?.() || [])].map(p => p.name).concat((() => { try { return window.PFP_PVP?.playerNames?.() || []; } catch { return []; } })()).map(n => String(n || '').trim()).filter(n => n && C.nameKey(n) !== me0))].sort((x, y) => x.localeCompare(y)).slice(0, 60);   // [v370] BANKSY t1968u: pick a pirate in YOUR server (no typing)
        h += `<div class="mm-note">your gold goes into the pot on their head · whoever KOs them takes it all · ${C.BOUNTY.min}-${formatGoldAmount(C.BOUNTY.max)}g</div><div class="mm-inline">${names.length ? `<select id="mm-bt"><option value="">☠ PICK A PIRATE (${names.length} IN THIS SERVER)</option>${names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select>` : `<div class="mm-note">no other pirates in this server right now</div>`}</div>
          <div class="mm-inline">${C.BOUNTY.stakes.map(s => `<button class="mm-btn red" data-a="post:${s}" ${api.live === false ? 'disabled' : ''}>POST ${gfmt(s)}</button>`).join('')}</div>`; }
      return h; },
      act: async (a, b, body) => { if (a.startsWith('t:')) { tab = a.slice(2); if (tab !== 'contracts') await pullBoard(true); ui.draw(); return; }
        if (a.startsWith('claim:')) { b.disabled = true; const id = a.slice(6); const r = await api.call('isl_contract', { contract: id }); if (r?.ok) { api.st.claimed[id] = 1; api.save(); say(`📜 CONTRACT PAID · +${gfmt(r.delta || r.paid || C.CONTRACT_BY_ID[id].gold)}`); } else say(why(r)); ui.draw(); return; }
        if (a.startsWith('post:')) { const t = (body.querySelector('#mm-bt')?.value || '').trim(); if (!t) { say('PICK A PIRATE FIRST'); return; } b.disabled = true;
          const r = await api.call('isl_bounty_post', { target: t, amount: +a.slice(5), name: myName() }); if (r?.ok) say(`☠ BOUNTY POSTED<small>${esc(t)} · pot ${gfmt(r.pot)}</small>`, 2600); else say(why(r)); await pullBoard(true); tab = 'wanted'; ui.draw(); } } };
  }
  function openBoard() { tab = 'contracts'; ui.open(boardView()); pullBoard(true).then(() => ui.view && ui.draw()); }
  // a KO of a wanted pirate claims their pot (the server pays only a real pot, never on yourself, rate-limited)
  addEventListener('pfp-pvp-kill', async (e) => { const n = e.detail?.name; if (!n) return;
    if (duel.id && duel.status === 'live' && C.nameKey(n) === C.nameKey(duel.opp)) settleDuel('won');
    if (api.live === false) return; await pullBoard(false); const w = board.wanted.find(x => C.nameKey(x.name) === C.nameKey(n)); if (!w) return;
    if (ctx.insideSafe?.(W().x, W().z)) return;
    // the server pays only once the KO is confirmed by both sides on the kill board (claimKill), so wait for it: now, +4 s, +10 s, +20 s
    for (const wait of [1500, 4000, 6000, 10000]) { await new Promise(res => setTimeout(res, wait)); const r = await api.call('isl_bounty_claim', { target: n, name: myName() });
      if (r?.ok) { if ((r.claimed | 0) > 0) say(`🪙 BOUNTY CLAIMED · +${gfmt(r.claimed)}<small>${esc(n)} is no longer wanted</small>`, 3000); break; }
      if (r?.error !== 'no confirmed kill') break; }
    pullBoard(true); });
  addEventListener('pfp-pvp-down', (e) => { const by = e.detail?.by; if (carry) dropCrate('ko'); if (duel.id && duel.status === 'live' && by && C.nameKey(by) === C.nameKey(duel.opp)) settleDuel('lost'); });

  // ======================= 2. COLISEUM: prize fights, ringside bets, Skeleton Horde =======================
  const duel = { id: null, side: null, opp: '', stake: 0, status: '', t: 0 };
  let cTab = 'fights';
  function coliView() {
    return { html: () => {
      let h = `<h2>⚔ THE COLISEUM</h2><div class="mm-sub">1v1 prize fights in the Sword Pit · ringside bets · the Skeleton Horde</div>${practiceNote()}<div class="mm-tabs"><button data-a="t:fights" class="${cTab === 'fights' ? 'on' : ''}">PRIZE FIGHTS</button><button data-a="t:horde" class="${cTab === 'horde' ? 'on' : ''}">SKELETON HORDE</button></div>`;
      if (cTab === 'fights') {
        if (duel.id) h += `<div class="mm-row"><div class="ic">🏟️</div><div class="tx">YOUR FIGHT · ${duel.status === 'live' ? `vs ${esc(duel.opp)} · LIVE` : 'waiting for a challenger'}<small>pot ${gfmt(C.duelPot(duel.stake))} · KO them in the Sword Pit</small></div>${duel.status === 'open' ? '<button class="mm-btn" data-a="cancel">CANCEL</button>' : ''}</div>`;
        else h += `<div class="mm-note">stake gold · a challenger matches it · the winner takes the pot</div><div class="mm-inline">${C.DUEL.stakes.map(s => `<button class="mm-btn red" data-a="post:${s}" ${api.live === false ? 'disabled' : ''}>FIGHT FOR ${gfmt(s)}</button>`).join('')}</div>`;
        const ds = board.duels.filter(d => d.status === 'open' || d.status === 'live' || d.status === 'done');
        h += ds.length ? ds.map(d => `<div class="mm-row"><div class="tx"><div class="mm-vs"><span class="r">${esc(d.red)}</span><span>vs</span><span class="b">${esc(d.blue || '???')}</span></div><small>${d.status === 'done' ? `🏆 ${esc(d.winner === 'r' ? d.red : d.blue)} won ${gfmt(d.stake * 2)}` : `stake ${gfmt(d.stake)} · bets 🔴 ${gfmt(d.pool_r)} · 🔵 ${gfmt(d.pool_b)}`}</small></div>
            ${d.status === 'open' && d.id !== duel.id && C.nameKey(d.red) !== C.nameKey(myName()) ? `<button class="mm-btn red" data-a="accept:${d.id}">ACCEPT</button>` : ''}
            ${(d.status === 'open' || (d.status === 'live' && (d.live_s ?? 99) < C.DUEL.betWindowS)) && d.id !== duel.id ? `<button class="mm-btn" data-a="bet:${d.id}:r">BET 🔴</button><button class="mm-btn" data-a="bet:${d.id}:b">BET 🔵</button>` : ''}</div>`).join('')
          : '<div class="mm-note">no fights posted right now</div>';
        h += `<div class="mm-inline"><span class="mm-note">ringside bet</span><select id="mm-bet">${[50, 100, 250, 500].map(v => `<option value="${v}">${gfmt(v)}</option>`).join('')}</select><span class="mm-note">winners split the whole pool</span></div>`;
      } else {
        const runsLeft = Math.max(0, C.HORDE.runsPerDay - (api.st.hordeRuns | 0));
        h += C.HORDE.waves.map((w, i) => `<div class="mm-row"><div class="ic">${w.cap ? '☠️' : '💀'}</div><div class="tx">WAVE ${i + 1} · ${w.n} gladiators${w.cap ? ' + a Cursed Captain' : ''}</div><div class="g">${gfmt(C.HORDE.gold[i])}</div></div>`).join('')
          + `<div class="mm-row"><div class="ic">🏆</div><div class="tx">CHAMPION · clear all 5<small>${gfmt(C.hordeRunGold())} a full run · ${C.HORDE.runsPerDay} paid runs a day</small></div><div class="g">+${gfmt(C.HORDE.champion)}</div></div>
          <div class="mm-inline"><button class="mm-btn red" data-a="horde" ${horde.on || runsLeft <= 0 ? 'disabled' : ''}>${horde.on ? 'HORDE IN PROGRESS' : runsLeft > 0 ? 'STRIKE THE GONG · START' : 'COME BACK TOMORROW'}</button><span class="mm-note">${runsLeft} run${runsLeft === 1 ? '' : 's'} left today · stay inside the red ring</span></div>`;
      }
      return h; },
      act: async (a, b, body) => {
        if (a.startsWith('t:')) { cTab = a.slice(2); ui.draw(); return; }
        if (a === 'horde') { ui.close(); startHorde(); return; }
        if (a === 'cancel') { const r = await api.call('isl_duel_settle', { duel: duel.id, result: 'cancel' }); if (r?.ok) { say('FIGHT CANCELLED · STAKE REFUNDED'); duel.id = null; } else say(why(r)); await pullBoard(true); ui.draw(); return; }
        if (a.startsWith('post:')) { b.disabled = true; const s = +a.slice(5); const r = await api.call('isl_duel_post', { stake: s, name: myName() });
          if (r?.ok) { Object.assign(duel, { id: r.duel, side: 'r', stake: s, status: 'open', opp: '', t: performance.now() }); say(`🏟️ FIGHT POSTED · ${gfmt(s)}<small>waiting for a challenger</small>`); } else say(why(r)); await pullBoard(true); ui.draw(); return; }
        if (a.startsWith('accept:')) { b.disabled = true; const id = a.slice(7); const r = await api.call('isl_duel_accept', { duel: id, name: myName() });
          if (r?.ok) { Object.assign(duel, { id, side: 'b', stake: r.stake, status: 'live', opp: r.red || '', t: performance.now() }); ui.close(); toPit(); say(`⚔ PRIZE FIGHT vs ${esc(r.red)}<small>pot ${gfmt(C.duelPot(r.stake))} · KO them!</small>`, 2600); } else say(why(r)); await pullBoard(true); if (ui.isOpen) ui.draw(); return; }
        if (a.startsWith('bet:')) { const [, id, side] = a.split(':'); const amt = +(body.querySelector('#mm-bet')?.value || 50); b.disabled = true;
          const r = await api.call('isl_bet', { duel: id, side, amount: amt, name: myName() }); if (r?.ok) say(`🎲 BET ${gfmt(amt)} ON ${side === 'r' ? '🔴 RED' : '🔵 BLUE'}`); else say(why(r)); await pullBoard(true); ui.draw(); return; } } };
  }
  function openColiseum() { cTab = 'fights'; ui.open(coliView()); pullBoard(true).then(() => ui.view && ui.draw()); }
  function toPit() { try { const w = W(), x = 351 + (duel.side === 'r' ? -6 : 6), z = 121; w.x = x; w.z = z; w.y = G(x, z); w.yaw = w.camYaw = duel.side === 'r' ? Math.PI / 2 : -Math.PI / 2; walker.snapCam?.(); } catch {} }
  async function settleDuel(result) { if (!duel.id || duel.settling) return; duel.settling = true; const r = await api.call('isl_duel_settle', { duel: duel.id, result }); duel.settling = false;
    if (!r?.ok && /confirm/.test(String(r?.error || ''))) { say(`⚔ KO!<small>waiting for ${esc(duel.opp)}'s side to confirm · unconfirmed fights refund after 10 min</small>`, 2600); return; } // [review fix 3]
    if (r?.ok) { const won = r.you_won ?? result === 'won'; say(won ? `🏆 PRIZE FIGHT WON · +${gfmt(r.pot || C.duelPot(duel.stake))}` : '💀 PRIZE FIGHT LOST<small>better luck in the pit</small>', 3000); duel.id = null; duel.status = ''; pullBoard(true); } }
  let creditSince = 0;
  async function pollDuel() { // the challenger arrived / your bets + wins landed (credits since last poll)
    if (api.live !== true) return; await pullBoard(true);
    if (duel.id) { const d = board.duels.find(x => x.id === duel.id); if (d && d.status === 'live' && duel.status !== 'live') { duel.status = 'live'; duel.opp = duel.side === 'r' ? d.blue : d.red; toPit(); say(`⚔ ${esc(duel.opp)} ACCEPTED YOUR FIGHT<small>pot ${gfmt(C.duelPot(duel.stake))} · KO them in the pit!</small>`, 3000); }
      if (d && d.status === 'done') { duel.id = null; duel.status = ''; }
      else if (d && d.status === 'live' && (d.live_s | 0) > 605) { const r = await api.call('isl_duel_settle', { duel: d.id, result: 'cancel' }); if (r?.ok) { say('⚔ FIGHT EXPIRED · STAKES REFUNDED', 2400); duel.id = null; duel.status = ''; } } /* [review fix 3] timeout refund */ if (!d && performance.now() - duel.t > 15 * 60e3) duel.id = null; }
    const st = await api.call('isl_state', { since: creditSince }); if (!st?.ok || st.practice) return;
    const cr = (st.credits || []).filter(c => c.delta > 0); if (creditSince) for (const c of cr) say(`🪙 +${gfmt(c.delta)} · ${String(c.kind).replace('_', ' ').toUpperCase()}`, 2400);
    if (creditSince && cr.length && st.gold != null) { try { ctx.pvp?.()?.serverGold?.(st.gold, { rev: st.rev, owner: !!st.owner }); } catch {} } // a duel / bet win landed on the server: re-base
    creditSince = st.last_id || creditSince;
  }
  // ---- the Skeleton Horde ----
  const horde = { on: false, run: '', wave: 0, next: 0, kills: 0, paid: 0, cool: 0 };
  function startHorde() {
    if (horde.on) return; const now = performance.now() / 1000; if (now < horde.cool) { say(`THE GONG IS STILL RINGING · ${Math.ceil(horde.cool - now)}s`); return; }
    if ((api.st.hordeRuns | 0) >= C.HORDE.runsPerDay) { say('THE HORDE IS SPENT FOR TODAY'); return; }
    Object.assign(horde, { on: true, run: rid('horde'), wave: 0, next: now + 3, kills: 0, paid: 0 }); hordeRing.visible = true;
    api.st.hordeRuns = (api.st.hordeRuns | 0) + 1; api.save(); fm.userData.gong.rotation.z = 0.4; try { sfx?.cannon?.(0.25); } catch {}
    const w = W(), x = SITES.horde.x, z = SITES.horde.z + 3; w.x = x; w.z = z; w.y = G(x, z); walker.snapCam?.(); if (battle?.setStance && !(battle.stance > 0)) try { battle.setStance(1, true); } catch {}
    say('🔔 THE SKELETON HORDE RISES<small>5 waves · stay inside the red ring</small>', 2600);
  }
  function spawnWave(n) { const w = C.HORDE.waves[n - 1]; for (let i = 0; i < w.n; i++) { const a = (i / w.n) * 6.28 + Math.random() * 0.4, r = SITES.horde.r - 1; pve.spawn('gladiator', SITES.horde.x + Math.cos(a) * r, SITES.horde.z + Math.sin(a) * r, { tag: 'horde', hp: w.hp, home: [SITES.horde.x, SITES.horde.z], leash: 30, aggro: 40 }); }
    if (w.cap) pve.spawn('captain', SITES.horde.x, SITES.horde.z - SITES.horde.r + 1.2, { tag: 'horde', hp: C.HORDE.captainHp, home: [SITES.horde.x, SITES.horde.z], leash: 30, aggro: 40 }); }
  async function payWave(n) { const r = await api.call('isl_horde', { run: horde.run, wave: n }); if (r?.ok) { const g = r.delta | 0; horde.paid += g; say(`💀 WAVE ${n} CLEARED · +${gfmt(g)}${n === 5 ? '<small>🏆 HORDE CHAMPION!</small>' : `<small>wave ${n + 1} in 12s</small>`}`, 2600); } else say(`WAVE ${n} CLEARED<small>${why(r)}</small>`); }
  function endHorde(won, msg) { if (!horde.on) return; horde.on = false; hordeRing.visible = false; pve.clear('horde'); horde.cool = performance.now() / 1000 + (C.MM_FAST ? 5 : C.HORDE.cooldownS); fm.userData.gong.rotation.z = 0;
    if (!won) say(`☠ HORDE OVER · ${msg}<small>you kept ${gfmt(horde.paid)}</small>`, 2800); }
  function tickHorde() { if (!horde.on) return; const now = performance.now() / 1000, w = W();
    if (Math.hypot(w.x - SITES.horde.x, w.z - SITES.horde.z) > SITES.horde.r + 9) { endHorde(false, 'you left the ring'); return; }
    const al = pve.alive('horde').length;
    if (horde.wave > 0 && al === 0 && horde.next === 0) { const n = horde.wave; payWave(n); if (n >= 5) { horde.on = false; endHorde(true); return; } horde.next = now + 12.5; }
    if (horde.next && now >= horde.next) { horde.next = 0; horde.wave++; spawnWave(horde.wave); say(`💀 WAVE ${horde.wave}/5${C.HORDE.waves[horde.wave - 1].cap ? '<small>a CURSED CAPTAIN leads them</small>' : ''}`, 1600); }
  }

  // ======================= 3. SMUGGLER CRATE RUNS =======================
  let carry = null; // { tier, route, to, run, t0, pvpM, lx, lz, buyer }
  function crateView(from) {
    return { html: () => `<h2>📦 SMUGGLER CRATES</h2><div class="mm-sub">${SITES.crates[from].name} · haul one to a buyer · 80% speed · no ziplines · drop it if you're KO'd</div>${practiceNote()}`
      + ROUTES.filter(r => r.from === from).map(r => { const b = SITES.buyers[r.to], d = Math.round(Math.hypot(b.x - SITES.crates[from].x, b.z - SITES.crates[from].z));
        return `<div class="mm-row"><div class="ic">${r.tier === 'cutthroat' ? '☠️' : '📦'}</div><div class="tx">${C.CRATE.tiers[r.tier].name}<small>→ ${b.name} · ${d} m${r.tier === 'cutthroat' ? ` · ${C.CRATE.tiers.cutthroat.pvpMeters} m+ through PvP ground or it pays ${gfmt(C.crateGold('standard'))}` : ''}</small></div><div class="g">${gfmt(C.crateGold(r.tier))}</div><button class="mm-btn ${r.tier === 'cutthroat' ? 'red' : ''}" data-a="take:${r.id}" ${carry ? 'disabled' : ''}>HAUL</button></div>`; }).join('')
      + `<div class="mm-note">${(api.st.crates | 0)}/${C.CRATE.perDay} paid hauls today</div>`,
      act: (a) => { if (a.startsWith('take:')) { const r = ROUTES.find(x => x.id === a.slice(5)); ui.close(); takeCrate(r); } } };
  }
  function takeCrate(r, from = null) {
    if (carry || !r) return; const b = SITES.buyers[r.to]; const w = W();
    carry = { tier: r.tier, route: r.id, to: r.to, run: from?.run || rid('crate'), t0: performance.now(), pvpM: from?.pvpM || 0, lx: w.x, lz: w.z, buyer: b.name };
    pirate.object.add(myCrate); myCrate.visible = true; w.carryK = C.CRATE.speedK; w.noZipline = true; buyerMk[r.to].ring.visible = buyerMk[r.to].beacon.visible = true;
    say(`📦 CONTRABAND ABOARD<small>deliver to the ${b.name}</small>`, 2200);
  }
  function stopCarry() { const w = W(); if (carry) { buyerMk[carry.to].ring.visible = buyerMk[carry.to].beacon.visible = false; } carry = null; myCrate.visible = false; myCrate.removeFromParent(); w.carryK = 0; w.noZipline = false; }
  function dropCrate(why2) { if (!carry) return; const w = W(); const key = 'me:' + carry.run; const o = P.crateMesh(1); put(o, w.x + 0.6, w.z + 0.6); const lb = P.label('☠ LOOT CRATE'); lb.position.y = 1.4; o.add(lb);
    drops.set(key, { o, x: w.x + 0.6, z: w.z + 0.6, tier: carry.tier, route: carry.route, run: carry.run, pvpM: carry.pvpM, until: performance.now() + C.CRATE.dropS * 1000, mine: true });
    stopCarry(); if (why2 === 'ko') say('📦 YOUR CRATE DROPPED<small>anyone can loot it for 3 minutes</small>', 2400); }
  async function deliver(to) { if (!carry || carry.to !== to) { say(carry ? `THE ${SITES.buyers[to].name.toUpperCase()} DOESN'T WANT THIS ONE<small>take it to the ${carry.buyer}</small>` : `${SITES.buyers[to].name.toUpperCase()}<small>bring a smuggler crate here</small>`); return; }
    const tier = carry.tier === 'cutthroat' && carry.pvpM < C.CRATE.tiers.cutthroat.pvpMeters ? 'standard' : carry.tier; const run = carry.run; stopCarry();
    const r = await api.call('isl_crate', { tier, run }); if (r?.ok) { api.st.crates = (api.st.crates | 0) + (r.retry ? 0 : (r.practice ? 0 : 1)); api.save(); api.onKill('salvage'); say(`📦 DELIVERED · +${gfmt(r.delta || C.crateGold(tier))}`, 2400); } else say(why(r)); }
  function tickCrate(dt) { if (!carry) return; const w = W(); const d = Math.hypot(w.x - carry.lx, w.z - carry.lz); if (d < 30 && !ctx.insideSafe?.(w.x, w.z)) carry.pvpM += d; carry.lx = w.x; carry.lz = w.z;
    if (w.ride || w.swim || w.body?.swim) { if (w.body?.swim) { dropCrate('water'); say('📦 THE CRATE SANK TO THE SHALLOWS<small>wade back and grab it</small>'); } } }
  // the crate others see: on your back (1) or dropped (2) — netState mc: [state, x, z, tier 0/1, run]
  function netState() { if (carry) return { mc: [1, 0, 0, carry.tier === 'cutthroat' ? 1 : 0, carry.run.slice(-10)] }; const d = [...drops.values()].find(x => x.mine && x.until > performance.now()); return d ? { mc: [2, Math.round(d.x * 10) / 10, Math.round(d.z * 10) / 10, d.tier === 'cutthroat' ? 1 : 0, d.run.slice(-10)] } : {}; }
  const taken = new Set();
  function onPeer(m) { if (!m || typeof m.i !== 'string') return; const p = fnet?.peers?.get(m.i); const mc = Array.isArray(m.mc) && m.mc.length === 5 ? m.mc : null;
    // their crate on their back
    let pc = peerCr.get(m.i); if (mc && mc[0] === 1 && p?.pirate?.object) { if (!pc) { pc = P.carriedCrate(); peerCr.set(m.i, pc); } if (pc.parent !== p.pirate.object) p.pirate.object.add(pc); pc.visible = true;
      for (const [k, d] of drops) if (d.mine && k.endsWith(String(mc[4]))) { root.remove(d.o); drops.delete(k); say('📦 A PIRATE TOOK YOUR DROPPED CRATE'); } }
    else if (pc) pc.visible = false;
    const key = 'p:' + m.i; const ex = drops.get(key);
    if (mc && mc[0] === 2 && Number.isFinite(+mc[1]) && Number.isFinite(+mc[2]) && !taken.has(String(mc[4]))) { if (!ex) { const o = P.crateMesh(1); put(o, +mc[1], +mc[2]); const lb = P.label('☠ LOOT CRATE'); lb.position.y = 1.4; o.add(lb);
      drops.set(key, { o, x: +mc[1], z: +mc[2], tier: mc[3] ? 'cutthroat' : 'standard', run: String(mc[4]), until: performance.now() + 10000, peer: m.i }); } else ex.until = performance.now() + 10000; }
    else if (ex) { root.remove(ex.o); drops.delete(key); } }
  function tickDrops() { const now = performance.now(), w = W(); for (const [k, d] of drops) { if (now > d.until) { root.remove(d.o); drops.delete(k); continue; } d.o.rotation.y += 0.01;
      if (!carry && walkerOn() && Math.hypot(w.x - d.x, w.z - d.z) < C.CRATE.pickR) { root.remove(d.o); drops.delete(k); if (d.peer) taken.add(d.run);
        const from = d.mine ? (d.route ? ROUTES.find(r => r.id === d.route) : null) : null; const route = from || ROUTES.find(r => r.tier === d.tier && r.from === (d.x > 700 ? 'cove' : 'wharf')) || ROUTES[0];
        takeCrate(route, { run: d.mine ? d.run : rid('loot'), pvpM: d.pvpM || 0 }); say(`📦 LOOTED A CONTRABAND CRATE<small>deliver to the ${SITES.buyers[route.to].name}</small>`); } } }

  // ======================= 4. DIVING / CRAB POTS / MINING =======================
  const dive = { on: false, d: null, o2: 100, pry: 0, need: 3 };
  function startDive(d) {
    const w = W(), wy = world.water(w.x, w.z); if (!(w.swim || w.body?.swim || (wy != null && wy - G(w.x, w.z) > 1.4 && w.y < wy + 0.4))) { say('🤿 SWIM OUT OVER THE BUBBLES FIRST<small>then dive</small>'); return; }
    Object.assign(dive, { on: true, d, o2: C.DIVE.o2, pry: 0, need: C.DIVE.pry[d.kind] || 3 }); ui.o2.show(true); ui.o2.set(100, 0, d.kind === 'chest' ? 'PRY THE CHEST' : 'PRY THE CLAM'); say('🤿 HOLD YOUR BREATH!<small>' + (touch ? 'tap PRY' : 'tap E / PRY') + ' fast before your O₂ runs out</small>', 1800);
  }
  function pryTap() { if (!dive.on) return; dive.pry = Math.min(1, dive.pry + 0.42 / dive.need); }
  ui.o2.btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); pryTap(); });
  async function tickDive(dt) { if (!dive.on) return; dive.o2 -= C.DIVE.drain * dt; dive.pry = Math.max(0, dive.pry - dt * 0.02); ui.o2.set(dive.o2, dive.pry);
    const w = W(); if (Math.hypot(w.x - dive.d.x, w.z - dive.d.z) > 5) { endDive(); say('🤿 YOU DRIFTED AWAY · SURFACED'); return; }
    if (dive.pry >= 1) { const d = dive.d; endDive(); const r = await api.call('isl_gather', { src: 'dive', spot: d.id, kind: d.kind });
      if (r?.ok) { api.onKill('salvage'); say(`🤿 ${itemsTxt(r.items)}<small>in your inventory · sell at the Treasure Trader</small>`, 2600); refreshInv(); } else say(why(r)); return; }
    if (dive.o2 <= 0) { endDive(); say('🫧 OUT OF BREATH!<small>you kick back up · nothing pried loose</small>', 2200); } }
  function endDive() { dive.on = false; ui.o2.show(false); }
  // crab pots
  const potKey = (id) => `crab:${id}`;
  async function usePot(p) { const t = api.timers()[potKey(p.id)];
    if (!t) { const r = await api.call('isl_timer_start', { kind: 'crab', slot: p.id }); if (r?.ok) { if (!r.practice) api.st.timers[potKey(p.id)] = { t0: Date.parse(r.started_at) || Date.now(), meta: {} }; api.save(); say(`🦀 POT SET<small>haul it in ${C.fmtClock(C.CRAB.fillS)}</small>`); } else say(why(r)); return; }
    const s = C.potState(t.t0, Date.now()); if (!s.full) { say(`🦀 SOAKING · ${C.fmtClock(s.left)}`); return; }
    const r = await api.call('isl_timer_finish', { kind: 'crab', slot: p.id }); if (r?.ok) { if (!r.practice) delete api.st.timers[potKey(p.id)]; api.save(); api.onKill('salvage'); say(`🦀 HAULED ${itemsTxt(r.items)}<small>sell at the Fish Market</small>`, 2600); refreshInv(); } else say(why(r)); }
  // mining
  let swinging = 0;
  async function mineAt(m) { if (swinging > 0) return; swinging = C.MINE.swingS; try { pirate.emote?.(4); } catch {} try { sfx?.hit?.(0.6); } catch {}
    const r = await api.call('isl_gather', { src: 'mine', spot: m.id, kind: m.kind });
    if (r?.ok) { api.onKill('salvage'); const left = r.left ?? null; mineM[m.id].o.userData.setCharges(left ?? 2); say(`⛏️ ${itemsTxt(r.items)}${left != null ? `<small>${left} swing${left === 1 ? '' : 's'} left in this vein</small>` : ''}`, 1800); refreshInv(); }
    else { if (/deplet|mined out|empty/i.test(String(r?.error))) mineM[m.id].o.userData.setCharges(0); say(why(r)); } }

  // ======================= 5. COTTAGE SPICE PLOTS + COPPER STILL + RUM STALL =======================
  const owns = (cid) => { try { return !!houses?.owned?.[cid] || !!ctx.isOwner?.(); } catch { return false; } };
  async function usePlot(cid) { if (!owns(cid)) { say('🌱 SPICE PLOT<small>buy this cottage to farm cane + spices here</small>', 2400); return; }
    const t = api.timers()[`plot:${cid}`];
    if (!t) { const r = await api.call('isl_timer_start', { kind: 'plot', slot: cid }); if (r?.ok) { if (!r.practice) api.st.timers[`plot:${cid}`] = { t0: Date.parse(r.started_at) || Date.now(), meta: {} }; api.save(); say(`🌱 PLANTED<small>cane + spices ready in ${C.fmtClock(C.PLOT.growS)}</small>`); } else say(why(r)); return; }
    const s = C.plotStage(t.t0, Date.now()); if (!s.ready) { say(`🌱 ${C.PLOT.stages[s.stage].toUpperCase()} · ${C.fmtClock(s.left)}`); return; }
    const r = await api.call('isl_timer_finish', { kind: 'plot', slot: cid }); if (r?.ok) { if (!r.practice) delete api.st.timers[`plot:${cid}`]; api.save(); say(`🎋 HARVESTED ${itemsTxt(r.items)}<small>brew them in your cottage's copper still</small>`, 2600); refreshInv(); } else say(why(r)); }
  const stillOut = (t) => t?.meta?.out || (t?.meta?.homegrown ? 'reserve_spiced_rum' : 'cottage_spiced_rum');
  function stillView(cid) {
    return { html: () => { const t = api.timers()[`still:${cid}`], s = C.stillState(t?.t0, Date.now()), cane = api.qty('island_cane'), sp = api.qty('island_spices'), hg = cane >= C.STILL.need.island_cane && sp >= C.STILL.need.island_spices;
      let h = `<h2>🥃 COPPER RUM STILL</h2><div class="mm-sub">brew ${C.STILL.bottles} bottles in ${C.fmtClock(C.STILL.brewS)} · sell at the Harbor Rum Export Stall</div>${practiceNote()}`;
      if (s.phase === 'idle') h += `<div class="mm-row"><div class="ic">${itemIconHtml({ kind: 'island', ...ISLAND_GOODS.cottage_spiced_rum }, '🍾', 'isl:cottage_spiced_rum')}</div><div class="tx">COTTAGE SPICED RUM<small>buy the molasses mash · ${formatGoldAmount(ISLAND_GOODS.cottage_spiced_rum.sell.rum)}g a bottle at the stall</small></div><button class="mm-btn" data-a="mash">BREW · ${gfmt(C.STILL.mashGold)}</button></div>
          <div class="mm-row"><div class="ic">${itemIconHtml({ kind: 'island', ...ISLAND_GOODS.reserve_spiced_rum }, '🥃', 'isl:reserve_spiced_rum')}</div><div class="tx">RESERVE SPICED RUM<small>your homegrown cane ${cane}/2 + spices ${sp}/1 · ${formatGoldAmount(ISLAND_GOODS.reserve_spiced_rum.sell.rum)}g a bottle</small></div><button class="mm-btn grn" data-a="home" ${hg ? '' : 'disabled'}>BREW HOMEGROWN</button></div>`;
      else if (s.phase === 'brewing') h += `<div class="mm-row"><div class="ic">🔥</div><div class="tx">${ISLAND_GOODS[stillOut(t)].name.toUpperCase()} · BREWING<small>${C.fmtClock(s.left)} left</small><div class="mm-bar"><i style="width:${Math.round(s.frac * 100)}%"></i></div></div></div>`;
      else h += `<div class="mm-row"><div class="ic">🍾</div><div class="tx">${C.STILL.bottles} × ${ISLAND_GOODS[stillOut(t)].name} READY</div><button class="mm-btn grn" data-a="collect">BOTTLE IT</button></div>`;
      return h; },
      act: async (a, b) => { b.disabled = true;
        if (a === 'mash' || a === 'home') { const r = await api.call('isl_timer_start', { kind: 'still', slot: cid, homegrown: a === 'home' }); if (r?.ok) { if (!r.practice) api.st.timers[`still:${cid}`] = { t0: Date.parse(r.started_at) || Date.now(), meta: { homegrown: a === 'home' } }; else if (r.goods) api.takeGoods(r); api.save(); say('🔥 THE STILL IS BUBBLING'); } else say(why(r)); }
        if (a === 'collect') { const r = await api.call('isl_timer_finish', { kind: 'still', slot: cid }); if (r?.ok) { if (!r.practice) delete api.st.timers[`still:${cid}`]; api.save(); say(`🥃 BOTTLED ${itemsTxt(r.items)}<small>sell at the Harbor Rum Export Stall</small>`, 2600); refreshInv(); } else say(why(r)); }
        ui.draw(); }, live: true };
  }
  let stillMesh = null, stillCid = null;
  globalThis.PFP_MM = {
    houseRoom(room, d) { try { const U = room.userData; const x = U.W / 2 - 1.15, z = U.D / 2 - 1.4; stillMesh = P.copperStill(); stillMesh.scale.setScalar(0.85); stillMesh.position.set(x, 0.02, z); stillMesh.rotation.y = -Math.PI / 2; room.add(stillMesh); stillCid = d?.id || null;
      U.colliders.push({ x, z, w: 1.5, d: 1.4 }); U.spots.still = { x: x - 1.25, z: z - 0.2, r: 1.7, kind: 'house_still', label: 'COPPER RUM STILL' }; } catch (e) { console.warn('[money-makers] still', e); } },
    stillPrompt(cid) { const t = api.timers()[`still:${cid}`], s = C.stillState(t?.t0, Date.now()); return { label: s.phase === 'idle' ? '🥃 COPPER RUM STILL · BREW' : s.phase === 'brewing' ? `🔥 BREWING · ${C.fmtClock(s.left)}` : '🍾 RUM READY · BOTTLE IT', key: 'E', primary: true, tag: 'still' }; },
    stillAct(cid) { if (!owns(cid)) { say('NOT YOUR COTTAGE'); return; } ui.open(stillView(cid)); },
  };
  function rumView() {
    return { html: () => { const rows = Object.entries(ISLAND_GOODS).filter(([, g]) => g.sell.rum);
      return `<h2>🍾 HARBOR RUM EXPORT STALL</h2><div class="mm-sub">the export ships pay best for cottage rum</div>${practiceNote()}` + rows.map(([id, g]) => { const q = api.qty(id);
        return `<div class="mm-row"><div class="ic">${itemIconHtml({ kind: 'island', ...g }, '❔', islKey(id))}</div><div class="tx">${g.name}<small>you have ${q} · brewed in a cottage copper still</small></div><div class="g">${gfmt(g.sell.rum)}</div><button class="mm-btn grn" data-a="sell:${id}:1" ${q ? '' : 'disabled'}>SELL 1</button><button class="mm-btn grn" data-a="sell:${id}:${q}" ${q > 1 ? '' : 'disabled'}>ALL</button></div>`; }).join('')
        + '<div class="mm-note">no rum yet? buy a cottage, grow cane + spices on its plot, brew in the still inside</div>'; },
      act: async (a, b) => { const [, id, n] = a.split(':'); b.disabled = true; await sell(id, +n, 'rum'); ui.draw(); } };
  }
  async function sell(id, n, shop) { if (!(n > 0)) return; const r = await api.call('isl_sell', { item: islKey(id), qty: n, shop }); if (r?.ok) { if (r.goods) api.takeGoods(r); else api.st.goods[id] = Math.max(0, api.qty(id) - n); api.save(); say(`SOLD ${n} × ${ISLAND_GOODS[id].name.toUpperCase()} · +${gfmt(r.delta || islPrice(islKey(id), shop) * n)}`); refreshInv(); } else say(why(r)); }
  // [v375] island goods are bag items now (js/inventory/ui.js islSlots, BANKSY t1978u): the inventory reads + sells them through this hook
  globalThis.PFP_MM.isl = { goods: () => api.goods(), sell: (id, n, shop) => sell(id, n, shop) };
  // the old inventory strip: off now (?islstrip=1 brings it back)
  if (/[?&]islstrip=1(&|$)/.test(globalThis.location?.search || '')) addEventListener('pfp-inv-render', (e) => { const { el, mode } = e.detail || {}; if (!el) return; let s = el.querySelector('#iv-isl'); const grid = el.querySelector('.iv-grid'); if (!grid) return;
    const shop = mode === 'fish' ? 'fish' : mode === 'antiques' ? 'antiques' : null; const rows = Object.entries(api.goods()).filter(([id]) => mode === 'bag' || (shop && ISLAND_GOODS[id]?.sell?.[shop]));
    if (!(mode === 'bag' || shop) || !rows.length) { s?.remove(); return; }
    if (!s) { s = document.createElement('div'); s.id = 'iv-isl'; s.style.cssText = 'margin:8px 4px;padding:6px 8px;border:2px solid #c9a66b;border-radius:10px;background:rgba(40,24,10,.55);font:20px Just Another Hand,cursive;color:#f1e2bd'; }
    if (s.previousElementSibling !== grid) grid.after(s);
    s.innerHTML = `<div style="color:#ffcd77">ISLAND GOODS${shop ? ` · ${ISL_SHOP_NAMES[shop]} BUYS` : ''}</div>` + rows.map(([id, q]) => { const g = ISLAND_GOODS[id]; return `<div style="display:flex;align-items:center;gap:8px;margin:3px 0"><span style="font-size:24px">${itemIconHtml({ kind: 'island', ...g }, '❔', islKey(id))}</span><span style="flex:1">${g.name} ×${q}</span>${shop ? `<b style="color:#ffcd77">${gfmt(g.sell[shop])}</b><button data-isl="${id}" style="min-height:40px;font:20px Just Another Hand,cursive;border:2px solid #161616;border-radius:8px;background:#ffcd77;padding:2px 10px 0">SELL ALL</button>` : ''}</div>`; }).join('');
    s.querySelectorAll('[data-isl]').forEach(b => { b.onclick = async (ev) => { ev.stopPropagation(); b.disabled = true; await sell(b.dataset.isl, api.qty(b.dataset.isl), shop); try { ctx.inventory?.()?.render?.(); } catch {} }; }); });
  function refreshInv() { try { const iv = ctx.inventory?.(); if (iv?.isOpen) (iv.refresh || iv.render)(); } catch {} } // [055] goods are pvp_inv rows: re-read the bag
  const itemsTxt = (items) => Object.entries(items || {}).map(([k, q]) => { const id = String(k).replace(/^isl:/, ''), g = ISLAND_GOODS[id]; return g ? `${q} × ${itemIconHtml({ kind: 'island', ...g }, '❔', islKey(id))} ${g.name.toUpperCase()}` : ''; }).filter(Boolean).join(' · ') || 'NOTHING';
  const WHYS = { 'not enough gold': 'NOT ENOUGH GOLD', 'live only': 'OPENS WHEN THE ISLAND GOLD SERVER IS LIVE', 'slow down': 'SLOW DOWN A MOMENT', 'daily cap reached': 'DAILY LIMIT REACHED · BACK TOMORROW', 'daily cap': 'DAILY LIMIT REACHED · BACK TOMORROW', 'claimed today': 'ALREADY PAID TODAY',
    'buy this cottage first': 'BUY THIS COTTAGE FIRST', 'three pots max': '3 CRAB POTS MAX', 'max pots': '3 CRAB POTS MAX', 'not ready': 'NOT READY YET', 'depleted': 'THIS SPOT IS PICKED CLEAN · COME BACK LATER', 'bets are locked': 'BETS ARE LOCKED', 'fighters cannot bet': "FIGHTERS CAN'T BET" };
  function why(r) { const e = String(r?.error || 'offline'); return WHYS[e] || (r?.left_s ? `${e.toUpperCase()} · ${C.fmtClock(r.left_s)}` : `THAT DIDN'T WORK<small>${esc(e)}</small>`); }

  // ======================= interact + tick =======================
  function interact(q) {
    if (dive.on && q.mm === 'dive') { pryTap(); return; }
    switch (q.mm) {
      case 'board': openBoard(); break;
      case 'coliseum': openColiseum(); break;
      case 'rum': ui.open(rumView()); break;
      case 'crate': if (carry) say('YOU ARE ALREADY HAULING ONE'); else ui.open(crateView(q.from)); break;
      case 'buyer': deliver(q.to); break;
      case 'dive': startDive(q.d); break;
      case 'pot': usePot(q.p); break;
      case 'mine': mineAt(q.m); break;
      case 'plot': usePlot(q.cid); break;
    }
  }
  let acc = 0, slow = 0, wasOn = false;
  function labels() { const now = Date.now(), T = api.timers();
    for (const p of SITES.pots) { const t = T[potKey(p.id)], M = potM[p.id], q = spots.find(s => s.id === 'mm_pot_' + p.id); if (!t) { M.lb.userData.set(''); M.o.userData.crab.visible = false; q.label = '🦀 SET CRAB POT'; continue; }
      const s = C.potState(t.t0, now); M.o.userData.crab.visible = s.full; M.lb.userData.set(s.full ? 'FULL!' : C.fmtClock(s.left), s.full ? '#8acb4a' : '#ffcd77'); q.label = s.full ? '🦀 HAUL CRAB POT' : `🦀 CRAB POT · ${C.fmtClock(s.left)}`; }
    for (const [cid, M] of Object.entries(plotM)) { const t = T[`plot:${cid}`], q = spots.find(s => s.id === 'mm_plot_' + cid); const s = C.plotStage(t?.t0, now); M.o.userData.setStage(Math.max(0, s.stage));
      M.lb.userData.set(!t ? '' : s.ready ? 'READY!' : C.fmtClock(s.left), s.ready ? '#8acb4a' : '#ffcd77'); q.label = !owns(cid) ? '🌱 SPICE PLOT · COTTAGE OWNERS' : !t ? '🌱 PLANT CANE + SPICES' : s.ready ? '🎋 HARVEST' : `🌱 GROWING · ${C.fmtClock(s.left)}`; }
    if (stillMesh && stillCid) { const t = T[`still:${stillCid}`], s = C.stillState(t?.t0, now); stillMesh.userData.fire.visible = s.phase === 'brewing'; stillMesh.userData.bottles.visible = s.phase === 'ready'; }
    for (const q of spots) if (q.mm === 'dive') q.used = dive.on && q.d !== dive.d;
  }
  function tick(dt, onFoot) {
    if (!onFoot) { if (wasOn) { wasOn = false; if (carry) dropCrate('aboard'); endDive(); endHorde(false, 'you went aboard'); pve.clear(); ui.setHud(''); } return; }
    if (!wasOn) { wasOn = true; api.refresh().then(() => labels()).catch(() => {}); }
    tickCamps(dt); pve.tick(dt); tickHorde(); tickCrate(dt); tickDrops(); tickDive(dt); swinging = Math.max(0, swinging - dt);
    acc += dt; if (acc > 0.5) { acc = 0; labels(); }
    slow += dt; if (slow > 10) { slow = 0; if (duel.id || ui.isOpen) pollDuel(); else if (api.live !== false && Math.hypot(W().x - SITES.wanted.x, W().z - SITES.wanted.z) < 40) pullBoard(false); }
    const H = carry ? `${C.crateBanner(carry.buyer)}${carry.tier === 'cutthroat' ? `<small>PvP ground ${Math.min(C.CRATE.tiers.cutthroat.pvpMeters, Math.round(carry.pvpM))}/${C.CRATE.tiers.cutthroat.pvpMeters} m · ${Math.round(Math.hypot(W().x - SITES.buyers[carry.to].x, W().z - SITES.buyers[carry.to].z))} m to go</small>` : `<small>${Math.round(Math.hypot(W().x - SITES.buyers[carry.to].x, W().z - SITES.buyers[carry.to].z))} m to go</small>`}`
      : horde.on ? `💀 SKELETON HORDE · WAVE ${Math.max(1, horde.wave)}/5<small>${horde.next ? `next wave in ${Math.ceil(horde.next - performance.now() / 1000)}s` : `${pve.alive('horde').length} left`} · earned ${gfmt(horde.paid)}</small>`
      : duel.id && duel.status === 'live' ? `⚔ PRIZE FIGHT vs ${esc(duel.opp)}<small>pot ${gfmt(C.duelPot(duel.stake))} · KO them in the Sword Pit</small>` : '';
    ui.setHud(H);
  }
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && ui.isOpen) { ui.close(); e.preventDefault(); } });
  // ---------------- test / QA hooks (window.PFP_MM.t) ----------------
  globalThis.PFP_MM.t = { api, ui, SITES, ROUTES, spots, houses, get still() { return stillMesh; }, pve, horde, duel, get carry() { return carry; }, dive, openBoard, openColiseum, openRum: () => ui.open(rumView()), openCrates: (f) => ui.open(crateView(f)), openStill: (cid) => ui.open(stillView(cid)),
    takeCrate: (id) => takeCrate(ROUTES.find(r => r.id === id)), dropCrate, deliver, startHorde, endHorde, startDive, pryTap, usePot, usePlot, mineAt, interact, sell,
    setBoard(b) { board = { wanted: b.wanted || [], duels: b.duels || [], claims: b.claims || [] }; wanted.userData.setPosters(board.wanted.slice(0, 3)); },
    ff(sec) { for (const t of Object.values(api.st.timers)) t.t0 -= sec * 1000; api.save(); labels(); }, labels };
  return { interact, tick, openBoard, openColiseum, netState, onPeer, root, api, ui, clear: () => tick(0, false) };
}
