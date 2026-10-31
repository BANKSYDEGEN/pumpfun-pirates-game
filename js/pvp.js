// PUMPFUN PIRATES · PvP ARENA (BETA): drop-in, real-time, free-for-all on a shared sea.
// Netcode: js/transport.js (Supabase Realtime broadcast fallback, or the relay server in server/), no presence.
//  - FLOW: everyone starts in the local HARBOR (AI ships for small gold, invisible to the arena). JOIN BATTLE asks the lobby
//    (supabase/migrations/007_pvp_lobby.sql or server/relay.js, the single authority) for an arena slot or a queue place;
//    an opened slot is offered for PVP_OFFER s ('Battle ready! Set sail?'). Dying while the queue is non-empty = back of the
//    queue (rotation). No input for PVP_AFK.kick s in the arena = back to the harbor.
//  - every client is authoritative for its OWN ship; state + events go out as ONE batched message per tick (PVP_NET hz);
//  - cannon volleys are broadcast as events so everyone sees the balls; the SHOOTER decides a hit and the VICTIM'S
//    client applies it (after caps: damage per ball, hits per second, shooter distance);
//  - AI ships are LOCAL only (harbor only; the arena is players only), never networked, never count for K/D.
//  - the lowest-id client in the room is HOST: it owns gold piles (who picked up which pile) and
//    turns a sunk player's report into a pile (carried gold + PVP_DEATH_BONUS). When the host leaves, the next one takes over.
// v1 is NOT cheat-proof: a modified client can lie about its own ship. See README "PvP".
import * as THREE from 'three';
import { createNet } from './transport.js';
import { HARBOR_HP_BASE, HARBOR_SIZE_PER_LV, HARBOR_DMG_PER_LV, harborScale, harborGold } from './config.js';
import { PVP_BOUNTY, HOLDER_ENABLED, HOLDER_GOLD_MUL, HOLDER_DAILY_GOLD } from './config.js';
import { PVP_PILE_CAP, PVP_PILE_MAX } from './config.js';
import { PVP_DEATH_BONUS, PVP_AI_GOLD, PVP_PILE_LIFE, PVP_RESPAWN, PVP_PROTECT, PVP_AI_SHIPS, PVP_ARENA_R, PVP_MAX_CARRY, PVP_AFK, PVP_OFFER } from './config.js';
import { loadProfile, saveProfile, walletSignIn, linkWallet, walletSession, signOut, kd, cleanProfile, blankProfile, claimKill, holderStatus, holderClaim, saveAirdrop } from './pvpSave.js';
import { TIERS, pvpSkin, canUse, nextTier, tierOf, shipTick, SHIP_TICKS } from './pvpSkins.js';
import { UPGRADES, BALL_DMG, shipStats } from './upgrades.js';
import { compilePreview } from './upgradeVisuals.js';
import { skinSwatch, getSkin } from './skins.js';
import { makeChest } from './props.js';
import { setRunLevels, getRunLevels } from './shop.js';
import { getSavedName, saveName, isValidSolanaAddress, getSavedWallet, saveWallet, shortWallet } from './wallet.js';
import { ON_PORTAL } from './config.js';
import { mountKillsBoard, renderKills } from './pvpBoard.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angWrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
const esc = (s) => String(s ?? '').replace(/[<>&"'`\\]/g, '');
const ROOM_PREFIX = 'pfp-pvp-' + (new URLSearchParams(location.search).get('pvproom') || 'v1').replace(/[^a-z0-9]/gi, '').slice(0, 16);
const PEER_TIMEOUT = 6000, SAFE_R = 110, PICK_R = 10;
// most damage one ball can do: max BALL_DMG × best CANNONS gunDmg; most speed: 3 sails × 4.2 × best SAILS
const MAX_GUNDMG = Math.max(1, ...UPGRADES.find(u => u.id === 'cannons').tiers.map(t => t.gunDmg || 1));
export const MAX_HIT = Math.ceil(BALL_DMG[1] * MAX_GUNDMG) + 1;
const MAX_SPEED = 3 * 4.2 * Math.max(...UPGRADES.find(u => u.id === 'sails').tiers.map(t => t.value)) * 1.15;
const MAX_HP = Math.max(...UPGRADES.find(u => u.id === 'hull').tiers.map(t => t.value));
const QS = new URLSearchParams(location.search);
const TEST_CAP = +QS.get('pvpcap') || null, TEST_OFFER = +QS.get('pvpoffer') || null, TEST_AFK = +QS.get('pvpafk') || 0; // test prefixes only (the lobby ignores them for the live arena)
const PIRATE_A = ['SALTY', 'RUM', 'IRON', 'BLACK', 'MAD', 'LUCKY', 'STORMY', 'ONE-EYED', 'GOLDEN', 'DEGEN', 'SALTY', 'CRIMSON'];
const PIRATE_B = ['JACK', 'BONES', 'MARY', 'HOOK', 'FINN', 'ANNE', 'PETE', 'MORGAN', 'KIDD', 'NED', 'BEARD', 'SALLY'];
export const pirateName = () => `${PIRATE_A[Math.random() * PIRATE_A.length | 0]} ${PIRATE_B[Math.random() * PIRATE_B.length | 0]}`;

// spawn points: 16 around the edge + 6 on a mid ring
const SPAWNS = [...Array.from({ length: 16 }, (_, i) => [Math.cos(i / 16 * 6.283) * PVP_ARENA_R * 0.82, Math.sin(i / 16 * 6.283) * PVP_ARENA_R * 0.82]),
  ...Array.from({ length: 6 }, (_, i) => [Math.cos((i + 0.5) / 6 * 6.283) * PVP_ARENA_R * 0.42, Math.sin((i + 0.5) / 6 * 6.283) * PVP_ARENA_R * 0.42])];

export function createPvp(K) {
  const { scene, game, enemies, balls, loot, fx, sfx } = K;
  const P = () => K.getPlayer();
  const myId = Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 6);
  let lastClaim = null;
  const holder = { on: false, claimed: true, checked: false }; // HOLDER PERK (server-checked)
  // SPECTATE: receive-only. No ship, never broadcasts a state (so other clients never see, count, target or map us),
  // never host, never saves. The hidden local player is used as a camera rig that follows a captain or the overview.
  const spec = { want: false, on: false, mode: 'leader', target: null, rig: null, camLock: 0, emptyT: 0, hudOff: false, maxDist: 0, wired: false };
  let room = null, roomIdx = 0, active = false, isHost = false, hostId = null, hudT = 0, saveT = 0, botT = 0, botSeq = 0, pileSeq = 0;
  const net = createNet({ prefix: ROOM_PREFIX, myId });
  const seatId = myId + Math.random().toString(36).slice(2, 10);
  // where we are: 'harbor' (local, AI only) | 'arena' (in the shared room) | 'spec'. lob = the lobby's last answer.
  let where = 'harbor';
  const lob = { state: 'harbor', pos: 0, queue: 0, players: 0, cap: net.cfg.maxArena, offerUntil: 0, pollT: 0, busy: false, wantJoin: false, queuedByDeath: false };
  const AFK_KICK = (TEST_AFK || PVP_AFK.kick) * 1000, AFK_WARN = Math.min(PVP_AFK.warn, (TEST_AFK || PVP_AFK.kick) / 2) * 1000, AFK_FARM = Math.min(PVP_AFK.farm, (TEST_AFK || PVP_AFK.kick) * 0.6) * 1000;
  const peers = new Map();           // id -> { id, name, ship, st, heard, k, d, g, K, D, lv, sk, key }
  const bots = new Map();            // id -> enemy object
  const piles = new Map();           // pid -> loot item
  const buckets = new Map();         // shooter id -> { tokens, t } (hit rate cap)
  const earned = new Map();          // host: gold granted per player this life (caps their death drop)
  const feed = [];
  let hitQueue = [], hitT = 0;
  const me = { life: 0, protect: 0, dead: false, respawn: 0, lastDamageAt: 0, lastBy: null, kills: 0, deaths: 0, gold: 0, killedBy: '', dropped: 0, streak: 0, bounty: 0, pairs: new Map() };
  let profile = blankProfile(), wallet = walletSession()?.wallet || '', name = getSavedName() || '';
  if (!name) name = pirateName(); // not saved: Waves keeps its own (empty) name until you type one

  // ---------------- profile / save ----------------
  async function prepare() {
    const r = await loadProfile(); profile = r.profile; wallet = r.wallet || '';
    refreshHolder();
    return profile;
  }
  async function refreshHolder() {
    if (!HOLDER_ENABLED || !wallet) { Object.assign(holder, { on: false, claimed: true, checked: true }); holderUi(); return; }
    const h = await holderStatus(); Object.assign(holder, { on: !!h.holder, claimed: h.claimed !== false, checked: true }); holderUi();
  }
  function holderUi() {
    const b = $('pvp-holder'), c = $('pvp-holder-claim'); if (!b || !c) return;
    b.hidden = !(HOLDER_ENABLED && holder.on); c.hidden = !(HOLDER_ENABLED && holder.on && !holder.claimed);
    c.textContent = `Claim daily gold (+${HOLDER_DAILY_GOLD})`;
  }
  async function claimHolderGold() {
    const c = $('pvp-holder-claim'); if (!c || c.disabled) return; c.disabled = true;
    try { const r = await holderClaim(); game.gold += r.gold | 0; holder.claimed = true; sfx.coin(); K.popup(new THREE.Vector3(P().x, 6, P().z), `+${r.gold} DAILY GOLD`); K.updateHud(); save({ now: true }); }
    catch (e) { holder.claimed = e?.status === 409 ? true : holder.claimed; if (e?.status === 403) holder.on = false; $('pvp-wallet-state').textContent = String(e?.message || e).slice(0, 80); }
    finally { c.disabled = false; holderUi(); }
  }
  const holderMul = (earned) => HOLDER_ENABLED && holder.on && earned > 0 ? Math.round(earned * (HOLDER_GOLD_MUL - 1)) : 0;
  function applyProfile() { // called by main after the fresh player ship exists
    setRunLevels(profile.levels); game.gold = profile.gold;
  }
  const skinId = () => profile.skins.equipped || 'classic';
  const skinObj = () => pvpSkin(skinId());
  function snapshot() { return cleanProfile({ gold: game.gold, levels: getRunLevels(), skins: { equipped: skinId() }, stats: profile.stats }); }
  function save(opts = {}) { if (!active && !opts.force) return; profile = snapshot(); saveProfile(profile, opts).then(r => { if (r && r.ok === false && r.status === 401) { wallet = ''; renderMenu(); } }); }

  // ---------------- rooms ----------------
  // ---------------- lobby (arena seat / queue), harbor <-> arena ----------------
  const lobbyOpts = (extra = {}) => ({ seat: seatId, name, cap: TEST_CAP, offer: TEST_OFFER, ...extra });
  async function lobbyCall(op, extra) {
    const r = await net.lobby(op, lobbyOpts(extra)); if (!active) return r;
    if (r && r.state && r.state !== 'error') {
      Object.assign(lob, { state: r.state, pos: r.pos || 0, queue: r.queue || 0, players: r.players || 0, cap: r.cap || lob.cap });
      if (r.state === 'offer') { if (!lob.offerUntil) { lob.offerUntil = performance.now() + (+r.offer_in || PVP_OFFER) * 1000; showOffer(true); sfx.coin?.(); } }
      else { lob.offerUntil = 0; showOffer(false); }
    }
    return r || { state: 'error' };
  }
  async function joinBattle() { // harbor JOIN BATTLE button
    if (where !== 'harbor' || lob.busy) return; lob.busy = true;
    try {
      const r = await lobbyCall('play');
      if (r.state === 'play') await enterArena();
      else if (r.state === 'queue') K.banner('ARENA FULL', `you are #${r.pos} in the queue · keep farming, we'll call you`);
      else if (r.state === 'offer') { /* the offer card is up */ }
      else if (r.state === 'full') K.banner('SERVERS FULL', 'the queue is full right now, try again in a minute');
      else K.banner('LOBBY OFFLINE', 'could not reach the arena, try again soon');
    } finally { lob.busy = false; harborUi(); }
  }
  async function acceptOffer() {
    if (lob.state !== 'offer' || lob.busy) return; lob.busy = true; showOffer(false);
    try { const r = await lobbyCall('accept'); if (r.state === 'play') await enterArena(); } finally { lob.busy = false; harborUi(); }
  }
  async function declineOffer() { showOffer(false); lob.offerUntil = 0; await lobbyCall('decline'); harborUi(); }
  async function leaveQueue() { await lobbyCall('leave'); lob.state = 'harbor'; harborUi(); }
  async function enterArena() {
    clearLocalAi(true);
    let link;
    try { link = await net.openRoom(1); } catch (e) { console.warn('[pvp] arena connect failed', e?.message); await lobbyCall('leave'); K.banner('ARENA OFFLINE', 'could not connect, back in the harbor'); return false; }
    if (!active) { link.close(); return false; }
    room = link; roomIdx = 1; wire(link); link.setState(stateMsg); link.send('hello', { i: myId }, { now: true });
    where = 'arena'; lob.queuedByDeath = false; document.documentElement.classList.remove('pvp-harbor'); harborUi();
    me.dead = true; P().alive = false; P().mesh.visible = false; // listen a moment so the spawn is the farthest from everyone
    K.banner('ENTERING THE ARENA', 'finding the quietest spawn…');
    await new Promise(res => setTimeout(res, 1200));
    if (!active || where !== 'arena') return false;
    P().mesh.visible = true; me.lastInput = performance.now(); electHost(); respawn(); hud();
    return true;
  }
  function toHarbor(title, sub) { // leave the arena (rotation, AFK, lost seat, RETURN TO HARBOR); upgrades, gold, K/D stay; bounty resets
    resetBounty(); me.ret = null;
    if (room) { room.send('bye', { i: myId }, { now: true }); room.close(); }
    room = null; clearPeers(); for (const pid of [...piles.keys()]) removePile(pid);
    isHost = false; hostId = null; where = 'harbor'; document.documentElement.classList.add('pvp-harbor');
    respawnHarbor(); harborUi(); K.banner(title, sub);
  }
  function respawnHarbor() {
    const pl = P(); me.dead = false; me.protect = 0; me.lastBy = null; me.lastDamageAt = 0; showDead(false); pl.mesh.visible = true;
    Object.assign(pl, { alive: true, sinking: 0, hp: pl.maxHp, x: 0, z: 0, yaw: 0, speed: 0, sail: 1, anchor: false, calm: 0, repT: 0 });
    pl.cd.port = pl.cd.star = 0; K.resetCamera(); K.updateHud();
  }
  function lobbyTick(dt) {
    const now = performance.now();
    if (lob.offerUntil) { const left = Math.max(0, (lob.offerUntil - now) / 1000); const el = $('pvp-offer-t'); if (el) el.textContent = Math.ceil(left); if (left <= 0) { lob.offerUntil = 0; showOffer(false); lobbyCall('poll').then(harborUi); } }
    const every = lob.state === 'queue' || lob.state === 'offer' ? 3000 : where === 'harbor' ? 0 : 10000; // queued seats expire after 15 s without a poll, arena seats after 25 s
    if (!every || lob.busy || now - (lob.lastPoll || 0) < every) return;
    lob.lastPoll = now;
    lobbyCall(where === 'spec' ? 'spec' : 'poll').then((r) => {
      if (!active) return;
      if (where === 'arena' && !lob.queuedByDeath && r.state === 'harbor') lobbyCall('play').then((r2) => { if (r2.state !== 'play' && where === 'arena') toHarbor('BACK IN THE HARBOR', r2.state === 'queue' ? `your arena seat expired · queue #${r2.pos}` : 'your arena seat expired'); });
      harborUi();
    });
  }
  // ---------------- AFK: no input for PVP_AFK.kick s in the arena = back to the harbor ----------------
  const markInput = () => { me.lastInput = performance.now(); if (me.afkWarned) { me.afkWarned = false; $('pvp-afk')?.classList.add('hidden'); } };
  const idleMs = () => performance.now() - (me.lastInput || performance.now());
  function afkTick() {
    if (where !== 'arena' || me.dead) { $('pvp-afk')?.classList.add('hidden'); return; }
    const idle = idleMs(), left = Math.ceil((AFK_KICK - idle) / 1000);
    if (idle > AFK_KICK - AFK_WARN) { const el = $('pvp-afk'); if (el) { el.classList.remove('hidden'); el.querySelector('b').textContent = Math.max(0, left); } me.afkWarned = true; }
    if (idle > AFK_KICK) afkKick();
  }
  function afkKick() {
    const pl = P();
    if (pl.alive && !me.dead && inCombat()) combatLog(false); // in a fight: counts as a death (same as quitting)
    $('pvp-afk')?.classList.add('hidden'); me.afkWarned = false;
    lobbyCall('leave'); toHarbor('SENT TO THE HARBOR', 'no input for a while · press JOIN BATTLE to go again');
  }
  // ---------------- RETURN TO HARBOR (anti-dodge): no PvP damage dealt/taken for 10 s, HP ≥ 30%, any hit cancels ----------------
  const RET_QUIET = 10000, RET_MIN_HP = 0.3;
  const lastCombat = () => Math.max(me.lastDamageAt || 0, me.lastDealtAt || 0);
  const inCombat = () => performance.now() - lastCombat() < RET_QUIET;
  function requestReturn() {
    const pl = P(); if (where !== 'arena' || me.dead || !pl.alive) return;
    if (me.ret) return cancelReturn('RETURN CANCELLED', 'staying in the fight');
    if (pl.hp < pl.maxHp * RET_MIN_HP) { K.banner('TOO DAMAGED TO RETREAT', `repair above ${Math.round(RET_MIN_HP * 100)}% hull first`); return; }
    const now = performance.now();
    me.ret = { start: now, until: Math.max(now, lastCombat() + RET_QUIET) };
    toggleMenu(false); retUi();
    if (me.ret.until > now) K.banner('RETURNING TO HARBOR', 'no fighting for 10 s · taking damage cancels it');
  }
  function cancelReturn(title, sub) { if (!me.ret) return; me.ret = null; retUi(); if (title) K.banner(title, sub); }
  function retTick() {
    if (!me.ret) { retUi(); return; }
    const pl = P(), now = performance.now();
    if (where !== 'arena' || me.dead || !pl.alive || pl.hp <= 0) { cancelReturn(); return; }
    if (me.lastDamageAt > me.ret.start) { cancelReturn('RETURN CANCELLED', 'you took damage'); return; }
    if (now < me.ret.until) { retUi(); return; }
    if (!me.ret.ready) { me.ret.ready = true; return; } // one more frame: a killing hit landing now wins over the return
    me.ret = null; retUi();
    save({ now: true, force: true }); // carried gold is banked in your PvP profile; not a death
    lobbyCall('leave'); toHarbor('BACK IN THE HARBOR', `you kept ${game.gold | 0} gold · JOIN BATTLE to go again`);
    lobbyCall('poll').then(harborUi);
  }
  function retUi() {
    const show = active && where === 'arena' && !me.dead && !spec.on;
    const b = $('pvp-return'); if (b) { b.classList.toggle('hidden', !show); const t = me.ret ? `RETURNING · ${Math.max(0, Math.ceil((me.ret.until - performance.now()) / 1000))}` : '⚓ HARBOR'; if (b.textContent !== t) b.textContent = t; b.classList.toggle('on', !!me.ret); }
    const mb = $('pvp-menu-return'); if (mb) mb.hidden = !show;
  }
  // ---------------- local AI ships (harbor only): never networked, never K/D, only ever hunt you ----------------
  const aiWanted = () => !spec.on && where === 'harbor'; // the arena is players only, always (BANKSY)
  function aiTick(dt) {
    botT -= dt; if (botT > 0) return; botT = 2;
    const now = performance.now();
    for (const [id, b] of bots) if (!b.mesh.parent) bots.delete(id);
    if (aiWanted()) {
      const alive = [...bots.values()].filter(b => b.alive).length;
      if (alive < PVP_AI_SHIPS) { const [x, z] = pickSpawn().pt; const e = K.spawnEnemy(x, z, 1, null); const id = `b${++botSeq}${myId.slice(-4)}`; e.net = { id, kind: 'bot' }; e.bar.querySelector('.name').textContent = ''; e.yaw = Math.atan2(-x, -z); scaleAi(e); bots.set(id, e); }
    } else clearLocalAi(false);
    capPiles(true);
  }
  // harbor economy: AI boats grow with YOUR total upgrade level L (HP, size + hitbox, damage) and pay proportionally more
  const totalLevel = () => Object.values(getRunLevels()).reduce((a, b) => a + (b | 0), 0);
  function scaleAi(e) {
    const L = totalLevel(), sc = harborScale(L), sz = 1 + HARBOR_SIZE_PER_LV * L, ud = e.mesh.userData;
    e.hp = e.maxHp = Math.round(HARBOR_HP_BASE * sc); e.dmgMul = 1 + HARBOR_DMG_PER_LV * L; e.gold = harborGold(L); e.aiLevel = L;
    if (sz !== 1) { e.mesh.scale.setScalar(sz); ud.len *= sz; ud.beam *= sz; }
  }
  function clearLocalAi(instant) { // a 2nd pirate arrived (or we sailed into the arena): AI ships sink away, their loot despawns
    for (const [id, b] of bots) {
      if (instant) { dropShip(b); bots.delete(id); continue; }
      if (b.alive) { b.alive = false; b.sinking = 0.001; b.fade = true; }
    }
    for (const [pid, l] of piles) if (l.local) removePile(pid);
  }
  function wire(r) {
    r.on('s', onState).on('shot', onShot).on('hit', onHit).on('sunk', onSunk).on('pile', (m) => addPile(m.pid, m.x, m.z, m.v, m.ttl, false, Math.min(+m.e || 0, PVP_DEATH_BONUS)))
      .on('claim', (m) => { if (isHost) grant(m.pid, m.i); }).on('got', applyGot).on('gone', (m) => removePile(m.pid))
      .on('hello', () => { if (isHost) sendWorld(); }).on('world', onWorld).on('pv', (m) => { const l = piles.get(m?.pid); if (l) { l.value = clamp(Math.floor(+m.v || 0), 0, PVP_PILE_MAX); l.earned = clamp(Math.floor(+m.e || 0), 0, l.value); pileLook(l); } })
      .on('bye', (m) => { const p = peers.get(m.i); if (p) p.heard = 0; });
    r.onStatus = (s) => { if (s === 'reconnecting') K.banner('RECONNECTING…', 'the sea went quiet for a moment'); else if (s === 'limit') K.banner('SERVERS BUSY', 'the arena is over capacity, hang on…'); };
  }
  const livePeers = () => [...peers.values()].filter(p => performance.now() - p.heard < PEER_TIMEOUT);
  function sendWorld(sync = false) { const list = [...piles.values()].filter(l => !l.local && !l.taken).slice(0, PVP_PILE_CAP + 10).map(l => [l.pid, r1(l.x), r1(l.z), l.value, 0]); room?.send('world', { h: myId, s: sync ? 1 : 0, piles: list, e: list.map(p => piles.get(p[0])?.earned || 0) }); }
  function onWorld(m) { // the host's pile list: add what we're missing; on a resync also drop piles the host no longer has
    const list = (Array.isArray(m?.piles) ? m.piles : []).slice(0, PVP_PILE_CAP + 10);
    for (const p of list) { if (!Array.isArray(p)) continue; const [pid, x, z, v] = p, e = Array.isArray(m.e) ? m.e[list.indexOf(p)] : 0; const l = piles.get(pid); if (l) { if (+v > 0 && +v !== l.value) { l.value = clamp(Math.floor(+v), 0, PVP_PILE_MAX); pileLook(l); } } else addPile(pid, x, z, v, 0, false, Math.min(+e || 0, PVP_PILE_MAX)); }
    if (m.s && m.h === hostId && !isHost) { const keep = new Set(list.map(p => p?.[0])); for (const [pid, l] of piles) if (!l.local && !keep.has(pid) && performance.now() - l.born > 5000) removePile(pid); }
  }

  // ---------------- remote ships ----------------
  const shipOptsFor = (sk) => ({ ...K.shipOpts, light: false, skin: pvpSkin(sk), pvp: true });
  function makeBar(obj, label) {
    const bar = document.createElement('div'); bar.className = 'ehp pvp-ehp';
    bar.innerHTML = `<div class="name pvp-name"></div><div class="bar"><div class="fill"></div></div>`;
    $('bars').appendChild(bar); obj.bar = bar; obj.fill = bar.querySelector('.fill'); obj.nameEl = bar.querySelector('.name'); obj.nameEl.textContent = label;
  }
  function buildRemoteMesh(p, lv, sk) {
    const mesh = compilePreview(lv, shipOptsFor(sk)); scene.add(mesh);
    if (p.ship?.mesh) { mesh.position.copy(p.ship.mesh.position); scene.remove(p.ship.mesh); K.disposeShip(p.ship.mesh); p.ship.mesh = mesh; }
    return mesh;
  }
  function lvFrom(arr) { const lv = {}; UPGRADES.forEach((u, i) => lv[u.id] = clamp(Math.floor(arr?.[i] || 0), 0, u.tiers.length)); return lv; }
  function onState(m) {
    if (!m || typeof m.i !== 'string' || m.i === myId || m.i.length > 20) return;
    let p = peers.get(m.i);
    const now = performance.now();
    if (!p) { p = { id: m.i, heard: now, st: null, ship: null, key: '' }; peers.set(m.i, p); }
    const lv = lvFrom(m.lv), sk = tierOf(m.sk) ? m.sk : 'classic', key = JSON.stringify(lv) + sk;
    p.name = esc(m.n).slice(0, 20) || 'PIRATE'; p.k = m.k | 0; p.d = m.d | 0; p.g = m.g | 0; p.K = m.K | 0; p.D = m.D | 0; p.lv = lv; p.sk = sk;
    const prevHeard = p.heard; p.heard = now;
    // speed sanity: a jump faster than the best possible ship (same life) is clamped
    let x = +m.x || 0, z = +m.z || 0;
    if (p.st && p.st.l === m.l && p.ship) { const dt = Math.max(0.05, (now - prevHeard) / 1000), dx = x - p.st.x, dz = z - p.st.z, d = Math.hypot(dx, dz), lim = MAX_SPEED * dt + 6;
      if (d > lim) { x = p.st.x + dx / d * lim; z = p.st.z + dz / d * lim; } }
    const stats = shipStats({ levels: lv });
    p.st = { x, z, y: +m.y || 0, v: clamp(+m.v || 0, 0, MAX_SPEED), t: clamp(+m.t || 0, -1, 1), h: clamp(+m.h || 0, 0, MAX_HP), m: clamp(+m.m || 100, 1, MAX_HP), a: m.a !== 0, p: !!m.p, l: m.l | 0, at: now };
    if (!p.ship) {
      const obj = { mesh: null, x, z, yaw: p.st.y, speed: 0, turn: 0, hp: p.st.h, maxHp: p.st.m, alive: p.st.a, roll: 0, pitch: 0, y: 0, sinking: p.st.a ? 0 : 99, state: 'roam', net: { id: p.id, kind: 'player' }, remote: true, cannons: stats.cannons };
      obj.mesh = buildRemoteMesh(p, lv, sk); obj.mesh.position.set(x, 0, z); p.ship = obj; p.key = key; makeBar(obj, p.name); enemies.push(obj);
    } else if (p.key !== key) { p.key = key; buildRemoteMesh(p, lv, sk); p.ship.cannons = stats.cannons; }
    const bt = clamp(m.bt | 0, 0, PVP_BOUNTY.cap);
    if (bt >= PVP_BOUNTY.announce && (p.bt || 0) < PVP_BOUNTY.announce) addFeed(`☠ <b>${esc(p.name)}</b> has a <b>${bt}g</b> bounty!`);
    else if (bt >= PVP_BOUNTY.cap && (p.bt || 0) < PVP_BOUNTY.cap) addFeed(`☠ <b>${esc(p.name)}</b> is at the MAX <b>${bt}g</b> bounty!`);
    p.bt = bt;
    p.ship.nameEl.innerHTML = `${esc(p.name)} · ${kd(p.K, p.D)}${bt ? ` <span class="pvp-bounty">☠${bt}</span>` : ''}`;
    p.ship.netState = p.st;
  }
  function updateRemote(e, dt) {
    const st = e.netState;
    if (st) {
      const age = Math.min((performance.now() - st.at) / 1000, 1);
      const tx = st.x + Math.sin(st.y) * st.v * age, tz = st.z + Math.cos(st.y) * st.v * age;
      if (st.a && !e.alive) { e.alive = true; e.sinking = 0; e.x = tx; e.z = tz; e.yaw = st.y; } // respawned
      if (!st.a && e.alive) { e.alive = false; e.sinking = 0.001; }
      if (e.alive) {
        const d = Math.hypot(tx - e.x, tz - e.z);
        if (d > 40) { e.x = tx; e.z = tz; } else { const k = Math.min(1, dt * 6); e.x += (tx - e.x) * k; e.z += (tz - e.z) * k; }
        e.yaw += angWrap(st.y - e.yaw) * Math.min(1, dt * 6); e.speed = st.v; e.turn = st.t;
      } else e.speed *= 0.98;
      e.hp = st.h; e.maxHp = st.m; e.prot = st.p;
    }
    K.floatShip(e, dt);
    shield(e, e.alive && e.prot);
    if (e.net?.kind === 'player') skinFx(e, dt);
  }
  // per-ship skin hook: skin.tick(mesh, { speed, alive, dt, t }) (+ global shipTick hooks) runs for EVERY PvP ship (yours and remote ones),
  // driven by that ship's (synced) speed. GPU effects on wind.uTime (flames, Raul's diamond glints / trail) animate on their own.
  function skinFx(s, dt) {
    const ud = s.mesh?.userData; if (!ud) return;
    ud.fxSpeed = s.speed || 0; ud.fxAlive = !!s.alive;
    const sk = getSkin(ud.skinId), o = { speed: s.speed || 0, alive: !!s.alive, dt, t: game.t, id: s === P() ? myId : s.net?.id }; // id seeds per-ship effects (Storm lightning)
    shipTick(s.mesh, o); // global hooks (each checks mesh.userData.skinId itself)
    if (typeof sk.tick === 'function' && !SHIP_TICKS.includes(sk.tick)) { try { sk.tick(s.mesh, o); } catch (e) { sk.tick = null; console.warn('[pvp skins] tick failed', sk.id, e); } } // skin.tick(mesh, { speed }) registry
  }
  // spawn-protection bubble
  const shieldGeo = new THREE.SphereGeometry(1, 16, 10), shieldMat = new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.16, depthWrite: false });
  function shield(s, on) {
    if (!on) { if (s.shield) s.shield.visible = false; return; }
    if (!s.shield) { s.shield = new THREE.Mesh(shieldGeo, shieldMat); s.shield.renderOrder = 6; scene.add(s.shield); }
    const L = s.mesh.userData.len; s.shield.visible = true; s.shield.position.set(s.x, s.y + 3, s.z); s.shield.scale.set(L * 0.42, L * 0.32, L * 0.62); s.shield.rotation.y = s.yaw;
  }
  function dropShip(obj) {
    const i = enemies.indexOf(obj); if (i >= 0) enemies.splice(i, 1);
    if (obj.mesh) { scene.remove(obj.mesh); K.disposeShip(obj.mesh); }
    obj.bar?.remove(); if (obj.shield) scene.remove(obj.shield);
  }
  function clearPeers() { for (const p of peers.values()) if (p.ship) dropShip(p.ship); peers.clear(); }

  // ---------------- host (loot only) ----------------
  function electHost() {
    const ids = [...(spec.on ? [] : [myId]), ...livePeers().map(p => p.id)].sort(); const h = ids[0] ?? null; // spectators are never host
    if (h === hostId) return;
    const was = isHost; hostId = h; isHost = h === myId;
    if (isHost && !was) { // adopt the old host's piles
      console.info('[pvp] I am the room host now');
    }
  }
  function hostTick() {
    const now = performance.now();
    capPiles(false);
    if (now - (hostTick.worldT || 0) > 10000) { hostTick.worldT = now; sendWorld(true); } // resync: late joiners / missed 'gone's
  }
  // piles never expire; past PVP_PILE_CAP the oldest pile's gold merges into its nearest pile (no gold is ever lost)
  function capPiles(local) {
    const list = [...piles.values()].filter(l => !!l.local === local && !l.taken);
    for (let n = list.length; n > PVP_PILE_CAP; n--) {
      list.sort((a, b) => a.born - b.born); const old = list.shift();
      let to = null, bd = Infinity; for (const l of list) { const d = Math.hypot(l.x - old.x, l.z - old.z); if (d < bd) { bd = d; to = l; } }
      if (!to) break;
      to.value = Math.min(PVP_PILE_MAX, to.value + old.value); to.earned = Math.min(to.value, (to.earned || 0) + (old.earned || 0)); pileLook(to);
      removePile(old.pid);
      if (!local) { room?.send('gone', { pid: old.pid }); room?.send('pv', { pid: to.pid, v: to.value, e: to.earned }); }
    }
  }
  const pileLook = (l) => l.mesh.scale.setScalar(l.value >= 2000 ? 3.2 : l.value >= 500 ? 2.6 : 2);
  function allShips() { const out = []; const pl = P(); if (pl.alive && !me.dead) out.push(pl); for (const p of livePeers()) if (p.ship?.alive) out.push(p.ship); for (const b of bots.values()) if (b.alive) out.push(b); return out; }
  const NO_TARGET = { x: 0, z: 0, alive: false, yaw: 0, speed: 0 };
  function botTarget(e) {
    // local AI (harbor only) only ever hunts YOU: never other AI ships, never other pirates
    const pl = P(), d = Math.hypot(pl.x - e.x, pl.z - e.z);
    return pl.alive && !me.dead && me.protect <= 0 && d < 220 ? pl : NO_TARGET;
  }
  function botSteer(e, desired) { const r = Math.hypot(e.x, e.z); return r > PVP_ARENA_R - 50 ? Math.atan2(-e.x, -e.z) : desired; }
  function pickSpawn(selfShip = null) {
    const ships = allShips().filter(s => s !== selfShip);
    let best = SPAWNS[0], bd = -1;
    for (const pt of SPAWNS.map(q => K.islands ? K.islands.freeSpot(q[0], q[1], 16) : q)) { let d = 1e9; for (const s of ships) d = Math.min(d, Math.hypot(s.x - pt[0], s.z - pt[1])); if (d > bd) { bd = d; best = pt; } }
    return { pt: best, crowded: bd < SAFE_R }; // [solid rocks] spawn points are nudged clear of rocks
  }

  // ---------------- cannon fire / hits ----------------
  function onFire(shooter, shot) {
    if (!room || !shot.length || shooter !== P()) return; // only OUR volleys go on the wire (AI ships are local)
    const id = myId;
    room.send('shot', { o: id, b: shot.map(b => [r2(b.p.x), r2(b.p.y), r2(b.p.z), r2(b.v.x), r2(b.v.y), r2(b.v.z), r2(b.delay)]) });
  }
  function onLocalFire() { markInput(); if (me.protect > 0) { me.protect = 0; } if (me.ret) me.ret.until = Math.max(me.ret.until, performance.now() + RET_QUIET); } // firing restarts the return countdown
  function ownerObj(id) { return peers.get(id)?.ship || null; }
  function onShot(m) {
    const owner = ownerObj(m.o); if (!owner || !Array.isArray(m.b)) return;
    for (const b of m.b.slice(0, 10)) {
      const mesh = K.getBall(); mesh.position.set(b[0], b[1], b[2]);
      balls.push({ mesh, v: new THREE.Vector3(clamp(b[3], -80, 80), clamp(b[4], -40, 60), clamp(b[5], -80, 80)), owner, life: 6, delay: clamp(b[6], 0, 1), visual: true });
    }
    const pl = P(), dist = Math.hypot(owner.x - pl.x, owner.z - pl.z);
    if (m.b[0]) fx.muzzle(new THREE.Vector3(m.b[0][0], m.b[0][1], m.b[0][2]), new THREE.Vector3(m.b[0][3], 0, m.b[0][5]).normalize());
    sfx.enemyBroadside(m.b.length, clamp(1 - dist / 220, 0, 1), false);
  }
  const inside = (s, p) => { const [lx, lz] = K.toLocal(s, p.x, p.z), u = s.mesh.userData; return Math.abs(lx) < u.beam / 2 + 0.7 && Math.abs(lz) < u.len / 2 + 0.6 && p.y > s.y - 1.5 && p.y < s.y + u.len * 0.9; };
  function ballStep(b, p) { // returns true when the ball is spent
    const pl = P();
    const ships = [pl, ...enemies];
    for (const s of ships) {
      if (s === b.owner || !s.alive || (s === pl && me.dead)) continue;
      if (b.owner?.net?.kind === 'bot' && s !== pl) continue; // AI balls only hurt you, never other AI ships / pirates
      if (!inside(s, p)) continue;
      if (b.visual) { fx.hit(p.clone()); return true; }
      if (s === pl ? me.protect > 0 : s.prot) { fx.splash(p); return true; } // bubble soaks it
      const raw = b.owner === pl ? (BALL_DMG[0] + Math.random() * (BALL_DMG[1] - BALL_DMG[0])) * (pl.gunDmg || 1) : (6 + Math.random() * 4) * 1.12 * (b.owner.dmgMul || 1);
      applyHit(s, raw, p.clone(), b.owner); return true;
    }
    return false;
  }
  function applyHit(target, raw, p, shooter) {
    const pl = P(), sid = shooter === pl ? myId : shooter.net?.id; if (!sid) return;
    if (target === pl) return localDamage(raw, sid, p, shooter);
    if (target.net?.kind === 'bot') { target.lastBy = sid; K.damage(target, Math.max(1, Math.round(raw)), p, shooter); return; } // local AI
    if (!target.net || shooter !== pl) return; // only our own hits on other pirates are reported
    me.lastDealtAt = performance.now(); if (me.ret) me.ret.until = me.lastDealtAt + RET_QUIET;
    hitQueue.sid = sid; hitQueue.push([target.net.id, Math.round(raw)]); fx.hit(p); sfx.impact?.({ dmg: raw, maxHp: 100, kill: false, onPlayer: false, armor: 0, v: 0.8 });
    if (shooter === pl) K.popup(p, `-${Math.round(raw)}`, 'hit');
  }
  function flushHits() { if (hitQueue.length && room) room.send('hit', { s: hitQueue.sid, h: hitQueue.slice(0, 12) }); hitQueue = []; hitQueue.sid = null; }
  function localDamage(raw, by, p, shooterObj = null) {
    const pl = P(); if (me.dead || !pl.alive || me.protect > 0) return;
    const amt = Math.max(1, Math.round(raw * (1 - (pl.armor || 0))));
    me.lastDamageAt = performance.now(); me.lastBy = by;
    K.damage(pl, amt, p || new THREE.Vector3(pl.x, pl.y + 3, pl.z), shooterObj);
  }
  function onHit(m) {
    if (!m || typeof m.s !== 'string' || !Array.isArray(m.h)) return;
    const shooter = ownerObj(m.s); if (!shooter) return; // unknown shooter
    const now = performance.now(), bk = buckets.get(m.s) || { tokens: 12, t: now };
    bk.tokens = Math.min(12, bk.tokens + (now - bk.t) / 1000 * 10); bk.t = now; buckets.set(m.s, bk);
    const cap = MAX_HIT;
    for (const [t, d] of m.h.slice(0, 12)) {
      if (bk.tokens < 1) break; bk.tokens--;
      const dmg = clamp(Math.round(+d || 0), 0, cap); if (!dmg) continue;
      if (t === myId) { const pl = P(); if (Math.hypot(shooter.x - pl.x, shooter.z - pl.z) > 230) continue; localDamage(dmg, m.s, null, shooter); }
    }
  }

  // ---------------- deaths, piles, gold ----------------
  const nameOf = (id) => id === myId ? name : (peers.get(id)?.name || (bots.has(id) || String(id).startsWith('b') ? 'an AI ship' : 'a pirate'));
  function addFeed(html) { feed.unshift({ html, t: performance.now() }); feed.length = Math.min(feed.length, 5); renderFeed(); }
  function renderFeed() { const el = $('pvp-feed'); if (!el) return; const now = performance.now(); el.innerHTML = feed.filter(f => now - f.t < 7000).map(f => `<div>${f.html}</div>`).join(''); }
  function onLocalSunk() { // our own hull hit 0 (K.damage already started the sinking animation)
    if (me.dead) return;
    const pl = P(), recent = performance.now() - me.lastDamageAt < 15000;
    let by = recent ? me.lastBy : null;
    const byAi = !!by && (bots.has(by) || String(by).startsWith('b'));
    if (where !== 'arena' || byAi) { // harbor / lone-pirate AI: costs nothing but time, never K/D
      me.dead = true; me.respawn = PVP_RESPAWN; me.killedBy = 'an AI ship'; me.dropped = 0; me.aiDeath = true;
      showDead(true); return;
    }
    me.aiDeath = false;
    const carried = game.gold | 0, afk = idleMs() >= AFK_FARM; // idle ≥ PVP_AFK.farm s: no +100 bonus, no kill credit (anti-farming)
    me.dead = true; me.respawn = PVP_RESPAWN; me.killedBy = by ? nameOf(by) : 'the sea'; me.dropped = carried + (afk ? 0 : PVP_DEATH_BONUS); me.afkDeath = afk;
    if (!afk) { me.deaths++; profile.stats.deaths++; }
    game.gold = 0; save({ now: true });
    const bounty = me.bounty; me.dropped += bounty; me.lostBounty = bounty; resetBounty();
    room?.send('sunk', { v: myId, by, l: me.life, x: r1(pl.x), z: r1(pl.z), g: carried, b: bounty, ...(afk ? { af: 1 } : {}) });
    if (!afk && by && peers.has(by)) boardClaim('v', by, myId, me.life);
    if (isHost) spawnPile(myId, pl.x, pl.z, Math.min(carried, earned.get(myId) ?? PVP_MAX_CARRY) + (afk ? 0 : PVP_DEATH_BONUS) + bounty, false, afk ? 0 : PVP_DEATH_BONUS);
    earned.delete(myId);
    addFeed(`<b>${esc(me.killedBy)}</b> sank <b class="me">${esc(name)}</b>`);
    showDead(true); K.updateHud();
    // rotation: the lobby decides. Queue non-empty = back of the queue (into the harbor after the death screen)
    lobbyCall('died').then((r) => {
      if (r.state === 'queue') { lob.queuedByDeath = true; const q = $('pvp-dead')?.querySelector('.pd-queue'); if (q) { q.textContent = `Sent to the queue, position #${r.pos}`; q.hidden = false; } const re = $('pvp-dead')?.querySelector('.pd-re'); if (re) re.firstChild.textContent = 'To the harbor in '; }
    });
  }
  function onBotSunk(e, src) { // one of our LOCAL AI ships went down: a small local pile, AI tally only
    const by = src === P() || e.lastBy === myId ? myId : null; // only YOUR kills count (AI never credits AI)
    if (!e.fade) spawnPile(e.net.id, e.x, e.z, e.gold || PVP_AI_GOLD, true);
    if (by === myId && !e.fade) { profile.stats.botKills++; save(); }
  }
  // PvP KILLS leaderboard: both the killer and the victim report each player kill; the server records it when they match
  function boardClaim(side, k, v, life, keepalive = false) {
    if (!room || typeof k !== 'string' || typeof v !== 'string') return;
    claimKill({ side, room: `${ROOM_PREFIX}-${roomIdx}`, k, v, life, name, keepalive }).then(r => { if (r) lastClaim = r; });
  }
  function resetBounty() { me.streak = 0; me.bounty = 0; }
  function creditKill(by, victim) {
    if (by !== myId) return;
    // streak bounty: only kills that count (the caller already skips idle victims); the same victim again inside the
    // anti-farm window gives no bounty (the PvP KILLS board drops it too)
    const tn = performance.now(), last = me.pairs.get(victim) || -1e9; me.pairs.set(victim, tn);
    if (tn - last > PVP_BOUNTY.pairWindow * 1000) { me.streak++; const before = me.bounty; me.bounty = Math.min(PVP_BOUNTY.cap, me.streak * PVP_BOUNTY.perKill); if (me.bounty > before && me.bounty >= PVP_BOUNTY.announce && before < PVP_BOUNTY.announce) addFeed(`☠ <b class="me">${esc(name)}</b> has a <b>${me.bounty}g</b> bounty!`); }
    me.kills++; const before = profile.stats.kills; profile.stats.kills++;
    const t = TIERS.find(x => x.kills > before && x.kills <= profile.stats.kills); if (t) skinToast(t);
    sfx.coin(); save({ now: true });
  }
  const seenSunk = new Map(); // dedupe: one sinking per ship life, even if the message arrives twice
  function onSunk(m) {
    if (!m || typeof m.v !== 'string') return;
    const sk = `${m.v}:${m.l | 0}`, now = performance.now(); if (now - (seenSunk.get(sk) || -1e9) < 20000) return; seenSunk.set(sk, now);
    if (seenSunk.size > 200) for (const [k2, t2] of seenSunk) if (now - t2 > 20000) seenSunk.delete(k2);
    if (m.bot) return; // (old clients) AI ships are local now
    const victim = peers.get(m.v)?.ship;
    if (victim && victim.alive && victim.remote) { victim.alive = false; victim.sinking = 0.001; sfx.sink(false); fx.ring(new THREE.Vector3(victim.x, 0, victim.z), 3, 16, 2.2); if (victim.netState) victim.netState.a = false; }
    const by = typeof m.by === 'string' ? m.by : null;
    const afk = !!m.af; // the victim had been idle: no kill credit, no +100
    addFeed(`<b class="${by === myId ? 'me' : ''}">${esc(by ? nameOf(by) : 'the sea')}</b> sank <b>${esc(nameOf(m.v))}</b>${afk ? ' <i class="muted">(idle · no credit)</i>' : ''}`);
    if (!afk) creditKill(by, m.v);
    const vb = clamp(m.b | 0, 0, Math.min(PVP_BOUNTY.cap, peers.get(m.v)?.bt ?? 0)); // never more than the bounty they showed
    if (vb >= PVP_BOUNTY.announce) addFeed(`☠ <b>${esc(by ? nameOf(by) : 'the sea')}</b> claimed <b>${esc(nameOf(m.v))}</b>'s <b>${vb}g</b> bounty`);
    if (!afk && by === myId && peers.has(m.v)) boardClaim('k', myId, m.v, m.l | 0);
    if (isHost) {
      const x = clamp(+m.x || 0, -PVP_ARENA_R, PVP_ARENA_R), z = clamp(+m.z || 0, -PVP_ARENA_R, PVP_ARENA_R);
      const g = clamp(Math.floor(+m.g || 0), 0, earned.has(m.v) ? earned.get(m.v) : PVP_MAX_CARRY);
      spawnPile(m.v, x, z, g + (afk ? 0 : PVP_DEATH_BONUS) + vb, false, afk ? 0 : PVP_DEATH_BONUS); earned.delete(m.v);
    }
  }
  function spawnPile(v, x, z, value, local = false, earnedPart = local ? value : 0) { // earnedPart: newly created gold (AI gold / +100 bonus), the part the holder perk boosts
    const pid = `${String(v).slice(-6)}${(++pileSeq).toString(36)}${myId.slice(-3)}`;
    if (!local) room?.send('pile', { pid, x: r1(x), z: r1(z), v: value, e: earnedPart });
    addPile(pid, x, z, value, PVP_PILE_LIFE, local, earnedPart);
  }
  function addPile(pid, x, z, value, ttl, local = false, earnedPart = 0) {
    if (typeof pid !== 'string' || piles.has(pid)) return;
    value = clamp(Math.floor(+value || 0), 0, PVP_PILE_MAX); // merged piles can be big; never expire (life Infinity)
    const g = makeChest(); scene.add(g);
    const l = { mesh: g, x: +x || 0, z: +z || 0, value, life: Infinity, ph: Math.random() * 6, pid, expires: Infinity, born: performance.now() };
    pileLook(l);
    l.local = local; l.earned = clamp(Math.floor(+earnedPart || 0), 0, value); loot.push(l); piles.set(pid, l); fx.ring(new THREE.Vector3(l.x, 0, l.z), 1, 9, 1.6);
    if (Math.hypot(l.x - P().x, l.z - P().z) < 200) K.popup(new THREE.Vector3(l.x, 6, l.z), `${value} GOLD`, 'hit');
  }
  function removePile(pid) { const l = piles.get(pid); if (!l) return; piles.delete(pid); const i = loot.indexOf(l); if (i >= 0) loot.splice(i, 1); scene.remove(l.mesh); }
  function lootStep(l) { // main loop, per pile: claim it when we sail over it
    if (!piles.has(l.pid)) return;
    const pl = P(); if (me.dead || !pl.alive) return;
    if (Math.hypot(l.x - pl.x, l.z - pl.z) > PICK_R) return;
    const now = performance.now(); if (l.claimT && now - l.claimT < 1500) return; l.claimT = now;
    if (l.local) { applyGot({ pid: l.pid, to: myId, v: l.value }); return; } // local AI loot
    if (isHost) grant(l.pid, myId); else room?.send('claim', { pid: l.pid, i: myId });
  }
  function grant(pid, to) { // host only: first claimant within reach gets the pile
    const l = piles.get(pid); if (!l || l.taken || typeof to !== 'string') return;
    const ship = to === myId ? P() : peers.get(to)?.ship; if (!ship || !ship.alive || Math.hypot(ship.x - l.x, ship.z - l.z) > PICK_R + 18) return;
    l.taken = true; earned.set(to, (earned.get(to) || 0) + l.value);
    room?.send('got', { pid, to, v: l.value }); applyGot({ pid, to, v: l.value });
  }
  function applyGot(m) {
    const l = piles.get(m.pid); const v = clamp(Math.floor(+m.v || 0), 0, l ? l.value : 0);
    if (l) { if (m.to !== myId) K.popup(l.mesh.position.clone().setY(5), `${nameOf(m.to)} +${v}`, 'hit'); removePile(m.pid); }
    const hb = m.to === myId && l ? holderMul(l.earned) : 0; // HOLDER +5% on earned gold only
    if (m.to === myId && v) { game.gold += v + hb; me.gold += v + hb; sfx.coin(); K.popup(new THREE.Vector3(P().x, 6, P().z), `+${v} GOLD`); K.updateHud(); save(); }
  }
  function respawn() {
    if (where === 'harbor' || (where === 'arena' && me.aiDeath && !room)) { respawnHarbor(); return; }
    if (lob.queuedByDeath) { lob.queuedByDeath = false; toHarbor('IN THE QUEUE', `position #${lob.pos || '?'} · farm the harbor AI while you wait`); return; }
    const pl = P(), { pt, crowded } = pickSpawn(pl);
    me.dead = false; me.life++; me.protect = PVP_PROTECT * (crowded ? 2 : 1); me.lastBy = null; me.lastDamageAt = 0;
    Object.assign(pl, { alive: true, sinking: 0, hp: pl.maxHp, x: pt[0], z: pt[1], yaw: Math.atan2(-pt[0], -pt[1]), speed: 0, sail: 1, anchor: false, calm: 0, repT: 0 });
    pl.cd.port = pl.cd.star = 0; K.resetCamera(); showDead(false); K.updateHud();
    K.banner(crowded ? 'BACK AT SEA · extra protection' : 'BACK AT SEA', `spawn protection ${Math.round(me.protect)} s (ends when you fire)`);
  }

  // ---------------- per-frame ----------------
  function update(dt) {
    if (!active) return;
    const now = performance.now(), pl = P();
    if (room) electHost();
    if (spec.on) { specTick(dt, now); return; }
    if (me.protect > 0) me.protect = Math.max(0, me.protect - dt);
    shield(pl, pl.alive && !me.dead && me.protect > 0); skinFx(pl, dt);
    lobbyTick(dt); aiTick(dt); afkTick(); retTick();
    if (me.dead) { me.respawn -= dt; const el = $('pvp-dead-t'); if (el) el.textContent = Math.max(0, Math.ceil(me.respawn)); if (me.respawn <= 0) respawn(); }
    // arena edge
    const r = Math.hypot(pl.x, pl.z); if (r > PVP_ARENA_R) { pl.x *= PVP_ARENA_R / r; pl.z *= PVP_ARENA_R / r; if (!me.edgeT || now - me.edgeT > 5000) { me.edgeT = now; K.banner('EDGE OF THE ARENA', 'turn back, captain'); } }
    if (room && isHost) hostTick();
    // peers that went silent: sink their ship from view
    for (const [id, p] of peers) if (now - p.heard > PEER_TIMEOUT) { if (p.ship) dropShip(p.ship); peers.delete(id); }
    // (our state is sent by the transport at PVP_NET hz via stateMsg; one batched message per tick)
    hitT -= dt; if (hitT <= 0) { hitT = 0.15; flushHits(); }
    hudT -= dt; if (hudT <= 0) { hudT = 0.5; hud(); renderFeed(); if (!$('pvp-menu').classList.contains('hidden')) renderBoard(); }
    saveT -= dt; if (saveT <= 0) { saveT = 10; save(); }
  }
  function stateMsg() { // the transport asks for this once per tick
    if (where !== 'arena' || spec.on) return null;
    const pl = P(), lv = getRunLevels();
    const m = { i: myId, l: me.life, x: r1(pl.x), z: r1(pl.z), y: r2(pl.yaw), v: r1(pl.speed), t: r2(pl.turn || 0), h: Math.round(pl.hp), m: pl.maxHp, a: me.dead || !pl.alive ? 0 : 1, p: me.protect > 0 ? 1 : 0,
      bt: me.bounty, n: name, lv: UPGRADES.map(u => lv[u.id] || 0), sk: skinId(), k: me.kills, d: me.deaths, g: me.gold, K: profile.stats.kills, D: profile.stats.deaths };
    return m;
  }

  // ---------------- HUD / menus ----------------
  function hud() {
    if (!active) return;
    const lab = document.querySelectorAll('#hud-top .label');
    if (lab.length === 4) { lab[0].textContent = 'KILLS'; lab[1].textContent = 'DEATHS'; lab[3].textContent = 'K/D'; }
    $('score').textContent = me.kills; $('wave').textContent = me.deaths; $('gold').textContent = game.gold; $('sunk').textContent = kd(profile.stats.kills, profile.stats.deaths);
    const n = livePeers().length + 1, ai = [...bots.values()].filter(b => b.alive).length;
    $('enemies-left').textContent = where === 'harbor' ? `HARBOR${lob.state === 'queue' ? ` · queue #${lob.pos}` : ''}${ai ? ` · ${ai} AI` : ''}`
      : room ? `ARENA · ${n}/${lob.cap} pirates${ai ? ` · ${ai} AI` : ''}${lob.queue ? ` · ${lob.queue} queued` : ''}${isHost ? ' · host' : ''}` : 'joining…';
  }
  function showDead(on) {
    const el = $('pvp-dead'); el.classList.toggle('hidden', !on); if (!on) return;
    el.querySelector('.pd-by').textContent = `Sunk by ${me.killedBy}`;
    const q = el.querySelector('.pd-queue'); if (q) q.hidden = true; const re = el.querySelector('.pd-re'); if (re) re.firstChild.textContent = 'Back at sea in ';
    el.querySelector('.pd-drop').textContent = me.aiDeath ? 'AI ships cost you nothing but time: gold and K/D unchanged.'
      : me.afkDeath ? `You were idle: you dropped ${me.dropped} gold (no bonus) and it does not count for K/D.` : `You dropped ${me.dropped} gold (${me.dropped - PVP_DEATH_BONUS - (me.lostBounty || 0)} carried + ${PVP_DEATH_BONUS} bonus${me.lostBounty ? ` + ${me.lostBounty} bounty` : ''}). Upgrades kept.`;
    el.querySelector('.pd-kd').innerHTML = `K/D <b>${kd(profile.stats.kills, profile.stats.deaths)}</b> · ${profile.stats.kills} kills · ${profile.stats.deaths} deaths<br><span class="muted">this session: ${me.kills} kills · ${me.deaths} deaths · ${me.gold} gold</span>`;
  }
  function renderBoard() {
    const rows = [{ id: myId, name, k: me.kills, d: me.deaths, g: me.gold, K: profile.stats.kills, D: profile.stats.deaths }, ...livePeers().map(p => ({ id: p.id, name: p.name, k: p.k, d: p.d, g: p.g, K: p.K, D: p.D }))].sort((a, b) => b.k - a.k || a.d - b.d);
    $('pvp-board').innerHTML = `<tr><th>PIRATE</th><th>K</th><th>D</th><th>GOLD</th><th>K/D</th></tr>` + rows.map(r => `<tr class="${r.id === myId ? 'me' : ''}"><td>${esc(r.name)}${r.id === hostId ? ' <i class="muted">host</i>' : ''}</td><td>${r.k}</td><td>${r.d}</td><td>${r.g}</td><td title="lifetime ${r.K} kills / ${r.D} deaths">${kd(r.K, r.D)}</td></tr>`).join('');
  }
  function renderMenu() {
    const m = $('pvp-menu'); if (!m) return;
    $('pvp-name').value = name;
    const st = profile.stats, nx = nextTier(st.kills);
    $('pvp-kd').innerHTML = `Lifetime K/D <b>${kd(st.kills, st.deaths)}</b> · ${st.kills} player kills · ${st.deaths} deaths · ${st.botKills} AI sunk${nx ? `<br><span class="muted">${nx.kills - st.kills} more kills unlock ${nx.name}</span>` : ''}`;
    const grid = $('pvp-skins'); grid.innerHTML = '';
    for (const t of TIERS) {
      const ok = canUse(t.id, st.kills), c = document.createElement('button'); c.type = 'button'; c.className = `pvp-skin${ok ? '' : ' locked'}${t.id === skinId() ? ' on' : ''}`; c.dataset.skin = t.id;
      const sw = skinSwatch(pvpSkin(t.id), 96, 48); c.appendChild(sw);
      const lab = document.createElement('span'); lab.innerHTML = `<b>${t.name}</b>${ok ? (t.id === skinId() ? 'SELECTED' : 'TAP TO USE') : `${t.kills - st.kills} kills to unlock`}`; c.appendChild(lab);
      c.disabled = !ok; c.onclick = () => pickSkin(t.id); grid.appendChild(c);
    }
    $('pvp-wallet-state').textContent = wallet ? `Saving to this device + wallet ${wallet.slice(0, 4)}…${wallet.slice(-4)}` : 'Saving on this device automatically.';
    $('pvp-wallet').textContent = wallet ? 'Disconnect wallet' : 'Connect wallet to save';
    holderUi();
    renderBoard();
  }
  function pickSkin(id) {
    if (!canUse(id, profile.stats.kills)) return;
    profile.skins.equipped = id; K.rebuildShip(getRunLevels()); sfx.equip?.(); save({ now: true }); renderMenu();
  }
  function skinToast(t) {
    document.getElementById('skin-toast')?.remove();
    const el = document.createElement('div'); el.id = 'skin-toast';
    el.innerHTML = `<div class="st-txt"><b>NEW SKIN UNLOCKED</b><span>${t.name} · ${t.kills} kills</span></div><button class="buy">EQUIP</button>`;
    const sw = skinSwatch(pvpSkin(t.id), 88, 44); sw.className = 'st-sw'; el.prepend(sw);
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) el.addEventListener(ev, e => e.stopPropagation());
    el.querySelector('button').onclick = (e) => { e.stopPropagation(); pickSkin(t.id); el.remove(); };
    document.body.appendChild(el); setTimeout(() => el.remove(), 6000);
  }
  async function walletButton() {
    const msg = (t) => { $('pvp-wallet-state').textContent = t; };
    if (wallet) { signOut(); wallet = ''; refreshHolder(); renderMenu(); return; }
    try {
      $('pvp-wallet').disabled = true;
      const r = await walletSignIn(msg); wallet = r.wallet;
      const use = await linkWallet(r.profile, snapshot());
      const cur = getRunLevels(); profile = use; game.gold = use.gold;
      if (JSON.stringify(cur) !== JSON.stringify(use.levels)) setRunLevels(use.levels); else K.rebuildShip(use.levels);
      K.updateHud(); renderMenu(); refreshHolder(); msg(`Linked! Saving to this device + wallet ${wallet.slice(0, 4)}…${wallet.slice(-4)}`);
    } catch (e) { msg(String(e?.message || e).slice(0, 120)); }
    finally { $('pvp-wallet').disabled = false; }
  }
  const capNo = () => ($('captain-name')?.textContent.match(/#(\S+)$/) || [])[1];
  function setName(v, keep = true) { // the chosen PvP name everywhere: HUD (top-left), menu field, name tag / feed / boards (via state 'n')
    name = v; if (keep) saveName(v);
    const hn = $('captain-name'); if (hn) { const m = hn.textContent.match(/ · #\S+$/); hn.textContent = `${name.toUpperCase()}${m ? m[0] : ''}`; }
    const mn = $('pvp-name'); if (mn) mn.value = name;
  }
  function addrCheck() {
    const inp = $('pvp-entry-addr'), msg = $('pvp-entry-addr-msg'); if (!inp) return false;
    const v = inp.value.trim(), ok = isValidSolanaAddress(v);
    inp.classList.toggle('good', ok); inp.classList.toggle('bad', !!v && !ok);
    if (msg) msg.textContent = !v ? 'Used for airdrops. Never asks for keys or signatures.' : ok ? `Ahoy ${shortWallet(v)}! Used for airdrops. Never asks for keys or signatures.` : 'That doesn’t look like a Solana address (base58, 32–44 characters).';
    return ok;
  }
  function entryAirdrop() { // optional: a valid address is saved (same slot as Waves) and stored privately server-side; anything else is ignored
    const inp = $('pvp-entry-addr'); if (!inp || ON_PORTAL) return;
    const v = inp.value.trim(); if (!isValidSolanaAddress(v)) return;
    saveWallet(v); saveAirdrop(v, name).catch(() => {});
  }
  let uiWired = false;
  function wireUi() {
    if (uiWired) return; uiWired = true;
    $('btn-pvp-menu').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggleMenu(); });
    $('pvp-menu-close').onclick = () => toggleMenu(false);
    $('pvp-wallet').onclick = walletButton;
    $('pvp-holder-claim')?.addEventListener('click', (e) => { e.stopPropagation(); claimHolderGold(); });
    $('pvp-name').addEventListener('change', () => setName(esc($('pvp-name').value).trim().slice(0, 20) || pirateName()));
    $('pvp-dead-menu').onclick = () => K.toTitle();
    $('pvp-join').onclick = (e) => { e.stopPropagation(); lob.state === 'queue' ? leaveQueue() : joinBattle(); };
    $('pvp-harbor-spec').onclick = (e) => { e.stopPropagation(); harborSpectate(); };
    $('pvp-offer-yes').onclick = (e) => { e.stopPropagation(); acceptOffer(); };
    $('pvp-offer-no').onclick = (e) => { e.stopPropagation(); declineOffer(); };
    $('pvp-entry-go').onclick = (e) => { e.stopPropagation(); const v = esc($('pvp-entry-name').value).trim().slice(0, 20); if (v) setName(v); else setName(getSavedName() || (capNo() ? `CAPT. #${capNo()}` : name), false); entryAirdrop(); $('pvp-entry').classList.add('hidden'); K.banner('THE HARBOR', 'AI ships for small gold · JOIN BATTLE when you are ready'); };
    // [airdrop] optional SOLANA WALLET paste field, same stored wallet + checks as the Waves game-over entry; never blocks SET SAIL
    if (ON_PORTAL) document.querySelectorAll('.pvp-airdrop').forEach(n => n.remove()); // crypto-free portal builds
    const addr = $('pvp-entry-addr');
    if (addr) {
      addr.addEventListener('input', addrCheck);
      addr.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!addr.value.trim() || addrCheck()) $('pvp-entry-go').click(); } });
      $('pvp-entry-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addr.focus(); } });
    }
    for (const id of ['pvp-return', 'pvp-menu-return']) $(id)?.addEventListener('click', (e) => { e.stopPropagation(); requestReturn(); });
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) $('pvp-return')?.addEventListener(ev, e => e.stopPropagation());
    $('pvp-entry-wallet').onclick = (e) => { e.stopPropagation(); $('pvp-entry').classList.add('hidden'); toggleMenu(true); };
    for (const id of ['pvp-harbor', 'pvp-offer', 'pvp-entry', 'pvp-afk']) for (const ev of ['pointerdown', 'touchstart', 'mousedown']) $(id)?.addEventListener(ev, e => e.stopPropagation());
    for (const ev of ['keydown', 'pointerdown', 'touchstart', 'wheel']) addEventListener(ev, () => { if (active) markInput(); }, { passive: true, capture: true });
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) { $('pvp-menu').addEventListener(ev, e => e.stopPropagation()); $('pvp-dead').addEventListener(ev, e => e.stopPropagation()); }
    addEventListener('keydown', (e) => { if (!active || e.target.tagName === 'INPUT') return; if (e.code === 'Tab') { e.preventDefault(); toggleMenu(); } });
    addEventListener('pagehide', () => leave(true));
  }
  function toggleMenu(on) { const m = $('pvp-menu'); const show = on ?? m.classList.contains('hidden'); m.classList.toggle('hidden', !show); if (show) { renderMenu(); const kb = $('pvp-kills'); if (kb) { mountKillsBoard(kb); renderKills(kb); } } }

  // ---------------- harbor UI ----------------
  function harborUi() {
    const h = $('pvp-harbor'); if (!h) return;
    const show = active && where === 'harbor' && !spec.on; h.classList.toggle('hidden', !show); if (!show) return;
    const b = $('pvp-join'), t = $('pvp-harbor-t');
    if (lob.state === 'queue') { b.textContent = 'LEAVE QUEUE'; t.innerHTML = `IN THE QUEUE · <b>#${lob.pos}</b> of ${lob.queue} · arena ${lob.players}/${lob.cap}`; }
    else if (lob.state === 'offer') { b.textContent = 'SET SAIL!'; t.innerHTML = '<b>BATTLE READY!</b>'; }
    else { b.textContent = 'JOIN BATTLE'; t.innerHTML = `THE HARBOR · AI ships pay <b>${harborGold(totalLevel())}</b> gold each${lob.players ? ` · arena ${lob.players}/${lob.cap}` : ''}${HOLDER_ENABLED && holder.on ? ' <span class="pvp-holder">HOLDER +5%</span>' : ''}`; }
    b.onclick = (e) => { e.stopPropagation(); lob.state === 'queue' ? leaveQueue() : lob.state === 'offer' ? acceptOffer() : joinBattle(); };
  }
  function showOffer(on) { $('pvp-offer')?.classList.toggle('hidden', !on); if (on) $('pvp-offer-t').textContent = Math.ceil(Math.max(0, (lob.offerUntil - performance.now()) / 1000)); }
  async function harborSpectate() { if (where !== 'harbor') return; if (lob.state === 'queue') K.banner('SPECTATING', 'you keep your queue place while you watch'); clearLocalAi(true); await specBegin(); }

  // ---------------- SPECTATE ----------------
  const LS_BOARD = 'pfp_spec_board';
  const skinIcons = new Map();
  const skinIcon = (id) => { if (!skinIcons.has(id)) { try { skinIcons.set(id, skinSwatch(pvpSkin(id), 30, 16).toDataURL()); } catch { skinIcons.set(id, ''); } } return skinIcons.get(id); };
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  function spectate(on = true) { spec.want = !!on; }
  async function specBegin() {
    spec.on = true; spec.mode = 'leader'; spec.target = null; spec.emptyT = 0; spec.camLock = 2;
    const pl = P(); me.dead = true; me.protect = 0; pl.alive = false; pl.hp = 0; pl.speed = 0; pl.mesh.visible = false; if (pl.shield) pl.shield.visible = false;
    spec.maxDist = K.controls.maxDistance; K.controls.maxDistance = 520;
    document.documentElement.classList.add('pvp-spec'); wireSpec();
    const open = lsGet(LS_BOARD); setBoard(open === null ? matchMedia('(min-width: 700px) and (min-height: 480px)').matches : open === '1', false);
    K.banner('SPECTATING', 'watching the arena · you are invisible to the pirates');
    await specJoin(1);
    if (!active || !spec.on) return;
    specHud(); renderSpecBoard();
  }
  async function specJoin(idx) { // receive-only join: listen, never announce a ship (the lobby checks the spectator budget)
    room?.close(); room = null; clearPeers(); for (const pid of [...piles.keys()]) removePile(pid); isHost = false; hostId = null;
    const seat = await net.lobby('spec', lobbyOpts());
    if (!active || !spec.on) return;
    if (seat.state === 'full') { K.banner('SPECTATOR SEATS FULL', 'the free servers are at capacity, try again soon'); spec.emptyT = -30; return; }
    roomIdx = idx; let r;
    try { r = await net.openRoom(idx); } catch (e) { console.warn('[pvp spectate] join failed', e?.message); K.banner('ARENA OFFLINE', 'retrying…'); spec.emptyT = 15; return; }
    if (!active || !spec.on) { r.close(); return; }
    room = r; wire(r); where = 'spec'; r.send('hello', { i: myId }, { now: true }); // the host answers with the gold piles; we never send a state
  }
  function specToHarbor() { // EXIT / JOIN BATTLE from spectate: back to our harbor (the queue place, if any, is kept)
    if (!spec.on) return; room?.close(); room = null; clearPeers(); for (const pid of [...piles.keys()]) removePile(pid);
    const left = net.lobby('leave', lobbyOpts()).then(() => { if (lob.state === 'queue') return lobbyCall('play'); }).catch(() => {}); // (spec seat freed; a queued seat id re-queues at its place only if still alive)
    specOff(); where = 'harbor'; document.documentElement.classList.add('pvp-harbor'); respawnHarbor(); harborUi(); K.banner('THE HARBOR', 'JOIN BATTLE when you are ready');
    return left;
  }
  function specOff() {
    if (!spec.on) return;
    spec.on = false; spec.want = false; spec.target = null; setHudOff(false);
    document.documentElement.classList.remove('pvp-spec');
    const pl = P(); pl.mesh.visible = true; if (spec.maxDist) K.controls.maxDistance = spec.maxDist; me.dead = false;
  }
  const specPlayers = () => livePeers().filter(p => p.ship && p.st).sort((a, b) => (b.k - a.k) || (a.d - b.d) || (b.K - a.K));
  function specFollow(id, mode = 'manual') { spec.target = id; spec.mode = mode; spec.camLock = 1.6; specHud(); renderSpecBoard(); }
  function specCycle(dir) {
    const list = specPlayers(); if (!list.length) return;
    const i = list.findIndex(p => p.id === spec.target), n = list[((i < 0 ? 0 : i + dir) % list.length + list.length) % list.length];
    specFollow(n.id, 'manual');
  }
  function specTick(dt, now) {
    lobbyTick(dt);
    for (const [id, p] of peers) if (now - p.heard > PEER_TIMEOUT) { if (p.ship) dropShip(p.ship); peers.delete(id); }
    const list = specPlayers();
    // pick who to watch: the kill leader by default, else the chosen captain while they're in the room
    if (spec.mode === 'leader') { const lead = list[0]?.id || null; if (lead !== spec.target) { spec.target = lead; spec.camLock = Math.max(spec.camLock, 1.2); } }
    else if (spec.mode === 'manual' && !peers.has(spec.target)) { spec.mode = 'leader'; spec.target = list[0]?.id || null; }
    const tgt = spec.mode === 'overview' ? null : peers.get(spec.target)?.ship;
    const pl = P(), tx = tgt ? tgt.x : 0, tz = tgt ? tgt.z : 0;
    // smooth camera: the hidden rig glides to the target (long moves glide fast), the camera keeps its orbit offset
    const d = Math.hypot(tx - pl.x, tz - pl.z), k = 1 - Math.exp(-dt * (d > 120 ? 2.2 : 5));
    pl.x += (tx - pl.x) * k; pl.z += (tz - pl.z) * k;
    if (tgt) { pl.yaw += angWrap(tgt.yaw - pl.yaw) * Math.min(1, dt * 3); pl.speed = tgt.speed; } else pl.speed = 0;
    pl.alive = false; pl.mesh.visible = false;
    // after a camera change, ease the distance / height (then the viewer is free to orbit and zoom)
    if (spec.camLock > 0) {
      spec.camLock -= dt;
      const cam = K.camera, c = K.controls.target, off = cam.position.clone().sub(c), portrait = cam.aspect < 1;
      const want = spec.mode === 'overview' ? (portrait ? 430 : 330) : (portrait ? 62 : 44), pitch = spec.mode === 'overview' ? 0.95 : 0.42;
      const len = off.length() || 1, flat = Math.hypot(off.x, off.z) || 1, kk = 1 - Math.exp(-dt * 3.5);
      const nl = len + (want - len) * kk, curP = Math.atan2(off.y, flat), np = curP + (pitch - curP) * kk;
      const hx = off.x / flat, hz = off.z / flat; cam.position.set(c.x + hx * Math.cos(np) * nl, c.y + Math.sin(np) * nl, c.z + hz * Math.cos(np) * nl);
    }
    // an empty room: look for an active one now and then (rooms fill from 1 up); the socket itself auto-reconnects
    if (!room) { spec.emptyT += dt; if (spec.emptyT > 30) { spec.emptyT = 0; specJoin(1); } } // reconnect / retry a full spectator budget
    hudT -= dt; if (hudT <= 0) { hudT = 0.5; specHud(); renderFeed(); renderSpecBoard(); }
  }
  function specHud() {
    if (!spec.on) return;
    const list = specPlayers(), p = spec.mode === 'overview' ? null : peers.get(spec.target);
    const who = $('spec-name'), st = $('spec-stats'), ic = $('spec-skin');
    if (p) { who.textContent = p.name; st.textContent = `${tierOf(p.sk)?.name || 'CLASSIC'} · ${p.k} kills · ${p.d} deaths · K/D ${kd(p.K, p.D)}${p.bt ? ` · ☠ ${p.bt}g bounty` : ''}`; ic.style.backgroundImage = `url(${skinIcon(p.sk)})`; ic.hidden = false; }
    else { who.textContent = spec.mode === 'overview' ? 'BATTLEFIELD OVERVIEW' : 'WAITING FOR PIRATES…'; st.textContent = list.length ? 'tap a captain or ◀ ▶ to follow' : 'nobody is fighting in this room right now'; ic.hidden = true; }
    $('spec-mode').textContent = spec.mode === 'leader' ? 'FOLLOWING THE KILL LEADER' : spec.mode === 'overview' ? 'OVERVIEW' : 'FOLLOWING';
    $('spec-room').textContent = `ARENA · ${list.length} ${list.length === 1 ? 'PIRATE' : 'PIRATES'}${lob.queue ? ` · ${lob.queue} QUEUED` : ''}${room?.open ? '' : ' · reconnecting…'}`;
    $('spec-leader').classList.toggle('on', spec.mode === 'leader'); $('spec-overview').classList.toggle('on', spec.mode === 'overview');
  }
  function renderSpecBoard() {
    if (!spec.on) return; const t = $('spec-table'); if (!t) return;
    const list = specPlayers();
    const html = `<tr><th></th><th>CAPTAIN</th><th>K</th><th>D</th><th>K/D</th><th title="lifetime K/D">LIFE</th><th title="streak bounty">☠</th></tr>` + (list.length ? list.map((p, i) =>
      `<tr data-id="${p.id}" class="${p.id === spec.target && spec.mode !== 'overview' ? 'on' : ''}"><td>${i + 1}</td><td><i class="sb-skin" style="background-image:url(${skinIcon(p.sk)})"></i>${esc(p.name)}</td><td>${p.k}</td><td>${p.d}</td><td>${kd(p.k, p.d)}</td><td>${kd(p.K, p.D)}</td><td class="sb-bounty">${p.bt ? p.bt : ''}</td></tr>`).join('')
      : `<tr><td colspan="7" class="muted">No captains in this room yet</td></tr>`);
    if (t._html !== html) { t._html = html; t.innerHTML = html; } // only touch the DOM when something changed
  }
  function setBoard(open, remember = true) { $('spec-board')?.classList.toggle('open', open); $('spec-board-tab')?.setAttribute('aria-expanded', open); if (remember) lsSet(LS_BOARD, open ? '1' : '0'); }
  function setHudOff(off) {
    spec.hudOff = off; document.documentElement.classList.toggle('hud-off', off);
    if (off) K.banner('HUD HIDDEN', 'press H or double-tap to bring it back');
  }
  function wireSpec() {
    if (spec.wired) return; spec.wired = true;
    const tap = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); };
    tap('spec-prev', () => specCycle(-1)); tap('spec-next', () => specCycle(1));
    tap('spec-leader', () => specFollow(null, 'leader')); tap('spec-overview', () => specFollow(spec.target, spec.mode === 'overview' ? 'leader' : 'overview'));
    tap('spec-hide', () => setHudOff(true)); tap('spec-exit', () => specToHarbor()); tap('spec-join', async () => { await specToHarbor(); joinBattle(); });
    tap('spec-board-tab', () => setBoard(!$('spec-board').classList.contains('open')));
    $('spec-table').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) { e.stopPropagation(); specFollow(tr.dataset.id, 'manual'); } });
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) for (const id of ['spec-hud', 'spec-board']) $(id).addEventListener(ev, e => e.stopPropagation());
    addEventListener('keydown', (e) => {
      if (!spec.on || e.target.tagName === 'INPUT') return;
      if (e.code === 'KeyH') setHudOff(!spec.hudOff);
      else if (e.code === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); setBoard(!$('spec-board').classList.contains('open')); }
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') specCycle(-1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') specCycle(1);
      else if (e.code === 'KeyO') specFollow(spec.target, spec.mode === 'overview' ? 'leader' : 'overview');
      else if (e.code === 'KeyL') specFollow(null, 'leader');
    }, true);
    // phones: double-tap anywhere brings a hidden HUD back
    let lastTap = 0;
    addEventListener('touchend', () => { if (!spec.on || !spec.hudOff) return; const t = performance.now(); if (t - lastTap < 320) setHudOff(false); lastTap = t; });
    addEventListener('dblclick', () => { if (spec.on && spec.hudOff) setHudOff(false); });
  }

  // ---------------- lifecycle ----------------
  async function begin() {
    active = true; wireUi(); document.documentElement.classList.add('pvp');
    me.life = 0; me.kills = me.deaths = me.gold = 0; me.dead = false; me.protect = 99; feed.length = 0;
    const pl = P(); pl.x = 0; pl.z = 0;
    where = 'harbor'; Object.assign(lob, { state: 'harbor', pos: 0, offerUntil: 0, lastPoll: 0, queuedByDeath: false }); me.lastInput = performance.now();
    if (spec.want) return specBegin();
    document.documentElement.classList.add('pvp-harbor');
    respawnHarbor(); hud(); harborUi(); lobbyCall('poll').then(harborUi);
    const en = $('pvp-entry'); if (en) { $('pvp-entry-name').value = getSavedName(); $('pvp-entry-name').placeholder = capNo() ? `CAPT. #${capNo()}` : name; const a = $('pvp-entry-addr'); if (a) { a.value = getSavedWallet(); addrCheck(); } en.classList.remove('hidden'); }
  }
  // quit-to-dodge / AFK in a fight: leaving the arena within 10 s of taking PvP damage counts as a death (gold drops for the others)
  function combatLog(unloading) {
    const pl = P(), by = me.lastBy && !String(me.lastBy).startsWith('b') ? me.lastBy : null; if (!by) return; // AI damage never counts
    const carried = game.gold | 0, bounty = me.bounty; profile.stats.deaths++; me.deaths++; game.gold = 0; resetBounty();
    room?.send('sunk', { v: myId, by, l: me.life, x: r1(pl.x), z: r1(pl.z), g: carried, b: bounty }, { now: true });
    if (peers.has(by)) boardClaim('v', by, myId, me.life, unloading);
    if (isHost) spawnPile(myId, pl.x, pl.z, carried + PVP_DEATH_BONUS + bounty, false, PVP_DEATH_BONUS);
    me.life++; K.updateHud();
  }
  function leave(unloading = false) {
    if (!active) return;
    if (spec.on) { net.lobby('leave', lobbyOpts({ keepalive: true })); specOff(); if (unloading) return; active = false; harborUi(); document.documentElement.classList.remove('pvp'); room?.close(); room = null; clearPeers(); for (const pid of [...piles.keys()]) removePile(pid); isHost = false; hostId = null; return; }
    const pl = P();
    if (where === 'arena' && !me.dead && pl.alive && inCombat()) combatLog(unloading); // closing / reloading within 10 s of combat = a death
    save({ now: true, keepalive: unloading, force: true });
    room?.send('bye', { i: myId }, { now: true });
    net.lobby('leave', lobbyOpts({ keepalive: true })); // free the arena seat / queue place for the next pirate
    if (unloading) return; // the page is going away; the socket closes with it
    active = false; document.documentElement.classList.remove('pvp');
    room?.close(); room = null; clearPeers();
    for (const pid of [...piles.keys()]) removePile(pid);
    isHost = false; hostId = null; showDead(false); toggleMenu(false); clearLocalAi(true); where = 'harbor'; showOffer(false);
    document.documentElement.classList.remove('pvp-harbor'); harborUi(); $('pvp-entry')?.classList.add('hidden'); $('pvp-afk')?.classList.add('hidden');
    if (P().shield) P().shield.visible = false;
    const lab = document.querySelectorAll('#hud-top .label'); if (lab.length === 4) { lab[0].textContent = 'SCORE'; lab[1].textContent = 'WAVE'; lab[3].textContent = 'SUNK'; }
  }

  const api = { myId, prepare, applyProfile, begin, leave, update, updateRemote, botTarget, botSteer, ballStep, onFire, onLocalFire, onLocalSunk, onBotSunk, lootStep, hud, skinObj,
    get active() { return active; }, get isHost() { return isHost; }, get hostId() { return hostId; }, get room() { return room; }, get roomIdx() { return roomIdx; }, spectate, get spectating() { return spec.on; }, get spec() { return spec; }, specFollow, specCycle, setBoard, setHudOff, get lastClaim() { return lastClaim; },
    get profile() { return profile; }, get me() { return me; }, peers, bots, piles, get name() { return name; }, set name(v) { setName(v); }, pickSkin, renderMenu, toggleMenu,
    get where() { return where; }, lob, net, holder, refreshHolder, holderUi, joinBattle, acceptOffer, declineOffer, leaveQueue, harborSpectate, idleMs,
    requestReturn, get returning() { return me.ret; },
    _test: { spawnPile, grant, pickSpawn, localDamage, MAX_HIT, SPAWNS, afkKick, seatId } };
  window.PFP_PVP = api;
  return api;
}
