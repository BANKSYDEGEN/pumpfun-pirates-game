import { formatGoldAmount } from './goldFormat.js';
import { DEV } from './env.js';
import { isKey } from './keybinds.js';
// PUMPFUN PIRATES · PvP ARENA (BETA): drop-in, real-time, free-for-all on a shared sea.
// Netcode: js/transport.js (Supabase Realtime broadcast fallback, or the relay server in server/), no presence.
//  - FLOW: everyone starts in the local HARBOR (AI ships for small gold, invisible to the arena). JOIN BATTLE asks the lobby
//    (supabase/migrations/007_pvp_lobby.sql or server/relay.js, the single authority) for an arena slot or a queue place;
//    an opened slot is offered for PVP_OFFER s ('Battle ready! Set sail?'). Dying while the queue is non-empty = back of the
//    queue (rotation). No input for PVP_AFK.kick s in the arena = back to the harbor.
//  - every client is authoritative for its OWN ship; state + events go out as ONE batched message per tick (PVP_NET hz);
//  - cannon volleys are broadcast as events so everyone sees the balls; the SHOOTER decides a hit and the VICTIM'S
//    client applies it (after caps: damage per ball, hits per second, shooter distance);
//  - AI ships live in the harbor only (the arena is players only) and never count for K/D. [v99] SHARED PvE HARBOR: the
//    pvp_harbor RPC (migration 021) puts up to HARBOR_NET.cap pirates in one harbor copy (pfp-harbor-1, -2, ...; a full copy overflows into
//    the next). In a copy the oldest pirate is the HOST: it sails the AI ships + boss and sends them in its state (1 Hz);
//    the others draw them, report their hits to the host, and each victim applies the AI balls that hit it. Pirates can't
//    hurt each other there. The last hit gets the kill, the gold is split by damage dealt. Alone in a copy = no Realtime
//    socket at all (the v98 local harbor).
//  - the lowest-id client in the room is HOST: it owns gold piles (who picked up which pile) and
//    turns a sunk player's report into a pile (carried gold + PVP_DEATH_BONUS). When the host leaves, the next one takes over.
// v1 is NOT cheat-proof: a modified client can lie about its own ship. See README "PvP".
import { setAvatar, nftSrc } from './avatar.js';
import * as THREE from 'three';
import { crewFire, crewHit, crewLodOf } from './crew.js'; // [Raul] remote broadsides animate their gun crews
import { createNet, createHarborNet } from './transport.js';
import { HARBOR_AI, HARBOR_BOSS, harborAiCount, harborHpScale } from './config.js';
import { HARBOR_HP_BASE, HARBOR_SIZE_PER_LV, HARBOR_DMG_PER_LV, harborScale, harborGold, PVP_BASE_HP, PVP_HULL_MUL, PVP_DMG_MUL, PVP_AI_DMG_MUL } from './config.js';
import { showEmote, validEmote, EMOTE_GAP } from './emotes.js'; // [v96] quick-chat
import { PVP_HARBOR_DEATH_LOSS, PVP_HARBOR_RESPAWN, PVP_HARBOR_PROTECT } from './config.js';
import { PVP_BOUNTY, HOLDER_ENABLED, HOLDER_GOLD_MUL, HOLDER_DAILY_GOLD, FLAG_DAILY } from './config.js';
import { PVP_PILE_CAP, PVP_PILE_MAX } from './config.js';
import { COAST_ON, fromHarbor as coastFromHarbor, w2t as coastW2t, inPoly as coastInPoly, APRON as COAST_APRON, ISLET as COAST_ISLET, HEADLAND as COAST_HEADLAND, SAFE as COAST_SAFE } from './island/coast.js'; // [Emerly] Raul's coast harbor flag
const COAST_TURN_X = 140; // [Emerly] bots turn back east of this (berths at x 201.5, no-fire zone from x 120)
import { SAIL_ALL, SAIL, clampSail, inSailSea, islandSpawnRing } from './dock/canoe.js'; // [Emerly sail-around]
import { PVP_DEATH_BONUS, PVP_BR_DEATH_LOSS, PVP_AI_GOLD, PVP_PILE_LIFE, PVP_RESPAWN, PVP_PROTECT, PVP_AI_SHIPS, PVP_ARENA_R, PVP_MAX_CARRY, PVP_AFK, PVP_OFFER } from './config.js';
import { noteServerGold } from './pvpSave.js'; // [v342] casino: the server already moved the gold
import { loadProfile, saveProfile, walletSignIn, linkWallet, walletSession, signOut, kd, cleanProfile, blankProfile, claimKill, holderStatus, holderClaim, saveAirdrop, confirmAirdrop, nameToast, pvpTicket, fetchMe, clearKillsTopCache, checkName, ownerAllSkins } from './pvpSave.js';
import { setOwnedSkins } from './pvpSkins.js';
import { BATTERY_GUNS, BATTERY_RANGE, shotRecent as batteryShotRecent } from './dock/battery.js'; // [v171] cliff guns: tagged hit validation
import { shopState, shopBuy, cleanGear, mapsState, mapDig, prestigeNow, isMaxed, invApi, wishToss } from './pvpSave.js'; // [inventory] + invApi
import { emblemSvg, emblemLabel, rewardFor } from './prestige.js'; // [prestige]
import { muskLevels, setMuskLevels } from './musketUpgrades.js'; // [Emerly musket-upgrades]
import { setShopProvider, openShop, refreshShop } from './islandShop.js'; // [v102] THE ISLAND SHOP (real provider below)
import { SKIN_ITEMS, goalProgress } from './shopCatalog.js';
import { TIERS, pvpSkin, canUse, nextTier, tierOf, shipTick, SHIP_TICKS, UNLOCKS, unlockOf, unlockProgress, knownSkin, skinName } from './pvpSkins.js';
import { previewShipId } from './newShips.js'; // [Emerly] the new hulls' preview flag
import { SQUADS, HARBOR_NET, HARBOR_SQUAD_MAX } from './config.js';
import { Room } from './net.js';
import { isNetId, escHtml, num } from './safe.js';
import { showLootCard } from './lootCard.js'; // [v370]
import { ADM } from './adminState.js'; // [admin-menu] owner GOD / INVISIBLE / NOCLIP, server FREEZE (js/adminMenu.js)
import { IS_PROD_HOST } from './env.js'; // [security H5] peer ids whitelisted, attribute values escaped
import { makeTeams, partyTag, newPartyCode, cleanCode, teamPaint, mateRing, hexCss } from './squads.js'; // [v98] SQUADS 2v2
import { bumpModeKill } from './modeKills.js'; // [Timothy] shop goals: BR kills by mode, this device (display only)
import { UPGRADES, BALL_DMG, shipStats, modeStats, maxRun, gunList } from './upgrades.js';
import { setBoostSource, setBoostZone, goldFindBonus, MAX_BOOST } from './boosts.js'; // [Emerly] ITEM SKILL BOOSTS
import { compilePreview } from './upgradeVisuals.js';
import { applyShipGear } from './shipGear.js'; // [Raul shop items 2] their shop flag + figurehead (from 'gr')
import { attachCaptain, detachCaptain, localCaptain, setLocalCaptain, captainAnchor } from './captainSlot.js';
import * as SC from './shoreCombat.js'; // [v347] t1821u-t1823u shore <-> sea combat
import { setLocalGear, getLocalGear, gearToWire, cleanWire, gearFromWire, EYE_SWATCHES } from './pirateGear.js';
const eyeOf = (v) => (Number.isInteger(v) && v > 0 && v <= EYE_SWATCHES.length ? v : 0); // [v115] validated eye colour ('ec') // [Timothy] other players see your shop gear ('gr')
import { syncCrewGear } from './crewGear.js'; // [v105] shop gear on your pirate
import { setCrewLoadout, crewGear, crewToWire, crewFromWire, crewColorToWire, crewColorFromWire, CREW_SLOTS, CREW_BASE } from './crewLoadout.js'; // [Timothy] CREW SHOP: the crew wear their OWN loadout, not yours
import { skinSwatch, getSkin } from './skins.js';
import { previewCards, renderPreview, releaseRenderer } from './skinPreview.js';
import { makeChest } from './props.js';
import { setRunLevels, getRunLevels, open as openUpgradesPanel } from './shop.js';
import { getSavedName, saveName, syncName, isValidSolanaAddress, getSavedWallet, saveWallet, shortWallet } from './wallet.js';
import { ON_PORTAL } from './config.js';
import { mountKillsBoard, renderKills, refreshKillsBoards } from './pvpBoard.js';
import { touchesGold } from './hullReach.js'; // [big-hitbox]
import { createServerPicker, SERVER_PICKER_ON, serverLabel, codeOfPrefix, ownPrefix, planSwitch } from './serverPicker.js'; // [backpack-pvp] t1694u CHOOSE SERVER
import { createKdTally } from './kdCounter.js'; // [backpack-pvp] t1703u K/D = sunk ships + ground fights

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angWrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
const esc = (s) => String(s ?? '').replace(/[<>&"'`\\]/g, '');
const QS = new URLSearchParams(IS_PROD_HOST ? '' : location.search); // [security L] test switches (?pvproom ?sqmin ?pvpcap ?pvpoffer ?pvpafk ?hbcap ?shareddrops) only work off the live domains
const ROOM_PREFIX = 'pfp-pvp-' + (QS.get('pvproom') || 'v1').replace(/[^a-z0-9]/gi, '').slice(0, 16);
const PEER_TIMEOUT = 6000, SAFE_R = 110;
// most damage one ball can do: max BALL_DMG × best CANNONS gunDmg; most speed: 3 sails × 4.2 × best SAILS
// [v93] from the BOOSTED Battle Royale stats (every level's gunDmg, since a lower CANNONS level can carry a higher gunDmg)
const PVP_MODE = { base: PVP_BASE_HP, mul: PVP_HULL_MUL, boost: true }, MAXED = modeStats(maxRun(), PVP_MODE);
const MAX_GUNDMG = Math.max(1, ...UPGRADES.find(u => u.id === 'cannons').tiers.map((_, i) => modeStats({ levels: { cannons: i + 1 } }, PVP_MODE).gunDmg));
export const MAX_HIT = Math.max(48, Math.ceil(BALL_DMG[1] * MAX_GUNDMG * (1 + MAX_BOOST.dmg) * PVP_DMG_MUL) + 1); // 48: v94 clients (up to 8 heavier balls) while they update; // [pvp hp] ×1.4 PvP cannonballs
const MAX_SPEED = 3 * 4.2 * MAXED.speed * (1 + MAX_BOOST.speed) * 1.15; // [Emerly] + the most a boost can add (a boosted peer never reads as a cheater)
const MAX_HP = Math.round(MAXED.maxHp * (1 + MAX_BOOST.hp));
const SQ_PREFIX = 'pfp-pvp-' + ROOM_PREFIX.slice(8, 22) + 'sq'; // [v98] the SQUADS arena: its own lobby prefix + room (live: pfp-pvp-v1sq)
const SQ_MIN = Math.max(2, Math.min(SQUADS.players, +QS.get('sqmin') || SQUADS.players)); // pirates needed to start a round (tests: ?sqmin=2)
const ls0 = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const TEST_CAP = +QS.get('pvpcap') || null, TEST_OFFER = +QS.get('pvpoffer') || null, TEST_AFK = +QS.get('pvpafk') || 0; // test prefixes only (the lobby ignores them for the live arena)
const PIRATE_A = ['SALTY', 'RUM', 'IRON', 'BLACK', 'MAD', 'LUCKY', 'STORMY', 'ONE-EYED', 'GOLDEN', 'DEGEN', 'SALTY', 'CRIMSON'];
const PIRATE_B = ['JACK', 'BONES', 'MARY', 'HOOK', 'FINN', 'ANNE', 'PETE', 'MORGAN', 'KIDD', 'NED', 'BEARD', 'SALLY'];
export const pirateName = () => `${PIRATE_A[Math.random() * PIRATE_A.length | 0]} ${PIRATE_B[Math.random() * PIRATE_B.length | 0]}`;

// spawn points: 16 around the edge + 6 on a mid ring
// [Emerly] coast harbor (Raul's js/island/coast.js, ?coast=1 until it goes live): the town + berths are the EAST side of the harbor, so
// the 5 outer spawns at 0 / 22.5 / 45 / 315 / 337.5 deg (on land / in the no-fire zone) go and the other 11 spread over 60..300 deg
// (harbor only; the arena keeps the full ring). SPAWNS below is unchanged.
// [v104 shared harbor] every coast spawn is checked against Raul's coast data: never on land (town apron, sandbar islet, cliff
// headland), never within 40 m of the no-fire SAFE HARBOR polygon, never east of COAST_TURN_X - 10 (the AI would turn straight back)
export const coastSeaOk = (hx, hz, pad = 40) => { const [x, z] = coastFromHarbor(hx, hz), [lx, lz] = coastW2t(x, z);
  if (hx > COAST_TURN_X - 10 || coastInPoly(lx, lz, COAST_APRON)) return false;
  if (Math.hypot(lx - COAST_ISLET.lx, lz - COAST_ISLET.lz) < COAST_ISLET.r + 30 || Math.hypot(lx - COAST_HEADLAND.lx, lz - COAST_HEADLAND.lz) < COAST_HEADLAND.r + 40) return false;
  const [sx0, sx1] = [Math.min(...COAST_SAFE.map(p => p[0])), Math.max(...COAST_SAFE.map(p => p[0]))], [sz0, sz1] = [Math.min(...COAST_SAFE.map(p => p[1])), Math.max(...COAST_SAFE.map(p => p[1]))];
  return !(lx > sx0 - pad && lx < sx1 + pad && lz > sz0 - pad && lz < sz1 + pad); };
// [sail-around] outer-island AI: same apron/islet/safe checks as coastSeaOk, but DO NOT reject hx > COAST_TURN_X (that killed every N/E/S spawn).
export const islandSeaOk = (hx, hz, pad = 55) => { const [x, z] = coastFromHarbor(hx, hz), [lx, lz] = coastW2t(x, z);
  if (coastInPoly(lx, lz, COAST_APRON)) return false;
  if (Math.hypot(lx - COAST_ISLET.lx, lz - COAST_ISLET.lz) < COAST_ISLET.r + 30 || Math.hypot(lx - COAST_HEADLAND.lx, lz - COAST_HEADLAND.lz) < COAST_HEADLAND.r + 40) return false;
  const [sx0, sx1] = [Math.min(...COAST_SAFE.map(p => p[0])), Math.max(...COAST_SAFE.map(p => p[0]))], [sz0, sz1] = [Math.min(...COAST_SAFE.map(p => p[1])), Math.max(...COAST_SAFE.map(p => p[1]))];
  return !(lx > sx0 - pad && lx < sx1 + pad && lz > sz0 - pad && lz < sz1 + pad); };
const SPAWNS_COAST = [...Array.from({ length: 11 }, (_, i) => (60 + i * 24) / 360 * 6.283).map(a => [Math.cos(a) * PVP_ARENA_R * 0.82, Math.sin(a) * PVP_ARENA_R * 0.82]),
  ...Array.from({ length: 6 }, (_, i) => [Math.cos((i + 0.5) / 6 * 6.283) * PVP_ARENA_R * 0.42, Math.sin((i + 0.5) / 6 * 6.283) * PVP_ARENA_R * 0.42])].filter(([x, z]) => coastSeaOk(x, z));
// [v314] BANKSY t1674u "move all the ai boat spawns around the island not near dock so they don't all wait at dock": 3 rings round
// the island, every point deep island sea and far from the west harbor dock; EVERY harbor AI + the Commodore spawns + patrols here.
export const HARBOR_DOCK = { x: 160, z: 0 }, DOCK_KEEP = { spawn: 540, spawn0: 480, patrol: 480, hunt: 300 };
export const SPAWNS_ISLAND = SAIL_ALL ? [...islandSpawnRing(16, 650), ...islandSpawnRing(16, 820), ...islandSpawnRing(14, 1000)].filter(([x, z]) => {
  const d = Math.hypot(x - SAIL.cx, z - SAIL.cz);
  if (d < 520 || d > 1180) return false;
  if (Math.hypot(x - HARBOR_DOCK.x, z - HARBOR_DOCK.z) <= DOCK_KEEP.spawn || Math.hypot(x, z) <= DOCK_KEEP.spawn0) return false; // well away from the dock
  return islandSeaOk(x, z, 70);
}) : [];
// runtime deep-water pass (the foot heightmap only exists once the dock is loaded): H(x, z) in the harbor frame
export const islandSpawnsDeep = (H) => { if (!H) return SPAWNS_ISLAND; const deep = SPAWNS_ISLAND.filter(([x, z]) => { try { return H(x, z) < -9; } catch { return true; } }); return deep.length ? deep : SPAWNS_ISLAND; };
// [v314] BANKSY t1680u "spawn the commodore at random spots around island": uniform random pick from the deep island pool
// (> 540 m from the dock), > 160 m clear of every ship, and > 400 m from the last Commodore spawn when possible (a new side each time)
export function pickBossSpawn(H, ships = [], lastPos = null, rnd = Math.random) {
  const deep = islandSpawnsDeep(H).filter(([x, z]) => Math.hypot(x - HARBOR_DOCK.x, z - HARBOR_DOCK.z) > DOCK_KEEP.spawn);
  if (!deep.length) return null;
  let c = deep.filter(([x, z]) => ships.every(s => Math.hypot(s.x - x, s.z - z) > 160)); if (!c.length) c = deep;
  if (lastPos) { const far = c.filter(([x, z]) => Math.hypot(x - lastPos[0], z - lastPos[1]) > 400); if (far.length) c = far; }
  const pt = c[Math.min(c.length - 1, Math.floor(rnd() * c.length))]; return [pt[0], pt[1]];
}
// heading (yaw, forward = (sin, cos)) along the island patrol ring: tangent + a radial spring back to radius R
export function patrolHeading(x, z, dir = 1, R = 760) {
  const dx = x - SAIL.cx, dz = z - SAIL.cz, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
  const k = Math.max(-1, Math.min(1, (R - d) / 220));
  return Math.atan2(-uz * dir + ux * k, ux * dir + uz * k); // tangent (-uz, ux)·dir in (x, z) + spring
}
const SPAWNS = [...Array.from({ length: 16 }, (_, i) => [Math.cos(i / 16 * 6.283) * PVP_ARENA_R * 0.82, Math.sin(i / 16 * 6.283) * PVP_ARENA_R * 0.82]),
  ...Array.from({ length: 6 }, (_, i) => [Math.cos((i + 0.5) / 6 * 6.283) * PVP_ARENA_R * 0.42, Math.sin((i + 0.5) / 6 * 6.283) * PVP_ARENA_R * 0.42])];

// [v314] island-patrol steering (harbor + sail-all): hunt a real live target, otherwise orbit the island at e.patrolR; never wait /
// cluster by the harbor dock (keep-out 480 m patrolling, 300 m even while hunting); 24 / 48 m shallow look-ahead round headlands + islets
export function islandSteer(e, desired, L) {
  const dx = e.x - SAIL.cx, dz = e.z - SAIL.cz, d = Math.hypot(dx, dz);
  if (d > SAIL.r - 80) return Math.atan2(-dx, -dz); // pull back into the sail disc
  const dir = e.patrolDir || 1, R = e.patrolR || 760;
  const hasTarget = !!(e.tgt && e.tgt.alive);
  let steer = hasTarget ? desired : patrolHeading(e.x, e.z, dir, R);
  const kx = e.x - HARBOR_DOCK.x, kz = e.z - HARBOR_DOCK.z, kd = Math.hypot(kx, kz) || 1;
  const keep = hasTarget ? DOCK_KEEP.hunt : DOCK_KEEP.patrol;
  if (kd < keep) { // dock keep-out: push away from the dock, blended with the patrol tangent so they round the N / S coast
    const w = Math.min(4, (keep - kd) / 50 + 1.2), p = patrolHeading(e.x, e.z, dir, R);
    const vx = kx / kd * w + Math.sin(p), vz = kz / kd * w + Math.cos(p);
    steer = Math.atan2(vx, vz);
  }
  try {
    if (L?.FM?.H && L.harborToFoot) {
      const H = (x, z) => L.FM.H(...L.harborToFoot(x, z));
      const clear = (a) => H(e.x + Math.sin(a) * 24, e.z + Math.cos(a) * 24) <= -7.5 && H(e.x + Math.sin(a) * 48, e.z + Math.cos(a) * 48) <= -7.5;
      if (!clear(steer)) {
        const out = Math.atan2(dx, dz); let pick = null;
        for (let i = 1; i <= 8 && pick === null; i++) for (const sg of [1, -1]) { const a = steer + sg * i * 0.3; if (clear(a)) { if (pick === null || Math.cos(a - out) > Math.cos(pick - out)) pick = a; } }
        steer = pick === null ? out : pick;
      }
    }
  } catch {}
  return steer;
}

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
  // [v98] one lobby / room per mode. SOLO = the free-for-all arena, SQUADS = 2v2 teams. Same profile (skins, upgrades, gold, board).
  // [security M1 + H2] a Realtime ticket per channel: proves this tab's lobby seat (seatId) to the server, which notes it for the kill
  // board and (once enabled) hands back a private-channel token. null = keep the public channel (see net.js).
  const rtTicket = (topic, extra = {}) => pvpTicket({ topic, net: myId, seat: seatId, name, ...extra });
  const nets = { solo: createNet({ prefix: ROOM_PREFIX, myId, ticket: rtTicket }), squads: createNet({ prefix: SQ_PREFIX, myId, ticket: rtTicket }) };
  let mode = ls0('pfp_br_mode') === 'squads' ? 'squads' : 'solo', net = nets[mode];
  // [v99] SHARED HARBOR copies: live 'pfp-harbor' (rooms pfp-harbor-1, -2, ...); ?pvproom=X tests use 'pfp-harbor-X'. ?hbcap=N: smaller test copies
  const HB_PREFIX = 'pfp-harbor' + (QS.get('pvproom') ? '-' + ROOM_PREFIX.slice(8) : '');
  const hbNet = createHarborNet({ prefix: HB_PREFIX, myId, ticket: rtTicket }), HB_CAP = +QS.get('hbcap') || null;
  // [backpack-pvp] BANKSY t1698u "Try B": open-water ship PvP in the shared harbor OUTSIDE Safe Harbor (+ its 4 s exit grace); anchored
  // UNMANNED ships (moored, or anchored while you are ashore / in the canoe) are shielded; sunk by a pirate = your unequipped haul floats
  // in a sea loot crate. &hbpvp=0 = the old PvE-only harbor (balls pass through pirates).
  const HB_PVP_ON = QS.get('hbpvp') !== '0'; // (= !/[?&]hbpvp=0(&|$)/)
  const hb = { copy: 0, n: 0, s: 0, pirates: 0, copies: [], cap: HARBOR_NET.cap, beatAt: 0, busy: false, hj: 0, listenUntil: 0, gen: 0, specCopy: 0, specEmptyT: 0, specBeatAt: 0, wantCopy: 0 };
  const curPrefix = () => mode === 'squads' ? SQ_PREFIX : ROOM_PREFIX;
  const isSq = () => mode === 'squads' && (where === 'arena' || where === 'spec'); // in the squads arena (playing or watching)
  const seatId = myId + Math.random().toString(36).slice(2, 10);
  // where we are: 'harbor' (local, AI only) | 'arena' (in the shared room) | 'spec'. lob = the lobby's last answer.
  let where = 'harbor';
  const lob = { state: 'harbor', pos: 0, queue: 0, players: 0, cap: mode === 'squads' ? SQUADS.players : net.cfg.maxArena, offerUntil: 0, pollT: 0, busy: false, wantJoin: false, queuedByDeath: false };
  const AFK_KICK = (TEST_AFK || PVP_AFK.kick) * 1000, AFK_WARN = Math.min(PVP_AFK.warn, (TEST_AFK || PVP_AFK.kick) / 2) * 1000, AFK_FARM = Math.min(PVP_AFK.farm, (TEST_AFK || PVP_AFK.kick) * 0.6) * 1000;
  const peers = new Map();           // id -> { id, name, ship, st, heard, k, d, g, K, D, lv, sk, key }
  const bots = new Map();            // id -> enemy object
  const piles = new Map();           // pid -> loot item
  const buckets = new Map();         // shooter id -> { tokens, t } (hit rate cap)
  const earned = new Map();          // host: gold granted per player this life (caps their death drop)
  const feed = [];
  let hitQueue = [], hitT = 0;
  const me = { life: 0, protect: 0, dead: false, respawn: 0, lastDamageAt: 0, lastBy: null, kills: 0, deaths: 0, gold: 0, killedBy: '', dropped: 0, streak: 0, bounty: 0, pairs: new Map() };
  // [backpack-pvp] t1703u: ONE K/D = player ships sunk (arena + harbor open water) + on-foot ground fights; deduped per victim life
  const kdT = createKdTally({ stats: () => profile?.stats, onChange: () => { try { K.updateHud?.(); hud(); save({}); } catch {} } });
  // [v352 KOTH] open-island gun/sword (and bomb) KOs: local tally + claimKill (both sides). Coliseum pit/range stay cosmetic
  // (meta.board falsy → kdT.extra only, never claimKill). meta: { board, k, v, life } when the kill feeds KING OF THE HILL.
  function groundKd(side, key, meta = null) {
    const onBoard = !!(meta && meta.board && meta.k && meta.v != null && Number.isFinite(+meta.life));
    const ok = side === 'k' ? kdT.kill('ground', key, onBoard ? { board: true } : undefined)
      : side === 'd' ? kdT.death('ground', key, onBoard ? { board: true } : undefined) : false;
    if (ok) { if (side === 'k') me.kills++; else me.deaths++; if (!active) { try { save({}); } catch {} } }
    if (ok && onBoard) boardClaim(side, meta.k, meta.v, meta.life | 0);
    return ok;
  }
  let profile = blankProfile(), wallet = walletSession()?.wallet || '', name = getSavedName() || '';
  if (!name) name = pirateName(); // not saved: Waves keeps its own (empty) name until you type one

  // ---------------- profile / save ----------------
  async function prepare() {
    const r = await loadProfile(); profile = r.profile; wallet = r.wallet || ''; setOwnedSkins(profile.skins.owned); gearChanged();
    refreshHolder();
    return profile;
  }
  async function refreshHolder() {
    if (!HOLDER_ENABLED || (!wallet && !ownerAllSkins())) { /* [v85] owner-only: BANKSYDEGEN devices */ Object.assign(holder, { on: false, claimed: true, checked: true }); holderUi(); return; }
    const h = await holderStatus(); Object.assign(holder, { on: !!h.holder, claimed: h.claimed !== false, checked: true }); holderUi();
    // [castle-flag-daily] already claimed today → courtyard flag starts raised for this player
    if (FLAG_DAILY && holder.on && holder.claimed) { try { const { markFortFlagRaised } = await import('./island/areas/fort.js'); markFortFlagRaised(); } catch {} }
  }
  function holderUi() {
    const b = $('pvp-holder'), c = $('pvp-holder-claim'); if (!b || !c) return;
    b.hidden = !(HOLDER_ENABLED && holder.on);
    // [castle-flag-daily] default: claim at the fort flag; &flagdaily=0 keeps the HUD button
    c.hidden = !(HOLDER_ENABLED && holder.on && !holder.claimed && !FLAG_DAILY);
    c.textContent = `Claim daily gold (+${HOLDER_DAILY_GOLD})`;
  }
  async function claimHolderGold(opts = {}) {
    // [castle-flag-daily] opts.fromFlag: skip the HUD button disable (flag path has no button); still server-gated
    const c = $('pvp-holder-claim'); if (!opts.fromFlag && (!c || c.disabled)) return null; if (c && !opts.fromFlag) c.disabled = true;
    try {
      const r = await holderClaim(); game.gold += r.gold | 0; holder.claimed = true; sfx.coin();
      if (!opts.quiet) K.popup(new THREE.Vector3(P().x, 6, P().z), `+${formatGoldAmount(r.gold)} DAILY GOLD`);
      K.updateHud(); save({ now: true });
      // keep the courtyard mast raised for this Indy day (visual only; claim is server-side)
      try { const { markFortFlagRaised } = await import('./island/areas/fort.js'); markFortFlagRaised(); } catch {}
      return r;
    } catch (e) {
      holder.claimed = e?.status === 409 ? true : holder.claimed; if (e?.status === 403) holder.on = false;
      if (!opts.fromFlag) $('pvp-wallet-state').textContent = String(e?.message || e).slice(0, 80);
      throw e;
    } finally { if (c) c.disabled = false; holderUi(); }
  }
  const holderMul = (earned) => HOLDER_ENABLED && holder.on && earned > 0 ? Math.round(earned * (HOLDER_GOLD_MUL - 1)) : 0;
  addEventListener('pfp-group-sync', (e) => { const { drift, levels, stats } = e.detail || {}; // [v92] owner shared save / [v106] account: the other device's gold / upgrades / stats
    if (stats) for (const k of Object.keys(profile.stats)) profile.stats[k] = Math.max(0, (profile.stats[k] | 0) + (stats[k] | 0));
    if (!active) { if (drift) profile.gold = Math.max(0, (profile.gold | 0) + drift); return; }
    if (drift) { game.gold = Math.max(0, (game.gold | 0) + drift); profile.gold = game.gold; }
    if (levels) { const cur = getRunLevels(), m = Object.fromEntries(Object.keys(cur).map(k => [k, Math.max(cur[k] | 0, levels[k] | 0)]));
      if (JSON.stringify(m) !== JSON.stringify(cur)) { const hp = P().hp; setRunLevels(m); P().hp = Math.min(hp, P().maxHp); profile.levels = m; } }
    K.updateHud(); });
  function applyProfile() { // called by main after the fresh player ship exists
    setRunLevels(profile.levels); game.gold = profile.gold;
  }
  const skinId = () => profile.skins.equipped || 'classic';
  const skinObj = () => pvpSkin(previewShipId() || skinId()); // [Emerly] ?newship=<id>: preview a new hull on YOUR ship only (look only: never saved or sent; js/newShips.js)
  function snapshot() { return cleanProfile({ gold: game.gold, levels: getRunLevels(), skins: { equipped: skinId(), owned: profile.skins.owned }, gear: profile.gear, gearOwned: profile.gearOwned, rev: profile.rev, prestige: profile.prestige | 0, stats: profile.stats }); }
  // ---------------- [v102] THE ISLAND SHOP (js/islandShop.js panel, server-checked buys via js/pvpSave.js) ----------------
  // Your pirate's equipped gear goes on the on-foot pirate + your captain through window.applyPirateGear (Timothy's gear meshes
  // plug in there; until then every gear item is COMING SOON and nothing is drawn).
  function gearChanged() { try { setLocalGear({ ...profile.gear }); } catch (e) { console.warn('[gear]', e); } setCrewLoadout(profile.gear); boostSrc(); } // [v105] Timothy's js/pirateGear.js: saves + re-dresses your on-foot pirate + your captain (fires 'pfp-gear')
  // [Emerly] ITEM SKILL BOOSTS: what you wear ∩ what the server says you own (owner = everything, still capped)
  function boostSrc() { try { setBoostSource({ gear: { ...(profile.gear || {}) }, owned: profile.gearOwned || [], owner: !!ownerAllSkins() }); } catch (e) { console.warn('[boosts]', e); } }
  addEventListener('pfp-shop-sync', (e) => { const d = e.detail || {}; if (!d.owned) return;
    profile.skins.owned = d.owned.skins.filter(x => x !== 'classic'); profile.gearOwned = d.owned.gear; setOwnedSkins(profile.skins.owned); try { setMuskLevels(muskLevels(d.owned.gear || [], !!d.owner || !!ownerAllSkins())); } catch {} // [Emerly musket-upgrades]
    try { setBoostSource({ owned: d.owned.gear, owner: !!d.owner || !!ownerAllSkins(), server: d.boosts || null }); } catch {} // [Emerly] boosts follow the server's owned list
    if (!d.owner && profile.gear) { for (const [sl, ids] of Object.entries(CREW_SLOTS)) if (profile.gear[sl] && profile.gear[sl] !== ids[0] && !d.owned.gear.includes(`${sl}:${profile.gear[sl]}`) && !d.owned.gear.includes(`${CREW_BASE[sl]}:${profile.gear[sl]}`)) profile.gear[sl] = ids[0];   /* [v6-store-clothes] CREW ROOM: owning the item dresses the crew */ setCrewLoadout(profile.gear); } // [Timothy] crew items: owned or the uniform
    if (!canUse(skinId())) { profile.skins.equipped = 'classic'; if (active) K.rebuildShip(getRunLevels()); }
    if (active && !$('pvp-menu')?.classList.contains('hidden')) renderMenu(); });
  let shopBehind = 0;
  const shopStateNow = async () => { const st = await shopState(snapshot()); if (!st) return null; try { setMuskLevels(muskLevels(st.owned?.gear || [], !!st.owner)); } catch {} // [Emerly musket-upgrades]
    return { source: 'live', owner: !!st.owner, gold: st.owner ? (game.gold | 0) : (st.gold ?? 0) | 0, behind: Math.max(0, (game.gold | 0) - ((st.gold ?? 0) | 0)) > 0 && !st.owner,
      stats: { ...profile.stats, prestige: profile.prestige | 0, ...(st.stats || {}) }, owned: st.owned, equipped: { skin: skinId(), gear: { ...profile.gear } } }; };
  setShopProvider({
    load: shopStateNow,
    async buy(kind, key) {
      const r = await shopBuy(kind === 'skin' ? `skin:${key}` : `gear:${key}`, snapshot());
      if (r.ok) { if (!r.owner) { game.gold = Math.max(0, (game.gold | 0) - (r.price | 0)); profile.rev = r.rev | 0; } // SAME tick as the rev bump
        if (kind === 'skin') profile.skins.owned = [...new Set([...profile.skins.owned, key])]; else { profile.gearOwned = [...new Set([...(profile.gearOwned || []), key])]; boostSrc(); }
        setOwnedSkins(profile.skins.owned); save({ now: true, force: true }); K.updateHud(); sfx.coin?.(); }
      const st = (await shopStateNow()) || { source: 'live', owner: false, gold: 0, stats: profile.stats, owned: { skins: ['classic', ...profile.skins.owned], gear: profile.gearOwned || [] }, equipped: { skin: skinId(), gear: { ...profile.gear } } };
      return { ok: !!r.ok, error: r.ok ? null : ({ 'goal not reached': 'reach the goal first', 'not enough gold': 'not enough gold', 'already owned': 'already yours' }[r.error] || r.error || 'shop offline'), state: st };
    },
    async buyAcc(key) { // [Emerly gunacc] a GUN ACCESSORY: the server takes the gold + puts it in the inventory (inventory.ts inv_buy_acc)
      const r = await inv.call('inv_buy_acc', { item: key }); // inv.call already moved the gold on this save
      return { ok: !!r?.ok, error: r?.ok ? null : (r?.error || 'shop offline'), state: (await shopStateNow()) || null }; },
    async hatColor(i) { const g = cleanGear({ ...profile.gear, hatColor: i }); profile.gear = g; gearChanged(); save({ now: true, force: true }); // [v105] free
      return shopStateNow().then(st => st || { source: 'live', gold: 0, stats: profile.stats, owned: { skins: ['classic', ...profile.skins.owned], gear: profile.gearOwned || [] }, equipped: { skin: skinId(), gear: { ...profile.gear } } }); },
    async crewCapeColor(i, k = 'crewcapeColor') { const g = cleanGear({ ...profile.gear, [k]: i }); profile.gear = g; gearChanged(); save({ now: true, force: true }); return shopStateNow().then(st => st || { source: 'live', gold: 0, stats: profile.stats, owned: { skins: ['classic', ...profile.skins.owned], gear: profile.gearOwned || [] }, equipped: { skin: skinId(), gear: { ...profile.gear } } }); },   // [v6-store-clothes] free, the crew's own cape colour
    async crewHatColor(i) { const g = cleanGear({ ...profile.gear, crewhatColor: i }); profile.gear = g; gearChanged(); save({ now: true, force: true }); // [Raul gear colours] free, the crew's own hat colour
      return shopStateNow().then(st => st || { source: 'live', gold: 0, stats: profile.stats, owned: { skins: ['classic', ...profile.skins.owned], gear: profile.gearOwned || [] }, equipped: { skin: skinId(), gear: { ...profile.gear } } }); },
    prewarm(kind, key) { if (kind === 'skin' && active && canUse(key) && key !== skinId()) K.prebuildSkin?.(getRunLevels(), pvpSkin(key)); }, // [skin-swap-perf] the picker / SKINS tab: build + compile it before the pick
    async equip(kind, key) {
      if (kind === 'skin') { if (canUse(key)) { profile.skins.equipped = key; if (active) (K.rebuildShipSkin || K.rebuildShip)(getRunLevels()); sfx.equip?.(); } }
      else { const [slot, id] = key.split(':'); const g = cleanGear({ ...profile.gear, [slot]: id }); if (g[slot] === id) { profile.gear = g; gearChanged(); } }
      save({ now: true, force: true }); return shopStateNow().then(st => st || { source: 'live', gold: 0, stats: profile.stats, owned: { skins: ['classic', ...profile.skins.owned], gear: [] }, equipped: { skin: skinId(), gear: { ...profile.gear } } });
    },
  });
  // [wish] the roundabout wishing fountain (js/island/areas/hillRound.js fires 'pfp-wish'): 100 gold, a splash, a neutral line. Nothing else.
  let wishBusy = false, wishLast = 0;
  addEventListener('pfp-wish', async (e) => { const d = e.detail || {}; if (wishBusy || Date.now() - wishLast < 4000) return; wishBusy = true;
    try { if ((game.gold | 0) < 100 && !ownerAllSkins()) { d.toast?.('YOU NEED 100 GOLD TO TOSS A COIN', 2200); return; }
      const r = await wishToss(snapshot());
      if (!r.ok) { d.toast?.(r.error === 'not enough gold' ? 'YOU NEED 100 GOLD TO TOSS A COIN' : r.error === 'slow down' ? 'THE WATER IS STILL RIPPLING...' : 'THE FOUNTAIN IS QUIET RIGHT NOW', 2200); return; }
      if (!r.owner && r.price) { game.gold = Math.max(0, (game.gold | 0) - (r.price | 0)); profile.rev = r.rev | 0; save({ now: true, force: true }); K.updateHud(); }
      wishLast = Date.now(); d.splash?.(); sfx.coin?.(); d.toast?.('YOU TOSS A COIN AND MAKE A WISH...', 2600);
    } finally { wishBusy = false; } });
  // [v122] treasure maps (js/dock/treasure.js drives the UI): the dig gold lands on THIS save in the same tick, then saves
  const maps = { state: () => mapsState(snapshot()),
    async dig(id, spot) { const r = await mapDig(id, spot, snapshot());
      if (r && r.ok && r.loot && r.loot.item && !r.loot.dup) { profile.gearOwned = [...new Set([...(profile.gearOwned || []), r.loot.item])]; } // [v152] a chest item (the server already owns it for you)
      if (r && r.ok && (r.gold | 0) > 0) { game.gold = Math.min(1e7, (game.gold | 0) + (r.gold | 0)); save({ now: true, force: true }); K.updateHud(); sfx.coin?.(); }
      return r || { ok: false, error: 'offline' }; },
    canWear(key) { const [slot, id] = String(key).split(':'); return cleanGear({ ...profile.gear, [slot]: id })[slot] === id; }, // [v152] a slot this build knows (weapons: once the WEAPON STORE is in)
    wear(key) { const [slot, id] = String(key).split(':'); const g = cleanGear({ ...profile.gear, [slot]: id }); // [v152] WEAR IT / DRESS CREW on the chest card
      if (g[slot] !== id) return false; profile.gear = g; gearChanged(); save({ now: true, force: true }); sfx.equip?.(); return true; } };
  // [inventory] migration 036: the server moves items + gold; gold a reply pays (NPC sale, Marketplace buy / proceeds) lands on THIS save
  // in the same tick, like a dig. The owner's gold goes through his pot (inv_pot), never twice.
  const inv = { async call(action, body = {}) {
      const r = await invApi(action, { ...body, mirror: true }); if (!r || !r.ok) return r || { ok: false, error: 'offline' };
      if (r.owner && (action === 'inv_sell' || action === 'mkt_buy' || action === 'inv_musk_rank' || action === 'inv_buy_acc')) { /* [Emerly v374] settle the owner's pot right away so a buy/rank-up charges NOW instead of silently eating his next sale */ const p = await invApi('inv_pot', { mirror: true }); if (p && p.ok) r.gold_landed = p.gold | 0; }
      else r.gold_landed = action === 'inv_sell' || action === 'inv_pot' ? (r.gold | 0) : action === 'mkt_buy' ? -(r.price | 0) : (action === 'inv_musk_rank' || action === 'inv_buy_acc') && !r.owner ? -(r.price | 0) : 0; // [Emerly musket-rank / gunacc] server took the gold
      if (r.gold_landed) { game.gold = Math.max(0, Math.min(1e7, (game.gold | 0) + r.gold_landed)); save({ now: true, force: true }); K.updateHud(); if (r.gold_landed > 0) sfx.coin?.(); }
      return r; } };
  function goalToast(before, after) { // a goal reached: that skin can now be BOUGHT at the shop (never free)
    for (const it of SKIN_ITEMS) { if (!it.goal || canUse(it.id)) continue; const a = goalProgress(it.goal, before), b = goalProgress(it.goal, after);
      if (b.done && !a.done) skinToast({ id: it.id, name: it.name, goal: true }); } }
  // ---------------- [prestige] PRESTIGE (BANKSY: "Add ability to prestige when max out ship") ----------------
  // The UPGRADE SHOP (js/shop.js) shows PRESTIGE once every track is maxed and asks to confirm; this does it: the server checks its own
  // copy of the save, raises the level and resets ONLY the upgrades (gold, skins, gear, kills kept). P1 = GOLDEN GALLEON buyable,
  // P2 = DIAMOND SHIP, both given free. A higher level from another device ('pfp-prestige') resets this device's upgrades the same way.
  const BASE_LV = () => Object.fromEntries(UPGRADES.map(u => [u.id, 0]));
  function prestigeApplied(lv) { profile.prestige = lv; profile.levels = BASE_LV();
    if (active) setRunLevels(profile.levels); // = buying an upgrade: stats + model rebuilt once (shop.js), hull full
    showRank(); K.updateHud(); if (!$('pvp-menu')?.classList.contains('hidden')) renderMenu(); }
  addEventListener('pfp-prestige', (e) => { const { level, reset } = e.detail || {}; if (!profile || !(level > (profile.prestige | 0))) return;
    if (reset) prestigeApplied(level); else { profile.prestige = level; showRank(); } });
  let prestBusy = false;
  window.PFP_PRESTIGE = Object.freeze({
    level: () => profile?.prestige | 0,
    canPrestige: () => active && !!profile && isMaxed(getRunLevels()),
    next: () => { const n = (profile?.prestige | 0) + 1; return { level: n, reward: rewardFor(n) }; },
    async run() { if (prestBusy || !active) return { ok: false, error: 'busy' }; prestBusy = true;
      try { const r = await prestigeNow(snapshot()); if (!r.ok) return r;
        prestigeApplied(r.prestige); { const rw0 = rewardFor(r.prestige); if (rw0) { profile.skins.owned = [...new Set([...profile.skins.owned, rw0.skin])]; setOwnedSkins(profile.skins.owned); } } save({ now: true, force: true }); sfx.equip?.();
        const rw = rewardFor(r.prestige); K.banner(`PRESTIGE ${r.prestige}`, rw ? `${rw.name} UNLOCKED · FREE: equip it at the SHIP SKINS shop` : 'your ship starts fresh: upgrade it again');
        return r; } finally { prestBusy = false; } },
  });
  addEventListener('pfp-save-now', () => { if (active) save({ now: true, force: true }); }); // [v106] right before LOG OUT: the latest gold lands on the account
  function save(opts = {}) { if (!active && !opts.force) return; profile = snapshot(); saveProfile(profile, opts).then(r => { if (r && r.ok === false && r.status === 401) { wallet = ''; renderMenu(); } }); }
  // [v342] BANKSY t1810u/t1811u casino gold: flush this device's save to the server BEFORE a wager (gold earned at sea is there first) ...
  function flushNow() { if (!profile) return Promise.resolve(null); profile = snapshot(); return saveProfile(profile, { now: true }).catch(() => null); }
  // ... and take the server's balance after it (casino_play moved it there): every sync path re-bases, nothing is debited / credited twice
  function serverGold(g, { rev = null, owner = false } = {}) {
    const v = noteServerGold(g, { rev, owner }); game.gold = v;
    if (profile && rev != null && !owner) profile.rev = Math.max(0, rev | 0);
    save({ now: true, force: true }); try { K.updateHud(); } catch {} return v; }

  // ---------------- rooms ----------------
  // ---------------- lobby (arena seat / queue), harbor <-> arena ----------------
  const lobbyOpts = (extra = {}) => ({ seat: seatId, name, cap: TEST_CAP, offer: TEST_OFFER, ...extra });
  async function lobbyCall(op, extra) {
    const n0 = net, r = await net.lobby(op, lobbyOpts(extra)); if (!active) return r;
    if (n0 !== net && op === 'poll') return r; // [v98.3] a poll for the other mode's room (the switch flipped meanwhile): ignore
    if (r && r.state && r.state !== 'error') {
      Object.assign(lob, { state: r.state, pos: r.pos || 0, queue: r.queue || 0, players: r.players || 0, specs: r.spectators || 0, cap: r.cap || lob.cap, known: true });
      if (room) room.specs = lob.specs | 0; // [v339] t1800u Batcher.hz() accounts for spectators in scaleBudget
      if (r.state === 'offer') { if (!lob.offerUntil) { lob.offerUntil = performance.now() + (+r.offer_in || PVP_OFFER) * 1000; showOffer(true); sfx.coin?.(); } }
      else { lob.offerUntil = 0; showOffer(false); }
    }
    return r || { state: 'error' };
  }
  async function joinBattle(fromParty = false) { // harbor JOIN BATTLE button
    if (where !== 'harbor' || lob.busy) return;
    // [v328] Arena SQUADS is 2v2 only — a larger Harbor co-op squad cannot queue for Arena
    if (mode === 'squads' && partyMates().length + 1 > SQUADS.size) {
      K.banner('ARENA SQUADS IS 2v2', `your Harbor squad has ${partyMates().length + 1} pirates · Arena is 2v2 only (Harbor PvE supports up to ${HARBOR_SQUAD_MAX})`);
      return;
    }
    lob.busy = true;
    if (mode === 'squads' && !fromParty && partyMate()) party.room?.send('go', { i: myId }); // [v98] your party mate queues with you
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
    hbLeave(); clearLocalAi(true); // [v99] out of the shared harbor copy (its seat, socket, pirates and the host's AI ships)
    let link;
    try { link = await net.openRoom(1); } catch (e) { console.warn('[pvp] arena connect failed', e?.message); await lobbyCall('leave'); K.banner('ARENA OFFLINE', 'could not connect, back in the harbor'); return false; }
    if (!active) { link.close(); return false; }
    room = link; roomIdx = 1; wire(link); link.setState(stateMsg); link.send('hello', { i: myId }, { now: true }); sqReset();
    where = 'arena'; setBoostZone('br'); lob.queuedByDeath = false; document.documentElement.classList.remove('pvp-harbor'); harborUi();
    me.dead = true; P().alive = false; P().mesh.visible = false; // listen a moment so the spawn is the farthest from everyone
    K.banner('ENTERING THE ARENA', 'finding the quietest spawn…');
    await new Promise(res => setTimeout(res, 1200));
    if (!active || where !== 'arena') return false;
    P().mesh.visible = true; me.lastInput = performance.now(); electHost(); if (!(isSq() && sq.ph === 'live' && sq.myR === sq.r)) respawn(); hud(); // [v98] squads: a round spawn already placed us
    return true;
  }
  function toHarbor(title, sub) { // leave the arena (rotation, AFK, lost seat, RETURN TO HARBOR); upgrades, gold, K/D stay; bounty resets
    resetBounty(); me.ret = null;
    if (room) { room.send('bye', { i: myId }, { now: true }); room.close(); }
    room = null; clearPeers(); for (const pid of [...piles.keys()]) removePile(pid);
    isHost = false; hostId = null; where = 'harbor'; setBoostZone('harbor'); document.documentElement.classList.add('pvp-harbor'); sqReset(); sqVis();
    respawnHarbor(); hb.beatAt = 0; harborUi(); K.banner(title, sub); // [v99] back into a shared harbor copy at the next heartbeat
  }
  function respawnHarbor(afterDeath = false) {
    if (afterDeath && me.harborPvp) { me.life++; me.harborPvp = false; } // [backpack-pvp] a new life after an Option B sink (its 'sunk' key)
    const pl = P(); me.dead = false; me.protect = afterDeath ? PVP_HARBOR_PROTECT : 0; me.lastBy = null; me.lastDamageAt = 0; showDead(false); pl.mesh.visible = true;
    let x = 0, z = 0, yaw = 0;
    if (!afterDeath && hbNet) { const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 26; x = Math.cos(a) * r; z = Math.sin(a) * r; } // [v104 shared harbor] pirates sharing a copy don't all appear on the same spot
    if (afterDeath) { // [v95] sunk in the harbor: respawn at the harbor spot farthest from every live AI ship / the boss (upgrades + skin kept)
      const foes = [...bots.values()].filter(b => b.alive); let best = -1;
      for (const p of livePeers()) if (p.ship?.alive) foes.push({ x: p.ship.x, z: p.ship.z, harborBoss: false }); // [v104] + the other pirates' ships (no spawning on top of them)
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2 + Math.random() * 0.2, r = 40 + (i % 3) * 45, cx = Math.cos(a) * r, cz = Math.sin(a) * r;
        if (COAST_ON && !coastSeaOk(cx, cz, 0)) continue; // [v104] not right up against the berths / headland
        const d = foes.length ? Math.min(...foes.map(b => Math.hypot(b.x - cx, b.z - cz) - (b.harborBoss ? 60 : 0))) : 1e9;
        if (d > best) { best = d; x = cx; z = cz; } }
      yaw = Math.atan2(-x, -z); me.life++;
    }
    Object.assign(pl, { alive: true, sinking: 0, hp: pl.maxHp, x, z, yaw, speed: 0, sail: 1, anchor: false, calm: 0, repT: 0 });
    pl.cd.port = pl.cd.star = 0; K.resetCamera(); K.updateHud();
    if (afterDeath) K.banner('BACK AT SEA', `harbor spawn protection ${PVP_HARBOR_PROTECT} s (ends when you fire)`);
  }
  function lobbyTick(dt) {
    const now = performance.now();
    if (lob.offerUntil) { const left = Math.max(0, (lob.offerUntil - now) / 1000); const el = $('pvp-offer-t'); if (el) el.textContent = Math.ceil(left); if (left <= 0) { lob.offerUntil = 0; showOffer(false); lobbyCall('poll').then(harborUi); } }
    const every = lob.state === 'queue' || lob.state === 'offer' ? 3000 : where === 'harbor' ? (spec.on || document.hidden ? 0 : 6000) : 10000; // [v71] harbor: live arena head-count every 6 s (read only, holds no seat) // queued seats expire after 15 s without a poll, arena seats after 25 s
    if (!every || lob.busy || now - (lob.lastPoll || 0) < every) return;
    lob.lastPoll = now;
    lobbyCall(where === 'spec' && !spec.harbor ? 'spec' : 'poll').then((r) => { // [v99] harbor spectators only read the arena count
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
    lobbyCall('leave'); toHarbor('BACK IN THE HARBOR', `you kept ${formatGoldAmount(game.gold | 0)} gold · JOIN BATTLE to go again`);
    lobbyCall('poll').then(harborUi);
  }
  function retUi() {
    const show = active && where === 'arena' && !me.dead && !spec.on;
    const b = $('pvp-return'); if (b) { b.classList.toggle('hidden', !show || !me.ret); /* [v71] status only while returning; the button lives in ⚙ settings */ const t = me.ret ? `RETURNING · ${Math.max(0, Math.ceil((me.ret.until - performance.now()) / 1000))}` : '⚓ HARBOR'; if (b.textContent !== t) b.textContent = t; b.classList.toggle('on', !!me.ret); }
    const mb = $('pvp-menu-return'); if (mb) mb.hidden = !show;
  }
  // ---------------- local AI ships (harbor only): never networked, never K/D, only ever hunt you ----------------
  // [v99] in a shared copy only the HOST sails AI ships (during the first HARBOR_NET.listen s after joining we keep our own)
  const SHARED_DROPS = QS.get('shareddrops') !== '0'; // [v107] ON (2-client test passed: host / non-host kills, claim race, host leaves mid-drop): one shared pile per AI kill, anyone claims; ?shareddrops=0 = old per-pirate shares
  const aiWanted = () => !spec.on && where === 'harbor' && (!room || isHost || performance.now() < hb.listenUntil); // the arena is players only, always (BANKSY)
  // [v99] COMMODORE 'hunter' (boss-side) mode: NOT built. Clean hook only: before the host hands a new harbor boss to the AI it
  // asks hunterPilot(boss) for a pirate id to sail it instead. Always null for now (hunter.enabled stays false).
  const hunter = { enabled: false };
  const hunterPilot = (bossShip) => (hunter.enabled && bossShip ? null : null);
  // [v94] HARBOR BOSS: countdown runs only while you sail the harbor (alive, not spectating); one boss at a time
  const boss = { t: HARBOR_BOSS.every[0] + Math.random() * (HARBOR_BOSS.every[1] - HARBOR_BOSS.every[0]), e: null, bar: null };
  const bossAlive = () => !!(boss.e && boss.e.alive && bots.has(boss.e.net.id));
  function spawnBoss() {
    if (bossAlive() || where !== 'harbor') return null;
    const isle = SAIL_ALL && where === 'harbor'; // [v314] the Commodore spawns + patrols round the island too, never off the dock
    let pt = null;
    if (isle) { const L = K.dock?.layout, H = L?.FM?.H && L.harborToFoot ? (x, z) => L.FM.H(...L.harborToFoot(x, z)) : null; // [v314] random spot round the island
      pt = pickBossSpawn(H, allShips(), boss.last); if (pt && K.islands?.freeSpot) pt = K.islands.freeSpot(pt[0], pt[1], 16); }
    const [x, z] = pt || pickSpawn(null, isle).pt, e = K.spawnEnemy(x, z, 2, 'boss'), id = `b${++botSeq}${myId.slice(-4)}`;
    e.net = { id, kind: 'bot' }; e.yaw = Math.atan2(P().x - x, P().z - z); e.harborBoss = true;
    if (isle) { islandPatrolInit(e, x, z); e.patrolDir = Math.random() < 0.5 ? 1 : -1; e.patrolR = 660 + Math.random() * 300; e.yaw = patrolHeading(x, z, e.patrolDir, e.patrolR); boss.last = [x, z]; } e.noFlee = true; e.dmgBy = new Map();
    e.pilot = hunterPilot(e); // [v99] hunter hook (always null: the AI sails it)
    e.bar.querySelector('.name').textContent = '☠ THE COMMODORE'; e.bar.classList.add('t-boss', 'harbor-boss');
    scaleAi(e); bots.set(id, e); boss.e = e;
    K.banner('☠ THE COMMODORE!', room ? `the Commodore sails in · ${formatGoldAmount(e.gold)}g, shared by damage` : `the Commodore sails in · sink him for ${formatGoldAmount(e.gold)}g`); K.sfx?.boss?.();
    return e;
  }
  function bossTick(dt) {
    const on = where === 'harbor' && !spec.on && (room ? isHost && performance.now() >= hb.listenUntil : P().alive && !me.dead); // [v99] a shared copy: the host's clock
    if (on && !bossAlive()) { boss.t -= dt; if (boss.t <= 0) { boss.t = HARBOR_BOSS.every[0] + Math.random() * (HARBOR_BOSS.every[1] - HARBOR_BOSS.every[0]); spawnBoss(); } }
    bossBar();
  }
  function bossBar() {
    let b = boss.bar; const show = bossAlive() && (where === 'harbor' || (spec.on && spec.harbor));
    if (show && !b) { b = boss.bar = document.createElement('div'); b.id = 'pvp-boss-bar'; b.innerHTML = '<span>☠ THE COMMODORE</span><i><b></b></i>'; document.body.appendChild(b); }
    if (b) { b.hidden = !show; if (show) b.querySelector('b').style.width = `${Math.max(0, boss.e.hp / boss.e.maxHp) * 100}%`; }
  }
  function islandPatrolInit(e, x, z) {
    e.islandPatrol = true; e.patrolDir = botSeq % 2 ? 1 : -1; e.patrolR = 640 + (botSeq % 4) * 95; e.patrolC = [SAIL.cx, SAIL.cz];
    e.yaw = patrolHeading(x, z, e.patrolDir, e.patrolR); e.wp = null;
  }
  function aiTick(dt) {
    bossTick(dt);
    botT -= dt; if (botT > 0) return; botT = 2;
    const now = performance.now();
    for (const [id, b] of bots) if (!b.mesh.parent) bots.delete(id);
    for (const b of bots.values()) if (b.remote && b.alive && now - (b.seenAt || 0) > 7000) { b.alive = false; b.sinking = 0.001; b.fade = true; if (b.netState) b.netState.a = false; } // [v99] the host stopped sending it
    if (aiWanted()) {
      const alive = [...bots.values()].filter(b => b.alive && !b.harborBoss && !b.remote).length; // the boss is extra
      const want = harborAiCount(copyLevel()) + (SAIL_ALL ? 6 : 0) + (room ? Math.min(HARBOR_NET.extraAiMax, livePeers().length * HARBOR_NET.extraAi) : 0); // [sail-around] +6 outer-coast AI when sail-all
      if (alive < want) { const preferIsland = SAIL_ALL && where === 'harbor'; const [x, z] = pickSpawn(null, preferIsland).pt; const e = K.spawnEnemy(x, z, 1, null); const id = `b${++botSeq}${myId.slice(-4)}`; e.net = { id, kind: 'bot' }; e.bar.querySelector('.name').textContent = ''; e.yaw = Math.atan2(-x, -z); if (preferIsland) islandPatrolInit(e, x, z); e.dmgBy = new Map(); scaleAi(e); bots.set(id, e); } // [v314] every harbor AI patrols round the island
    } else clearLocalAi(false, true);
    capPiles(true);
  }
  // harbor economy: AI boats grow with YOUR total upgrade level L (HP, size + hitbox, damage) and pay proportionally more
  const totalLevel = () => Object.values(getRunLevels()).reduce((a, b) => a + (b | 0), 0);
  const lvSum = (lv) => Object.values(lv || {}).reduce((a, b) => a + (b | 0), 0);
  // [v99] a shared copy scales its AI to the pirates' AVERAGE total upgrade level (alone: yours, exactly as before)
  const copyLevel = () => { if (!(room && where === 'harbor')) return totalLevel(); const L = [totalLevel(), ...livePeers().filter(p => p.lv).map(p => lvSum(p.lv))]; return Math.round(L.reduce((a, b) => a + b, 0) / L.length); };
  function scaleAi(e) {
    const L = copyLevel(), sc = harborScale(L), sz = 1 + HARBOR_SIZE_PER_LV * L, ud = e.mesh.userData;
    const hp0 = HARBOR_HP_BASE * harborHpScale(L) * PVP_DMG_MUL; e.hp = e.maxHp = Math.round(hp0 * (e.harborBoss ? 1 : HARBOR_AI.hpMul)); e.dmgMul = (1 + HARBOR_DMG_PER_LV * L) * PVP_AI_DMG_MUL; // [harbor-ai-tough] harbor AI x1.75 HP (bosses unchanged, below); [pvp hp] same harbor pace with the bigger BR hulls
    { const f = Math.min(1, Math.max(0, L) / 44), lerp = (a) => a[0] + (a[1] - a[0]) * f; // [v93] sharper AI as you grow (HARBOR_AI)
      e.reload = lerp(HARBOR_AI.reload); e.accuracy = lerp(HARBOR_AI.accuracy); e.fireR = lerp(HARBOR_AI.fireR); e.maxSpeed *= 1 + HARBOR_AI.speed * f; e.cd = Math.min(e.cd, e.reload); }
    e.gold = harborGold(L); e.aiLevel = L;
    if (e.harborBoss) { const B = HARBOR_BOSS; e.hp = e.maxHp = Math.round(hp0) * B.hp; e.dmgMul *= B.dmg; e.reload *= B.reloadMul; e.accuracy = Math.min(0.92, 0.6 + 0.2 * Math.min(1, Math.max(0, L) / 44) + B.accuracy); // [harbor-ai-tough] boss aim on the old 0.6-0.8 curve (unchanged)
      e.cannons = Math.min(B.guns[1], B.guns[0] + Math.floor(L / 15)); K.refitGuns?.(e); e.gold = harborGold(L) * B.pay; e.maxSpeed = Math.min(e.maxSpeed, 7.5 * (1 + HARBOR_AI.speed * Math.min(1, L / 44))); }
    const k = sz * (e.harborBoss ? HARBOR_BOSS.scale : 1);
    e.aiK = k; scaleMesh(e, k);
  }
  function scaleMesh(e, k) { if (k !== 1) { const u = e.mesh.userData; e.mesh.scale.multiplyScalar(k); u.len *= k; u.hitLen = (u.hitLen || u.len / k) * k; if (u.baseLen) u.baseLen *= k; u.beam *= k; u.depth *= k; } } // (u: the refitted hull)
  function clearLocalAi(instant, keepProxies = false) { // we sailed into the arena / spectate / left (or a shared copy's host took over): AI ships sink away, their loot despawns
    for (const [id, b] of bots) {
      if (keepProxies && b.remote) continue; // [v99] the host's ships stay
      if (instant) { dropShip(b); bots.delete(id); continue; }
      if (b.alive) { b.alive = false; b.sinking = 0.001; b.fade = true; }
    }
    // [v105] ROOT CAUSE of "harbor gold disappears before it's claimed": a non-host's aiTick calls clearLocalAi(false, true) every 2 s
    // (aiWanted() is false for a non-host in a shared copy), and this line removed every local pile, i.e. your share of a shared
    // kill and any AI gold you dropped before a copy-mate joined. Piles now only go when you actually leave the harbor (instant).
    if (instant) for (const [pid, l] of piles) if (l.local) removePile(pid);
  }
  // ---------------- [v99] SHARED HARBOR: copies, host AI, hits, damage-share gold ----------------
  // heartbeat every HARBOR_NET.beat s while sailing the harbor: the RPC keeps our copy seat and says who else is in it.
  // n + s ≥ 2 -> open the copy's Realtime room; alone -> close it (no traffic). Hidden tab / no input for HARBOR_NET.afk s -> leave.
  function hbTick(now) {
    if (!hbNet || where !== 'harbor' || spec.on || !active) return;
    if (document.hidden || now - Math.max(me.lastInput || 0, hb.moveAt || 0) > HARBOR_NET.afk * 1000) { if (room || hb.copy) hbLeave(); return; } // (a held joystick / mouse steering counts as here)
    if (hb.busy || now - hb.beatAt < HARBOR_NET.beat * 1000) return;
    hb.beatAt = now; hb.busy = true; const g = hb.gen;
    hbNet.call('beat', { seat: seatId, name, cap: HB_CAP, wantCopy: hb.wantCopy || null }).then(async (r) => {
      try {
        if (!active || g !== hb.gen || where !== 'harbor' || spec.on) return;
        if (r?.state !== 'play') { hb.copy = 0; hb.n = 0; if (room) hbDisconnect(); return; }
        Object.assign(hb, { copy: r.copy | 0, n: r.n | 0, s: r.s | 0, pirates: r.pirates | 0, copies: Array.isArray(r.copies) ? r.copies : [], cap: r.cap || hb.cap, wantCopy: 0 });
        const want = hb.n + hb.s >= 2;
        if (room && (!want || room.hbCopy !== hb.copy)) hbDisconnect(); // alone again, or moved to another copy (budget)
        if (want && !room) await hbConnect(hb.copy, g);
      } finally { hb.busy = false; if (active && where === 'harbor') hud(); }
    });
  }
  async function hbConnect(copy, g) {
    let link; try { link = await hbNet.openRoom(copy); } catch (e) { console.warn('[harbor] connect failed', e?.message); return; }
    if (!active || g !== hb.gen || where !== 'harbor' || spec.on || room) { link.close(); return; }
    room = link; link.hbCopy = copy; roomIdx = copy; link.boost = () => window.PFP?.dock?.battle?.fastHz?.(1 + (link.heard?.() || 0)) || 0; // [Emerly]/v337] faster sends while YOU fight; pass room headcount for Free-tier budget
    hb.hj = Date.now(); hb.listenUntil = performance.now() + HARBOR_NET.listen * 1000;
    isHost = false; hostId = null; wire(link); link.setState(stateMsg); link.send('hello', { i: myId }, { now: true });
  }
  function hbDisconnect() { // close the copy's room: its pirates and the host's AI ships leave with it (our own AI ships stay)
    if (!room || where === 'arena') return;
    room.send('bye', { i: myId }, { now: true }); room.close(); room = null; clearPeers();
    for (const l of piles.values()) if (!l.local && !l.taken) l.local = true; // [v105] alone again: the copy's shared drops stay and are yours to grab
    for (const [id, b] of bots) if (b.remote) { dropShip(b); bots.delete(id); }
    if (boss.e && !bots.has(boss.e.net.id)) boss.e = null;
    isHost = false; hostId = null; hb.listenUntil = 0;
  }
  // [backpack-pvp] t1694u CHOOSE SERVER: public copy / + NEW (lowest empty copy) / OWN code (own prefix) / AUTO
  async function switchServer(plan) {
    if (!hbNet) return { ok: false, why: 'shared harbors are off right now' };
    if (!plan?.ok) return { ok: false, why: plan?.why || 'bad server' };
    if (!active || where !== 'harbor' || spec.on) return { ok: false, why: 'leave the arena / spectate first' };
    if (lob.state !== 'harbor') return { ok: false, why: 'leave the queue first' };
    try { if (K.dock?.houses?.inHouse) K.dock.houses.exitHouse(); } catch {}
    hbLeave(true);
    hbNet.setPrefix(plan.prefix); hb.wantCopy = plan.wantCopy || 0; hb.copies = []; hb.copy = 0; hb.beatAt = 0;
    try { localStorage.setItem('pfp_hb_server', plan.code || ''); } catch {}
    markInput(); hbTick(performance.now()); // reconnect now, not at the next heartbeat
    harborUi(); hud();
    const msg = `⚓ Switched to ${plan.label}`; K.banner?.('⚓ SERVER', esc(msg).slice(0, 60));
    return { ok: true, msg, prefix: hbNet.prefix, wantCopy: plan.wantCopy || 0, code: plan.code || '' };
  }
  const serverPicker = hbNet && SERVER_PICKER_ON ? createServerPicker({
    info: () => ({ prefix: hbNet.prefix, copy: hb.copy | 0, copies: hb.copies, cap: hb.cap || HARBOR_NET.cap, wantCopy: hb.wantCopy | 0, n: hb.n | 0, pirates: hb.pirates | 0 }),
    switchTo: switchServer, toast: (m) => K.banner?.('⚓ SERVER', String(m).slice(0, 60)),
  }) : null;
  try { const op = ownPrefix(localStorage.getItem('pfp_hb_server') || ''); if (hbNet && op && !QS.get('pvproom')) hbNet.setPrefix(op); } catch {} // your OWN server sticks until AUTO PUBLIC
  function hbLeave(keepalive = false) { hb.gen++; if (where !== 'spec') hbDisconnect(); if (hbNet && (hb.copy || keepalive)) hbNet.call('leave', { seat: seatId, keepalive }); hb.copy = 0; hb.n = 0; hb.beatAt = 0; hb.busy = false; }
  // host order in a copy: who joined it first (hj, their own clock: everyone compares the same numbers), then the lowest id
  function electHarborHost() {
    if (!spec.on && performance.now() < hb.listenUntil) return;
    if (!spec.on && performance.now() < hb.listenUntil + 6000 && livePeers().some(p => !p.hj)) return; // [v104] wait until every copy-mate's join time (hj) has arrived: no brief wrong host + AI hand-over churn
    const c = [...(spec.on ? [] : [{ id: myId, hj: hb.hj }]), ...livePeers().filter(p => p.hj).map(p => ({ id: p.id, hj: p.hj }))];
    c.sort((a, b) => a.hj - b.hj || (a.id < b.id ? -1 : 1)); const h = c[0]?.id ?? null;
    if (h === hostId) return;
    const was = isHost; hostId = h; isHost = h === myId;
    if (isHost && !was) { hb.hostSince = performance.now(); adoptBots(); setTimeout(() => { if (isHost && room) sendWorld(); }, 2500); } else if (!isHost && was) yieldBots(); // [v105] the new host already holds every shared drop (all clients keep the list) and re-announces it
  }
  function adoptBots() { // the host left: its AI ships (our copies of them) become ours, same place, hull and stats
    for (const e of bots.values()) {
      if (!e.remote || !e.alive) continue;
      const st = e.netState, a = e.aiS || {};
      if (st) { e.x = st.x; e.z = st.z; e.yaw = st.y; e.speed = st.v; e.hp = st.h; e.maxHp = st.m; }
      Object.assign(e, { remote: false, netState: null, dmgMul: a.dmgMul ?? e.dmgMul, reload: a.reload ?? e.reload, accuracy: a.accuracy ?? e.accuracy, fireR: a.fireR ?? e.fireR, maxSpeed: a.maxSpeed ?? e.maxSpeed,
        gold: a.gold ?? e.gold, aiLevel: a.aiLevel ?? 0, state: 'roam', wp: null, tgt: null, tgtT: 0, cd: 1 + Math.random() * 2, dmgBy: new Map() });
    }
    console.info('[harbor] I am the harbor host now');
  }
  function yieldBots() { // an older pirate is host after all: our AI ships wait for its updates (and fade if it doesn't have them)
    const now = performance.now();
    for (const e of bots.values()) { if (e.remote || !e.alive) continue;
      e.aiS = { dmgMul: e.dmgMul, reload: e.reload, accuracy: e.accuracy, fireR: e.fireR, maxSpeed: e.maxSpeed, gold: e.gold, aiLevel: e.aiLevel };
      Object.assign(e, { remote: true, seenAt: now, netState: { yr: 0, x: e.x, z: e.z, y: e.yaw, v: e.speed, t: 0, h: e.hp, m: e.maxHp, a: true, p: false, at: now } }); }
  }
  // the host's AI ships ride in its state message: [id, boss, x, z, yaw, speed, hp, maxHp, size, dmg×, reload, accuracy, range, top speed, gold, level, guns]
  const aiRows = () => [...bots.values()].filter(b => !b.remote && b.alive && !b.fade).slice(0, 12).map(b => [b.net.id, b.harborBoss ? 1 : 0, r1(b.x), r1(b.z), r2(b.yaw), r1(b.speed), Math.round(b.hp), Math.round(b.maxHp),
    r2(b.aiK || 1), r2(b.dmgMul || 1), r2(b.reload || 3), r2(b.accuracy || 0.6), Math.round(b.fireR || 70), r1(b.maxSpeed || 7), Math.round(b.gold || 0), b.aiLevel | 0, b.cannons | 0]);
  function makeProxy(id, isBoss, x, z, k, guns) {
    const e = K.spawnEnemy(x, z, isBoss ? 2 : 1, isBoss ? 'boss' : null);
    e.x = x; e.z = z; e.net = { id, kind: 'bot' }; e.remote = true; e.aiK = k;
    if (isBoss) { e.harborBoss = true; e.noFlee = true; e.bar.querySelector('.name').textContent = '☠ THE COMMODORE'; e.bar.classList.add('t-boss', 'harbor-boss'); if (guns) { e.cannons = guns; K.refitGuns?.(e); } boss.e = e;
      if (!spec.on || spec.harbor) { K.banner('☠ THE COMMODORE!', 'the Commodore sails in · sink him together, the gold is shared by damage'); K.sfx?.boss?.(); } }
    else e.bar.querySelector('.name').textContent = '';
    scaleMesh(e, k); bots.set(id, e); return e;
  }
  function syncBots(rows) { // a non-host / spectator: draw the host's AI ships (dead-reckoned by updateRemote)
    if (isHost || !Array.isArray(rows)) return;
    const now = performance.now();
    for (const w of rows.slice(0, 12)) {
      if (!Array.isArray(w) || typeof w[0] !== 'string' || w[0].length > 24 || w[0][0] !== 'b') continue;
      const [id, bossF, x, z, y, v, h, m, k, dm, rl, acc, fr, ms, gold, L, guns] = w;
      let e = bots.get(id);
      if (e && !e.remote) continue; // still ours (a host change in flight)
      if (!e) { if (!(+h > 0) || seenBs.has(id)) continue; e = makeProxy(id, !!bossF, +x || 0, +z || 0, clamp(+k || 1, 0.5, 4), clamp(guns | 0, 0, 12)); }
      if (!e.alive) continue;
      const st = e.netState, ny = +y || 0; let yr = 0;
      if (st) { const sdt = (now - st.at) / 1000; if (sdt > 0.04 && sdt < 3) yr = clamp(angWrap(ny - st.y) / sdt, -2.5, 2.5); yr = st.yr != null ? st.yr * 0.35 + yr * 0.65 : yr; }
      e.netState = { yr, x: +x || 0, z: +z || 0, y: ny, v: clamp(+v || 0, 0, 30), t: 0, h: clamp(+h || 0, 0, 1e5), m: clamp(+m || 1, 1, 1e5), a: true, p: false, at: now };
      e.aiS = { dmgMul: clamp(+dm || 1, 0.1, 20), reload: clamp(+rl || 3, 0.5, 10), accuracy: clamp(+acc || 0.6, 0, 1), fireR: clamp(+fr || 70, 20, 200), maxSpeed: clamp(+ms || 7, 1, 30), gold: clamp(gold | 0, 0, 1e5), aiLevel: L | 0 };
      e.dmgMul = e.aiS.dmgMul; e.gold = e.aiS.gold; e.seenAt = now;
    }
  }
  let botHits = [];
  function flushBotHits() { if (botHits.length && room && where === 'harbor') room.send('bh', { s: myId, h: botHits.slice(0, 16) }); botHits = []; }
  function onBotHit(m) { // host: another pirate's balls hit one of our AI ships (same caps as PvP hits: per-ball max, ~10 hits/s, range)
    if (!isHost || where !== 'harbor' || !m || !isNetId(m.s) || !Array.isArray(m.h)) return;
    const sh = peers.get(m.s)?.ship; if (!sh) return;
    const now = performance.now(), bk = buckets.get(m.s) || { tokens: 16, t: now };
    bk.tokens = Math.min(16, bk.tokens + (now - bk.t) / 1000 * 10); bk.t = now; buckets.set(m.s, bk);
    for (const it of m.h.slice(0, 16)) {
      if (!Array.isArray(it) || bk.tokens < 1) break; bk.tokens--;
      const e = bots.get(it[0]), fp = footPeer(m.s); if (!e || e.remote || !e.alive || Math.min(Math.hypot(sh.x - e.x, sh.z - e.z), fp ? Math.hypot(fp.x - e.x, fp.z - e.z) : 1e9) > 260) continue; // [v347] + shot from the shore
      if (fp && Math.hypot(fp.x - e.x, fp.z - e.z) <= SC.SHIP_RANGE + 30) e.shoreAggro = { id: m.s, until: performance.now() + 30000 };
      const dmg = clamp(Math.round(+it[1] || 0), 0, MAX_HIT); if (!dmg) continue;
      e.lastBy = m.s; (e.dmgBy ||= new Map()).set(m.s, (e.dmgBy.get(m.s) || 0) + Math.min(dmg, Math.max(0, e.hp)));
      K.damage(e, dmg, new THREE.Vector3(e.x, e.y + 2, e.z), sh);
    }
  }
  function hostBotSunk(e, src) { // host: the last hit gets the kill, the gold is split by damage dealt (the rest to the killer)
    const gold = e.gold || PVP_AI_GOLD, by = e.dmgBy || new Map(); if (!by.size && src === P()) by.set(myId, 1);
    const killer = e.lastBy || ([...by.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null);
    const tot = [...by.values()].reduce((a, b) => a + b, 0), pay = [];
    if (tot > 0) { let left = gold; for (const [id, d] of by) { const g = Math.floor(gold * d / tot); if (g > 0) { pay.push([id, g]); left -= g; } }
      if (left > 0) { const kk = pay.find(q => q[0] === killer) || pay[0]; if (kk) kk[1] += left; else if (killer) pay.push([killer, left]); } }
    else if (killer) pay.push([killer, gold]);
    // [v105] SHARED DROPS (BANKSY: "make it so any player can claim"): no per-pirate shares any more. The host drops ONE pile with the
    // whole gold where the ship went down (nudged clear of rocks / the shore); first pirate to reach it gets it (host grant, 'got'
    // broadcast). p stays empty so a v104 client in the copy doesn't also make its own share pile; sp = shared pile.
    if (SHARED_DROPS) { const [px, pz] = dropSpot(e.x, e.z);
      const m = { h: myId, b: e.net.id, k: killer, x: r1(e.x), z: r1(e.z), boss: e.harborBoss ? 1 : 0, g: gold, p: [], sp: 1 };
      room.send('bs', m, { now: true }); onBotSunkNet(m, true); spawnPile(e.net.id, px, pz, gold, false, gold); return; }
    const m = { h: myId, b: e.net.id, k: killer, x: r1(e.x), z: r1(e.z), boss: e.harborBoss ? 1 : 0, g: gold, p: pay.slice(0, 8) };
    room.send('bs', m, { now: true }); onBotSunkNet(m, true);
  }
  const seenBs = new Set();
  function onBotSunkNet(m, local = false) { // everyone in the copy (host included): sink it, take your share as a pile only you see
    if (!m || typeof m.b !== 'string' || seenBs.has(m.b)) return;
    if (!local && (where === 'arena' || typeof m.h !== 'string' || (m.h !== hostId && !peers.has(m.h)))) return;
    seenBs.add(m.b); if (seenBs.size > 400) seenBs.delete(seenBs.values().next().value);
    const e = bots.get(m.b), isBoss = !!m.boss, [x, z] = clampXZ(m.x, m.z);
    if (!local && e && e.remote && e.alive) { e.alive = false; e.hp = 0; e.sinking = 0.001; if (e.netState) e.netState.a = false; sfx.sink(!!e.big); fx.ring(new THREE.Vector3(e.x, 0, e.z), 3, 16, 2.2); }
    const capG = Math.max(1, e?.gold || harborGold(80) * HARBOR_BOSS.pay), mine = Array.isArray(m.p) ? m.p.find(q => Array.isArray(q) && q[0] === myId) : null;
    const g = mine ? clamp(Math.floor(+mine[1] || 0), 0, capG) : 0;
    const mapDrop = isBoss && m.k === myId && !spec.on; // [v145] your boss kill = your treasure map: your share floats in the crimson map chest
    if (g > 0 && !spec.on && !m.sp) spawnPile(m.b, x, z, g, true, g, mapDrop); // (a v104 host: your damage share, only you see it)
    if (isBoss) { if (boss.bar) boss.bar.hidden = true; K.banner('THE COMMODORE SUNK!', m.sp ? `${formatGoldAmount(clamp(m.g | 0, 0, capG * 2))}g of treasure in the water · first to grab it gets it` : g ? `your share: ${formatGoldAmount(g)}g of treasure · grab it` : `sunk by ${esc(nameOf(m.k))}`); }
    if (m.k === myId && !spec.on) countBotKill(isBoss);
  }
  function wire(r) {
    r.on('lb', onLootNet); // [backpack-pvp] plunder bags / sea crates in this copy
    r.on('s', onState).on('shot', onShot).on('hit', onHit).on('gh', onGunHit).on('bk', onBombKill).on('sunk', onSunk).on('gdrop', onGdrop).on('pile', (m) => { if (where === 'harbor' && m?.h && m.h !== hostId) return; addPile(m.pid, m.x, m.z, m.v, m.ttl, false, Math.min(+m.e || 0, where === 'harbor' ? Math.max(PVP_DEATH_BONUS, harborGold(80) * HARBOR_BOSS.pay * 2) : PVP_DEATH_BONUS), false, m.y ?? null); }) // [v105] harbor: the host's shared AI drops (earned = the AI gold)
      .on('claim', (m) => { if (isHost) grant(m.pid, m.i); }).on('got', applyGot).on('gone', (m) => removePile(m.pid))
      .on('hello', () => { if (isHost && (where === 'arena' || where === 'harbor')) sendWorld(); }).on('world', onWorld).on('pv', (m) => { const l = piles.get(m?.pid); if (l) { l.value = clamp(Math.floor(+m.v || 0), 0, PVP_PILE_MAX); l.earned = clamp(Math.floor(+m.e || 0), 0, l.value); pileLook(l); } })
      .on('bye', (m) => { const p = peers.get(m?.i); if (p) p.heard = 0; if (isNetId(m?.i)) K.dock?.fnet?.drop?.(m.i); }) // [admin-menu] their on-foot pirate goes at once too (INVISIBLE / left)
      .on('adm', (m, from) => { try { ADM.onPoke?.(m, from); } catch {} }) // [admin-menu] zero-trust poke: the target only re-asks the SERVER (admin_my_state / inventory)
      .on('soc', (m, from) => { try { globalThis.PFP_SOCIAL_NET?.onNet?.(m, from); } catch {} }) // [Friends R2] squad invites (addressed: m.to)
      .on('emo', onEmote) // [v96] quick-chat callouts (preset ids only)
      .on('sq', onSq) // [v98] squads round state (host)
      .on('bh', onBotHit).on('bs', (m) => onBotSunkNet(m)); // [v99] shared harbor: hits on the host's AI ships, an AI ship sunk (kill + gold shares)
    r.onStatus = (s) => { if (s === 'reconnecting') K.banner('RECONNECTING…', 'the sea went quiet for a moment'); else if (s === 'limit') K.banner('SERVERS BUSY', 'the arena is over capacity, hang on…'); };
  }
  const livePeers = () => [...peers.values()].filter(p => performance.now() - p.heard < PEER_TIMEOUT);
  function sendWorld(sync = false) { const list = [...piles.values()].filter(l => !l.local && !l.taken).slice(0, PVP_PILE_CAP + 10).map(l => [l.pid, r1(l.x), r1(l.z), l.value, 0, l.gy]); room?.send('world', { h: myId, s: sync ? 1 : 0, piles: list, e: list.map(p => piles.get(p[0])?.earned || 0) }); }
  function onWorld(m) { // the host's pile list: add what we're missing; on a resync also drop piles the host no longer has
    const list = (Array.isArray(m?.piles) ? m.piles : []).slice(0, PVP_PILE_CAP + 10);
    for (const p of list) { if (!Array.isArray(p)) continue; const [pid, x, z, v, , gy] = p, e = Array.isArray(m.e) ? m.e[list.indexOf(p)] : 0; const l = piles.get(pid); if (l) { if (+v > 0 && +v !== l.value) { l.value = clamp(Math.floor(+v), 0, PVP_PILE_MAX); pileLook(l); } } else addPile(pid, x, z, v, 0, false, Math.min(+e || 0, PVP_PILE_MAX), false, gy ?? null); }
    if (m.s && m.h === hostId && !isHost) { const keep = new Set(list.map(p => p?.[0])); for (const [pid, l] of piles) if (!l.local && !keep.has(pid) && performance.now() - l.born > 5000) removePile(pid); }
  }

  // ---------------- remote ships ----------------
  const shipOptsFor = (sk) => ({ ...K.shipOpts, light: false, skin: pvpSkin(sk), pvp: true });
  function makeBar(obj, label) {
    const bar = document.createElement('div'); bar.className = 'ehp pvp-ehp';
    bar.innerHTML = `<div class="name pvp-name"></div><div class="bar"><div class="fill"></div></div>`;
    $('bars').appendChild(bar); obj.bar = bar; obj.fill = bar.querySelector('.fill'); obj.nameEl = bar.querySelector('.name'); obj.nameEl.textContent = label;
  }
  // [dock-lag] BANKSY 10:40 PM "running and jumping by ships at dock is laggy": every other pirate's ship (own skin = own shader set, own crew)
  // was built and drawn on the frame its first state arrived, so its ~15-30 shader programs compiled synchronously mid-run. Now a new remote
  // ship compiles with compileAsync and only shows once it is ready (&shipwarm=0 = the old instant show); far away, its crew + captain
  // figure are hidden (&shiplod=0 = always drawn): desktop past 90 m, phones past 55 m.
  const DQS = typeof location !== 'undefined' ? location.search : '', SHIP_WARM = !/[?&]shipwarm=0(&|$)/.test(DQS), SHIP_LOD = !/[?&]shiplod=0(&|$)/.test(DQS);
  const FAR_R2 = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 55 : 90) ** 2;
  function farCrew(e) { const c = K.camera; if (!SHIP_LOD || !c || !e.mesh) return; const far = e.mesh.position.distanceToSquared(c.position) > FAR_R2;
    if (far === e._far && e._farMesh === e.mesh) return; e._far = far; e._farMesh = e.mesh;
    const lod = crewLodOf(e.mesh.userData.body); if (lod) lod.visible = !far; const cap = e.mesh.userData.captainMesh; if (cap) cap.visible = !far; }
  function buildRemoteMesh(p, lv, sk) {
    const mesh = compilePreview(lv, shipOptsFor(sk)); scene.add(mesh);
    if (SHIP_WARM && K.warmShip) { mesh.visible = false; K.warmShip(mesh).then(() => { mesh.visible = true; }); }
    applyShipGear(mesh, p.captain?.gear); // [Raul shop items 2]
    if (p.captain) attachCaptain(mesh, p.captain); // [Timothy v2] remote player's captain JSON (pfp_captain_v1) when the netcode sends it
    if (p.ship?.mesh) { mesh.position.copy(p.ship.mesh.position); scene.remove(p.ship.mesh); K.disposeShip(p.ship.mesh); p.ship.mesh = mesh; }
    return mesh;
  }
  function lvFrom(arr) { const lv = {}; UPGRADES.forEach((u, i) => lv[u.id] = clamp(Math.floor(arr?.[i] || 0), 0, u.tiers.length)); return lv; }
  function onState(m) {
    if (!m || !isNetId(m.i) || m.i === myId) return; // [security H5]
    if (where === 'harbor') window.PFP?.dock?.onPeerState?.(m); // [Emerly] other pirates' berth + on-foot pose (harbor room only)
    let p = peers.get(m.i);
    const now = performance.now();
    if (!p) { p = { id: m.i, heard: now, st: null, ship: null, key: '' }; peers.set(m.i, p); }
    const lv = lvFrom(m.lv), sk = knownSkin(m.sk) ? m.sk : 'classic', key = JSON.stringify(lv) + sk; // [v98] + unlock skins (COMMODORE)
    p.fz = m.fz === 1; // [admin-menu] frozen by the owner (icy tint)
    p.pc = typeof m.pc === 'string' ? m.pc.slice(0, 8) : ''; p.hj = +m.hj || 0; // [v99] harbor host order
    p.name = esc(m.n).slice(0, 20) || 'PIRATE'; p.k = m.k | 0; p.d = m.d | 0; p.g = m.g | 0; p.K = m.K | 0; p.D = m.D | 0; p.bK = m.bK == null ? null : Math.max(0, m.bK | 0); p.bD = m.bD == null ? null : Math.max(0, m.bD | 0); /* [v81] board totals */ p.lv = lv; p.sk = sk;
    const prevHeard = p.heard; p.heard = now;
    // speed sanity: a jump faster than the best possible ship (same life) is clamped
    let [x, z] = clampXZ(m.x, m.z);
    if (p.st && p.st.l === m.l && p.ship) { const dt = Math.max(0.05, (now - prevHeard) / 1000), dx = x - p.st.x, dz = z - p.st.z, d = Math.hypot(dx, dz), lim = MAX_SPEED * dt + 6;
      if (d > lim) { x = p.st.x + dx / d * lim; z = p.st.z + dz / d * lim; [x, z] = clampXZ(x, z); } }
    const stats = modeStats({ levels: lv }, PVP_MODE); // [v95] BR gun count (4 + CANNONS level)
    // [v87] turn rate from the last two headings (shortest angle), so remote ships keep turning smoothly between updates
    let yr = 0; const ny = +m.y || 0;
    if (p.st && p.st.l === m.l) { const sdt = (now - p.st.at) / 1000; if (sdt > 0.04 && sdt < 1.5) yr = clamp(angWrap(ny - p.st.y) / sdt, -2.5, 2.5); yr = p.st.yr != null ? p.st.yr * 0.35 + yr * 0.65 : yr; }
    p.st = { yr, x, z, y: ny, v: clamp(+m.v || 0, 0, MAX_SPEED), t: clamp(+m.t || 0, -1, 1), h: clamp(+m.h || 0, 0, MAX_HP), m: clamp(+m.m || 100, 1, MAX_HP), a: m.a !== 0, p: !!m.p, l: m.l | 0, at: now };
    // [Timothy] their shop gear ('gr', static field: sent on join / change + the transport's 3 s static refresh). Validated against
    // GEAR_RENDERS; missing / default = the deck crew's captain (no extra figure). Dressed = Raul's v4 captain at their wheel.
    // Their clothes take the colours of the ship skin they already send ('sk', validated above): no extra field.
    const gw = cleanWire(m.gr), ec = eyeOf(m.ec), gk = gw + '|' + sk + '|' + ec;
    if (gk !== (p.gk ?? '|classic')) { const gNew = gw + '|' + ec !== (p.gw ?? '|0'); p.gw = gw + '|' + ec; p.gk = gk;
      // their chosen skin + hair colour ride in the wire (gear.skinColor / hairColor, validated) and applyGear paints them (setBodyLook);
      // the id hash is only the fallback look for a pirate who kept the DEFAULT skin / hair
      const gg = gw || ec ? { ...gearFromWire(gw), eyeColor: ec } : null, hashLook = { skin: [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 5, hair: p.id.charCodeAt(p.id.length - 1) % 5 };
      p.captain = gg ? { v: 1, remote: true, gear: gg, skin: sk, look: { skin: gg.skinColor ? 0 : hashLook.skin, hair: gg.hairColor ? 0 : hashLook.hair } } : null;
      if (p.ship?.mesh) applyShipGear(p.ship.mesh, p.captain?.gear); // [Raul shop items 2]
      if (p.ship?.mesh && (gNew || p.key === key)) { if (p.captain) attachCaptain(p.ship.mesh, p.captain); else detachCaptain(p.ship.mesh); } }   // a new skin rebuilds the ship below (it re-attaches)
    if (!p.ship) {
      const obj = { mesh: null, x, z, yaw: p.st.y, speed: 0, turn: 0, hp: p.st.h, maxHp: p.st.m, alive: p.st.a, roll: 0, pitch: 0, y: 0, sinking: p.st.a ? 0 : 99, state: 'roam', net: { id: p.id, kind: 'player' }, remote: true, cannons: stats.cannons };
      obj.mesh = buildRemoteMesh(p, lv, sk); obj.mesh.position.set(x, 0, z); p.ship = obj; p.key = key; makeBar(obj, p.name); enemies.push(obj);
    } else if (p.key !== key) { p.key = key; buildRemoteMesh(p, lv, sk); p.ship.cannons = stats.cannons; }
    const bt = clamp(m.bt | 0, 0, PVP_BOUNTY.cap);
    if (bt >= PVP_BOUNTY.announce && (p.bt || 0) < PVP_BOUNTY.announce) addFeed(`☠ <b>${esc(p.name)}</b> has a <b>${formatGoldAmount(bt)}g</b> bounty!`);
    else if (bt >= PVP_BOUNTY.cap && (p.bt || 0) < PVP_BOUNTY.cap) addFeed(`☠ <b>${esc(p.name)}</b> is at the MAX <b>${formatGoldAmount(bt)}g</b> bounty!`);
    p.bt = bt;
    p.ship.nameEl.innerHTML = `${esc(p.name)} · ${kd(p.K, p.D)}${bt ? ` <span class="pvp-bounty">☠${bt}</span>` : ''}`;
    p.ship.netState = p.st;
    if (typeof m.dk === 'string') p.dk = m.dk; p.ship.anchor = p.ship._safe = where === 'harbor' && !!p.dk;
    p.um = !!m.um; p.ship._unmanned = where === 'harbor' && (p.um || !!p.dk); // [backpack-pvp] Option B: their parked / unmanned ship is shielded // [dock-waterline] a peer moored at a berth rides the moored waterline too
    // [v340] BANKSY t1801u/t1802u: Harbor map colors — squadmates GREEN, other players BLACK (AI stay RED elsewhere)
    const hbv = where === 'harbor' || (spec.on && spec.harbor);
    hbPaint(p, hbv);
    if (hbv && m.i === hostId && m.ai !== undefined) syncBots(m.ai);
    syncCrewGear(p.ship.mesh, crewGear({ ...crewFromWire(m.cr), crewhatColor: crewColorFromWire(m.cc) }), { skin: sk }, p.captain?.gear); // [Raul shop2 fixes] + their captain's shop-items-2 extras // [Timothy] their crew in THEIR CREW loadout ('cr'; old builds: the uniform), never their captain's clothes
  }
  function updateRemote(e, dt) {
    const st = e.netState;
    if (st) {
      // [v339] t1800u: scale dead-reckon clamps with the live tick interval so 1.2 Hz (8-ship) arcs stay smooth (4 Hz unchanged)
      const step = 1 / Math.max(1, room?.hz?.() || 4);
      const age = Math.min((performance.now() - st.at) / 1000, Math.max(1, step * 1.35));
      // [v87] dead-reckon heading with the measured turn rate (capped at 0.6 s @ 4 Hz), and move along the turning arc (mid heading)
      const ta = Math.min(age, Math.max(0.6, step * 1.1)), ty = st.y + (st.yr || 0) * ta, my = st.y + (st.yr || 0) * ta * 0.5;
      const tx = st.x + Math.sin(my) * st.v * age, tz = st.z + Math.cos(my) * st.v * age;
      if (st.a && !e.alive) { e.alive = true; e.sinking = 0; e.x = tx; e.z = tz; e.yaw = st.y; } // respawned
      if (!st.a && e.alive) { e.alive = false; e.sinking = 0.001; }
      if (e.alive) {
        const d = Math.hypot(tx - e.x, tz - e.z);
        if (d > 40) { e.x = tx; e.z = tz; } else { const k = 1 - Math.exp(-dt * 8); e.x += (tx - e.x) * k; e.z += (tz - e.z) * k; } // frame-rate independent
        e.yaw += angWrap(ty - e.yaw) * (1 - Math.exp(-dt * 9)); e.speed = st.v; e.turn = st.t;
      } else e.speed *= 0.98;
      e.hp = st.h; e.maxHp = st.m; e.prot = st.p;
    }
    K.floatShip(e, dt); farCrew(e);
    shield(e, e.alive && (e.prot || (HB_PVP_ON && where === 'harbor' && e._unmanned))); // [backpack-pvp] rivals SEE the unmanned-ship bubble
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
    const L = s.mesh.userData.hitLen || s.mesh.userData.len, LZ = Math.max(L, s.mesh.userData.len * 0.92); s.shield.visible = true; s.shield.position.set(s.x, s.y + 3, s.z); s.shield.scale.set(L * 0.42, L * 0.32, LZ * 0.62); s.shield.rotation.y = s.yaw;
  }
  function dropShip(obj) {
    const i = enemies.indexOf(obj); if (i >= 0) enemies.splice(i, 1);
    if (obj.mesh) { scene.remove(obj.mesh); K.disposeShip(obj.mesh); }
    obj.bar?.remove(); if (obj.shield) scene.remove(obj.shield); if (obj.ring) scene.remove(obj.ring);
  }
  function clearPeers() { for (const p of peers.values()) if (p.ship) dropShip(p.ship); peers.clear(); }

  // ---------------- host (loot only) ----------------
  function electHost() {
    if (where === 'harbor' || (spec.on && spec.harbor)) return electHarborHost(); // [v99]
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
  const clampXZ = (x, z) => {
    if (where === 'harbor' && SAIL_ALL) { const [nx, nz] = clampSail(+x || 0, +z || 0); return [nx, nz]; }
    return [clamp(+x || 0, -PVP_ARENA_R, PVP_ARENA_R), clamp(+z || 0, -PVP_ARENA_R, PVP_ARENA_R)];
  };
  function botTarget(e) {
    // harbor AI hunts the nearest pirate within 220 m (alone: only ever YOU), never other AI ships, never a protected / unmanned offshore-anchored ship
    const unmanned = (s) => !!(s && (s._offshore || s._canoeAway || (K.dock?.onFoot && s.anchor) || (K.dock?.canoeing && s.anchor) || K.dock?.inHull));
    const pl = P(); let best = NO_TARGET, bd = e.islandPatrol ? 280 : 220;
    if (!ADM.invisible && pl.alive && !me.dead && me.protect <= 0 && !unmanned(pl)) { const d = Math.hypot(pl.x - e.x, pl.z - e.z); if (d < bd) { bd = d; best = pl; } }
    if (room && where === 'harbor') for (const p of livePeers()) { const s = p.ship; if (!s?.alive || s.prot || !p.st?.a || unmanned(s)) continue; const d = Math.hypot(s.x - e.x, s.z - e.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  function botSteer(e, desired) {
    if (where === 'harbor' && SAIL_ALL && e.islandPatrol) return islandSteer(e, desired, K.dock?.layout);
    const r = Math.hypot(e.x, e.z);
    return r > PVP_ARENA_R - 50 || (COAST_ON && where === 'harbor' && e.x > COAST_TURN_X && !e.islandPatrol) ? Math.atan2(-e.x, -e.z) : desired;
  } // [Emerly] coast: west-bay bots turn before berths; [sail-around] island-patrol bots use sail disc + shallow look-ahead
  function pickSpawn(selfShip = null, preferIsland = false) {
    const ships = allShips().filter(s => s !== selfShip);
    let SP = COAST_ON && where === 'harbor'
      ? (SAIL_ALL && preferIsland && SPAWNS_ISLAND.length ? SPAWNS_ISLAND : SPAWNS_COAST)
      : SPAWNS; // [Emerly] coast harbor / [sail-around] outer island ring
    // runtime deep-water filter for outer-island spawns (FM.H not available at module load)
    if (preferIsland && SAIL_ALL && SP === SPAWNS_ISLAND) {
      const L = K.dock?.layout;
      if (L?.FM?.H && L.harborToFoot) {
        SP = islandSpawnsDeep((x, z) => L.FM.H(...L.harborToFoot(x, z)));
      }
    }
    let best = SP[0], bd = -1;
    for (const pt of SP.map(q => K.islands ? K.islands.freeSpot(q[0], q[1], 16) : q)) { let d = 1e9; for (const s of ships) d = Math.min(d, Math.hypot(s.x - pt[0], s.z - pt[1])); if (d > bd) { bd = d; best = pt; } }
    return { pt: best, crowded: bd < SAFE_R }; // [solid rocks] spawn points are nudged clear of rocks
  }

  // ---------------- cannon fire / hits ----------------
  function onFire(shooter, shot) {
    if (!room || !shot.length) return;
    const w = shot.map(b => [r2(b.p.x), r2(b.p.y), r2(b.p.z), r2(b.v.x), r2(b.v.y), r2(b.v.z), r2(b.delay), b.side === 'star' ? 1 : 0, b.i | 0]); // [v95] + side, gun index
    if (shooter === P()) room.send('shot', { o: myId, b: w }, { now: where === 'harbor' }); // our volleys (harbor: at once, the state is only 1 Hz)
    else if (where === 'harbor' && isHost && shooter.net?.kind === 'bot' && !shooter.remote) // [v99] the host's AI volleys: at once when aimed at another pirate (their client applies the hits)
      room.send('shot', { o: shooter.net.id, b: w }, { now: shooter.tgt?.net?.kind === 'player' });
  }
  function onLocalFire() { me.lastFireAt = performance.now(); markInput(); if (me.protect > 0) { me.protect = 0; } if (me.ret) me.ret.until = Math.max(me.ret.until, performance.now() + RET_QUIET); } // firing restarts the return countdown
  // [v96] quick-chat: send a preset id (the wheel already limits you to 1 / 2 s); receive: preset ids only, ≤1 per 1.5 s per pirate
  function emote(e) { if (!validEmote(e) || !room || (where !== 'arena' && where !== 'harbor')) return; room.send('emo', { i: myId, e }); } // [v99] + the shared harbor
  function onEmote(m) {
    if (!m || !isNetId(m.i) || m.i === myId || !validEmote(m.e)) return;
    const p = peers.get(m.i), now = performance.now(); if (!p?.ship || !p.ship.alive) return;
    if (globalThis.PFP_SOCIAL_NET?.isMuted?.(p.name)) return; // [Friends R2] muted pirates: no callouts
    if (now - (p.emoAt || 0) < EMOTE_GAP * 0.75) return; p.emoAt = now;
    // [v145] near pirates at full voice (linear falloff made a ship 100 m off -4 dB): full to 60 m, then eased out by 280 m
    const pl = P(), d = Math.hypot(p.ship.x - pl.x, p.ship.z - pl.z), u = Math.max(0, Math.min(1, (d - 60) / 220)), vol = 1 - u * u;
    let h = 0; for (const ch of m.i) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const anchor = window.PFP?.dock?.peerEmote?.(m.i, m.e) || null; // [Raul emotes] they walk the island in your copy: their pirate moves + the bubble rides over the head
    showEmote(p.ship, m.e, { vol, pitch: 0.85 + (Math.abs(h) % 30) / 100, body: p.captain?.gear?.body === 1 ? 'f' : 'm', anchor });
  }
  function ownerObj(id) { return peers.get(id)?.ship || null; }
  const shotOwner = (id) => peers.get(id)?.ship || (where !== 'arena' && bots.get(id)?.remote ? bots.get(id) : null); // [v99] + the host's AI ships
  function onShot(m) {
    const owner = shotOwner(m.o); if (!owner || !Array.isArray(m.b)) return; const aiBall = owner.net?.kind === 'bot'; // [v99] an AI ball is real on the pirate it hits
    if (owner.mesh) owner.mesh.updateMatrixWorld(true); // [v348] t1827u: same live barrel frame as fire()/launchBall (gunList picks the matching tip; gi indexes gunList, not raw muzzles)
    for (const b of m.b.slice(0, 14)) { // [v95] up to 12 guns a side; launched from the RENDERED ship's own muzzle (v95 senders)
      const mesh = K.getBall(); mesh.position.set(b[0], b[1], b[2]); mesh.visible = false;
      const side = b[7] === 1 ? 'star' : 'port', ms = b[7] != null && owner.mesh ? gunList(owner, side) : null, muzzle = ms && ms.length ? ms[(b[8] | 0) % ms.length] : null;
      balls.push({ mesh, v: new THREE.Vector3(clamp(b[3], -80, 80), clamp(b[4], -40, 60), clamp(b[5], -80, 80)), owner, life: 6, delay: clamp(b[6], 0, 1), visual: !aiBall, muzzle, gi: b[8] | 0, side, aimT: 0 });
    }
    const pl = P(), dist = Math.hypot(owner.x - pl.x, owner.z - pl.z);
    if (m.b[0]) crewFire(owner.mesh, (m.b[0][3] * Math.cos(owner.yaw) - m.b[0][5] * Math.sin(owner.yaw)) > 0 ? 'port' : 'star');
    if (m.b[0] && m.b[0][7] == null) fx.muzzle(new THREE.Vector3(m.b[0][0], m.b[0][1], m.b[0][2]), new THREE.Vector3(m.b[0][3], 0, m.b[0][5]).normalize()); // old senders (v95 flashes at launch)
    sfx.enemyBroadside(m.b.length, clamp(1 - dist / 220, 0, 1), aiBall && !!owner.big);
  }
  const inside = (s, p) => { const [lx, lz] = K.toLocal(s, p.x, p.z), u = s.mesh.userData; return Math.abs(lx) < u.beam / 2 + 0.7 && Math.abs(lz) < (u.hitLen || u.len) / 2 + 0.6 && p.y > s.y - 1.5 && p.y < s.y + u.len * 0.9; };
  // [backpack-pvp] Option B helpers
  const unmannedLocal = () => { const d = K.dock, pl = P(); return !!(d?.on && (d.inHull || d.docking?.mode === 'docked' || (pl?.anchor && (d.onFoot || d.canoeing)) || pl?._offshore || pl?._canoeAway)); };
  function shipProtectedHarbor(s) {
    if (!s || !s.alive) return true;
    if (s.prot) return true;
    if (s === P() ? (me.protect > 0 || unmannedLocal()) : !!s._unmanned) return true;
    try { if (K.dock?.invuln?.(s)) return true; } catch {}
    return false;
  }
  const harborPvpCanHit = (shooter, target) => HB_PVP_ON && where === 'harbor' && !spec.on && !!shooter && !!target
    && !isSquadMate(shipIdOf(target)) && !isSquadMate(shipIdOf(shooter))
    && !shipProtectedHarbor(shooter) && !shipProtectedHarbor(target)
    && !(K.dock?.canFire && shooter === P() && !K.dock.canFire(shooter)) && !(shooter !== P() && K.dock?.zone?.inside?.(shooter.x, shooter.z));
  function ballStep(b, p) { // returns true when the ball is spent
    const pl = P(), hbm = where === 'harbor' || (spec.on && spec.harbor), ownerBot = b.owner?.net?.kind === 'bot';
    if (K.dock?.onFoot && ballShore(b, p, false)) return true; // [v347] t1823u: a cannonball through a pirate on foot = dead
    const ships = [pl, ...enemies];
    for (const s of ships) {
      if (s === b.owner || !s.alive || (s === pl && me.dead)) continue;
      if (ownerBot && s !== pl) { if (hbm && s.net?.kind === 'player' && inside(s, p)) { fx.hit(p.clone()); return true; } continue; } // AI balls only hurt you (another pirate's client applies its own hits), never AI ships
      if (hbm && !ownerBot && (s === pl || s.net?.kind === 'player') && !harborPvpCanHit(b.owner, s)) continue; // [v99] PvE harbor: balls pass through pirates · [backpack-pvp] Option B: open water outside Safe Harbor = live
      if (isSq() && !sqCanHit(shipIdOf(b.owner), shipIdOf(s))) continue; // [v98] squads: balls pass through teammates; no damage between rounds
      if (!inside(s, p)) continue;
      if (b.visual) { fx.hit(p.clone()); return true; }
      if (s === pl ? me.protect > 0 : s.prot) { fx.splash(p); return true; } // bubble soaks it
      const raw = b.owner === pl ? (BALL_DMG[0] + Math.random() * (BALL_DMG[1] - BALL_DMG[0])) * (pl.gunDmg || 1) * PVP_DMG_MUL : (6 + Math.random() * 4) * 1.12 * (b.owner.dmgMul || 1);
      applyHit(s, raw, p.clone(), b.owner); return true;
    }
    return false;
  }
  // [v171] BANKSY "make it so the cannons on cliff can damage ai and player ships": a live headland-battery ball (js/dock/battery.js, YOUR shot).
  // Same path as a ship cannon (applyHit: our AI -> K.damage + kill credit, the host's AI -> botHits, a pirate -> a 'hit' message), basic
  // damage (BALL_DMG x PVP_DMG_MUL, no CANNONS / boosts), never your own ship or a party mate's, a spawn bubble soaks it, SAFE HARBOR ships
  // stay immune (K.damage -> dock.invuln). Unlike ship balls, battery balls DO hit other pirates' ships in the shared harbor (BANKSY's ask).
  function batteryStep(p, gun) {
    const pl = P(); if (!pl || where !== 'harbor') return false;
    for (const s of enemies) {
      if (!s.alive || !s.mesh) continue;
      const pid = s.net?.kind === 'player' ? s.net.id : null; if (pid && isSquadMate(pid)) continue;   // [v328] Harbor squad: pass through
      if (!inside(s, p)) continue;
      if (s.prot) { fx.splash(p); return true; }
      const raw = (BALL_DMG[0] + Math.random() * (BALL_DMG[1] - BALL_DMG[0])) * PVP_DMG_MUL;
      if (pid) { flushHits(); hitQueue.g = gun | 0; }   // tagged + sent on its own: the receiver validates the gun, not our (moored) ship's distance
      applyHit(s, raw, p.clone(), pl); if (pid) flushHits(); payBattery(p); return true;
    }
    return false;
  }
  // ---------------- [v347] SHORE <-> SEA COMBAT (BANKSY t1821u / t1822u / t1823u) ----------------
  // YOUR musket on foot -> a ship: the CAPTAIN at the wheel first (full on-foot gun damage), else the hull (small ship damage).
  // Any cannonball -> YOU on foot: a direct hit or a landing within SC.BLAST_R kills outright (victim decides for itself, like ship hits).
  const _cw = new THREE.Vector3(), gunBk = new Map(), cap = { hp: SC.CAPTAIN_HP, at: 0 }, bombSeen = new Map();
  const footPeer = (id) => K.dock?.fnet?.peers?.get?.(id) || null;
  const inSafeH = (x, z) => { try { return !!K.dock?.safeZone?.inside?.(x, z); } catch { return false; } };
  function shipBox(s) { const u = s.mesh?.userData || {}, L = u.hitLen || u.len || 20; return { x: s.x, z: s.z, yaw: s.yaw, hw: (u.beam || 6) / 2 + 0.5, hl: L / 2 + 0.4, y0: (s.y || 0) - 1.2, y1: (s.y || 0) + L * 0.9 }; }
  function captainAt(s) { const a = captainAnchor(s.mesh); const par = a && (a.node?.parent || s.mesh?.userData?.body); if (!par) return null;
    par.updateWorldMatrix?.(true, false); _cw.copy(a.pos).applyMatrix4(par.matrixWorld); return { x: _cw.x, y: _cw.y, z: _cw.z, k: s.mesh.userData.buildOpts?.boss ? 1.2 : 1 }; }
  // a peer's ship you may shoot from shore: harbor PvP on, not a party mate, crewed (captain at the helm), not in / just out of SAFE HARBOR
  const gunPeerOk = (s) => HB_PVP_ON && where === 'harbor' && s.net?.kind === 'player' && !isSquadMate(s.net.id) && !shipProtectedHarbor(s);
  // battle.js shoot() (mine): the nearest ship part on the musket line. o = muzzle {x,y,z}, f = unit horizontal, slope = dy per m (null = flat)
  function gunShipTest(o, f, slope, maxD = SC.SHIP_RANGE) {
    const pl = P(); if (!pl || !(where === 'harbor' || !room)) return null; let best = null;
    for (const s of enemies) {
      if (!s?.alive || !s.mesh || s === pl || s.sinking) continue;
      const bot = s.net?.kind === 'bot' || (!s.net && s !== pl); if (!bot && !gunPeerOk(s)) continue;
      const lim = best ? best.a : maxD, c = captainAt(s);
      const ca = c ? SC.rayCylH(o, f, slope, c.x, c.z, SC.CAPTAIN_R * c.k, c.y - 0.15, c.y + SC.CAPTAIN_TALL * c.k, lim) : -1;
      if (ca > 0) { best = { a: ca, kind: 'captain', s, bot }; continue; } // t1822u: the captain FIRST
      const ha = SC.rayShipBox(o, f, slope, shipBox(s), lim);
      if (ha > 0 && (!c || Math.hypot(o.x + f.x * ha - c.x, o.z + f.z * ha - c.z) > 0.05)) best = { a: ha, kind: 'ship', s, bot };
    }
    return best;
  }
  // tps.js crosshair: what the aim ray can land on out over the water (3 hull cylinders + the captain per ship; refreshed every 0.25 s)
  let aimC = { t: 0, l: [] };
  function gunAimCyls() { const now = performance.now(); if (now - aimC.t < 250) return aimC.l; const l = [], pl = P();
    for (const s of enemies) { if (!s?.alive || !s.mesh || s === pl || s.sinking) continue; const bot = s.net?.kind === 'bot' || !s.net; if (!bot && !gunPeerOk(s)) continue;
      const b = shipBox(s), fx0 = Math.sin(s.yaw), fz0 = Math.cos(s.yaw), c = captainAt(s);
      for (const k of [-0.6, 0, 0.6]) l.push([s.x + fx0 * b.hl * k, s.z + fz0 * b.hl * k, b.hw, b.y0, b.y0 + (b.y1 - b.y0) * 0.45, 'ship']);
      if (c) l.push([c.x, c.z, SC.CAPTAIN_R * c.k, c.y - 0.15, c.y + SC.CAPTAIN_TALL * c.k, 'captain']); }
    aimC = { t: now, l }; return l; }
  // apply YOUR gun hit (battle.js calls this once the ship part is the first thing on the line). gunDmg = your musket's real damage.
  function gunShipHit(hit, p, gunDmg) {
    const pl = P(), s = hit.s, capHit = hit.kind === 'captain', dmg = capHit ? Math.max(1, Math.round(gunDmg)) : SC.hullDamage(gunDmg);
    const at = new THREE.Vector3(p.x, p.y, p.z);
    if (hit.bot) { applyHit(s, dmg, at, pl); s.shoreAggro = { id: myId, until: performance.now() + 30000 }; }
    else { if (!room) return 0; me.lastDealtAt = performance.now(); room.send('gh', { s: myId, t: s.net.id, k: capHit ? 'c' : 'h', d: dmg }, { now: true });
      crewHit(s.mesh, dmg / Math.max(1, s.maxHp || 100) * 6); fx.hit(at); }
    K.popup(at, capHit ? `CAPTAIN HIT! -${dmg}` : `-${dmg}`, 'hit'); sfx.impact?.({ dmg, maxHp: 100, kill: false, onPlayer: false, armor: 0, v: 0.6 });
    return dmg;
  }
  // victim: a pirate on the island shot MY ship ('gh' { s, t, k: 'c' captain | 'h' hull, d })
  function onGunHit(m, from) {
    if (!m || !isNetId(m.s) || m.s !== from || m.t !== myId || where !== 'harbor' || !HB_PVP_ON || isSquadMate(m.s)) return;
    const now = performance.now(), bk = gunBk.get(m.s) || { tokens: 3, t: now }; bk.tokens = Math.min(3, bk.tokens + (now - bk.t) / 1000 * 1.2); bk.t = now; gunBk.set(m.s, bk);
    if (bk.tokens < 1) return; bk.tokens--;
    const pl = P(), fp = footPeer(m.s); if (!pl?.alive || me.dead || !fp || shipProtectedHarbor(pl)) return; // on foot, crewed, out of SAFE HARBOR
    if (Math.hypot(fp.x - pl.x, fp.z - pl.z) > SC.SHIP_RANGE + 30 || inSafeH(fp.x, fp.z)) return; // nobody snipes out of an Island Safe Zone
    const d = clamp(Math.round(+m.d || 0), 0, m.k === 'c' ? SC.GUN_HIT_MAX : Math.ceil(SC.HULL_DMG[1] * 1.6)); if (!d) return;
    if (m.k !== 'c') { localDamage(d, m.s, null, ownerObj(m.s)); return; }
    if (ADM.god) return; // [admin-menu] GOD MODE
    if (now - cap.at > 20000) cap.hp = SC.CAPTAIN_HP; cap.at = now; cap.hp -= d; me.lastDamageAt = now; me.lastBy = m.s;
    K.popup(new THREE.Vector3(pl.x, (pl.y || 0) + 6, pl.z), `🩸 CAPTAIN -${d}`, 'hit'); sfx.playerHit?.(0.7);
    if (cap.hp > 0) { K.dock?.toast?.(`🩸 SHOT AT THE WHEEL BY ${esc(nameOf(m.s))}<small>captain ${Math.max(0, Math.round(cap.hp))} / ${SC.CAPTAIN_HP} HP</small>`, 1600); return; }
    cap.hp = SC.CAPTAIN_HP; K.banner('☠ CAPTAIN SHOT DOWN', `by ${nameOf(m.s)} from the shore`);
    localDamage(SC.BOMB_DMG, m.s, null, ownerObj(m.s)); // the ship goes down with its captain: standard sunk flow (kill credit, sea crate, harbor respawn)
  }
  // a cannonball near ME on foot (every ball in flight: ballStep; landing: shoreImpact; cliff guns: shoreBattery)
  function shoreBlast(owner, p, impact, by, sid) {
    const d = K.dock, B = d?.battle; if (!d?.on || !d.onFoot || !B?.me?.onFoot || B.me.down > 0 || !d.walker?.w) return false;
    const W = d.walker.w; if (!SC.blastHits(p, { x: W.x, y: W.y ?? 0, z: W.z }, impact)) return false;
    if (sid && (sid === myId || isSquadMate(sid))) return false; // no friendly fire
    if (owner && owner !== P() && Math.hypot(owner.x - W.x, owner.z - W.z) > 320) return false;
    const k0 = B.me.life; B.takeHit(SC.BOMB_DMG, by, sid); // takeHit + sid → open-island KOTH victim claimKill via groundKd meta.board
    if (!(B.me.down > 0)) return false;
    d.toast?.(`💣 KILLED BY ${esc(String(by).toUpperCase())}${sid ? "'S" : ''} CANNON`, 2600); fx.hit(new THREE.Vector3(p.x, p.y, p.z));
    if (sid && room && peers.has(sid)) room.send('bk', { s: myId, k: sid, l: k0 }, { now: true });
    return true;
  }
  function ballShore(b, p, impact) {
    const o = b.owner; if (!o || o === P()) return false; const bot = o.net?.kind === 'bot' || !o.net, sid = bot ? null : o.net.id;
    if (!bot && (!HB_PVP_ON || where !== 'harbor' || inSafeH(o.x, o.z) || K.dock?.zone?.inside?.(o.x, o.z))) return false; // SAFE HARBOR ships never bomb
    return shoreBlast(o, p, impact, bot ? (o.harborBoss ? 'THE COMMODORE' : 'PIRATE GALLEON') : nameOf(sid), sid);
  }
  const shoreImpact = (b, p) => ballShore(b, p, true);
  // a peer's cliff-battery replay landed (battery.js): shooter id known
  const shoreBattery = (p, sid, impact) => shoreBlast(null, p, impact, sid ? `${nameOf(sid)}` : 'CLIFF BATTERY', sid || null);
  // shooter: the pirate I bombed confirms ('bk' { s: victim, k: me, l: their foot life })
  function onBombKill(m, from) {
    if (!m || !isNetId(m.s) || m.s !== from || m.k !== myId || !peers.has(m.s)) return;
    const key = `${m.s}:${m.l | 0}`; if (bombSeen.has(key)) return; bombSeen.set(key, 1); if (bombSeen.size > 200) bombSeen.clear();
    if (performance.now() - (me.lastFireAt || 0) > 12000) return; // only right after one of MY broadsides
    // [v352 KOTH] cannon → on-foot pirate counts (killer side); groundKd board:true → claimKill + no extra double-count
    try { groundKd('k', `bomb:${key}`, { board: true, k: myId, v: m.s, life: m.l | 0 }); } catch {}
    K.banner(`💥 BOMBED ${nameOf(m.s).toUpperCase()}!`, 'one cannonball, one pirate'); sfx.impact?.({ dmg: 100, maxHp: 100, kill: true, onPlayer: false, armor: 0, v: 0.9 });
  }
  // AI: a pirate exposed on the coast (out of Safe Zones) who shot this ship is worth a broadside (main.js enemyTarget)
  function shoreTarget(e) {
    if (e.remote || (room && where !== 'harbor')) return null;
    const now = performance.now(), ag = e.shoreAggro && e.shoreAggro.until > now ? e.shoreAggro : null, d = K.dock;
    const at = (id) => { if (id === myId) { if (!d?.onFoot || !d.walker?.w || d.battle?.me?.down > 0 || ADM.invisible) return null; const w = d.walker.w; return { x: w.x, z: w.z, y: w.y ?? 0 }; }
      const fp = footPeer(id); if (!fp) return null; return { x: fp.x, z: fp.z, y: fp.body?.y ?? fp.fy ?? 0 }; };
    const ok = (q, R) => q && !inSafeH(q.x, q.z) && Math.hypot(q.x - e.x, q.z - e.z) < R;
    let q = ag ? at(ag.id) : null; if (!ok(q, SC.SHORE_SPOT)) q = null;
    if (!q && d?.onFoot) { const m = at(myId); if (ok(m, SC.SHORE_SPOT * 0.6)) q = m; } // spotted on the open coast
    if (!q && isHost && d?.fnet?.peers) for (const [id, p] of d.fnet.peers) { if (!peers.has(id)) continue; const m = { x: p.x, z: p.z, y: p.body?.y ?? p.fy ?? 0 }; if (ok(m, SC.SHORE_SPOT * 0.6)) { q = m; break; } }
    return q ? { x: q.x, z: q.z, yaw: 0, speed: 0, alive: true, foot: true, footY: +q.y || 0, maxHp: 100 } : null;
  }

  // [cliff gold] BANKSY: +50 gold per cliff-cannon hit on an AI / pirate ship (own + party ships never reach here). Paid at most once per
  // 5 s gun reload and 10 / min; counted in stats.batteryHits so the pvp function allows exactly 50 g per hit (2 + 10 / min cap there).
  const BAT_PAY = { gold: 50, gapMs: 5000, perMin: 10 }, batPaid = [];
  function payBattery(p) {
    const now = performance.now(); while (batPaid.length && now - batPaid[0] > 60000) batPaid.shift();
    if ((batPaid.length && now - batPaid[batPaid.length - 1] < BAT_PAY.gapMs) || batPaid.length >= BAT_PAY.perMin) return;
    batPaid.push(now); game.gold += BAT_PAY.gold; profile.stats.batteryHits = (profile.stats.batteryHits | 0) + 1;
    sfx.coin?.(); K.popup(p.clone().setY(6), `+${BAT_PAY.gold}`); K.updateHud(); save({});
  }
  function applyHit(target, raw, p, shooter) {
    const pl = P(), sid = shooter === pl ? myId : shooter.net?.id; if (!sid) return;
    if (target === pl) return localDamage(raw, sid, p, shooter);
    if (target.net?.kind === 'bot') { const dmg = Math.max(1, Math.round(raw));
      if (target.remote) { if (shooter !== pl) return; // [v99] the host's AI ship: report the hit, show it now (the host's next state confirms the hull)
        botHits.push([target.net.id, dmg]); if (target.netState) target.netState.h = Math.max(1, target.netState.h - dmg); target.hp = target.netState?.h ?? target.hp;
        crewHit(target.mesh, dmg / Math.max(1, target.maxHp || 100) * 6); fx.hit(p); sfx.impact?.({ dmg, maxHp: target.maxHp || 100, kill: false, onPlayer: false, armor: 0, v: 0.8 }); K.popup(p, `-${dmg}`, 'hit'); return; }
      target.lastBy = sid; if (sid) (target.dmgBy ||= new Map()).set(sid, (target.dmgBy.get(sid) || 0) + Math.min(dmg, Math.max(0, target.hp)));
      K.damage(target, dmg, p, shooter); return; } // our AI (local harbor, or we host the copy)
    if (!target.net || shooter !== pl) return; // only our own hits on other pirates are reported
    me.lastDealtAt = performance.now(); if (me.ret) me.ret.until = me.lastDealtAt + RET_QUIET;
    hitQueue.sid = sid; hitQueue.push([target.net.id, Math.round(raw)]); crewHit(target.mesh, raw / Math.max(1, target.maxHp || 100) * 6); /* [v87] their crew stagger (visual) */ fx.hit(p); sfx.impact?.({ dmg: raw, maxHp: 100, kill: false, onPlayer: false, armor: 0, v: 0.8 });
    if (shooter === pl) K.popup(p, `-${Math.round(raw)}`, 'hit');
  }
  function flushHits() { if (hitQueue.length && room) room.send('hit', { s: hitQueue.sid, h: hitQueue.slice(0, 12), ...(hitQueue.g != null ? { g: hitQueue.g } : {}) }); hitQueue = []; hitQueue.sid = null; hitQueue.g = null; }
  function localDamage(raw, by, p, shooterObj = null) {
    if (ADM.god) { const g = P(); g.hp = g.maxHp; return; } // [admin-menu] GOD MODE
    const pl = P(); if (me.dead || !pl.alive || me.protect > 0) return;
    const amt = Math.max(1, Math.round(raw * (1 - (pl.armor || 0))));
    me.lastDamageAt = performance.now(); me.lastBy = by;
    K.damage(pl, amt, p || new THREE.Vector3(pl.x, pl.y + 3, pl.z), shooterObj);
  }
  function onHit(m, from) {
    if (!m || !isNetId(m.s) || !Array.isArray(m.h)) return;
    if (from && m.s !== from && !(bots.has(m.s) && from === hostId)) return; // [security M1] a hit names its own sender (or the host's AI ship)
    const shooter = ownerObj(m.s); if (!shooter) return; // unknown shooter
    if (isSq() && !sqCanHit(m.s, myId)) return; // [v98] never from a teammate / outside a live round
    const now = performance.now(), bk = buckets.get(m.s) || { tokens: 12, t: now };
    bk.tokens = Math.min(12, bk.tokens + (now - bk.t) / 1000 * 10); bk.t = now; buckets.set(m.s, bk);
    const cap = MAX_HIT;
    // [v171] a cliff-battery hit (m.g = gun): only in the harbor, only from a pirate whose shot from that gun we just saw (battery.js replay), never a party mate, basic damage only
    let bat = null; if (m.g != null) { const gi = m.g | 0; if (where !== 'harbor' || !Number.isInteger(m.g) || !BATTERY_GUNS[gi] || !batteryShotRecent(m.s, gi) || isSquadMate(m.s)) return;
      bat = { g: gi, cap: Math.ceil(BALL_DMG[1] * PVP_DMG_MUL) + 1 }; }
    for (const [t, d] of m.h.slice(0, 12)) {
      if (bk.tokens < 1) break; bk.tokens--;
      const dmg = clamp(Math.round(+d || 0), 0, cap); if (!dmg) continue;
      if (t !== myId) { const o = ownerObj(t); if (o?.mesh) crewHit(o.mesh, dmg / Math.max(1, o.maxHp || 100) * 6); continue; } // [v87] another pirate got hit: their crew stagger (visual)
      if (t === myId) { const pl = P();
        if (bat) { const g = BATTERY_GUNS[bat.g]; if (!g || Math.hypot(g.x - pl.x, g.z - pl.z) > BATTERY_RANGE || dmg > bat.cap) continue; localDamage(dmg, m.s, null, shooter); continue; } // [v171] cliff gun: gun -> you range
        if (Math.hypot(shooter.x - pl.x, shooter.z - pl.z) > 230) continue;
        if (where === 'harbor' && !bots.has(m.s) && !harborPvpCanHit(shooter, pl)) continue; // [backpack-pvp] Option B: never in / just out of Safe Harbor, never an unmanned / shielded ship, never a party mate (&hbpvp=0: no ship PvP)
        localDamage(dmg, m.s, null, shooter); }
    }
  }

  // ---------------- deaths, piles, gold ----------------
  const brLoss = (g) => Math.min(PVP_BR_DEATH_LOSS, Math.max(0, Math.floor(+g || 0))); // [br-death] what a sunk pirate loses in the arena
  const nameOf = (id) => id === myId ? name : (peers.get(id)?.name || (bots.has(id) || String(id).startsWith('b') ? 'an AI ship' : 'a pirate'));
  function addFeed(html) { feed.unshift({ html, t: performance.now() }); feed.length = Math.min(feed.length, 5); renderFeed(); }
  function renderFeed() { const el = $('pvp-feed'); if (!el) return; const now = performance.now(); el.innerHTML = feed.filter(f => now - f.t < 7000).map(f => `<div>${f.html}</div>`).join(''); }
  function onLocalSunk() { // our own hull hit 0 (K.damage already started the sinking animation)
    if (me.dead) return;
    const pl = P(), recent = performance.now() - me.lastDamageAt < 15000;
    let by = recent ? me.lastBy : null;
    const byAi = !!by && (bots.has(by) || String(by).startsWith('b'));
    if (where === 'harbor' && HB_PVP_ON && !byAi && by && peers.has(by)) { harborPvpSunk(pl, by); return; } // [backpack-pvp] Option B
    if (where !== 'arena' || byAi) { // harbor / lone-pirate AI: never K/D. [v92] sunk IN THE HARBOR: lose min(100, gold), keep the rest
      const lost = where === 'harbor' ? Math.min(PVP_HARBOR_DEATH_LOSS, Math.max(0, game.gold | 0)) : 0;
      me.dead = true; me.respawn = where === 'harbor' ? PVP_HARBOR_RESPAWN : PVP_RESPAWN; me.respawnAt = where === 'harbor' ? performance.now() + PVP_HARBOR_RESPAWN * 1000 : 0; me.killedBy = bots.get(by)?.harborBoss ? 'the COMMODORE' : 'an AI ship'; me.dropped = 0; me.aiDeath = true; me.harborLoss = lost;
      if (lost) { game.gold = Math.max(0, (game.gold | 0) - lost); K.updateHud(); save({ now: true }); dropMyGold(pl.x, pl.z, lost); } // [v370] BANKSY t1963u: the lost gold floats where you sank (anyone can grab it)
      showDead(true); return;
    }
    me.aiDeath = false;
    // [br-death] BANKSY: a sunk pirate loses only min(PVP_BR_DEATH_LOSS, gold) (keeps the rest) + the +100 bonus on top, then goes back to the harbor
    const carried = brLoss(game.gold), afk = idleMs() >= AFK_FARM; // idle ≥ PVP_AFK.farm s: no +100 bonus, no kill credit (anti-farming)
    me.dead = true; me.respawn = PVP_RESPAWN; me.killedBy = by ? nameOf(by) : 'the sea'; me.dropped = carried + (afk ? 0 : PVP_DEATH_BONUS); me.afkDeath = afk; me.lostGold = carried;
    if (!afk) { me.deaths++; kdT.death('ship', `me:${me.life}`); } // [backpack-pvp] t1703u unified K/D tally (deduped)
    game.gold = Math.max(0, (game.gold | 0) - carried); save({ now: true });
    const bounty = me.bounty; me.dropped += bounty; me.lostBounty = bounty; resetBounty();
    room?.send('sunk', { v: myId, by, l: me.life, x: r1(pl.x), z: r1(pl.z), g: carried, b: bounty, ...(afk ? { af: 1 } : {}) });
    if (!afk && by && peers.has(by)) boardClaim('v', by, myId, me.life);
    if (isHost) spawnPile(myId, pl.x, pl.z, Math.min(carried, earned.get(myId) ?? PVP_MAX_CARRY) + (afk ? 0 : PVP_DEATH_BONUS) + bounty, false, afk ? 0 : PVP_DEATH_BONUS);
    earned.delete(myId);
    addFeed(`<b>${esc(me.killedBy)}</b> sank <b class="me">${esc(name)}</b>`);
    if (isSq()) { sq.sunk.add(myId); me.respawn = Infinity; me.deadAt = performance.now(); showDead(true); K.updateHud(); return; } // [v98] squads: out until the round ends, watching your teammate
    showDead(true); K.updateHud();
  }
  // [backpack-pvp] Option B: sunk by a rival pirate in the open harbor water. K/D counts (unified tally), you lose the harbor loss
  // (min(100, gold)) as a floating gold pile + your UNEQUIPPED backpack haul as a sea loot crate; ship, skins, upgrades, cosmetics, pets,
  // maps, equipped sword / musket and cottage storage stay. You respawn in the harbor (never kicked to the Battle Royale queue).
  function harborPvpSunk(pl, by) {
    const lost = Math.min(PVP_HARBOR_DEATH_LOSS, Math.max(0, game.gold | 0)), afk = idleMs() >= AFK_FARM;
    me.dead = true; me.respawn = PVP_HARBOR_RESPAWN; me.respawnAt = performance.now() + PVP_HARBOR_RESPAWN * 1000; me.killedBy = nameOf(by);
    me.aiDeath = false; me.harborPvp = true; me.dropped = lost; me.lostGold = lost; me.harborLoss = lost; me.afkDeath = afk; me.lostBounty = 0;
    if (!afk) { me.deaths++; kdT.death('ship', `me:${me.life}`); }
    if (lost) { game.gold = Math.max(0, (game.gold | 0) - lost); K.updateHud(); }
    save({ now: true });
    room?.send('sunk', { v: myId, by, l: me.life, x: r1(pl.x), z: r1(pl.z), g: lost, b: 0, hb: 1, ...(afk ? { af: 1 } : {}) }, { now: true });
    if (!afk && !codeOfPrefix(hbNet?.prefix)) boardClaim('v', by, myId, me.life); // own / private servers never feed the kills board
    if (isHost && lost) spawnPile(myId, pl.x, pl.z, Math.min(lost, earned.get(myId) ?? PVP_MAX_CARRY), false, 0);
    earned.delete(myId);
    addFeed(`☠ <b>${esc(me.killedBy)}</b> sank <b class="me">${esc(name)}</b> at sea!`);
    try { K.dock?.lootBags?.dropLocalHaul?.({ sea: true, hx: pl.x, hz: pl.z, killerId: by }); } catch (e) { console.warn('[sea crate]', e); }
    showDead(true); K.updateHud(); hud();
  }
  // [backpack-pvp] share a dropped plunder bag / sea crate (and its claims) with the pirates in this harbor copy
  const LOOT_KEY_RE = /^[a-z0-9:_.-]{1,64}$/i, BAG_ID_RE = /^[a-zA-Z0-9_-]{4,64}$/;
  function lootNet(msg) {
    if (!room || where !== 'harbor' || !msg || typeof msg !== 'object') return false;
    const b = msg.bag; const out = { t: msg.type === 'loot_claim' ? 'c' : 's', id: String(msg.bag_id || b?.id || '').slice(0, 64) };
    if (b) out.b = { id: String(b.id).slice(0, 64), x: r1(+b.x || 0), y: r1(+b.y || 0), z: r1(+b.z || 0), sea: b.sea ? 1 : 0, m: b.manual ? 1 : 0, n: String(b.victim_name || 'PIRATE').slice(0, 24),
      it: (b.items || []).slice(0, 40).map((i) => [String(i.item).slice(0, 64), Math.max(0, Math.min(9999, i.qty | 0))]), ex: Math.max(0, Math.min(600, Math.round(((+b.expires_at || 0) - Date.now()) / 1000))) };
    room.send('lb', { i: myId, ...out }); return true;
  }
  function onLootNet(m) {
    if (!m || !isNetId(m.i) || m.i === myId || !peers.has(m.i) || !BAG_ID_RE.test(String(m.id || ''))) return;
    const lb = K.dock?.lootBags; if (!lb?.onNet) return;
    if (m.t === 'c' && !m.b) { lb.onNet({ type: 'loot_claim', bag_id: m.id }); return; }
    const b = m.b; if (!b || !Array.isArray(b.it)) return;
    const items = b.it.filter((r) => Array.isArray(r) && LOOT_KEY_RE.test(String(r[0])) && (r[1] | 0) > 0).map((r) => ({ item: String(r[0]), qty: Math.min(9999, r[1] | 0) }));
    const [x, z] = clampXZ(b.x, b.z);
    lb.onNet({ type: m.t === 'c' ? 'loot_claim' : 'loot_spawn', bag_id: m.id, bag: { id: m.id, x, z, y: clamp(+b.y || 0, -5, 80), sea: !!b.sea, manual: !!b.m, victim_name: esc(b.n).slice(0, 24) || 'PIRATE', items, expires_at: Date.now() + clamp(b.ex | 0, 5, 600) * 1000 } });
  }
  function onBotSunk(e, src) { // one of our AI ships went down (local harbor, or we host the shared copy)
    if (e.remote) return;
    if (room && where === 'harbor' && isHost && !e.fade) { hostBotSunk(e, src); return; } // [v99] shared copy: kill + gold shares for everyone
    const by = src === P() || e.lastBy === myId ? myId : null; // only YOUR kills count (AI never credits AI)
    if (!e.fade) spawnPile(e.net.id, e.x, e.z, e.gold || PVP_AI_GOLD, true, e.gold || PVP_AI_GOLD, !!e.harborBoss && by === myId); // [v145] your boss kill: the crimson map chest
    if (e.harborBoss && !e.fade) { if (boss.bar) boss.bar.hidden = true; K.banner('THE COMMODORE SUNK!', `${formatGoldAmount(e.gold)}g of treasure in the water · grab it`); }
    if (by === myId && !e.fade) countBotKill(!!e.harborBoss);
  }
  function countBotKill(isBoss) { // [v98] unlock tracks: harbor AI kills / harbor boss kills (COMMODORE = 100 boss kills); the server caps their pace ([v99] shared harbor: the last hit)
    profile.stats.botKills++;
    const st = profile.stats; if (isBoss) st.bossKills = (st.bossKills | 0) + 1; else st.harborKills = (st.harborKills | 0) + 1;
    if (isBoss) goalToast({ ...st, bossKills: st.bossKills - 1 }, st);
    save(isBoss ? { now: true } : {});
  }
  // KING OF THE HILL board: both sides report each player kill (gun / sword / boat sink, harbor OR arena); server records when they match
  function claimRoomId() { // harbor copies → pfp-harbor-N; BR solo/squads → pfp-pvp-v1[-sq]-N (top sums every room)
    return where === 'harbor' ? `${HB_PREFIX}-${roomIdx || 0}` : `${curPrefix()}-${roomIdx}`;
  }
  function boardClaim(side, k, v, life, keepalive = false) {
    if (!room || typeof k !== 'string' || typeof v !== 'string') return;
    if (where === 'harbor' && codeOfPrefix(hbNet?.prefix)) return; // own / private harbor servers never feed KOTH
    const ent = { side, t1: 0 }; if (!keepalive) unsynced.push(ent);
    claimKill({ side, room: claimRoomId(), k, v, life, name, keepalive }).then(r => { if (r) lastClaim = r;
      ent.t1 = performance.now(); if (!(r === 'recorded' || r === 'pending')) { const i = unsynced.indexOf(ent); if (i >= 0) unsynced.splice(i, 1); } // not counted by the server if (r === 'recorded' && !keepalive) { refreshRank(true); clearKillsTopCache(); refreshKillsBoards(); }
      else if (r === 'pending' && !keepalive) for (const ms of [3000, 9000]) setTimeout(() => { refreshRank(true); clearKillsTopCache(); refreshKillsBoards(); }, ms); }); // [v77] the other side's claim lands after mine: re-read my rank / the board (a first death now ranks me)
  }
  function resetBounty() { me.streak = 0; me.bounty = 0; }
  function creditKill(by, victim, key = null) {
    if (by !== myId) return;
    // streak bounty: only kills that count (the caller already skips idle victims); the same victim again inside the
    // anti-farm window gives no bounty (the PvP KILLS board drops it too)
    const tn = performance.now(), last = me.pairs.get(victim) || -1e9; me.pairs.set(victim, tn);
    if (tn - last > PVP_BOUNTY.pairWindow * 1000) { me.streak++; const before = me.bounty; me.bounty = Math.min(PVP_BOUNTY.cap, me.streak * PVP_BOUNTY.perKill); if (me.bounty > before && me.bounty >= PVP_BOUNTY.announce && before < PVP_BOUNTY.announce) addFeed(`☠ <b class="me">${esc(name)}</b> has a <b>${formatGoldAmount(me.bounty)}g</b> bounty!`); }
    const before = { ...profile.stats }; if (!kdT.kill('ship', key || `${victim}:${Math.round(tn)}`)) return; me.kills++; bumpModeKill(mode); // [Timothy] Solo / Squads split (display only)
    goalToast(before, profile.stats);
    sfx.coin(); save({ now: true });
  }
  const seenSunk = new Map(); // dedupe: one sinking per ship life, even if the message arrives twice
  function onSunk(m) {
    if (!m || typeof m.v !== 'string') return;
    const sk = `${m.v}:${m.l | 0}`, now = performance.now(); if (now - (seenSunk.get(sk) || -1e9) < 20000) return; seenSunk.set(sk, now);
    if (seenSunk.size > 200) for (const [k2, t2] of seenSunk) if (now - t2 > 20000) seenSunk.delete(k2);
    if (m.bot) return; // (old clients) AI ships are local now
    const victim = peers.get(m.v)?.ship;
    if (isSq() && sq.ph === 'live') sq.sunk.add(m.v); // [v98] round gold needs a real sinking
    if (victim && victim.alive && victim.remote) { victim.alive = false; victim.sinking = 0.001; sfx.sink(false); fx.ring(new THREE.Vector3(victim.x, 0, victim.z), 3, 16, 2.2); if (victim.netState) victim.netState.a = false; }
    const by = typeof m.by === 'string' ? m.by : null;
    const afk = !!m.af; // the victim had been idle: no kill credit, no +100
    addFeed(`<b class="${by === myId ? 'me' : ''}">${esc(by ? nameOf(by) : 'the sea')}</b> sank <b>${esc(nameOf(m.v))}</b>${afk ? ' <i class="muted">(idle · no credit)</i>' : ''}`);
    const hbSink = where === 'harbor' && !!m.hb; // [backpack-pvp] Option B sink: no +100 bonus gold out of thin air
    if (!afk) creditKill(by, m.v, `${m.v}:${m.l | 0}`);
    const vb = clamp(m.b | 0, 0, Math.min(PVP_BOUNTY.cap, peers.get(m.v)?.bt ?? 0)); // never more than the bounty they showed
    if (vb >= PVP_BOUNTY.announce) addFeed(`☠ <b>${esc(by ? nameOf(by) : 'the sea')}</b> claimed <b>${esc(nameOf(m.v))}</b>'s <b>${formatGoldAmount(vb)}g</b> bounty`);
    if (!afk && by === myId && peers.has(m.v) && !(hbSink && codeOfPrefix(hbNet?.prefix))) boardClaim('k', myId, m.v, m.l | 0);
    if (isHost) {
      const [x, z] = clampXZ(m.x, m.z);
      const g = clamp(Math.floor(+m.g || 0), 0, Math.min(PVP_BR_DEATH_LOSS, earned.has(m.v) ? earned.get(m.v) : PVP_MAX_CARRY)); // [br-death] never more than the flat loss (old clients still report all carried)
      if (hbSink) { const hg = clamp(Math.floor(+m.g || 0), 0, PVP_HARBOR_DEATH_LOSS); if (hg) spawnPile(m.v, x, z, hg, false, 0); earned.delete(m.v); }
      else { spawnPile(m.v, x, z, g + (afk ? 0 : PVP_DEATH_BONUS) + vb, false, afk ? 0 : PVP_DEATH_BONUS); earned.delete(m.v); }
    }
  }
  // [v370] BANKSY t1963u-t1965u: gold YOU lose without a pirate sink (an AI ship sank you, or KO'd on foot) drops as a shared pile.
  // Host spawns it (non-hosts ask with 'gdrop'; capped at the flat harbor loss); no room = a local pile you can take back.
  let gdropSeq = 0; const seenGdrop = new Map();
  function dropMyGold(x, z, v, gy = null) {
    v = clamp(Math.floor(+v || 0), 0, PVP_HARBOR_DEATH_LOSS); if (!v) return;
    if (!room) { spawnPile(myId, x, z, v, true, 0, false, gy); return; }
    if (isHost) { spawnPile(myId, x, z, v, false, 0, false, gy); return; }
    room.send('gdrop', { v: myId, k: `${me.life}:${++gdropSeq}`, x: r1(x), z: r1(z), g: v, ...(gy != null ? { y: r1(gy) } : {}) }, { now: true });
  }
  function onGdrop(m) {
    if (!isHost || !m || typeof m.v !== 'string' || where !== 'harbor') return;
    const key = `${m.v}:${String(m.k || '').slice(0, 24)}`, now = performance.now(); if (seenGdrop.has(key)) return; seenGdrop.set(key, now);
    if (seenGdrop.size > 200) for (const [k2, t2] of seenGdrop) if (now - t2 > 60000) seenGdrop.delete(k2);
    const g = clamp(Math.floor(+m.g || 0), 0, PVP_HARBOR_DEATH_LOSS); if (!g) return;
    const gy = m.y != null && Number.isFinite(+m.y) ? clamp(+m.y, -5, 200) : null, [x, z] = gy != null ? [+m.x || 0, +m.z || 0] : clampXZ(m.x, m.z);
    spawnPile(m.v, x, z, g, false, 0, false, gy);
  }
  addEventListener('pfp-foot-ko', (e) => { // [v370] knocked out on the open island (battle.js; never the Coliseum / Safe Zones): lose min(100, gold) as a ground pile
    try { if (where !== 'harbor' || ADM.invisible) return; const d = e.detail || {}, lost = Math.min(PVP_HARBOR_DEATH_LOSS, Math.max(0, game.gold | 0)); if (!lost) return;
      game.gold = Math.max(0, (game.gold | 0) - lost); K.updateHud(); save({ now: true }); dropMyGold(+d.x || 0, +d.z || 0, lost, Number.isFinite(+d.y) ? +d.y : 0);
      K.dock?.toast?.(`💀 -${formatGoldAmount(lost)} GOLD DROPPED<br><small>grab it back before someone else does</small>`, 2200); } catch (err) { console.warn('[foot ko gold]', err); }
  });
  function dropSpot(x, z) { // [v105] a drop always floats in open water you can sail to (never on the shore or inside a rock)
    try { const q = K.islands?.freeSpot?.(x, z, 9); if (q && isFinite(q[0]) && isFinite(q[1])) return [q[0], q[1]]; } catch {} return [x, z]; }
  function spawnPile(v, x, z, value, local = false, earnedPart = local ? value : 0, map = false, gy = null) { // [v145] map: the crimson treasure-map chest (look only, local piles) // earnedPart: newly created gold (AI gold / +100 bonus), the part the holder perk boosts
    const pid = `${String(v).slice(-6)}${(++pileSeq).toString(36)}${myId.slice(-3)}`;
    if (!local) room?.send('pile', { pid, x: r1(x), z: r1(z), v: value, e: earnedPart, h: myId, ...(gy != null ? { y: r1(gy) } : {}) });
    addPile(pid, x, z, value, PVP_PILE_LIFE, local, earnedPart, map, gy);
  }
  function addPile(pid, x, z, value, ttl, local = false, earnedPart = 0, map = false, gy = null) {
    if (typeof pid !== 'string' || piles.has(pid)) return;
    value = clamp(Math.floor(+value || 0), 0, PVP_PILE_MAX); // merged piles can be big; never expire (life Infinity)
    const g = makeChest(map ? { map: true } : undefined); scene.add(g);
    const l = { mesh: g, map, x: +x || 0, z: +z || 0, gy: gy != null && Number.isFinite(+gy) ? +gy : null /* [v370] on-foot KO gold: sits on the ground */, value, life: Infinity, ph: Math.random() * 6, pid, expires: Infinity, born: performance.now() };
    pileLook(l);
    l.local = local; l.earned = clamp(Math.floor(+earnedPart || 0), 0, value); loot.push(l); piles.set(pid, l); fx.ring(new THREE.Vector3(l.x, 0, l.z), 1, 9, 1.6);
    if (Math.hypot(l.x - P().x, l.z - P().z) < 200) K.popup(new THREE.Vector3(l.x, 6, l.z), map ? `${formatGoldAmount(value)} GOLD + TREASURE MAP` : `${formatGoldAmount(value)} GOLD`, 'hit');
  }
  function removePile(pid) { const l = piles.get(pid); if (!l) return; piles.delete(pid); const i = loot.indexOf(l); if (i >= 0) loot.splice(i, 1); scene.remove(l.mesh); }
  function lootStep(l) { // main loop, per pile: claim it when we sail over it
    if (!piles.has(l.pid)) return;
    { const t = performance.now(); if (t - (l.pulseT || 0) > 3500) { l.pulseT = t + Math.random() * 800; if (Math.hypot(l.x - P().x, l.z - P().z) < 260) fx.ring(new THREE.Vector3(l.x, 0, l.z), 1.5, 7, 1.2); } } // [v105] a soft gold ring every few s: easy to find
    if (l.gy != null) { const d = K.dock, w = d?.walker?.w; if (!d?.onFoot || !w || d.battle?.me?.down > 0 || Math.hypot(w.x - l.x, w.z - l.z) > 2.4) return; } // [v370] a land pile: walk over it
    else { const pl = P(); if (me.dead || !pl.alive) return;
    if (!touchesGold(pl, l.x, l.z)) return; } // [big-hitbox] any part of the hull
    const now = performance.now(); if (l.claimT && now - l.claimT < 1500) return; l.claimT = now;
    if (l.local) { applyGot({ pid: l.pid, to: myId, v: l.value }); return; } // local AI loot
    if (isHost) grant(l.pid, myId); else room?.send('claim', { pid: l.pid, i: myId });
  }
  function grant(pid, to) { // host only: first claimant within reach gets the pile
    const l = piles.get(pid); if (!l || l.taken || typeof to !== 'string') return;
    if (where === 'harbor' && performance.now() - (hb.hostSince || 0) < 1500) return; // [v105] a brand-new host waits out the hand-over (no double grant); the claimer retries every 1.5 s
    const ship = to === myId ? P() : peers.get(to)?.ship; if (!ship || !ship.alive || !touchesGold(ship, l.x, l.z, 18)) return; // [big-hitbox] same footprint + lag slack
    l.taken = true; earned.set(to, (earned.get(to) || 0) + l.value);
    room?.send('got', { pid, to, v: l.value }); applyGot({ pid, to, v: l.value });
  }
  function applyGot(m) {
    const l = piles.get(m.pid); const v = clamp(Math.floor(+m.v || 0), 0, l ? l.value : 0);
    if (l) { if (m.to !== myId) K.popup(l.mesh.position.clone().setY(5), `${nameOf(m.to)} +${v}`, 'hit'); removePile(m.pid); }
    const hb = m.to === myId && l ? holderMul(l.earned) + goldFindBonus(l.earned) : 0; // HOLDER ×2 on earned gold only · [Emerly] + PET gold find (earned gold only)
    if (m.to === myId && v) { game.gold += v + hb; me.gold += v + hb; sfx.coin(); K.popup(new THREE.Vector3(P().x, 6, P().z), `+${formatGoldAmount(v)} GOLD`); showLootCard({ title: l?.map ? 'TREASURE CHEST' : l?.gy != null ? 'DROPPED GOLD' : 'GOLD CHEST', gold: v + hb, bonus: hb, items: l?.map ? [{ icon: '🗺️', name: 'Treasure Map' }] : [] }); K.updateHud(); save(); } // [v370] the LOOT card
  }
  function respawn() {
    me.respawnAt = 0;
    if (where === 'harbor' || (where === 'arena' && me.aiDeath && !room)) { respawnHarbor(true); return; } // [v95] stay in the harbor, never the lobby
    if (lob.queuedByDeath) { lob.queuedByDeath = false; toHarbor('IN THE QUEUE', `position #${lob.pos || '?'} · farm the harbor AI while you wait`); return; }
    if (where === 'arena' && !me.aiDeath && !isSq()) { lobbyCall('leave'); toHarbor('BACK IN THE HARBOR', `you kept ${formatGoldAmount(game.gold | 0)} gold · JOIN BATTLE to go again`); return; } // [br-death] sunk by a pirate: no arena respawn
    const pl = P(), { pt, crowded } = pickSpawn(pl);
    me.dead = false; me.life++; me.protect = PVP_PROTECT * (crowded ? 2 : 1); me.lastBy = null; me.lastDamageAt = 0;
    Object.assign(pl, { alive: true, sinking: 0, hp: pl.maxHp, x: pt[0], z: pt[1], yaw: Math.atan2(-pt[0], -pt[1]), speed: 0, sail: 1, anchor: false, calm: 0, repT: 0 });
    pl.cd.port = pl.cd.star = 0; K.resetCamera(); showDead(false); K.updateHud();
    K.banner(crowded ? 'BACK AT SEA · extra protection' : 'BACK AT SEA', `spawn protection ${Math.round(me.protect)} s (ends when you fire)`);
  }

  // ---------------- [v98] SQUADS (2v2): mode, party code, host-run rounds, team colours ----------------
  // The host (lowest id, as for gold piles) runs the round: wait (no damage) -> live (teams fixed, friendly fire off, a sunk pirate
  // is out until the round ends) -> end (VICTORY / DEFEAT, win gold, the losers rotate out when someone queues) -> wait.
  const sq = { r: 0, ph: 'wait', A: [], B: [], A0: [], B0: [], until: 0, w: '', sent: 0, readyAt: 0, sunk: new Set(), joinAt: new Map(), downAt: new Map(), seen: '', myR: -1, bar: null, waitN: 0, joinedAt: 0 };
  function sqReset() { Object.assign(sq, { r: 0, ph: 'wait', A: [], B: [], A0: [], B0: [], until: 0, w: '', sent: 0, readyAt: 0, seen: '', myR: -1, waitN: 0, joinedAt: performance.now() }); sq.sunk.clear(); sq.joinAt.clear(); sq.downAt.clear(); if (sq.bar) sq.bar.hidden = true; }
  const sqTeam = (id) => sq.A.includes(id) ? 'A' : sq.B.includes(id) ? 'B' : null;
  const shipIdOf = (o) => o === P() ? myId : o?.net?.id;
  const sqCanHit = (a, b) => sq.ph === 'live' && !!sqTeam(a) && !!sqTeam(b) && sqTeam(a) !== sqTeam(b);
  // [v328] Harbor co-op: always broadcast pc when you have a party code (even if BR mode toggle is SOLO)
  const myPc = () => (where === 'harbor' || mode === 'squads') && party.code ? partyTag(party.code) : '';
  function setNet(m) { mode = m === 'squads' ? 'squads' : 'solo'; net = nets[mode]; Object.assign(lob, { cap: mode === 'squads' ? SQUADS.players : net.cfg.maxArena, known: false, lastPoll: 0, players: 0, queue: 0, specs: 0 }); } // [v339] Solo Arena 8; SQUADS stays 2v2 / 4
  function setMode(m) { // the queue harbor's SOLO / SQUADS switch: only while not queued
    m = m === 'squads' ? 'squads' : 'solo'; if (m === mode) return;
    if (where !== 'harbor' || spec.on || lob.busy || lob.state !== 'harbor') { K.banner('LEAVE THE QUEUE FIRST', 'switch SOLO / SQUADS while you are not queued'); harborUi(); return; }
    setNet(m); try { localStorage.setItem('pfp_br_mode', mode); } catch {} hud();
    // [v328] do NOT partyLeave on SOLO — Harbor co-op squads are independent of Arena queue mode
    lobbyCall('poll').then(() => { harborUi(); hud(); }); harborUi();
    K.banner(mode === 'squads' ? 'ARENA SQUADS 2v2' : 'SOLO', mode === 'squads' ? 'Arena is 2v2 · Harbor co-op PvE keeps your full squad (up to 16)' : 'Arena free-for-all · Harbor squad (if any) stays for island PvE');
  }
  // party: 2 friends share a 5-character code (a tiny realtime channel, a heartbeat every 4 s); JOIN BATTLE queues you both
  const party = { code: '', room: null, mates: new Map(), t: 0, hbT: 0, msg: '' };
  const partyMate = () => { const now = performance.now(); for (const [id, m] of party.mates) if (now - m.at < 10000) return { id, ...m }; return null; };
  const partyMates = () => { const now = performance.now(), out = []; for (const [id, m] of party.mates) if (now - m.at < 10000) out.push({ id, ...m }); return out; };
  // [v328] Harbor / Island: ZERO friendly fire for anyone sharing your party code (mates map OR matching pc tag)
  function isSquadMate(id) {
    if (!id || id === myId || !party.code) return false;
    const m = party.mates.get(id);
    if (m && performance.now() - m.at < 15000) return true;
    const pc = partyTag(party.code), p = peers.get(id);
    return !!(pc && p?.pc && p.pc === pc);
  }
  // [v340] BANKSY t1801u/t1802u: is this Harbor peer in YOUR squad (party active + same party tag 'pc', or a live party mate)?
  function isHbSquadPeer(p) {
    if (!p || !party.code) return false;
    const mine = partyTag(party.code);
    return !!(mine && ((p.pc && p.pc === mine) || isSquadMate(p.id)));
  }
  // [v340] Harbor map colors on a remote ship: squadmates GREEN (#2fd866), other players BLACK (#0d0d10); AI stay red (main.js)
  function hbPaint(p, hbv = where === 'harbor' || (spec.on && spec.harbor)) {
    if (!p?.ship) return;
    if (hbv) {
      const squad = isHbSquadPeer(p);
      p.ship._hbSquad = squad; p.ship._hbOther = !squad;
      p.ship.radarColor = squad ? '#2fd866' : '#0d0d10';
      p.ship.nameEl?.classList.toggle('hb-mate', squad); // only true squadmates wear the green mate tag
    } else {
      p.ship._hbSquad = false; p.ship._hbOther = false;
      p.ship.nameEl?.classList.remove('hb-mate');
      if (p.ship.radarColor === '#2fd866' || p.ship.radarColor === '#0d0d10' || p.ship.radarColor === '#5ee08a') p.ship.radarColor = null;
    }
  }
  function hbRepaintAll() { try { for (const p of peers.values()) hbPaint(p); } catch {} } // [v340] party code changed: refresh every peer's colour
  // [v340] Harbor map / minimap: accept id string OR peer-like { id, i, pc, name }
  function isHarborSquadMate(peer) {
    if (!peer) return false;
    const id = typeof peer === 'string' ? peer : (peer.id || peer.i || '');
    if (id && isSquadMate(id)) return true;
    const mine = party.code ? partyTag(party.code) : '';
    if (!mine) return false;
    const their = typeof peer === 'object' ? String(peer.pc || '').slice(0, 8) : '';
    return !!(their && their === mine);
  }
  function partyMsg(t) { party.msg = t; harborUi(); }
  async function partyJoin(code, made = false) {
    code = cleanCode(code); if (code.length !== 5) { partyMsg('A party code is 5 letters / numbers'); return; }
    partyLeave(true); party.code = code; party.t = Date.now(); party.mates.clear(); party.msg = made ? 'share this code with your friend' : 'joining…'; hbRepaintAll();
    const r = new Room('pfp-party-' + code.toLowerCase(), { ticket: rtTicket }); party.room = r;
    r.on('p', onPartyBeat).on('bye', (m) => { if (party.mates.delete(m?.i)) harborUi(); })
      .on('vc', (m) => { try { globalThis.PFP_SOCIAL_NET?.onSig?.(m); } catch {} }) // [Friends R2] squad voice signalling
      .on('go', (m) => { if (m?.i && party.mates.has(m.i) && mode === 'squads' && where === 'harbor' && lob.state === 'harbor' && !spec.on) { K.banner('YOUR MATE SET SAIL', 'queuing you together…'); joinBattle(true); } });
    harborUi();
    try { await r.connect(); } catch { if (party.room === r) { partyLeave(true); partyMsg('could not open the party channel, try again'); } return; }
    if (party.room !== r) { r.close(); return; }
    if (!made) party.msg = 'waiting for your mate…'; partyBeat(); harborUi();
  }
  function partyLeave(silent = false) { if (party.room) { party.room.send('bye', { i: myId }); party.room.close(); } party.room = null; party.code = ''; party.mates.clear(); party.msg = ''; hbRepaintAll(); if (!silent) harborUi(); }
  function partyMake() { const c = newPartyCode(); partyJoin(c, true); return c; } // [squad-hall]
  function partyInfo() { const mates = partyMates().map(m => ({ id: m.id, n: m.n, st: m.st })); return { code: party.code || '', mate: mates[0] || null, mates, count: party.code ? mates.length + 1 : 0, msg: party.msg || '' }; }
  async function joinWorld({ name, w, copy, mode } = {}) { // [squad-hall] travel to another pirate's harbor copy, or queue their arena mode
    if (!active || where !== 'harbor' || spec.on) return { ok: false, why: 'leave the arena / spectate first' };
    if (lob.state !== 'harbor') return { ok: false, why: 'leave the queue first' };
    if (w === 'arena' || w === 'queue') {
      if (mode === 'squads') setMode('squads'); else setMode('solo');
      joinBattle(false); return { ok: true, msg: `QUEUED FOR ${mode === 'squads' ? 'SQUADS' : 'SOLO'}` };
    }
    if (w === 'spec') return { ok: false, why: 'they are spectating · invite them instead' };
    const want = Math.max(0, copy | 0);
    if (!want) return { ok: false, why: 'their harbor copy is unknown · invite them instead' };
    if (hb.copy === want) return { ok: true, msg: 'ALREADY IN THEIR HARBOR' };
    hbLeave(true); hb.wantCopy = want; hb.beatAt = 0;
    return { ok: true, msg: want > 1 ? `SAILING TO HARBOR ${want}…` : 'SAILING TO THEIR HARBOR…' };
  }

  // [v356 friends] JOIN a friend: their Harbor server (public copy or OWN code, same path as the ⚓ server picker) or queue their arena mode
  async function joinFriend(p) {
    if (!p?.ok) return { ok: false, why: p?.why || 'cannot join right now' };
    if (!active) return { ok: false, why: 'set sail to the Harbor first' };
    if (p.kind === 'arena') return joinWorld({ w: 'arena', mode: p.mode });
    if (!hbNet) return { ok: false, why: 'shared harbors are off right now' };
    const plan = p.server?.kind === 'own' ? planSwitch('own', p.server.arg) : planSwitch('pick', p.server?.arg);
    if (plan.ok && (p.server?.copy | 0) > 0) plan.wantCopy = p.server.copy | 0;
    return switchServer(plan);
  }

  function partyBeat() { party.room?.send('p', { i: myId, n: name, t: party.t, st: where === 'harbor' ? lob.state : where }); }
  function onPartyBeat(m) {
    if (!m || !isNetId(m.i) || m.i === myId) return; // [security H5]
    const had = party.mates.has(m.i); party.mates.set(m.i, { n: esc(m.n).slice(0, 20) || 'PIRATE', t: +m.t || 0, st: String(m.st || '').slice(0, 10), at: performance.now() });
    const now = performance.now(), live = [...party.mates.values()].filter(x => now - x.at < 10000);
    // [v328] Harbor co-op: allow up to HARBOR_SQUAD_MAX (16). Arena 2v2 still gates joinBattle separately.
    if (live.length + 1 > HARBOR_SQUAD_MAX && live.every(x => x.t < party.t)) { partyLeave(true); partyMsg(`SQUAD FULL: that code already has ${HARBOR_SQUAD_MAX} pirates`); return; }
    if (!had) { party.msg = ''; partyBeat(); hbRepaintAll(); K.banner('SQUAD READY', `${party.mates.get(m.i).n} joined (${live.length + 1} in squad) · friendly fire OFF`); }
    harborUi();
  }
  function partyTick(now) { if (party.room && now - party.hbT > 4000) { party.hbT = now; partyBeat(); } }
  const aliveId = (id) => { if (id === myId) return where === 'arena' && !spec.on && P().alive && !me.dead; const p = peers.get(id); return !!p && performance.now() - p.heard < PEER_TIMEOUT && !!p.st?.a; };
  const hpFrac = (id) => { if (!aliveId(id)) return 0; if (id === myId) return P().hp / Math.max(1, P().maxHp); const st = peers.get(id)?.st; return st ? st.h / Math.max(1, st.m) : 0; };
  function sqHost(now) {
    const present = [...(spec.on ? [] : [myId]), ...livePeers().map(p => p.id)];
    const pcOf = (id) => id === myId ? myPc() : (peers.get(id)?.pc || '');
    let ch = false;
    if (sq.ph === 'wait') {
      sq.waitN = present.length;
      const ok = present.length >= SQ_MIN && present.every(aliveId);
      if (!ok) sq.readyAt = 0; else if (!sq.readyAt) sq.readyAt = now;
      else if (now - sq.readyAt > 2500) { const t = makeTeams(present.slice(0, SQUADS.players).map(id => ({ id, pc: pcOf(id) })));
        Object.assign(sq, { r: sq.r + 1, ph: 'live', A: t.A, B: t.B, until: now + SQUADS.roundSecs * 1000, w: '', readyAt: 0 }); sq.joinAt.clear(); ch = true; }
    } else if (sq.ph === 'live') {
      const here = new Set(present), A = sq.A.filter(id => here.has(id)), B = sq.B.filter(id => here.has(id));
      if (A.length !== sq.A.length || B.length !== sq.B.length) { sq.A = A; sq.B = B; ch = true; } // leavers drop out of their team
      for (const id of present) if (!sqTeam(id)) { const T = sq.A.length <= sq.B.length ? sq.A : sq.B; if (T.length < SQUADS.size) { T.push(id); sq.joinAt.set(id, now); ch = true; } } // a new pirate fills a short team
      for (const id of [...sq.A, ...sq.B]) { if (aliveId(id)) sq.downAt.delete(id); else if (!sq.downAt.has(id)) sq.downAt.set(id, now); }
      const down = (id) => sq.sunk.has(id) || now - (sq.downAt.get(id) ?? now) > 4000; // sunk (heard), or not afloat for 4 s (a missed 'sunk' / a lagging tab)
      const up = (T) => T.filter(id => !down(id) || now - (sq.joinAt.get(id) || -1e9) < 6000).length, a = up(sq.A), b = up(sq.B);
      let w = '';
      if (!a || !b) w = !a && !b ? 'D' : a ? 'A' : 'B'; // a team fully sunk (or gone)
      else if (now > sq.until) { if (a !== b) w = a > b ? 'A' : 'B'; else { const ha = sq.A.reduce((x, id) => x + hpFrac(id), 0), hb = sq.B.reduce((x, id) => x + hpFrac(id), 0); w = Math.abs(ha - hb) < 0.02 ? 'D' : ha > hb ? 'A' : 'B'; } }
      if (w) { Object.assign(sq, { ph: 'end', w, until: now + SQUADS.endSecs * 1000 }); ch = true; }
    } else if (now > sq.until) { Object.assign(sq, { ph: 'wait', A: [], B: [], w: '', readyAt: 0 }); ch = true; }
    if (ch || now - sq.sent > 2000) { sq.sent = now; room?.send('sq', { h: myId, r: sq.r, ph: sq.ph, A: sq.A, B: sq.B, left: Math.max(0, Math.round(sq.until - now)), w: sq.w, n: present.length }); }
    if (ch) sqChanged();
  }
  function onSq(m) { // the host's round state (anyone else's is ignored)
    if (!isSq() || !m || typeof m.h !== 'string' || m.h !== hostId || m.h === myId) return;
    const ids = (a) => Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.length <= 20).slice(0, SQUADS.size) : [];
    Object.assign(sq, { r: Math.max(0, m.r | 0), ph: ['wait', 'live', 'end'].includes(m.ph) ? m.ph : 'wait', A: ids(m.A), B: ids(m.B), until: performance.now() + clamp(+m.left || 0, 0, SQUADS.roundSecs * 1000), w: ['A', 'B', 'D'].includes(m.w) ? m.w : '', waitN: clamp(m.n | 0, 0, 8) });
    sqChanged();
  }
  const tName = (t) => t === 'A' ? 'BLUE' : 'RED';
  function sqChanged() {
    const key = `${sq.r}:${sq.ph}`; if (key === sq.seen) return; const prevPh = sq.seen.split(':')[1]; sq.seen = key;
    if (sq.ph === 'live') { sq.sunk.clear(); sq.downAt.clear(); sq.A0 = [...sq.A]; sq.B0 = [...sq.B];
      if (spec.on) K.banner(`ROUND ${sq.r} · 2v2`, `${sq.A.map(nameOf).join(' + ')} (BLUE) vs ${sq.B.map(nameOf).join(' + ')} (RED)`);
      return; } // players: the spawn + banner come from sqTick once we're on a team
    if (sq.ph === 'end') {
      if (spec.on) { K.banner(sq.w === 'D' ? 'DRAW' : `${tName(sq.w)} TEAM WINS`, `round ${sq.r}`); return; }
      if (where !== 'arena') return;
      const myT = sq.A0.includes(myId) ? 'A' : sq.B0.includes(myId) ? 'B' : null, won = !!myT && sq.w === myT, draw = sq.w === 'D', losers = sq.w === 'A' ? sq.B0 : sq.A0;
      let gold = 0;
      if (won && [...sq.sunk].some(id => losers.includes(id))) { // win gold only for a real fight (someone on the other team was sunk), earned gold: the holder perk doubles it
        gold = SQUADS.winGold + holderMul(SQUADS.winGold) + goldFindBonus(SQUADS.winGold); game.gold += gold; me.gold += gold; sfx.coin(); K.popup(new THREE.Vector3(P().x, 6, P().z), `+${gold} VICTORY GOLD`); K.updateHud(); save({ now: true }); }
      if (won) sfx.victory?.(); // [v101] recorded victory stinger
      K.banner(draw ? 'DRAW' : won ? 'VICTORY!' : myT ? 'DEFEAT' : 'ROUND OVER', won ? (gold ? `+${formatGoldAmount(gold)} gold · next round in ${SQUADS.endSecs} s` : 'no gold: nobody on their team was sunk') : draw ? 'nobody wins this round' : `next round in ${SQUADS.endSecs} s`);
      if (myT && !won && lob.queue > 0) lobbyCall('died').then((r) => { if (r.state === 'queue') lob.queuedByDeath = true; }); // rotation: the losing team makes room for the queue
      return;
    }
    if (spec.on || where !== 'arena') return; // wait
    if (lob.queuedByDeath) { lob.queuedByDeath = false; toHarbor('IN THE QUEUE', `position #${lob.pos || '?'} · farm the harbor AI while you wait`); return; }
    if (me.dead) respawn();
    if (prevPh) K.banner('SQUADS', 'waiting for the next round · no damage until it starts');
  }
  function sqSpawn(t) { // round start: your team's side of the arena
    const pl = P(), side = t === 'A' ? -1 : 1, list = t === 'A' ? sq.A : sq.B, k = Math.max(0, list.indexOf(myId));
    let x = side * PVP_ARENA_R * 0.55, z = (k ? 1 : -1) * 22;
    if (K.islands) [x, z] = K.islands.freeSpot(x, z, 16);
    me.dead = false; me.respawn = 0; me.respawnAt = 0; me.life++; me.protect = SQUADS.protect; me.lastBy = null; me.lastDamageAt = 0;
    Object.assign(pl, { alive: true, sinking: 0, hp: pl.maxHp, x, z, yaw: Math.atan2(-x, -z), speed: 0, sail: 1, anchor: false, calm: 0, repT: 0 });
    pl.cd.port = pl.cd.star = 0; pl.mesh.visible = true; K.resetCamera(); showDead(false); K.updateHud();
    const mates = list.filter(id => id !== myId).map(nameOf), foes = (t === 'A' ? sq.B : sq.A).map(nameOf);
    K.banner(`ROUND ${sq.r} · 2v2`, `${mates.length ? `you + ${mates.join(', ')}` : 'you'} vs ${foes.join(' + ') || '…'} · sink the RED ships`);
  }
  function sqTick(now) {
    if (room && isHost && !spec.on && now - sq.joinedAt > 3000) sqHost(now);
    if (!spec.on && where === 'arena' && sq.ph === 'live' && sqTeam(myId) && sq.myR !== sq.r) { sq.myR = sq.r; sqSpawn(sqTeam(myId)); }
    if (!spec.on && me.dead && me.respawn === Infinity && sq.ph === 'live' && now - (me.deadAt || 0) > 3000) { // out for the round: the camera follows your teammate
      const mate = (sqTeam(myId) === 'A' ? sq.A : sq.B).map(id => peers.get(id)?.ship).find(s => s && s.alive);
      if (mate) { const pl = P(); pl.mesh.visible = false; pl.x += (mate.x - pl.x) * 0.08; pl.z += (mate.z - pl.z) * 0.08; } }
    sqVis();
  }
  const SQ_CSS = { [SQUADS.blue]: '#8fb8ff', [SQUADS.red]: '#ff8f8f' };
  function sqVis() { // your team = blue sails + flag, the enemy = red (hulls keep their skin); name tags, a ring under teammates, radar dots
    const on = isSq() && sq.ph !== 'wait', mine = spec.on ? null : sqTeam(myId);
    const col = (id) => { const t = on ? sqTeam(id) : null; if (!t) return null; if (spec.on) return t === 'A' ? SQUADS.blue : SQUADS.red; return mine ? (t === mine ? SQUADS.blue : SQUADS.red) : null; };
    const opts = { skullImg: K.skullImg, mainImg: K.shipOpts?.mainSailMap?.image };
    if (!spec.on && P()?.mesh) teamPaint(P().mesh, on && mine ? SQUADS.blue : null, opts);
    for (const p of peers.values()) { const s = p.ship; if (!s?.mesh) continue; const c = col(p.id); teamPaint(s.mesh, c, opts);
      const css = c == null ? '' : SQ_CSS[c]; if (s.nameEl && s.nameEl.style.color !== css) s.nameEl.style.color = css;
      s.radarColor = c === SQUADS.blue ? '#3d8bff' : null;
      if (c === SQUADS.blue && !spec.on && s.alive) { if (!s.ring) s.ring = mateRing(scene); const L = s.mesh.userData.hitLen || s.mesh.userData.len || 16; s.ring.visible = true; s.ring.position.set(s.x, 0.4, s.z); s.ring.scale.setScalar(L * 0.62); }
      else if (s.ring) s.ring.visible = false; }
    mateBar(on && !!mine && where === 'arena');
  }
  function mateBar(show) { // your teammate's hull at the top of the screen
    let b = sq.bar; const mates = show ? (sqTeam(myId) === 'A' ? sq.A : sq.B).filter(id => id !== myId) : [];
    if (!mates.length) { if (b) b.hidden = true; return; }
    if (!b) { b = sq.bar = document.createElement('div'); b.id = 'sq-mate'; b.innerHTML = '<span></span><i><b></b></i>'; document.body.appendChild(b); }
    const id = mates[0], p = peers.get(id), alive = aliveId(id), f = alive ? hpFrac(id) : 0;
    b.hidden = false; b.classList.toggle('sunk', !alive);
    const t = `⚓ ${p?.name || 'TEAMMATE'}${alive ? ` · ${Math.round(f * 100)}%` : ' · SUNK'}`; if (b.firstChild.textContent !== t) b.firstChild.textContent = t;
    b.querySelector('b').style.width = `${Math.round(f * 100)}%`;
  }
  function sqHudLine(n) {
    const left = Math.max(0, Math.ceil((sq.until - performance.now()) / 1000)), mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (sq.ph === 'live') { const mine = sqTeam(myId), foe = mine === 'A' ? 'B' : 'A'; return `SQUADS · ROUND ${sq.r} · ${mm}\n${mine ? `BLUE ${sq[mine].filter(aliveId).length} vs RED ${sq[foe].filter(aliveId).length} afloat` : 'you join the next round'}`; }
    if (sq.ph === 'end') return `SQUADS · ROUND ${sq.r} OVER\nnext round in ${left} s`;
    return `SQUADS · WAITING ${Math.max(n, sq.waitN)}/${SQ_MIN} pirates\nno damage until the round starts`;
  }

  // ---------------- per-frame ----------------
  function update(dt) {
    if (!active) return;
    const now = performance.now(), pl = P();
    if (room) electHost();
    partyTick(now);
    if (spec.on) { specTick(dt, now); return; }
    if (me.protect > 0) me.protect = Math.max(0, me.protect - dt);
    shield(pl, pl.alive && !me.dead && me.protect > 0); skinFx(pl, dt);
    lobbyTick(dt); hbTick(now); aiTick(dt); afkTick(); retTick();
    if (isSq()) sqTick(now);
    if (me.dead && !(isSq() && me.respawn === Infinity)) { me.respawn = me.respawnAt ? (me.respawnAt - now) / 1000 : me.respawn - dt; // [v95] harbor: wall clock, a true 5-4-3-2-1 even on a slow phone
      const el = $('pvp-dead-t'), n = Math.max(1, Math.ceil(me.respawn)); if (el) el.textContent = Math.max(0, Math.ceil(me.respawn)); const big = $('pvp-dead-big'); if (big && big.textContent !== String(n)) { big.textContent = n; big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop'); } if (me.respawn <= 0) respawn(); }
    // arena edge
    if (where === 'harbor' && SAIL_ALL) { // [Emerly sail-around] full-island sea disc; west-bay AI stay near PVP_ARENA_R, islandPatrol uses clampSail
      const [nx, nz] = clampSail(pl.x, pl.z); if (nx !== pl.x || nz !== pl.z) { pl.x = nx; pl.z = nz; if (!me.edgeT || now - me.edgeT > 5000) { me.edgeT = now; K.banner('OPEN SEA LIMIT', 'turn back, captain'); } }
    } else { const r = Math.hypot(pl.x, pl.z); if (r > PVP_ARENA_R) { pl.x *= PVP_ARENA_R / r; pl.z *= PVP_ARENA_R / r; if (!me.edgeT || now - me.edgeT > 5000) { me.edgeT = now; K.banner('EDGE OF THE ARENA', 'turn back, captain'); } } }
    if (room && isHost && (where === 'arena' || where === 'harbor')) hostTick(); // [v105] + the shared harbor's drops (pile cap + 10 s resync)
    // peers that went silent: sink their ship from view
    for (const [id, p] of peers) if (now - p.heard > PEER_TIMEOUT) { if (p.ship) dropShip(p.ship); peers.delete(id); }
    // (our state is sent by the transport at PVP_NET hz via stateMsg; one batched message per tick)
    hitT -= dt; if (hitT <= 0) { hitT = 0.15; flushHits(); flushBotHits(); }
    hudT -= dt; if (hudT <= 0) { hudT = 0.5; hud(); renderFeed(); if (!$('pvp-menu').classList.contains('hidden')) renderBoard(); }
    saveT -= dt; if (saveT <= 0) { saveT = 10; save(); }
  }
  let sentGear = false, sentCrew = false, sentCC = false;   // [Raul gear colours] cc = the crew's hat colour
  function stateMsg() { // the transport asks for this once per tick
    const shared = where === 'harbor' && !!room; // [v99] a shared harbor copy
    if ((where !== 'arena' && !shared) || spec.on) return null;
    if (ADM.invisible) return null; // [admin-menu] INVISIBLE: nothing about you leaves this device (a 'bye' already went out)
    if (where === 'harbor' && document.documentElement.classList.contains('pfp-spawn-pending')) return null; // [spawn-snap] still at the sea spawn behind the dock cover: send nothing until moored
    const pl = P(), lv = getRunLevels();
    const m = { i: myId, l: me.life, x: r1(pl.x), z: r1(pl.z), y: r2(pl.yaw), v: r1(pl.speed), t: r2(pl.turn || 0), h: Math.round(pl.hp), m: pl.maxHp, a: me.dead || !pl.alive ? 0 : 1, p: me.protect > 0 ? 1 : 0,
      bt: me.bounty, n: name, lv: UPGRADES.map(u => lv[u.id] || 0), sk: skinId(), pc: myPc(), k: me.kills, d: me.deaths, g: me.gold, K: lifeK(), D: lifeD(), bK: boardK(), bD: boardD() };
    const lg = getLocalGear(), gw = gearToWire(lg); if (gw || sentGear || lg.eyeColor) { m.gr = gw; if (gw || lg.eyeColor) sentGear = true; } if (lg.eyeColor || sentGear) m.ec = lg.eyeColor | 0; { const cw = crewToWire(); if (cw || sentCrew) { m.cr = cw; sentCrew = true; } } { const cc = crewColorToWire(); if (cc || sentCC) { m.cc = cc; sentCC = true; } } // [Timothy] cr = your crew's loadout (js/crewLoadout.js) // [v115] ec = eye colour (own static field: 'gr' unchanged for old builds) // [Timothy] shop gear: only once you wear some (then kept, so taking it off reaches everyone)
    const dk = window.PFP?.dock; if (dk?.on) Object.assign(m, dk.netState()); // [Emerly] harbor room: dk = moored berth, ft = on-foot pose (nothing outside the harbor)
    if (ADM.frozen) m.fz = 1; // [admin-menu] everyone tints you icy (cosmetic; the freeze itself is server-side)
    if (shared) { m.hj = hb.hj; m.ai = isHost && performance.now() >= hb.listenUntil ? aiRows() : 0; m.um = unmannedLocal() ? 1 : 0; } // [backpack-pvp] um: my ship is parked / unmanned (shielded) // [v99] host order + the host's AI ships (0 = none: overwrites a stale list)
    return m;
  }

  // ---------------- HUD / menus ----------------
  // [rank] '#' next to your name = your BATTLE ROYALE all-time kills rank ('—' unranked), from the pvp function ('me', same
  // identity as the kills board). Kills / deaths on the HUD = lifetime: the saved profile, or the server's confirmed count if higher.
  const rk = { rank: null, kills: 0, deaths: 0, at: 0, busy: false, got: false };
  // [v81] all-time totals exactly as the BATTLE ROYALE board counts them: the server's confirmed kills / deaths for this identity
  // (device key or SIGNED wallet, never a typed one) + this match's claims the server hasn't been re-read for yet (no double count:
  // a claim is dropped from the extra once a board read that started after it resolved comes back). Shown in spectate + scoreboard.
  const unsynced = [];
  const boardK = () => rk.got ? rk.kills + unsynced.filter(e => e.side === 'k').length : lifeK();
  const boardD = () => rk.got ? rk.deaths + unsynced.filter(e => e.side === 'v').length : lifeD();
  const lifeK = () => Math.max(profile.stats.kills, rk.kills + kdT.extra.k), lifeD = () => Math.max(profile.stats.deaths, rk.deaths + kdT.extra.d); // [backpack-pvp] + ground fights (never on the BR board)
  const rankTxt = () => rk.rank ? String(rk.rank) : '—';
  function showRank() { // name ellipsizes on narrow phones, the rank never does
    const hn = $('captain-name'); if (!hn || spec.on) return;
    const a = document.createElement('span'), b = document.createElement('span'); a.className = 'cn-name'; b.className = 'cn-rank';
    setAvatar($('captain-img'), nftSrc(rk.rank)); // [v78] rank #N = NFT #N (1–333), else the skull
    a.textContent = String(name).toUpperCase(); b.textContent = `\u00a0· #${rankTxt()}`; b.title = 'Your BATTLE ROYALE rank (all-time kills)'; hn.replaceChildren(a, b); hn.classList.add('cn-split');
    prestigeEmblem();
  }
  // [prestige] BANKSY: "Add prestige emblem to player top left section": a small emblem on the corner of your avatar (no extra width on
  // phones). P1 gold shield, P2 diamond, P3+ diamond with a gold rim; the number on it. Nothing at prestige 0 (and outside Battle Royale).
  function prestigeEmblem() {
    const cap = $('captain'), img = $('captain-img'); if (!cap || !img) return;
    let e = $('cap-prest'); const lv = active && profile ? profile.prestige | 0 : 0;
    if (!lv) { if (e) e.remove(); return; }
    if (!e) { e = document.createElement('span'); e.id = 'cap-prest'; cap.appendChild(e); }
    if (e.dataset.lv !== String(lv)) { e.dataset.lv = String(lv); e.className = `p${Math.min(3, lv)}`; e.innerHTML = emblemSvg(lv, 24); e.title = emblemLabel(lv); }
    const s = Math.round(Math.max(18, Math.min(26, img.offsetWidth * 0.46))); e.style.width = e.style.height = `${s}px`; // follows the avatar size (58 / 42 / 38 px)
    e.style.left = `${img.offsetLeft + img.offsetWidth - s * 0.72}px`; e.style.top = `${img.offsetTop + img.offsetHeight - s * 0.78}px`;
  }
  addEventListener('resize', () => { if ($('cap-prest')) requestAnimationFrame(prestigeEmblem); });
  function refreshRank(force = false) {
    if (rk.busy || (!force && performance.now() - rk.at < 30000)) return; rk.busy = true; rk.at = performance.now(); const t0 = rk.at;
    fetchMe().then(r => { if (r) { rk.rank = r.rank; rk.kills = r.kills | 0; rk.deaths = r.deaths | 0; rk.got = true;
      for (let i = unsynced.length - 1; i >= 0; i--) if (unsynced[i].t1 && unsynced[i].t1 < t0 - 1500) unsynced.splice(i, 1); // already in r showRank(); K.updateHud();
      // [v76] this identity's server-confirmed kills / deaths (this device, or the SIGNED wallet) are the floor of the saved stats,
      // so skins unlock from real kills. A typed wallet never changes the identity.
      const st = profile.stats; if (rk.kills > st.kills || rk.deaths > st.deaths) { st.kills = Math.max(st.kills, rk.kills); st.deaths = Math.max(st.deaths, rk.deaths); save({ now: true }); if (!$('pvp-menu').classList.contains('hidden')) renderMenu(); } } }).finally(() => { rk.busy = false; });
  }
  function hud() {
    if (!active) return;
    if (!spec.on) refreshRank(); // every 30 s at most
    const lab = document.querySelectorAll('#hud-top .label');
    if (lab.length >= 3) { lab[0].textContent = 'KILLS'; lab[1].textContent = 'DEATHS'; lab[2].textContent = 'K/D'; } // [sail-around] GOLD moved to #hud-gold
    $('score').textContent = lifeK(); $('wave').textContent = lifeD(); $('gold').textContent = formatGoldAmount(game.gold); $('sunk').textContent = kd(lifeK(), lifeD()); // BANKSY: lifetime kills / deaths (saved with your upgrades + skins), not this session
    const n = livePeers().length + 1, ai = [...bots.values()].filter(b => b.alive).length;
    const h2x = where === 'harbor' && HOLDER_ENABLED && holder.on && !ON_PORTAL; // [v97.1] holder perk (incl. the owner's devices): harbor AI pay is doubled
    const hbN = room && where === 'harbor' ? livePeers().length + 1 : 0; // [v99] 'HARBOR · N pirates' in a shared copy (copy 2+ shows its number)
    const el = $('enemies-left'), txt = where === 'harbor' ? `HARBOR${hbN > 1 ? `${hb.copy > 1 ? ` ${hb.copy}` : ''} · ${hbN} pirates` : ''}${lob.state === 'queue' ? ` · queue #${lob.pos}` : ''} · pay ${formatGoldAmount(harborGold(totalLevel()))}g${h2x ? '\u0001' : ''}` // [v74] under the minimap (BANKSY); [v98.3] the arena count moved into the harbor card, above SPECTATE
      : room ? (isSq() ? sqHudLine(n) : `ARENA · ${n}/${lob.cap} pirates${lob.queue ? ` · ${lob.queue} queued` : ''}${isHost ? ' · host' : ''}`) : 'joining…';
    if (where === 'harbor') { const an = $('pvp-arena-n'); if (an) { const t = lob.known ? `${mode === 'squads' ? 'SQUADS' : 'SOLO'} · ${lob.players | 0}/${lob.cap || (mode === 'squads' ? SQUADS.players : net.cfg.maxArena)} in arena${lob.specs ? ` · ${lob.specs} 👁` : ''}` : `${mode === 'squads' ? 'SQUADS' : 'SOLO'} · …`; if (an.textContent !== t) an.textContent = t; } } // [v98.3] follows the SOLO / SQUADS switch
    if (h2x) { const html = esc(txt).replace('\u0001', ' <b class="hud-2x" title="Holder perk: AI ships pay double">HOLDER 2×</b>'); if (el._h !== html || !el.firstElementChild) { el._h = html; el.innerHTML = html; } }
    else { el._h = null; if (el.textContent !== txt) el.textContent = txt; }
  }
  function showDead(on) {
    const el = $('pvp-dead'); el.classList.toggle('hidden', !on); if (!on) return;
    el.querySelector('.pd-by').textContent = `Sunk by ${me.killedBy}`;
    const q = el.querySelector('.pd-queue'); if (q) q.hidden = true; const re = el.querySelector('.pd-re'); if (re) re.firstChild.textContent = 'Back at sea in ';
    const tt = el.querySelector('#pvp-dead-t'); if (tt) tt.hidden = false;
    if (isSq() && where === 'arena' && !me.aiDeath) { if (re) re.firstChild.textContent = 'Out for this round · your teammate fights on'; if (tt) tt.hidden = true; }
    else if (where === 'arena' && !me.aiDeath && re) re.firstChild.textContent = 'Back to the harbor in '; // [br-death] SOLO
    el.classList.toggle('pd-harbor', where === 'harbor'); // [v95] harbor: big centred 5-4-3-2-1, respawn right here
    if (where === 'harbor' && re) re.firstChild.textContent = 'Back at sea in the harbor in ';
    el.querySelector('.pd-drop').textContent = me.harborPvp ? `Sunk at sea by ${me.killedBy}: -${formatGoldAmount(me.harborLoss | 0)} gold + your unequipped haul floats in a sea loot crate. Equipped gear, ship, skins + cottage storage kept. Counts for K/D.` : me.aiDeath ? (me.harborLoss ? `Sunk in the harbor: -${formatGoldAmount(me.harborLoss)} gold (you kept ${game.gold | 0}). K/D unchanged.` : where === 'harbor' ? `Sunk in the harbor: no gold to lose. K/D unchanged.` : 'AI ships cost you nothing but time: gold and K/D unchanged.')
      : me.afkDeath ? `You were idle: you dropped ${formatGoldAmount(me.dropped)} gold (no bonus) and it does not count for K/D. You kept ${game.gold | 0}. ${isSq() ? 'Watching your teammate.' : 'Back to the harbor.'}` : `You dropped ${formatGoldAmount(me.dropped)} gold (${me.lostGold | 0} + ${PVP_DEATH_BONUS} bonus${me.lostBounty ? ` + ${me.lostBounty} bounty` : ''}). You kept ${game.gold | 0}. ${isSq() ? 'Watching your teammate.' : 'Back to the harbor.'}`;
    el.querySelector('.pd-kd').innerHTML = `K/D <b>${kd(profile.stats.kills, profile.stats.deaths)}</b> · ${profile.stats.kills} kills · ${profile.stats.deaths} deaths<br><span class="muted">this session: ${me.kills} kills · ${me.deaths} deaths · ${formatGoldAmount(me.gold)} gold</span>`;
  }
  function renderBoard() {
    const rows = [{ id: myId, name, k: me.kills, d: me.deaths, g: me.gold, K: boardK(), D: boardD() }, ...livePeers().map(p => ({ id: p.id, name: p.name, k: p.k, d: p.d, g: p.g, K: p.bK ?? p.K, D: p.bD ?? p.D }))].sort((a, b) => b.k - a.k || a.d - b.d);
    $('pvp-board').innerHTML = `<tr><th>PIRATE</th><th>K</th><th>D</th><th>GOLD</th><th>K/D</th></tr>` + rows.map(r => `<tr class="${r.id === myId ? 'me' : ''}"><td>${esc(r.name)}${r.id === hostId ? ' <i class="muted">host</i>' : ''}</td><td>${r.k}</td><td>${r.d}</td><td>${formatGoldAmount(r.g)}</td><td title="lifetime ${r.K} kills / ${r.D} deaths">${kd(r.K, r.D)}</td></tr>`).join('');
  }
  function renderMenu() {
    const m = $('pvp-menu'); if (!m) return;
    $('pvp-name').value = name;
    const st = profile.stats; // [v102] skins are bought with gold at the island shop (or from here: tap a locked skin)
    $('pvp-kd').innerHTML = `Lifetime K/D <b>${kd(lifeK(), lifeD())}</b> · ${lifeK()} player kills · ${lifeD()} deaths · ${st.botKills} AI sunk · ${st.bossKills | 0} Commodores sunk${profile.prestige ? ` · <b class="pvp-prest">${emblemSvg(profile.prestige, 16)} PRESTIGE ${profile.prestige}</b>` : ''}<br><span class="muted pvp-isle-ptr">⛵ Skins at the SHIP SKINS shop, upgrades at the UPGRADE SHOP on the island</span>`;
    const grid = $('pvp-skins'); grid.innerHTML = '';
    for (const t of [...TIERS, ...UNLOCKS]) {
      const ok = canUse(t.id), it = SKIN_ITEMS.find(i => i.id === t.id), g = it?.goal ? goalProgress(it.goal, { ...st, kills: lifeK(), deaths: lifeD(), prestige: profile.prestige | 0 }) : null;
      const c = document.createElement('div'); c.className = `pvp-skin view-only${ok ? '' : ' locked'}${t.id === skinId() ? ' on' : ''}`; c.dataset.skin = t.id; // [Timothy] display only: buy / equip at the island ship shop
      c.appendChild(skinSwatch(pvpSkin(t.id), 96, 48));
      const lab = document.createElement('span');
      lab.innerHTML = `<b>${t.name}</b>${ok ? (t.id === skinId() ? 'EQUIPPED' : 'OWNED') : g && !g.done ? `🔒 ${g.rows.filter(x => !x.done).map(x => x.fmt === 'prestige' ? `PRESTIGE ${x.need}` : x.fmt === 'kd' ? `K/D ${x.need}` : `${x.need.toLocaleString('en-US')} kills`).join(' + ')}` : `${formatGoldAmount((it?.price || 0))}g`}`; c.appendChild(lab);
      grid.appendChild(c);
    }
    previewCards(grid, [...TIERS, ...UNLOCKS].map(t => ({ id: t.id, skin: pvpSkin(t.id) })), getRunLevels(), { pvp: true }); // [v75] real renders, like the shop
    $('pvp-wallet-state').textContent = wallet ? `Saving to this device + wallet ${wallet.slice(0, 4)}…${wallet.slice(-4)}` : 'Saving on this device automatically.';
    $('pvp-wallet').textContent = wallet ? 'Disconnect wallet' : 'Connect wallet to save';
    holderUi();
    renderBoard();
  }
  function pickSkin(id) {
    if (!canUse(id)) return;
    profile.skins.equipped = id; (K.rebuildShipSkin || K.rebuildShip)(getRunLevels()); sfx.equip?.(); save({ now: true }); renderMenu();
  }
  function skinToast(t) {
    document.getElementById('skin-toast')?.remove();
    const el = document.createElement('div'); el.id = 'skin-toast';
    el.innerHTML = t.goal ? `<div class="st-txt"><b>GOAL REACHED</b><span>${t.name} · buy it at the SHIP SKINS shop on the island</span></div>` // [Timothy] no remote SHOP / EQUIP button
      : `<div class="st-txt"><b>NEW SKIN UNLOCKED</b><span>${t.name} · equip it at the SHIP SKINS shop on the island</span></div>`;
    const sw = skinSwatch(pvpSkin(t.id), 88, 44); sw.className = 'st-sw'; el.prepend(sw);
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) el.addEventListener(ev, e => e.stopPropagation());
    document.body.appendChild(el); setTimeout(() => el.remove(), 6000);
  }
  async function walletButton() {
    const msg = (t) => { $('pvp-wallet-state').textContent = t; };
    if (wallet) { signOut(); wallet = ''; refreshHolder(); renderMenu(); return; }
    try {
      $('pvp-wallet').disabled = true;
      const r = await walletSignIn(msg); wallet = r.wallet;
      const use = await linkWallet(r.profile, snapshot());
      const cur = getRunLevels(); profile = use; game.gold = use.gold; setCrewLoadout(profile.gear);
      if (JSON.stringify(cur) !== JSON.stringify(use.levels)) setRunLevels(use.levels); else K.rebuildShip(use.levels);
      K.updateHud(); renderMenu(); refreshHolder(); refreshRank(true); clearKillsTopCache(); msg(`Linked! Saving to this device + wallet ${wallet.slice(0, 4)}…${wallet.slice(-4)}`);
    } catch (e) { msg(String(e?.message || e).slice(0, 120)); }
    finally { $('pvp-wallet').disabled = false; }
  }
  const capNo = () => game.captain; // the captain portrait number (default CAPT. #N name); the HUD '#' is the rank
  function setName(v, keep = true) { // the chosen PvP name everywhere: HUD (top-left), menu field, name tag / feed / boards (via state 'n')
    name = v; if (keep) saveName(v);
    showRank();
    const mn = $('pvp-name'); if (mn) mn.value = name;
  }
  function addrCheck() {
    const inp = $('pvp-entry-addr'), msg = $('pvp-entry-addr-msg'); if (!inp) return false;
    const v = inp.value.trim(), ok = isValidSolanaAddress(v);
    inp.classList.toggle('good', ok); inp.classList.toggle('bad', !!v && !ok);
    if (msg) msg.textContent = !v ? 'Used for airdrops. Never asks for keys. Changing it later: a free signature.' : ok ? `Ahoy ${shortWallet(v)}! Used for airdrops. Never asks for keys. Changing it later: a free signature.` : 'That doesn’t look like a Solana address (base58, 32–44 characters).';
    return ok;
  }
  let airdropAsked = '';
  function syncWallet(v) { // stored privately server-side; [security H4] changing it: the new wallet confirms it with a free signature
    if (ON_PORTAL || !isValidSolanaAddress(v)) return;
    saveAirdrop(v, name).then(async (r) => {
      if (r?.need !== 'signature' || airdropAsked === v) return; airdropAsked = v;
      const c = await confirmAirdrop(v, name).catch((e) => ({ ok: false, error: e?.message || 'not confirmed' }));
      nameToast(c?.ok ? `Wallet changed to ${shortWallet(v)}` : `Wallet NOT changed: confirm ${shortWallet(v)} in your wallet app (${c?.error || 'not confirmed'})`);
    }).catch(() => {});
  }
  function entryAirdrop() { // [v116] the wallet is set in the PROFILE now (same saved slot as Waves): SET SAIL still syncs a valid saved one, as before
    syncWallet(String(getSavedWallet() || '').trim());
  }
  if (typeof window !== 'undefined') window.PFP_PVP_WALLET = (v) => { if (ON_PORTAL || !isValidSolanaAddress(v)) return; saveWallet(v); syncWallet(v); }; // profile field -> server copy
  let uiWired = false;
  function wireUi() {
    if (uiWired) return; uiWired = true;
    $('btn-pvp-menu').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggleMenu(); });
    $('pvp-menu-close').onclick = () => toggleMenu(false);
    $('pvp-wallet').onclick = walletButton;
    $('pvp-holder-claim')?.addEventListener('click', (e) => { e.stopPropagation(); claimHolderGold(); });
    $('pvp-name').addEventListener('change', async () => { const v = esc($('pvp-name').value).trim().slice(0, 20) || pirateName();
      if (v.toLowerCase() !== String(name).toLowerCase() && await checkName(v) === false) { $('pvp-name').value = name; K.banner('NAME TAKEN', window.PFP_ACCT?.takenByAccount(v) ? `"${v}" has a password: LOG IN in PROFILE` : `"${v}" belongs to another pirate`); return; } // [v76]
      setName(v); });
    $('pvp-dead-menu').onclick = () => K.toTitle();
    $('pvp-join').onclick = (e) => { e.stopPropagation(); lob.state === 'queue' ? leaveQueue() : joinBattle(); };
    $('pvp-harbor-spec').onclick = (e) => { e.stopPropagation(); specPick(true); };
    $('pvp-spec-pick')?.addEventListener('click', (e) => { const b = e.target.closest('button[data-w]'); if (!b) return; e.stopPropagation(); specPick(false); harborSpectate(b.dataset.w === 'harbor'); }); // [v99]
    $('pvp-tab')?.addEventListener('click', (e) => { const b = e.target.closest('button[data-t]'); if (!b) return; e.stopPropagation(); if (lob.state !== 'harbor') return; harborTab = b.dataset.t; harborUi(); });
    $('pvp-waves-go')?.addEventListener('click', (e) => { e.stopPropagation(); window.PFP_OPEN_WAVES?.(); }); // = the old home-screen WAVES button
    $('pvp-mode')?.addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (b) { e.stopPropagation(); setMode(b.dataset.m); } }); // [v98]
    $('pvp-party-new')?.addEventListener('click', (e) => { e.stopPropagation(); partyJoin(newPartyCode(), true); });
    $('pvp-party-join')?.addEventListener('click', (e) => { e.stopPropagation(); partyJoin($('pvp-party-code').value); });
    $('pvp-party-code')?.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); partyJoin(e.target.value); } });
    $('pvp-party-leave')?.addEventListener('click', (e) => { e.stopPropagation(); partyLeave(); });
    $('pvp-offer-yes').onclick = (e) => { e.stopPropagation(); acceptOffer(); };
    $('pvp-offer-no').onclick = (e) => { e.stopPropagation(); declineOffer(); };
    $('pvp-entry-go').onclick = async (e) => { e.stopPropagation(); const v = esc($('pvp-entry-name').value).trim().slice(0, 20);
      const go = $('pvp-entry-go'), msg = $('pvp-entry-name-msg'); if (go.disabled) return;
      if (v && v.toLowerCase() !== String(name).toLowerCase()) { go.disabled = true; const free = await checkName(v); go.disabled = false; // [v76] unique names
        if (free === false) { window.PFP_ACCT_UI?.nameTaken(msg, v); msg?.classList.remove('hidden'); $('pvp-entry-name').focus(); return; } } // [v106] a name with a password: LOG IN
      msg?.classList.add('hidden');
      if (v) setName(v); else setName(getSavedName() || (capNo() ? `CAPT. #${capNo()}` : name), false); entryAirdrop(); syncName(name); $('pvp-entry').classList.add('hidden');  };
    // [airdrop] optional SOLANA WALLET paste field, same stored wallet + checks as the Waves game-over entry; never blocks SET SAIL
    if (ON_PORTAL) document.querySelectorAll('.pvp-airdrop').forEach(n => n.remove()); // crypto-free portal builds
    $('pvp-entry-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('pvp-entry-go').click(); } }); // [v115] name -> SET SAIL
    for (const id of ['pvp-return', 'pvp-menu-return']) $(id)?.addEventListener('click', (e) => { e.stopPropagation(); requestReturn(); });
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) $('pvp-return')?.addEventListener(ev, e => e.stopPropagation());
    for (const id of ['pvp-harbor', 'pvp-offer', 'pvp-entry', 'pvp-afk']) for (const ev of ['pointerdown', 'touchstart', 'mousedown']) $(id)?.addEventListener(ev, e => e.stopPropagation());
    for (const ev of ['keydown', 'pointerdown', 'touchstart', 'wheel']) addEventListener(ev, () => { if (active) markInput(); }, { passive: true, capture: true });
    for (const ev of ['pointermove', 'touchmove']) addEventListener(ev, () => { hb.moveAt = performance.now(); }, { passive: true, capture: true }); // [v99] harbor presence only (the arena AFK rule is unchanged)
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) { $('pvp-menu').addEventListener(ev, e => e.stopPropagation()); $('pvp-dead').addEventListener(ev, e => e.stopPropagation()); }
    addEventListener('keydown', (e) => { if (!active || e.target.tagName === 'INPUT') return; if (isKey('menu', e.code)) { e.preventDefault(); toggleMenu(); } });
    addEventListener('pagehide', () => leave(true));
  }
  window.PFP_OPEN_UPGRADES = () => { if (!active || where !== 'harbor') return false; $('pvp-menu')?.classList.add('hidden'); return !!openUpgradesPanel({ island: true }); }; // [Timothy] the island UPGRADE SHOP storefront (separate from SHIP SKINS) (was: the BR menu)
  function toggleMenu(on) { const m = $('pvp-menu'); const show = on ?? m.classList.contains('hidden'); m.classList.toggle('hidden', !show); if (show) { renderMenu(); const kb = $('pvp-kills'); if (kb) { mountKillsBoard(kb); renderKills(kb); } } }

  // ---------------- harbor UI ----------------
  let harborTab = 'battle';
  function harborUi() {
    const h = $('pvp-harbor'); if (!h) return;
    const show = active && where === 'harbor' && !spec.on; h.classList.toggle('hidden', !show); if (!show) return;
    serverPicker?.mountButton(); { const sb = document.getElementById('srv-btn'); if (sb && hbNet) sb.title = serverLabel({ prefix: hbNet.prefix, copy: hb.copy }); } // [backpack-pvp] ⚓ SERVER
    try { // [v339] PLAY & SERVERS hub pill
      const lab = hbNet ? serverLabel({ prefix: hbNet.prefix, copy: hb.copy }) : 'HARBOR';
      dispatchEvent(new CustomEvent('pfp-harbor-hub', { detail: { label: lab, n: hb.n | hb.pirates | 0, queued: lob?.state === 'queue', pos: lob?.pos | 0 } }));
    } catch {}
    const b = $('pvp-join'), t = $('pvp-harbor-t');
    if (lob.state === 'queue') { b.textContent = 'LEAVE QUEUE'; t.innerHTML = `${mode === 'squads' ? 'SQUADS · ' : ''}IN THE QUEUE · <b>#${num(lob.pos)}</b> of ${num(lob.queue)} · arena ${num(lob.players)}/${num(lob.cap)}`; }
    else if (lob.state === 'offer') { b.textContent = 'SET SAIL!'; t.innerHTML = '<b>BATTLE READY!</b>'; }
    else { b.textContent = 'JOIN BATTLE'; t.innerHTML = HOLDER_ENABLED && holder.on ? '<span class="pvp-holder">HOLDER 2× GOLD</span>' : ''; } // [v98.1] no "THE HARBOR" pill (it blocked the view); the SOLO / SQUADS switch shows the mode
    t.hidden = !t.innerHTML;
    // [v103] BATTLE | WAVES tab: WAVES hides the battle controls and shows START WAVES (never while queued / offered a seat)
    if (lob.state !== 'harbor') harborTab = 'battle';
    const tb = $('pvp-tab'), wv = harborTab === 'waves';
    if (tb) { tb.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x.dataset.t === harborTab); x.setAttribute('aria-selected', x.dataset.t === harborTab); }); tb.classList.toggle('locked', lob.state !== 'harbor'); }
    h.classList.toggle('ph-waves', wv); const wb = $('pvp-waves'); if (wb) wb.hidden = !wv;
    if (wv) t.hidden = true;
    const ms = $('pvp-mode'); if (ms) { ms.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x.dataset.m === mode); x.setAttribute('aria-pressed', x.dataset.m === mode); }); ms.classList.toggle('locked', lob.state !== 'harbor'); } // [v98]
    const pp = $('pvp-party'); if (pp) { pp.hidden = !(mode === 'squads' || !!party.code); const mates = partyMates(); pp.classList.toggle('pp-idle', !party.code && !party.msg); // [v328] show while Harbor squad active (even on SOLO BR toggle)
      $('pvp-party-t').innerHTML = party.code ? `SQUAD <b>${party.code}</b> · ${mates.length ? `with ${mates.map(x => esc(x.n)).join(', ')} ✔` : esc(party.msg || 'share code or invite at Squad Hall')}` : esc(party.msg || 'No squad · Harbor co-op PvE (up to 16) or Arena 2v2');
      for (const id of ['pvp-party-new', 'pvp-party-join', 'pvp-party-code']) $(id).hidden = !!party.code; $('pvp-party-leave').hidden = !party.code; }
    if (where === 'harbor') hud(); // [v74] arena head-count + AI pay live under the minimap
    b.onclick = (e) => { e.stopPropagation(); lob.state === 'queue' ? leaveQueue() : lob.state === 'offer' ? acceptOffer() : joinBattle(); };
  }
  function showOffer(on) { $('pvp-offer')?.classList.toggle('hidden', !on); if (on) $('pvp-offer-t').textContent = Math.ceil(Math.max(0, (lob.offerUntil - performance.now()) / 1000)); }
  async function harborSpectate(harbor = false) { if (where !== 'harbor') return; if (lob.state === 'queue') K.banner('SPECTATING', 'you keep your queue place while you watch');
    spec.harbor = !!harbor && !!hbNet; hbLeave(); clearLocalAi(true); await specBegin(); } // [v99] harbor = watch the busiest shared harbor copy
  function specPick(show) { // [v99] the card's 👁: pick the arena (the mode on the switch) or the HARBOR; folds back after 5 s
    const pk = $('pvp-spec-pick'), b = $('pvp-harbor-spec'); if (!pk || !b) { harborSpectate(false); return; }
    if (!hbNet) { harborSpectate(false); return; }
    clearTimeout(specPick.t); pk.hidden = !show; b.hidden = !!show;
    if (show) { const a = pk.querySelector('[data-w="arena"]'); if (a) a.textContent = mode === 'squads' ? 'SQUADS' : 'SOLO'; specPick.t = setTimeout(() => specPick(false), 5000); }
  }

  // ---------------- SPECTATE ----------------
  const LS_BOARD = 'pfp_spec_board';
  // [v79] spectate follow zoom: starts wide and is kept across target switches (new kill leader, ◀ ▶, a tapped captain);
  // only OVERVIEW uses its own height. Wheel / pinch changes are remembered.
  const SPEC_WIDE_P = 150, SPEC_WIDE_L = 115;
  const skinIcons = new Map();
  const skinIcon = (id) => { if (!skinIcons.has(id)) { try { skinIcons.set(id, skinSwatch(pvpSkin(id), 30, 16).toDataURL()); } catch { skinIcons.set(id, ''); } realIcon(id); } return skinIcons.get(id); };
  // [v79] spectate list / follow card: the skin pickers' real ship render (base build), swapped in once ready; swatch until then
  let iconKill = 0, iconQ = Promise.resolve();
  function realIcon(id) { // one render at a time, spaced out, so the spectate view never hitches
    iconQ = iconQ.then(() => new Promise(res => setTimeout(() => { res(); doIcon(id); }, 250)));
  }
  function doIcon(id) {
    {
      try {
        const src = renderPreview(pvpSkin(id), {}, { pvp: true }); if (!src) return;
        const c = document.createElement('canvas'); c.width = 72; c.height = 40; c.getContext('2d').drawImage(src, 0, 0, 72, 40);
        skinIcons.set(id, c.toDataURL()); clearTimeout(iconKill); iconKill = setTimeout(releaseRenderer, 20000);
        if (spec.on) { specHud(); renderSpecBoard(); }
      } catch { /* keep the swatch */ }
    }
  }
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  function spectate(on = true) { spec.want = !!on; }
  async function specBegin() {
    spec.on = true; spec.mode = 'leader'; spec.target = null; spec.emptyT = 0; spec.camLock = 2; spec.dist = K.camera.aspect < 1 ? SPEC_WIDE_P : SPEC_WIDE_L; // [v79] start wide
    const pl = P(); me.dead = true; me.protect = 0; pl.alive = false; pl.hp = 0; pl.speed = 0; pl.mesh.visible = false; if (pl.shield) pl.shield.visible = false;
    spec.maxDist = K.controls.maxDistance; K.controls.maxDistance = 520; // [v82] one finger spins the view again (as before v69); two fingers pinch-zoom and drag to pan
    document.documentElement.classList.add('pvp-spec'); wireSpec();
    const open = lsGet(LS_BOARD); setBoard(open === null ? matchMedia('(min-width: 700px) and (min-height: 480px)').matches : open === '1', false);
    K.banner('SPECTATING', spec.harbor ? 'watching the busiest harbor · you are invisible to the pirates' : 'watching the arena · you are invisible to the pirates');
    await specJoin(1);
    if (!active || !spec.on) return;
    specHud(); renderSpecBoard();
  }
  async function specJoin(idx) { // receive-only join: listen, never announce a ship (the lobby checks the spectator budget)
    if (spec.harbor) return specJoinHarbor();
    room?.close(); room = null; clearPeers(); for (const pid of [...piles.keys()]) removePile(pid); isHost = false; hostId = null;
    const seat = await net.lobby('spec', lobbyOpts());
    if (!active || !spec.on) return;
    if (seat.state === 'full') { K.banner('SPECTATOR SEATS FULL', 'the free servers are at capacity, try again soon'); spec.emptyT = -30; return; }
    roomIdx = idx; let r;
    try { r = await net.openRoom(idx); } catch (e) { console.warn('[pvp spectate] join failed', e?.message); K.banner('ARENA OFFLINE', 'retrying…'); spec.emptyT = 15; return; }
    if (!active || !spec.on) { r.close(); return; }
    room = r; wire(r); where = 'spec'; sqReset(); r.send('hello', { i: myId }, { now: true }); // the host answers with the gold piles; we never send a state
  }
  async function specJoinHarbor() { // [v99] watch the busiest shared harbor copy (pirates + the host's AI ships); re-picked when it empties
    room?.close(); room = null; clearPeers(); clearLocalAi(true); isHost = false; hostId = null; hb.specEmptyT = 0;
    if (!hbNet) { K.banner('HARBOR OFFLINE', 'shared harbors are off right now'); spec.emptyT = -30; return; }
    await hbNet.call('leave', { seat: seatId });
    const r = await hbNet.call('spec', { seat: seatId, name, cap: HB_CAP });
    if (!active || !spec.on || !spec.harbor) return;
    hb.pirates = r?.pirates | 0;
    if (r?.state === 'full') { K.banner('SPECTATOR SEATS FULL', 'the free servers are at capacity, try again soon'); spec.emptyT = -30; return; }
    if (r?.state !== 'spec') { hb.specCopy = 0; spec.emptyT = 15; return; } // nobody in a shared harbor right now: look again in 15 s
    let link; try { link = await hbNet.openRoom(r.copy); } catch (e) { console.warn('[harbor spectate] join failed', e?.message); spec.emptyT = 15; return; }
    if (!active || !spec.on || !spec.harbor) { link.close(); return; }
    room = link; link.hbCopy = r.copy; roomIdx = r.copy; hb.specCopy = r.copy; hb.n = r.n | 0; hb.specBeatAt = performance.now(); wire(link); where = 'spec'; link.send('hello', { i: myId }, { now: true });
  }
  function hbSpecTick(dt, now) { // keep the spectator seat; an empty copy for 20 s -> watch the busiest one again
    if (!spec.harbor) return;
    bossBar();
    if (room && now - hb.specBeatAt > HARBOR_NET.beat * 1000) { hb.specBeatAt = now; hbNet?.call('spec', { seat: seatId, name, cap: HB_CAP }).then(r => { if (r?.state === 'spec') { hb.pirates = r.pirates | 0; hb.n = r.n | 0; } }); }
    if (room && !livePeers().length) { hb.specEmptyT += dt; if (hb.specEmptyT > 20) { hb.specEmptyT = 0; specJoinHarbor(); } } else hb.specEmptyT = 0;
  }
  function specToHarbor() { // EXIT / JOIN BATTLE from spectate: back to our harbor (the queue place, if any, is kept)
    if (!spec.on) return; room?.close(); room = null; clearPeers(); for (const pid of [...piles.keys()]) removePile(pid);
    const left = net.lobby('leave', lobbyOpts()).then(() => { if (lob.state === 'queue') return lobbyCall('play'); }).catch(() => {}); // (spec seat freed; a queued seat id re-queues at its place only if still alive)
    if (spec.harbor) { hbNet?.call('leave', { seat: seatId }); clearLocalAi(true); } // [v99] free the harbor spectator seat
    specOff(); where = 'harbor'; setBoostZone('harbor'); document.documentElement.classList.add('pvp-harbor'); respawnHarbor(); hb.beatAt = 0; harborUi();
    return left;
  }
  function specOff() {
    if (!spec.on) return;
    spec.on = false; spec.want = false; spec.target = null; spec.harbor = false; setHudOff(false);
    document.documentElement.classList.remove('pvp-spec');
    if (spec.touchOne != null) { K.controls.touches.ONE = spec.touchOne; spec.touchOne = null; } panHeld.clear();
    const pl = P(); pl.mesh.visible = true; if (spec.maxDist) K.controls.maxDistance = spec.maxDist; me.dead = false;
  }
  const specPlayers = () => livePeers().filter(p => p.ship && p.st).sort((a, b) => (b.k - a.k) || (a.d - b.d) || (b.K - a.K));
  function specFollow(id, mode = 'manual') { if ((spec.mode === 'overview') !== (mode === 'overview')) spec.camLock = 1.6; spec.target = id; spec.mode = mode; // [v79] a new target keeps the zoom; only OVERVIEW in/out eases the distance
    specHud(); renderSpecBoard(); }
  function specCycle(dir) {
    const list = specPlayers(); if (!list.length) return;
    const i = list.findIndex(p => p.id === spec.target), n = list[((i < 0 ? 0 : i + dir) % list.length + list.length) % list.length];
    specFollow(n.id, 'manual');
  }
  function specTick(dt, now) {
    lobbyTick(dt); if (isSq()) sqTick(now); hbSpecTick(dt, now);
    for (const [id, p] of peers) if (now - p.heard > PEER_TIMEOUT) { if (p.ship) dropShip(p.ship); peers.delete(id); }
    const list = specPlayers();
    // pick who to watch: the kill leader by default, else the chosen captain while they're in the room
    if (spec.mode === 'leader') { const lead = list[0]?.id || null; if (lead !== spec.target) spec.target = lead; } // [v79] a new kill leader keeps the viewer's zoom
    else if (spec.mode === 'manual' && !peers.has(spec.target)) { spec.mode = 'leader'; spec.target = list[0]?.id || null; }
    if (spec.mode === 'free') specPanStep(dt);
    const tgt = spec.mode === 'overview' || spec.mode === 'free' ? null : peers.get(spec.target)?.ship;
    const pl = P(), tx = spec.mode === 'free' ? spec.free.x : tgt ? tgt.x : 0, tz = spec.mode === 'free' ? spec.free.z : tgt ? tgt.z : 0;
    // smooth camera: the hidden rig glides to the target (long moves glide fast), the camera keeps its orbit offset
    const d = Math.hypot(tx - pl.x, tz - pl.z), k = spec.mode === 'free' ? 1 - Math.exp(-dt * 12) : 1 - Math.exp(-dt * (d > 120 ? 2.2 : 5));
    pl.x += (tx - pl.x) * k; pl.z += (tz - pl.z) * k;
    if (tgt) { pl.yaw += angWrap(tgt.yaw - pl.yaw) * Math.min(1, dt * 3); pl.speed = tgt.speed; } else pl.speed = 0;
    pl.alive = false; pl.mesh.visible = false;
    // after a camera change, ease the distance / height (then the viewer is free to orbit and zoom)
    K.controls.maxDistance = 520; // [v79] the ship-size / resize paths reset it to the sailing limit (120 / 95)
    if (spec.camLock > 0) {
      spec.camLock -= dt;
      const cam = K.camera, c = K.controls.target, off = cam.position.clone().sub(c), portrait = cam.aspect < 1;
      const want = spec.mode === 'overview' ? (portrait ? 430 : 330) : (spec.dist || (portrait ? SPEC_WIDE_P : SPEC_WIDE_L)), pitch = spec.mode === 'overview' ? 0.95 : 0.42;
      const len = off.length() || 1, flat = Math.hypot(off.x, off.z) || 1, kk = 1 - Math.exp(-dt * 3.5);
      const nl = len + (want - len) * kk, curP = Math.atan2(off.y, flat), np = curP + (pitch - curP) * kk;
      const hx = off.x / flat, hz = off.z / flat; cam.position.set(c.x + hx * Math.cos(np) * nl, c.y + Math.sin(np) * nl, c.z + hz * Math.cos(np) * nl);
    }
    else if (spec.mode !== 'overview') spec.dist = Math.max(20, Math.min(K.controls.maxDistance, K.camera.position.distanceTo(K.controls.target))); // [v79] remember the viewer's zoom
    // an empty room: look for an active one now and then (rooms fill from 1 up); the socket itself auto-reconnects
    if (!room) { spec.emptyT += dt; if (spec.emptyT > 30) { spec.emptyT = 0; specJoin(1); } } // reconnect / retry a full spectator budget
    hudT -= dt; if (hudT <= 0) { hudT = 0.5; specHud(); renderFeed(); renderSpecBoard(); }
  }
  // [spectate pan] free camera: WASD / arrows (desktop) or a two-finger drag (phones, v82) move the focus point over the arena,
  // relative to where the camera faces, clamped to the arena. Panning detaches from following; ◀ ▶ / a captain / KILL LEADER /
  // F re-attach. Pinch (two fingers) still zooms, the wheel zooms on desktop.
  const PAN_KEYS = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  const panHeld = new Set();
  function specDetach() { if (spec.mode === 'free') return; const pl = P(); spec.free = { x: pl.x, z: pl.z }; spec.mode = 'free'; spec.target = null; specHud(); renderSpecBoard(); }
  function specPanBy(f, r) { // f / r in metres along the camera's flat forward / right
    const cam = K.camera, c = K.controls.target; let fx = c.x - cam.position.x, fz = c.z - cam.position.z; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    let nx = spec.free.x + fx * f - fz * r, nz = spec.free.z + fz * f + fx * r;
    if (where === 'harbor' && SAIL_ALL) { [nx, nz] = clampSail(nx, nz); } else { const R = PVP_ARENA_R * 1.05, m = Math.hypot(nx, nz); if (m > R) { nx = nx / m * R; nz = nz / m * R; } }
    spec.free.x = nx; spec.free.z = nz;
  }
  function specPanStep(dt) {
    if (!panHeld.size) return; let f = 0, r = 0; for (const c of panHeld) { const v = PAN_KEYS[c]; r += v[0]; f += v[1]; }
    const sp = Math.max(40, K.camera.position.distanceTo(K.controls.target) * 1.1) * dt; if (f || r) specPanBy(f * sp, r * sp);
  }
  function specHud() {
    if (!spec.on) return;
    const list = specPlayers(), p = spec.mode === 'overview' ? null : peers.get(spec.target);
    const who = $('spec-name'), st = $('spec-stats'), ic = $('spec-skin');
    if (p) { who.textContent = p.name; const TK = p.bK ?? p.K ?? 0, TD = p.bD ?? p.D ?? 0; st.textContent = `${skinName(p.sk)}${isSq() && sqTeam(p.id) ? ` · ${sqTeam(p.id) === 'A' ? 'BLUE' : 'RED'} TEAM` : ''} · ${TK} kills · ${TD} deaths · K/D ${kd(TK, TD)} (all-time) · this battle ${p.k | 0}/${p.d | 0}${p.bt ? ` · ☠ ${formatGoldAmount(p.bt)}g bounty` : ''}`; ic.style.backgroundImage = `url(${skinIcon(p.sk)})`; ic.hidden = false; }
    else { who.textContent = spec.mode === 'overview' ? 'BATTLEFIELD OVERVIEW' : spec.mode === 'free' ? 'FREE CAMERA' : 'WAITING FOR PIRATES…'; st.textContent = list.length ? 'tap a captain or ◀ ▶ to follow' : 'nobody is fighting in this room right now';
      // [v79] nobody to follow: the ship box cycles through the skins (same real renders as the skins pickers) instead of sitting empty
      const t = TIERS[Math.floor(performance.now() / 2200) % TIERS.length]; ic.style.backgroundImage = `url(${skinIcon(t.id)})`; ic.title = t.name; ic.hidden = false; }
    $('spec-mode').textContent = spec.mode === 'leader' ? 'FOLLOWING THE KILL LEADER' : spec.mode === 'overview' ? 'OVERVIEW' : spec.mode === 'free' ? 'FREE CAMERA' : 'FOLLOWING';
    $('spec-room').textContent = spec.harbor ? `HARBOR${hb.specCopy > 1 ? ` ${hb.specCopy}` : ''} · ${list.length} ${list.length === 1 ? 'PIRATE' : 'PIRATES'} · PvE${room?.open ? '' : room ? ' · reconnecting…' : ' · looking for pirates…'}` : `${isSq() ? `SQUADS · ${sq.ph === 'live' ? `ROUND ${sq.r}` : sq.ph === 'end' ? 'ROUND OVER' : 'WAITING'} · ` : ''}ARENA · ${list.length} ${list.length === 1 ? 'PIRATE' : 'PIRATES'}${lob.queue ? ` · ${lob.queue} QUEUED` : ''}${room?.open ? '' : ' · reconnecting…'}`;
    $('spec-leader').classList.toggle('on', spec.mode === 'leader'); $('spec-overview').classList.toggle('on', spec.mode === 'overview');
  }
  function renderSpecBoard() {
    if (!spec.on) return; const t = $('spec-table'); if (!t) return;
    const list = specPlayers();
    // ALL-TIME kills / deaths / K/D (each captain's saved stats) + a live hull bar (BANKSY)
    const hpPct = (p) => { const s = p.ship, h = s ? s.hp : p.st?.h, m = s ? s.maxHp : p.st?.m; return m ? Math.max(0, Math.min(100, Math.round(h / m * 20) * 5)) : 0; };
    const html = `<tr><th></th><th>CAPTAIN</th><th title="all-time kills">K</th><th title="all-time deaths">D</th><th title="all-time K/D">K/D</th><th title="streak bounty">☠</th></tr>` + (list.length ? list.map((p, i) => { const hp = hpPct(p);
      return `<tr data-id="${escHtml(p.id)}" class="${p.id === spec.target && spec.mode !== 'overview' ? 'on' : ''}${isSq() && sqTeam(p.id) ? ` t${sqTeam(p.id)}` : ''}"><td>${i + 1}</td><td><i class="sb-skin" style="background-image:url(${skinIcon(p.sk)})"></i><span class="sb-name">${esc(p.name)}</span><i class="sb-hp${hp <= 30 ? ' low' : ''}" title="hull ${hp}%"><b style="width:${hp}%"></b></i></td><td>${(p.bK ?? p.K) | 0}</td><td>${(p.bD ?? p.D) | 0}</td><td>${kd((p.bK ?? p.K) | 0, (p.bD ?? p.D) | 0)}</td><td class="sb-bounty">${p.bt ? p.bt : ''}</td></tr>`; }).join('')
      : `<tr><td colspan="6" class="muted">No captains in this room yet</td></tr>`);
    if (t._html !== html) { t._html = html; t.innerHTML = html; } // only touch the DOM when something changed
  }
  function setBoard(open, remember = true) { $('spec-board')?.classList.toggle('open', open); $('spec-board-tab')?.setAttribute('aria-expanded', open); if (remember) lsSet(LS_BOARD, open ? '1' : '0'); }
  function setHudOff(off) {
    spec.hudOff = off; document.documentElement.classList.toggle('hud-off', off);
    if (off) K.banner('HUD HIDDEN', 'tap 👁 SHOW HUD (top right), press H or double-tap to bring it back');
  }
  function wireSpec() {
    if (spec.wired) return; spec.wired = true;
    const tap = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); };
    tap('spec-prev', () => specCycle(-1)); tap('spec-next', () => specCycle(1));
    tap('spec-leader', () => specFollow(null, 'leader')); tap('spec-overview', () => specFollow(spec.target, spec.mode === 'overview' ? 'leader' : 'overview'));
    tap('spec-hide', () => setHudOff(true)); tap('spec-showhud', () => setHudOff(false));
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) $('spec-showhud')?.addEventListener(ev, e => e.stopPropagation()); tap('spec-exit', () => specToHarbor()); tap('spec-join', async () => { await specToHarbor(); joinBattle(); });
    tap('spec-board-tab', () => setBoard(!$('spec-board').classList.contains('open')));
    $('spec-table').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) { e.stopPropagation(); specFollow(tr.dataset.id, 'manual'); } });
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) for (const id of ['spec-hud', 'spec-board']) $(id).addEventListener(ev, e => e.stopPropagation());
    addEventListener('keydown', (e) => {
      if (!spec.on || e.target.tagName === 'INPUT') return;
      if (e.code === 'KeyH') setHudOff(!spec.hudOff);
      else if (e.code === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); setBoard(!$('spec-board').classList.contains('open')); }
      else if (PAN_KEYS[e.code]) { e.preventDefault(); e.stopImmediatePropagation(); specDetach(); panHeld.add(e.code); }
      else if (e.code === 'KeyQ' || e.code === 'Comma') specCycle(-1);
      else if (e.code === 'KeyE' || e.code === 'Period') specCycle(1);
      else if (e.code === 'KeyF') { const l = specPlayers(); specFollow(spec.target && peers.has(spec.target) ? spec.target : l[0]?.id || null, spec.target ? 'manual' : 'leader'); }
      else if (e.code === 'KeyO') specFollow(spec.target, spec.mode === 'overview' ? 'leader' : 'overview');
      else if (e.code === 'KeyL') specFollow(null, 'leader');
    }, true);
    addEventListener('keyup', (e) => { panHeld.delete(e.code); }, true);
    addEventListener('blur', () => panHeld.clear());
    { // phones: [v82] one finger spins (OrbitControls, as before v69); a two-finger drag pans, pinch zooms
      const cv = K.controls.domElement; let last = null;
      const mid = (e) => ({ x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 });
      cv.addEventListener('touchstart', (e) => { if (!spec.on) return; last = e.touches.length === 2 ? mid(e) : null; }, { passive: true });
      cv.addEventListener('touchmove', (e) => {
        if (!spec.on || e.touches.length !== 2) { last = null; return; }
        const t = mid(e); if (!last) { last = t; return; } const dx = t.x - last.x, dy = t.y - last.y; last = t;
        if (Math.abs(dx) + Math.abs(dy) < 0.5) return; specDetach();
        const k = K.camera.position.distanceTo(K.controls.target) * 1.6 / Math.max(320, innerHeight); specPanBy(dy * k, -dx * k);
      }, { passive: true });
      cv.addEventListener('touchend', (e) => { last = e.touches.length === 2 ? mid(e) : null; }, { passive: true });
    }
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
    where = 'harbor'; setBoostZone('harbor'); Object.assign(lob, { state: 'harbor', pos: 0, offerUntil: 0, lastPoll: 0, queuedByDeath: false }); me.lastInput = performance.now();
    if (spec.want) { const sm = ls0('pfp_spec_mode'); spec.harbor = sm === 'harbor' && !!hbNet; setNet(sm === 'squads' ? 'squads' : 'solo'); return specBegin(); } // [v98] the home switch picks the arena to watch; [v99] or the HARBOR
    document.documentElement.classList.add('pvp-harbor');
    respawnHarbor(); hud(); harborUi(); lobbyCall('poll').then(harborUi); refreshRank(true);
    const en = $('pvp-entry'); if (en) { $('pvp-entry-name').value = getSavedName(); $('pvp-entry-name').placeholder = capNo() ? `CAPT. #${capNo()}` : name; const a = $('pvp-entry-addr'); if (a) { a.value = getSavedWallet(); addrCheck(); } en.classList.remove('hidden'); }
  }
  // quit-to-dodge / AFK in a fight: leaving the arena within 10 s of taking PvP damage counts as a death (gold drops for the others)
  function combatLog(unloading) {
    const pl = P(), by = me.lastBy && !String(me.lastBy).startsWith('b') ? me.lastBy : null; if (!by) return; // AI damage never counts
    const carried = brLoss(game.gold), bounty = me.bounty; kdT.death('ship', `me:${me.life}`); me.deaths++; game.gold = Math.max(0, (game.gold | 0) - carried); resetBounty(); // [br-death] flat loss here too
    room?.send('sunk', { v: myId, by, l: me.life, x: r1(pl.x), z: r1(pl.z), g: carried, b: bounty }, { now: true });
    if (peers.has(by)) boardClaim('v', by, myId, me.life, unloading);
    if (isHost) spawnPile(myId, pl.x, pl.z, carried + PVP_DEATH_BONUS + bounty, false, PVP_DEATH_BONUS);
    me.life++; K.updateHud();
  }
  function leave(unloading = false) {
    if (!active) return;
    if (!unloading) partyLeave(); sqReset(); sqVis();
    if (spec.on) { net.lobby('leave', lobbyOpts({ keepalive: true })); if (spec.harbor) hbNet?.call('leave', { seat: seatId, keepalive: true }); specOff(); if (unloading) return; active = false; harborUi(); document.documentElement.classList.remove('pvp'); room?.close(); room = null; clearPeers(); for (const pid of [...piles.keys()]) removePile(pid); isHost = false; hostId = null; return; }
    const pl = P();
    if (where === 'arena' && !me.dead && pl.alive && inCombat()) combatLog(unloading); // closing / reloading within 10 s of combat = a death
    if (where === 'harbor') hbLeave(true); // [v99] free the harbor copy seat; the socket says bye
    save({ now: true, keepalive: unloading, force: true });
    room?.send('bye', { i: myId }, { now: true });
    net.lobby('leave', lobbyOpts({ keepalive: true })); // free the arena seat / queue place for the next pirate
    if (unloading) return; // the page is going away; the socket closes with it
    active = false; document.documentElement.classList.remove('pvp'); $('cap-prest')?.remove(); // [prestige] Battle Royale only
    room?.close(); room = null; clearPeers();
    for (const pid of [...piles.keys()]) removePile(pid);
    isHost = false; hostId = null; showDead(false); toggleMenu(false); clearLocalAi(true); where = 'harbor'; setBoostZone('harbor'); showOffer(false);
    document.documentElement.classList.remove('pvp-harbor'); harborUi(); $('pvp-entry')?.classList.add('hidden'); $('pvp-afk')?.classList.add('hidden');
    if (P().shield) P().shield.visible = false;
    const lab = document.querySelectorAll('#hud-top .label'); if (lab.length >= 3) { lab[0].textContent = 'SCORE'; lab[1].textContent = 'WAVE'; lab[2].textContent = 'SUNK'; }
  }

  const api = { gunAimCyls, gunShipTest, gunShipHit, shoreImpact, shoreBattery, shoreTarget, flushNow, serverGold, emote, myId, rankTxt, refreshRank, showRank, prepare, applyProfile, begin, leave, update, updateRemote, botTarget, botSteer, ballStep, batteryStep, onFire, onLocalFire, onLocalSunk, onBotSunk, lootStep, hud, skinObj,
    get active() { return active; }, get isHost() { return isHost; }, get hostId() { return hostId; }, get room() { return room; }, get roomIdx() { return roomIdx; }, spectate, get specHarbor() { return !!(spec.on && spec.harbor); }, get spectating() { return spec.on; }, get spec() { return spec; }, specFollow, specCycle, setBoard, setHudOff, get lastClaim() { return lastClaim; },
    get gold() { return active ? game.gold : profile.gold; }, get profile() { return profile; }, get me() { return me; }, peers, bots, piles, get name() { return name; }, set name(v) { setName(v); }, pickSkin, renderMenu, toggleMenu,
    get where() { return where; }, lob, get net() { return net; }, get mode() { return mode; }, setMode, partyJoin, partyLeave, partyMake, partyInfo, joinWorld, joinFriend, sq, party, get skinId() { return skinId(); }, holder, refreshHolder, holderUi, claimHolderGold, joinBattle, acceptOffer, declineOffer, leaveQueue, harborSpectate, idleMs, maps, inv,
    requestReturn, get returning() { return me.ret; }, hb, hunter, get hbShared() { return where === 'harbor' && !!room; }, HB_PREFIX,
    // [v339] harbor session auto-resume (js/main.js pfp_harbor_resume_v1): which server you were on, and put you back on it after a phone reload
    harborInfo: () => ({ prefix: hbNet?.prefix || '', copy: hb.copy | 0, code: codeOfPrefix(hbNet?.prefix) || '', label: hbNet ? serverLabel({ prefix: hbNet.prefix, copy: hb.copy }) : 'HARBOR' }),
    resumeServer: (r) => { if (!hbNet || !r) return null; const curCode = codeOfPrefix(hbNet.prefix) || '';
      if (r.code && r.code !== curCode) return switchServer(planSwitch('own', r.code));
      if (!r.code && (r.copy | 0) > 0 && (r.copy | 0) !== (hb.copy | 0)) return switchServer(planSwitch('pick', r.copy | 0));
      return null; },
    serverPicker, switchServer, groundKd, kdT, lifeK: () => lifeK(), lifeD: () => lifeD(), HB_PVP_ON, shipProtectedHarbor: (s) => shipProtectedHarbor(s), harborPvpCanHit: (a, b) => harborPvpCanHit(a, b), isSquadMate: (id) => isSquadMate(id), isHarborSquadMate: (p) => isHarborSquadMate(p), isHbSquadPeer: (p) => isHbSquadPeer(p), partyMates, unmannedLocal: () => unmannedLocal(), lootNet: (msg) => lootNet(msg),
    _test: { SPAWNS_COAST, SPAWNS_ISLAND, pickBossSpawn, coastOk: coastSeaOk, islandOk: islandSeaOk, spawnBoss, boss, P, onShot, onState, onEmote, skin: (id) => { profile.skins.equipped = id; return (K.rebuildShipSkin || K.rebuildShip)(getRunLevels()); }, skinWarm: (id) => K.prebuildSkin?.(getRunLevels(), pvpSkin(id)), damage: (...a) => K.damage(...a), spawnPile, grant, pickSpawn, localDamage, MAX_HIT, SPAWNS, afkKick, seatId, applyHit, hbTick, syncBots, aiRows, electHost, isHbSquadPeer, hbPaint, hbRepaintAll, copyLevel, sqHost, sqTeam, makeTeams, SQ_PREFIX, setNet } };
  api.publicApi = Object.freeze({ playerNames: () => (where === 'harbor' ? livePeers().map(p => p.name).filter(Boolean) : []) /* [v370] WANTED board dropdown */, serverPicker, groundKd, lootNet: (msg) => lootNet(msg), isSquadMate: (id) => isSquadMate(id), isHarborSquadMate: (p) => isHarborSquadMate(p), isHbSquadPeer: (p) => isHbSquadPeer(p), partyInfo, get kd() { return { kills: lifeK(), deaths: lifeD() }; }, renderMenu: (...a) => renderMenu(...a), get profile() { return profile ? structuredClone(profile) : profile; } }); // [security L] what other modules read on the live game
  api.playerNames = api.publicApi.playerNames;
  window.PFP_PVP = DEV ? api : api.publicApi;
  return api;
}
