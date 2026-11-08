import { createPumpfun } from './pumpfun.js';
import { setParrotWorld } from '../parrotFlight.js';
// [Emerly] PUMPFUN PIRATES docking + on-foot controller (harbor only; Waves, the arena and spectate never load or run it).
// Layout-driven (js/dock/layout.js): berths, SAFE HARBOR zone, decks, interact points, ship colliders, walkable land.
// main.js talks to it through a handful of one-line hooks (see EMERLY-HOOKS in the report): ship(dt), camera(dt), focus(),
// canFire(s), invuln(s), isSafe(s), aiSteer(e, desired), and pvp.js (harbor room) through netState() / onPeerState(m).
import * as THREE from 'three';
import { coastLayout } from './layout.js';
import { FLAG_DAILY } from '../config.js'; // [castle-flag-daily]
import { buildWorld, colliderSets } from './world.js';
import { loadTownKit, loadNatureKit } from '../island/townkit.js'; // [v330 perf] early kit downloads
import { createSafeZone } from './safe.js';
import { createDocking } from './docking.js';
import { createWalker } from '../onfoot/walker.js';
import { getLocalGear, gearToWire } from '../pirateGear.js';
import { loadPirate } from '../onfoot/pirate.js';
import { createFootNet } from '../onfoot/net.js';
import { createBerthSigns } from './berthSigns.js'; // [berth-signs] captain name over each occupied berth
import { locatePoint } from '../islandGeography.js'; // [map-streets] HUD callout
import { showEmote } from '../emotes.js'; // [Raul emotes] the 2-tab test channel's bubbles
import { createFollowers } from '../onfoot/followers.js'; // [v106] 3 crew follow you ashore (2 on Low)
import { createPetFollower } from '../onfoot/pets.js'; import { createPilly, createPillyState } from '../onfoot/pilly.js'; // [Pilly] companion slot
// // [Raul items redo 2] your cat / monkey / chimp / gorilla follows you ashore
import { binds, keyName, isKey, anyModalOpen } from '../keybinds.js';
import { createIslandMap } from '../islandMap.js';
import { createTreasure } from './treasure.js'; // [v122] treasure maps: MAPS list, radar dig area, server digs
import { createInventory } from '../inventory/ui.js'; // [inventory] the INVENTORY grid + plaza shop panels (migration 036)
import { createPlaza } from './plaza.js'; // [v103] live leaderboards + token billboards on the harbor plaza
import { createBattery } from './battery.js'; // [Timothy] headland battery: playable cosmetic guns
import { CONSOLE, PAD, padActive, padGlyph, promptKey, onPadMode, registerPadDock, padRumble } from '../gamepad.js'; // [Emerly gamepad] pad prompts + the walker / prompt hooks
import { createSkinPicker } from './skinPicker.js'; // [dock-skin] Q / CHANGE SKIN at your own berth
import { casinoInteract } from '../island/casinoData.js'; // [Timothy] THE GOLDEN DOUBLOON CASINO tables → js/casino/ui.js
import { createFriends, myAt, joinPlan, whereLabel } from '../friends.js'; // [v356 friends] BANKSY t1851u: friends list + join their server
import { createSquadHall } from './squadHall.js'; // [squad-hall] BANKSY: all-worlds list + invite / join
import { createZipline } from './zipline.js'; // [Emerly zipline] Waterfall Hill -> Skull Peak (&zipline=0 = none)
import { createCanoe, SAIL_ALL } from './canoe.js'; // [Emerly sail-around] offshore anchor + canoe + ship recall (&sailall=0)
import { createHouses, HOUSES_ON } from './houses.js'; // [Emerly storage-houses] buyable cottages + instanced storage (&houses=0)
import { ADM } from '../adminState.js'; // [admin-menu] frozen = no interact
import { boardReach } from '../hullReach.js'; // [board-anywhere] BOARD SHIP from anywhere round your docked hull
import { createShipHull, SHIP_QUARTERS_ID, HULL_COMBAT_LOCK_S } from './shipHull.js'; // [v333] Captain's Quarters ENTER HULL
import { createLadders, LADDERS_ON } from './ladders.js'; // [dock-ladders] swim back up the jetty / boardwalk / cove / lagoon ladders (&ladders=0 = off)
import { LAGOON_LADDER, LAGOON_DOCK, lagoonDockY } from '../island/areas/lagoon.js';
import { createBattle } from '../onfoot/battle.js'; // [Timothy] battle areas: SWORD PIT + MUSKET RANGE (cosmetic, no rewards)
import { createLootBags } from './lootBags.js'; // [backpack-pvp] PvP plunder bags
import { buildSafeZoneMarks } from './safeZoneMarks.js'; // [backpack-pvp] sanctuary lanterns
import { tickIsleSafe, graceLeft, SAFEZONES_ON, SAFE_GRACE_S, insideSafeZoneH, zoneAtH, isInsideColiseumH } from '../island/safeZones.js'; // [backpack-pvp]
import { createCrewFight } from '../onfoot/crewFight.js'; // [backpack-pvp] t1706u crew mirror your attack on THEIR crew
import { ownerAllSkins, shopCache, accountInfo } from '../pvpSave.js'; // [backpack-pvp] BANKSY unlimited

const CSS = `
#dk-safe{position:fixed;left:50%;top:calc(var(--safe-t,0px) + 54px);transform:translateX(-50%);z-index:7;pointer-events:none;font:22px 'Just Another Hand',cursive;letter-spacing:.06em;color:#7cff6b;background:rgba(22,22,22,.72);border:2px solid #7cff6b;border-radius:999px;padding:2px 14px 0;white-space:nowrap;display:none}
#dk-safe.grace{color:#ffcd77;border-color:#ffcd77}
#dk-islesafe{position:fixed;left:50%;top:calc(var(--safe-t,0px) + 54px);transform:translateX(-50%);z-index:7;pointer-events:none;font:22px 'Just Another Hand',cursive;letter-spacing:.06em;color:#34d399;background:rgba(22,22,22,.72);border:2px solid #34d399;border-radius:999px;padding:2px 14px 0;white-space:nowrap;display:none}
#dk-islesafe.grace{color:#ffcd77;border-color:#ffcd77}
#dk-islesafe:not(.grace){display:none!important} /* [v340] BANKSY t1805u: SAFE ZONE text pill never shows (NO FIRING grace countdown still does) */
@media (max-width:600px){#dk-islesafe{top:calc(var(--safe-t,0px) + 112px);font-size:18px}}
#dk-acts{position:fixed;left:50%;bottom:calc(var(--safe-b,0px) + 168px);transform:translateX(-50%);z-index:8;display:none;gap:10px;align-items:center;pointer-events:none}
#dk-acts button[hidden]{display:none!important}
#dk-acts button{pointer-events:auto;font:26px 'Just Another Hand',cursive;letter-spacing:.05em;line-height:1;padding:10px 20px 7px;border-radius:14px;border:3px solid #ffcd77;background:rgba(22,22,22,.86);color:#ffcd77;cursor:pointer;white-space:nowrap;touch-action:none}
#dk-acts button.primary{background:#fa0d0d;color:#fff;border-color:#ffcd77}
#dk-acts button[disabled]{opacity:.75;background:rgba(22,22,22,.86);color:#ddd;border-color:#888}
#dk-acts kbd{font:16px system-ui,sans-serif;background:#ffcd77;color:#161616;border-radius:5px;padding:1px 6px;margin-right:8px;vertical-align:3px}
html.dk-touch #dk-acts kbd{display:none}
html.pfp-onfoot #controls,html.pfp-onfoot #hint,html.pfp-onfoot #pvp-harbor:not(.hb-modal-open),html.pfp-onfoot .ehp,html.pfp-onfoot #pvp-boss-bar,html.pfp-canoe #controls,html.pfp-canoe #hint,html.pfp-canoe #pvp-harbor:not(.hb-modal-open),html.pfp-canoe #pvp-menu{display:none!important}
html.pfp-onfoot.dk-board #pvp-harbor{display:flex!important}
#dk-board-x{position:fixed;right:14px;top:calc(var(--safe-t,0px) + 54px);z-index:9;display:none;font:22px 'Just Another Hand',cursive;padding:6px 14px 3px;border-radius:12px;border:2px solid #ffcd77;background:rgba(22,22,22,.86);color:#ffcd77}
html.dk-board #dk-board-x{display:block}
#dk-joy{position:fixed;left:calc(var(--safe-l,0px) + 22px);bottom:calc(var(--safe-b,0px) + 22px);width:132px;height:132px;border-radius:50%;background:rgba(22,22,22,.35);border:3px solid rgba(255,205,119,.65);z-index:8;display:none;touch-action:none}
#dk-joy i{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:rgba(255,205,119,.9);box-shadow:0 2px 6px #000}
html.pfp-onfoot.dk-touch #dk-joy,html.pfp-canoe.dk-touch #dk-joy{display:block}
#dk-jump{position:fixed;left:calc(var(--safe-l,0px) + 168px);bottom:calc(var(--safe-b,0px) + 26px);width:70px;height:70px;border-radius:50%;display:none;z-index:8;font:24px 'Just Another Hand',cursive;color:#161616;background:rgba(255,205,119,.92);border:3px solid #161616;box-shadow:0 3px 8px rgba(0,0,0,.5);touch-action:none;padding:4px 0 0}
#dk-jump:active{transform:scale(.92)}
html.pfp-onfoot.dk-touch #dk-jump{display:block}
html.dk-touch.pfp-onfoot #dk-acts,html.dk-touch.pfp-canoe #dk-acts{left:auto;right:calc(var(--safe-r,0px) + 22px);bottom:calc(var(--safe-b,0px) + 40px);transform:none;flex-direction:column;align-items:flex-end}
html.dk-touch.pfp-onfoot #dk-acts button,html.dk-touch.pfp-canoe #dk-acts button{font-size:24px;padding:14px 18px 10px}
html.dk-touch.pfp-onfoot #dk-acts,html.dk-touch.pfp-canoe #dk-acts{max-width:calc(100vw - var(--safe-l,0px) - var(--safe-r,0px) - 24px)} html.dk-touch.pfp-onfoot #dk-acts button,html.dk-touch.pfp-canoe #dk-acts button{white-space:normal;text-align:center;max-width:100%} /* [v166] long shop labels wrap instead of running under the stick */
#dk-fade{position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:30;transition:opacity .28s}
#dk-toast{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:70;pointer-events:none;font:30px 'Just Another Hand',cursive;color:#fff;text-shadow:0 2px 4px #000;opacity:0;transition:opacity .3s;text-align:center}
@media (max-height:480px){#dk-acts{bottom:calc(var(--safe-b,0px) + 104px)} #dk-acts button{font-size:22px;padding:8px 14px 5px} #dk-safe{top:calc(var(--safe-t,0px) + 46px);font-size:18px}}
@media (max-width:600px){#dk-acts{bottom:calc(var(--safe-b,0px) + 200px);flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 16px)} /* [v340] 3 aboard buttons wrap instead of running off a 390px screen */ #dk-safe{top:calc(var(--safe-t,0px) + 112px);font-size:18px}}
/* [v340] mobile on-foot HUD (v339 QA t1793u-t1795u): BOARD SHIP / CHANGE SKIN never over the radar, INVENTORY, the weapon switch or the top icons */
@media (orientation:landscape) and (max-height:540px){html.dk-touch.pfp-onfoot #dk-acts,html.dk-touch.pfp-canoe #dk-acts{flex-direction:row;align-items:flex-end;right:calc(var(--safe-r,0px) + 74px);bottom:calc(var(--safe-b,0px) + 14px);max-width:calc(100vw - var(--safe-l,0px) - var(--safe-r,0px) - 330px);flex-wrap:wrap-reverse;justify-content:flex-end}
  html.dk-touch.pfp-onfoot #dk-acts button,html.dk-touch.pfp-canoe #dk-acts button{font-size:19px;padding:8px 13px 5px}}
@media (orientation:portrait) and (max-width:600px){html.dk-touch.pfp-onfoot #dk-acts button,html.dk-touch.pfp-canoe #dk-acts button{font-size:20px;padding:10px 14px 7px}}
/* [v340] BANKSY t1806u: on foot (touch) JUMP + weapon switch + 💬 emote share ONE bottom row beside the stick */
html.pfp-onfoot.dk-touch #bt-stance{left:calc(var(--safe-l,0px) + 248px)!important;right:auto!important;top:auto!important;bottom:calc(var(--safe-b,0px) + 36px)!important;width:50px!important;height:50px!important;font-size:22px}
html.pfp-onfoot.dk-touch #btn-emote{position:fixed!important;left:calc(var(--safe-l,0px) + 308px)!important;right:auto!important;top:auto!important;bottom:calc(var(--safe-b,0px) + 36px)!important;width:50px!important;height:50px!important;font-size:22px!important}
html.pfp-onfoot.dk-touch:not(.tps-on) #bt-atk{right:calc(var(--safe-r,0px) + 18px);bottom:calc(var(--safe-b,0px) + 98px)}
html.pfp-onfoot.dk-touch.tps-on #bt-atk{bottom:calc(var(--safe-b,0px) + 100px)!important} html.pfp-onfoot.dk-touch.tps-on #tps-ads{bottom:calc(var(--safe-b,0px) + 110px)!important} html.pfp-onfoot.dk-touch.tps-on #tps-sw{bottom:calc(var(--safe-b,0px) + 210px)!important} /* [v340] musket aim cluster sits above the JUMP / weapon / emote row */
@media (max-width:380px){html.pfp-onfoot.dk-touch #dk-joy{left:calc(var(--safe-l,0px) + 14px);width:120px;height:120px}
  html.pfp-onfoot.dk-touch #dk-jump{left:calc(var(--safe-l,0px) + 144px);width:62px;height:62px}
  html.pfp-onfoot.dk-touch #bt-stance{left:calc(var(--safe-l,0px) + 214px)!important;width:46px!important;height:46px!important}
  html.pfp-onfoot.dk-touch #btn-emote{left:calc(var(--safe-l,0px) + 268px)!important;width:46px!important;height:46px!important}}

/* [v350] compact action row; placeActs still collision-checks touch foot prompts. */
#dk-acts { flex-direction:row; flex-wrap:wrap; justify-content:center; gap:6px; bottom:calc(52px + var(--safe-b,0px)); max-width:calc(100vw - 24px); width:max-content; }
html.dk-touch #dk-acts { bottom:calc(168px + var(--safe-b,0px)); }
html.dk-moored #dk-acts, html.pfp-onfoot #dk-acts, html.pfp-canoe #dk-acts, html.pfp-inhull #dk-acts { bottom:calc(16px + var(--safe-b,0px)); }
html.dk-touch.pfp-onfoot #dk-acts, html.dk-touch.pfp-canoe #dk-acts { flex-direction:row; flex-wrap:wrap; justify-content:center; align-items:center; bottom:calc(176px + var(--safe-b,0px)); }
html #dk-acts button, html.dk-touch.pfp-onfoot #dk-acts button, html.dk-touch.pfp-canoe #dk-acts button { font-size:18px; line-height:1; padding:4px 11px 3px; border:1.5px solid rgba(255,205,119,.65); border-radius:999px; background:rgba(22,22,22,.78); backdrop-filter:blur(6px); }
html #dk-acts button.primary { background:rgba(92,60,19,.88); color:#ffdf9e; border-color:#ffcd77; }
html #dk-acts kbd { font-size:13px; padding:1px 6px; margin-right:5px; vertical-align:1px; }
html.pfp-console #dk-acts button { font-size:22px; padding:5px 13px 4px; }
html.pfp-console #dk-acts kbd { font-size:14px; }
html.pfp-pad #dk-acts, html.pfp-console #dk-acts { bottom:calc(52px + var(--safe-b,0px)); }
html.pfp-pad.pfp-onfoot #dk-acts, html.pfp-pad.dk-moored #dk-acts, html.pfp-console.pfp-onfoot #dk-acts, html.pfp-console.dk-moored #dk-acts { bottom:calc(16px + var(--safe-b,0px)); }
`;

export async function createDock(ctx) {
  const { scene, camera, controls, renderer, ocean, islands, game, quality, canvas } = ctx;
  const LOW = quality === 'low', $ = (id) => document.getElementById(id);
  const touch = !CONSOLE && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window); // [Emerly gamepad] consoles: no touch stick / JUMP (the pad walks)
  // [v330 perf] start the island art downloads (town + nature kits) before coastLayout imports / builds the island heightmap; world.js awaits the same promises
  if (!/[?&]parworld=0(&|$)/.test(location.search)) { loadTownKit(LOW, renderer).catch(() => {}); if (new URLSearchParams(location.search).get('nature') !== '0') loadNatureKit(LOW, renderer).catch(() => {}); }
  // [v330 perf] your on-foot pirate (V6 body GLB, ~0.8-1.6 MB) used to start downloading only after the whole island was built: start it now, alongside the island art
  const pirate0 = loadPirate({ look: ctx.look?.() || { skin: 0, hair: 0 }, low: LOW, gear: getLocalGear(), local: true }); pirate0.object.visible = false; scene.add(pirate0.object); // [Timothy] + your shop gear
  const layout = await coastLayout();
  const uTime = { value: 0 };
  const world = await buildWorld({ layout, scene, quality, ocean, renderer, uTime });
  setParrotWorld(world);
  const zone = createSafeZone(layout.safe, layout.graceS);
  const myId = () => ctx.pvp()?.myId || 'me';
  const skinPick = createSkinPicker({ current: () => ctx.pvp()?.profile?.skins?.equipped || 'classic' }); // [dock-skin]
  const docking = createDocking({ berths: layout.berths, myId }); // [v152] a getter: the room id can arrive later
  const pirate = pirate0; // [v330 perf] created (and its V6 GLB download started) before the island build, see above
  const walker = createWalker({ camera, canvas, world, pirate, touch, low: LOW });
  import('../island/terrainEdit.js').then(m => m.initTerrainEdit({ scene, camera, canvas, footRoot: world.foot.root, walker, touch, toast: (t) => toast(t) })).then(te => { api.terrain = te; }).catch(e => console.warn('[terrain-edit]', e)); // [terrain-edit] everyone: saved deltas; owner: BUILD mode
  // [v102] your equipped pirate gear (js/pvp.js 'pfp-gear'): drawn by window.applyPirateGear (Timothy's gear meshes; a no-op until then)
  // [v105] setLocalGear (js/pirateGear.js) re-dresses the local pirate itself (loadPirate local: true)
  const fnet = createFootNet({ scene, low: LOW, world, docking, getCamera: () => camera });
  const signs = createBerthSigns({ scene, berths: layout.berths, low: LOW }), peerNames = new Map(); // [berth-signs] peer id -> last synced name
  // [v335] BANKSY t1785u: the 3D street signs are removed (the 8 junction posts are gone)
  const crewF = new URLSearchParams(location.search).get('followers') === '0' ? null : createFollowers({ scene, world, walker, low: LOW, keepOut: (x, z, i) => battle?.keepOut?.(x, z, i) }); // [Emerly] the crew wait outside the SWORD PIT / MUSKET RANGE
  const zip = createZipline({ scene, world, layout, walker, pirate, crew: crewF, toast: (m, ms) => toast(m, ms), low: LOW }); // [Emerly zipline-v2] pirate grip + crew train
  const petF = new URLSearchParams(location.search).get('pets') === '0' ? null : createPetFollower({ scene, world, low: LOW, keepOut: (x, z, i) => battle?.keepOut?.(x, z, i) }); // [Raul items redo 2] ?pets=0 = the pet stays by your boots
  const pillyF = new URLSearchParams(location.search).get('pilly') === '0' ? null : createPilly({ scene, world, low: LOW }); let pillyS = null; // [Pilly] own slot: walks beside you WITH your parrot / pet
  let ladders = null; try { if (LADDERS_ON) ladders = createLadders({ world, layout, walker, pirate, crewF, petF, lagoon: { ...LAGOON_LADDER, dock: LAGOON_DOCK, y: lagoonDockY() } }); } catch (e) { console.warn('[dock-ladders]', e); } // [dock-ladders]
  const canoe = createCanoe({ scene, layout, walker, pirate, crewF, petF, getPlayer: () => ctx.getPlayer(), toast: (m, ms) => toast(m, ms), sfx: ctx.sfx, waveY: (x, z) => ctx.waveHeight?.(x, z, uTime?.value || 0) ?? 0, low: LOW, canvas, world, touch }); // [v314] + canvas look, world.blocked landings // [Emerly sail-around]
  const imap = createIslandMap({ world, layout, low: LOW || touch, islands, paperSheet: (bare) => treasure.map.sheet(bare) }); // [v153] PAPER minimap style = the MAPS parchment chart // [v106] the radar is the whole-island map in the harbor (at sea + on foot)
  // [v106] radar markers: main.js passes ship / AI / harbor mates / loot; we add you on foot + the on-foot pirates + the dig target
  let mapSt = {};
  function minimapState(st) {
    const W = walker.w, peers = [...(st.peers || [])];
    for (const p of fnet.peers.values()) { // [v340] on-foot: squadmates green, other players black
      let squad = false; try { const pv = ctx.pvp?.(); squad = !!(pv?.isHbSquadPeer?.(p) || pv?.isHarborSquadMate?.(p) || pv?.isSquadMate?.(p.id)); } catch {}
      peers.push({ x: p.x, z: p.z, foot: true, squad, id: p.id });
    }
    const crew = onFoot && crewF?.active ? crewF.list.map(c => ({ x: c.x, z: c.z })) : []; // [minimap-themes] your crew on the radar
    const demo = typeof window !== 'undefined' && typeof window.PFP_MAP_DEMO === 'function' && onFoot ? window.PFP_MAP_DEMO({ x: W.x, z: W.z }) : null; // dev: icon shots (tools)
    if (demo) { peers.push(...(demo.peers || []).map(q => ({ ...q, squad: !!q.squad }))); crew.push(...(demo.crew || [])); }
    return { ...st, peers, crew, ai: [...(st.ai || []), ...(demo?.ai || [])], me: onFoot ? { x: W.x, z: W.z, yaw: W.yaw, foot: true } : null, dig: treasure.target() || (typeof window !== 'undefined' && window.PFP_MAP_TARGET) || st.dig || null };
  }
  const openIsleMap = () => { if (on && game.state === 'playing' && !treasure.isOpen) imap.open(() => minimapState(mapSt)); };
  const radarEl = document.getElementById('radar');
  radarEl?.addEventListener('pointerdown', (e) => { if (!on || !radarEl.classList.contains('isle-tap')) return; e.preventDefault(); e.stopPropagation(); openIsleMap(); });
  // [map-streets] GTA-style district · street tag under the corner radar (Harbor / Island only)
  let mapLocEl = document.getElementById('map-loc-hud');
  if (!mapLocEl) {
    mapLocEl = document.createElement('div'); mapLocEl.id = 'map-loc-hud'; mapLocEl.hidden = true;
    mapLocEl.innerHTML = '<div class="ml-dist"></div><div class="ml-street"></div>';
    (document.getElementById('hud-tr') || document.body).appendChild(mapLocEl);
  }
  let _locAcc = 0, _locSig = '';
  function updateMapLocHud() {
    const hide = !imap.isOpen || !(on && onFoot && game.state === 'playing') || document.documentElement.classList.contains('hud-hide') || game.mode === 'waves';
    if (hide) { if (!mapLocEl.hidden) mapLocEl.hidden = true; return; }
    _locAcc++; if (_locAcc % 4) return; // ~4 Hz when drawMinimap runs every frame at 60
    const W = walker.w; const [fx, fz] = layout.harborToFoot(W.x, W.z);
    const loc = locatePoint(fx, fz, { onFoot: true });
    const sig = loc.callout;
    if (sig === _locSig && !mapLocEl.hidden) return; _locSig = sig;
    mapLocEl.hidden = false;
    const d = mapLocEl.querySelector('.ml-dist'), s2 = mapLocEl.querySelector('.ml-street');
    if (d && d.textContent !== loc.district) d.textContent = loc.district;
    if (s2 && s2.textContent !== (loc.street || '')) s2.textContent = loc.street || '';
  }
  // [v145] calm() = the treasure-map reveal may play now (never mid-fight); getPos() = you on foot, else your ship (harbor coords)
  let inventory = null; // [inventory] (made right after the treasure maps: it opens them)
  const treasure = createTreasure({ inventory: () => inventory, world, layout, toast: (...a) => toast(...a), pvp: () => ctx.pvp(), isOn: () => on && inHarbor(), calm: () => calm(), sfx: ctx.sfx, low: LOW || touch,
    getPos: () => { if (onFoot) { const W = walker.w; return { x: W.x, z: W.z, yaw: W.yaw, foot: true }; } const s = P(); return s ? { x: s.x, z: s.z, yaw: s.yaw, foot: false } : null; } });
  try { inventory = createInventory({ manualDrop: () => lootBags, pvp: () => ctx.pvp(), toast: (...a) => toast(...a), treasure, nearbyPlayers: () => (on ? [...fnet.peers.values()].map(p => p.name).filter(Boolean) : []) }); /* [give-dropdown] your harbor copy's pirates first in the GIVE picker */ } catch (e) { console.warn('[inventory]', e); } // [inventory]
  let casinoUi = null; // [Timothy] THE GOLDEN DOUBLOON CASINO table UI (created on the first E at a table, openCasino below)
  let squadHall = null; try { squadHall = createSquadHall({ pvp: () => ctx.pvp(), toast: (...a) => toast(...a), nearby: () => (on ? [...fnet.peers.values()].map(p => p.name).filter(Boolean) : []) }); } catch (e) { console.warn('[squad-hall]', e); }
  // [v356 friends] BANKSY t1851u: ⚙ SETTINGS → 👥 FRIENDS (+ the ⚓ server picker's FRIENDS ONLINE, Squad Hall / King of the Hill "+ FRIEND")
  let friends = null;
  try {
    const pv = () => ctx.pvp?.();
    friends = createFriends({
      call: (a, b) => pv()?.inv?.call ? pv().inv.call(a, b) : Promise.resolve({ ok: false, why: 'offline' }),
      at: () => myAt(pv(), game),
      name: () => { try { return pv()?.name || ''; } catch { return ''; } },
      join: async (p) => { const r = await (pv()?.joinFriend?.(p) ?? { ok: false, why: 'set sail to the Harbor first' }); if (r?.ok) { try { pv()?.serverPicker?.close?.(); squadHall?.close?.(); if (!$('pause')?.classList.contains('hidden')) $('btn-resume')?.click(); } catch {} } return r; },
      online: async () => { const r = await pv()?.inv?.call?.('inv_online', { detail: true }); return r?.ok && Array.isArray(r.players) ? r.players : []; },
      toast: (...a) => toast(...a),
    });
    const fb = $('btn-friends'); if (fb) { fb.hidden = false; fb.onclick = (e) => { e.stopPropagation(); friends.open(); }; }
    window.PFP_FRIENDS = Object.freeze({ open: (t) => friends.open(t), request: (n) => friends.request(n), relationOf: (n) => friends.relationOf(n), get me() { return friends.data.me; } });
    import('../petsPanel.js').then((m) => { // [pets R1] name / level / trade your pets (settings: 🐾 MY PETS)
      const pp = m.createPetsPanel({ call: (a, b) => pv()?.inv?.call ? pv().inv.call(a, b) : Promise.resolve({ ok: false, why: 'set sail to the Harbor first' }),
        equipped: () => getLocalGear()?.parrot || '', out: () => !!petF?.active, toast: (...a) => toast(...a),
        gold: (r) => { if (r?.gold != null) try { pv()?.serverGold?.(r.gold, { rev: r.rev ?? null, owner: !!r.owner }); } catch {} } });
      setInterval(() => pp.tick(1), 1000);
      pillyS = createPillyState({ call: (a, b) => pv()?.inv?.call ? pv().inv.call(a, b) : Promise.resolve({ ok: false, why: 'set sail to the Harbor first' }), follower: pillyF, toast: (...a) => toast(...a),
        out: () => on && onFoot && !shipHull?.inHull, gold: (r) => { if (r?.gold != null) try { pv()?.serverGold?.(r.gold, { rev: r.rev ?? null, owner: !!r.owner }); } catch {} } }); // [Pilly]
      window.PFP_PILLY = Object.freeze({ open: () => pillyS.open(), close: () => pillyS.close(), refresh: () => pillyS.refresh(), get state() { return pillyS.state; } });
      setInterval(() => pillyS.tick(1), 1000); { let tries = 0; const t = setInterval(() => { if (++tries > 30 || pillyS.state.avail != null) return clearInterval(t); if (pv()?.inv?.call) pillyS.refresh(); }, 4000); }
      import('../parrotsPanel.js').then(m => {
        const pc = m.createParrotsPanel({ flush: () => pv()?.flushNow?.(), call: (a, b) => pv()?.inv?.call?.(a, b),
          equipped: () => getLocalGear()?.parrot || '', out: () => on && onFoot && !shipHull?.inHull,
          equip: color => import('../islandShop.js').then(m => m.getShopProvider()?.equip?.('gear', 'parrot:' + color)),
          gold: r => { if (r.gold != null) pv()?.serverGold?.(r.gold, { rev: r.rev, owner: !!r.owner }); } });
        window.PFP_PETS = Object.freeze({ open: () => shipHull?.inHull ? pc.open() : toast('Visit the PARROT CAGE inside your ship hull.', 2400), close: () => pc.close(), get isOpen() { return pc.isOpen; } });
        setInterval(() => pc.tick(1), 1000);
        const call0 = async (a, b) => { try { return await pv()?.inv?.call?.(a, b); } catch { return null; } };
        window.addEventListener('pfp-parrot-cage-sync', async () => { // hull cage wants your birds: client read only
          const r = await call0('parrot_list'); if (r?.ok) window.dispatchEvent(new CustomEvent('pfp-parrot-state', { detail: { parrots: r.parrots || [], equipped: r.equipped || null } }));
        });
        window.addEventListener('pfp-parrot-state', e => {
          window.__pfpParrotState = e.detail || null;
          const birds = e.detail?.parrots || [], selected = birds.find(p => p.id === e.detail?.equipped);
          const current = getLocalGear()?.parrot || '';
          if (current.startsWith('parrot_') && current !== (selected?.color || 'none')) import('../islandShop.js').then(m => m.getShopProvider()?.equip?.('gear', 'parrot:' + (selected?.color || 'none')));
          window.dispatchEvent(new CustomEvent('pfp-parrot', { detail: selected || null }));
        });
        window.addEventListener('pfp-parrot-equip', async e => {
          const r = await pv()?.inv?.call?.('parrot_equip', { id: e.detail });
          if (r?.ok) { await import('../islandShop.js').then(m => m.getShopProvider()?.equip?.('gear', 'parrot:' + r.color)); toast('🦜 PARROT EQUIPPED', 1800); window.dispatchEvent(new CustomEvent('pfp-parrot-equipped'));  }
          else toast(r?.why || r?.error || 'Could not equip parrot', 2200);
        });
      });
    }).catch((e) => console.warn('[pets]', e));
    import('../social.js').then((m) => { // [Friends R2] map player list (mute / add friend / squad) + squad voice chat
      const soc = m.createSocial({ pvp: () => ctx.pvp?.(), friends, toast: (...a) => toast(...a) });
      Object.defineProperty(globalThis, 'PFP_SOCIAL_NET', { value: Object.freeze({ onNet: soc.onNet, onSig: soc.onSig, isMuted: soc.isMuted }), configurable: false });
    }).catch((e) => console.warn('[social]', e));
  } catch (e) { console.warn('[friends]', e); }
  let frPickerHooked = false;
  function hookFriendsPicker() { // the ⚓ server picker shows FRIENDS ONLINE with one-tap JOIN
    const sp = ctx.pvp?.()?.serverPicker; if (frPickerHooked || !friends || !sp?.setFriends) return; frPickerHooked = true;
    sp.setFriends({ rows: () => { const cur = myAt(ctx.pvp?.(), game); return friends.onlineFriends().map((f) => { const p = joinPlan(f, cur); return { n: f.n, label: whereLabel(f), ok: p.ok, kind: p.kind, why: p.why, here: !!p.here, full: !!p.full }; }); },
      join: (n) => friends.joinFriend(n), open: () => friends.open() });
  }
  setTimeout(() => { try { treasure.render?.(); } catch (e) { console.warn('[treasure]', e); } }, 0); // [minimap-fix] (deferred: the dock is still being built) the HUD button was first drawn before the inventory existed (read 'MAPS 0' until the next server poll)
  const pumpfun = createPumpfun({world, layout, camera, canvas, low: LOW});
  const plaza = createPlaza({ world, ctx: { harborToFoot: layout.harborToFoot, startWaves: () => { goAboard(true); ctx.openWaves(); }, openArena: () => openBoard() } });
  const battery = createBattery({ scene, world, layout, fx: ctx.fx, ocean, sfx: ctx.sfx, camera, toast: (m, ms) => toast(m, ms), myId: () => { const v = ctx.pvp?.()?.myId; return (typeof v === 'function' ? v() : v) ?? null; },
    hitShip: (p, gun) => ctx.pvp?.()?.batteryStep?.(p, gun) || false, hitFoot: (p, by, impact) => ctx.pvp?.()?.shoreBattery?.(p, by, impact) || false }); // [v171] live shots: AI + other pirates' ships (pvp.batteryStep) // [Timothy] adds its 6 FIRE CANNON points to layout.interact // [lh-hit] toast on lighthouse strike
  let lootBags = null; // [backpack-pvp] filled after houses so inHouse can close over it
  const isleSafeHud = { _isleSafe: false, _isleSafeOut: 0, _isleSafeZone: null };
  const isSquadMateDock = (id) => { try { return !!ctx.pvp?.()?.isSquadMate?.(id); } catch { return false; } };
  const crewFight = createCrewFight({ THREE, scene, sfx: ctx.sfx, ground: (x, z) => world.ground(x, z), inSafe: (x, z) => insideSafeZoneH(x, z),
    isSquadMate: (id) => isSquadMateDock(id),
    ships: { test: (...a) => ctx.pvp?.()?.gunShipTest?.(...a) || null, hit: (...a) => ctx.pvp?.()?.gunShipHit?.(...a) || 0, aim: () => ctx.pvp?.()?.gunAimCyls?.() || [] }, // [v347] t1821u shoot ships from the island
    crewOf: (id) => (id === 'me' ? (onFoot && crewF?.active ? crewF.list.filter((c) => c.p.object.visible || c.fight) : []) : (fnet.peers.get(id)?.crew?.list || [])),
    captainOf: (id) => (id === 'me' ? (onFoot ? walker.w : null) : (fnet.peers.get(id) || null)) });
  function respawnOnShip() { // [v328] BANKSY t1740u/t1741u open-island KO → aboard your ship (Harbor berth OR offshore anchor)
    try { imap.close(); skinPick.close(); squadHall?.close?.(); houses?.closeStorage?.(); casinoUi?.close?.(); } catch {}
    const s = P(); if (!on || !s) return false;
    const ax = canoe?.state?.ax, az = canoe?.state?.az, ayaw = canoe?.state?.ayaw;
    const away = canoe && (canoe.mode === 'canoe' || canoe.mode === 'beached') && Number.isFinite(ax) && Number.isFinite(az);
    if (away) {
      canoe.clearAll(s, controls);
      s.x = ax; s.z = az; s.yaw = Number.isFinite(ayaw) ? ayaw : s.yaw; s.speed = 0; s.sail = 0; s.turn = 0; s.anchor = true; s._offshore = false; s._canoeAway = false;
    } else if (docking.mode === 'sea' && s.alive) {
      canoe?.clearAll?.(s, controls); s.speed = 0; s.sail = 0; s.turn = 0; s.anchor = true; s._offshore = false; s._canoeAway = false;
    } else if (docking.mode === 'docked' && s.alive) {
      canoe?.clearAll?.(s, controls);
    } else {
      canoe?.clearAll?.(s, controls); s.alive = true; s.sinking = 0; s.hp = s.maxHp; if (s.mesh) s.mesh.visible = true; docking.release(); spawnNow(s);
    }
    goAboard(true); ctx.updateHud?.();
    toast(docking.mode === 'docked' ? '⚓ RESPAWNED ON YOUR SHIP · HARBOR' : '⚓ RESPAWNED ON YOUR ANCHORED SHIP', 2200);
    return true;
  }
  const battle = createBattle({ scene, world, layout, walker, fnet, sfx: ctx.sfx, camera, canvas, touch, myId, low: LOW,
    lootBags: { dropHaul: (...a) => lootBags?.dropHaul?.(...a) },
    inHouse: () => !!houses?.inHouse,
    posed: () => restPosed(), // [bed-desk] lying in a bunk / seated at a desk: holstered, no attacks
    inventory: () => inventory, crewFight,
    kd: (side, key, meta) => { try { return ctx.pvp?.()?.groundKd?.(side, key, meta); } catch { return false; } },
    isSquadMate: (id) => isSquadMateDock(id),
    respawnOnShip: () => respawnOnShip(),
  }); // [Timothy] + [backpack-pvp] + [v328] Harbor squad FF off + ship respawn
  const sets = colliderSets(layout.shipCircles);
  const NO_TARGET = { x: 0, z: 0, alive: false, yaw: 0, speed: 0 };

  // ---------- UI ----------
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  if (touch) document.documentElement.classList.add('dk-touch');
  const el = (tag, id, html = '') => { const e = document.createElement(tag); e.id = id; e.innerHTML = html; document.body.appendChild(e); return e; };
  const safeTag = el('div', 'dk-safe', '⚓ SAFE HARBOR'), isleSafeTag = el('div', 'dk-islesafe', '🛡️ SAFE ZONE'), acts = el('div', 'dk-acts'), fade = el('div', 'dk-fade'), toastEl = el('div', 'dk-toast');
  const joy = el('div', 'dk-joy', '<i></i>'), jumpB = el('button', 'dk-jump', 'JUMP'), boardX = el('button', 'dk-board-x', '✕ BACK');
  const bA = document.createElement('button'), bB = document.createElement('button'), bC = document.createElement('button'); acts.append(bA, bB, bC);
  let actA = null, actB = null, actC = null, uiSig = '';
  function setActs(a, b, c = null) { // a / b / c: { label, key, fn, primary, disabled, pad } | null  ([v333] 3rd = ENTER HULL / WEIGH ANCHOR · [v349] pad = face btn glyph e.g. 'Y')
    actA = a; actB = b; actC = c; const pd = padActive(), sig = JSON.stringify([a && [a.label, a.key, a.disabled, a.primary, a.pad], b && [b.label, b.key, b.pad], c && [c.label, c.key, c.pad], pd && padGlyph('A')]); if (sig === uiSig) return; uiSig = sig;
    acts.style.display = a || b || c ? 'flex' : 'none';
    for (const [btn, s, i] of [[bA, a, 0], [bB, b, 1], [bC, c, 2]]) {
      btn.hidden = !s; if (!s) { btn.innerHTML = ''; btn.disabled = false; btn.classList.remove('primary'); continue; } // [v350 t1838u] clear stale LEAVE HULL / OPEN STORAGE text when mid-room
      const showKbd = (s.key || (pd && s.fn)) && (!touch || pd);
      const kbd = !showKbd ? '' : `<kbd>${s.key && !pd ? s.key : promptKey(s.key || 'E', i, s.pad || (s.label === 'ENTER HULL' ? 'Y' : null))}</kbd>`; // [v349] ENTER HULL → △ / Y on pad
      btn.innerHTML = kbd + s.label; btn.disabled = !!s.disabled; btn.classList.toggle('primary', !!s.primary);
    }
    placeActs();
  }
  // [v166] BANKSY: the on-foot prompt (shops, weapon shops, battle areas, the dock) sat under the joystick + JUMP on phones. Touch only
  // (desktop keeps the CSS): try spots in order, keep the first that hits no visible touch control (stick, JUMP, ATTACK, quick chat):
  // 1) bottom, in the gap right of JUMP (one line only)  2) right-aligned just above the stick  3) above every control. Real rects = safe areas + landscape.
  function placeActs() {
    if (!touch || acts.style.display === 'none') return;
    const st = acts.style; st.left = st.right = st.bottom = st.top = st.transform = '';
    if (!document.documentElement.classList.contains('pfp-onfoot') && !document.documentElement.classList.contains('pfp-canoe')) return; // aboard: the CSS spot (no stick / JUMP)
    const W = innerWidth, H = innerHeight, cs = getComputedStyle(document.documentElement), px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
    const sr = px('--safe-r'), sb = px('--safe-b'), pad = 10;
    const vis = (e) => e && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
    const ctrls = ['dk-joy', 'dk-jump', 'bt-stance', 'bt-atk', 'btn-emote'].map(id => document.getElementById(id)).filter(vis)
      .map(e => e.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    // [v340] v339 QA: also keep clear of the radar, INVENTORY, the weapon switch, the top icons + PLAY · HARBOR pill
    const extra = ['radar', 'tps-ads', 'tps-sw', 'bt-stance', 'btn-sound', 'btn-cam', 'btn-pause', 'btn-full', 'captain', 'hb-hub-btn', 'inv-hud-btn', 'btn-inv'].map(id => document.getElementById(id))
      .concat([...document.querySelectorAll('.tm-btn, #tm-btn, #sq-note')]).filter(vis).map(e => e.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    const obst = ctrls.concat(extra);
    const hits = (oneLine) => { const r = acts.getBoundingClientRect(); if (r.left < 0 || r.right > W - sr - 8 || r.top < 0 || (oneLine && r.height > 64)) return true;
      return obst.some(c => r.left < c.right + pad && r.right > c.left - pad && r.top < c.bottom + pad && r.bottom > c.top - pad); };
    const left = ctrls.filter(c => c.left < W / 2), gapL = Math.max(0, ...left.map(c => c.right)) + pad;
    const rightCol = obst.filter(c => c.left > W * 0.6 && c.bottom > H * 0.25), stanceR = Math.max(0, ...rightCol.map(c => W - c.left)) + pad; // clear the right-edge column (weapon switch / chat)
    const tryAt = (o, oneLine) => { st.left = o.left ?? 'auto'; st.right = o.right ?? 'auto'; st.bottom = o.bottom; st.transform = 'none'; return !hits(oneLine); };
    if (left.length && tryAt({ left: `${gapL}px`, bottom: `${sb + 24}px` }, true)) return; // the gap only when the label fits on one line
    const joyTop = Math.min(H, ...left.map(c => c.top));
    const tries = [{ right: `${sr + 22}px`, bottom: `${sb + 14}px` }, { right: `${Math.max(sr + 22, stanceR)}px`, bottom: `${sb + 14}px` }, { right: `${sr + 22}px`, bottom: `${H - joyTop + pad}px` },
      { right: `${Math.max(sr + 22, stanceR)}px`, bottom: `${H - joyTop + pad}px` }, { right: `${Math.max(sr + 22, stanceR)}px`, bottom: `${sb + 120}px` }];
    { const low = obst.filter(c => c.top > H * 0.45), lowTop = Math.min(H, ...low.map(c => c.top)); tries.push({ right: `${sr + 22}px`, bottom: `${H - lowTop + pad}px` }); } // [v341] above every lower-half control (musket-aim cluster)
    for (const o of tries) if (tryAt(o)) return;
    const allTop = Math.min(H, ...ctrls.map(c => c.top)); tryAt({ right: `${Math.max(sr + 22, stanceR)}px`, bottom: `${H - allTop + pad}px` });
  }
  if (touch) { addEventListener('resize', () => requestAnimationFrame(placeActs)); setInterval(placeActs, 600); } // controls come and go (battle areas, chat)
  const press = (s) => { if (s && !s.disabled) s.fn(); };
  for (const [btn, get] of [[bA, () => actA], [bB, () => actB], [bC, () => actC]]) btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); press(get()); });
  let toastT = 0; function toast(t, ms = 1600) { toastEl.innerHTML = t; toastEl.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.opacity = 0; }, ms); }
  const fadeTo = (fn) => { fade.style.opacity = 1; setTimeout(() => { fn(); setTimeout(() => { fade.style.opacity = 0; }, 60); }, 280); };
  let houses = null; try { houses = createHouses({
    scene, world, layout, walker, pirate, crewF, petF, fnet, camera, renderer,
    toast: (m, ms) => toast(m, ms), sfx: ctx.sfx, fadeTo: (fn) => fadeTo(fn),
    getGold: () => (game.gold | 0),
    spendGold: (n) => { const g = game.gold | 0; if (g < (n | 0)) return false; game.gold = g - (n | 0); try { ctx.pvp?.()?.save?.({ now: true, force: true }); } catch {} return true; },
    saveGold: () => { try { ctx.pvp?.()?.save?.({ now: true, force: true }); } catch {} },
    inventory: () => inventory, pvp: () => ctx.pvp(), low: LOW, game, ocean, islands, openWardrobe: (from) => openWardrobe(from), // [t408u]
  }); } catch (e) { console.warn('[storage-houses]', e); } // [Emerly storage-houses]
  let mm = null; import('../island/moneyMakers/index.js').then(m => m.createMoneyMakers({ scene, world, layout, walker, pirate, battle, houses, fnet, game, touch, low: LOW, pvp: () => ctx.pvp(), sfx: ctx.sfx, updateHud: () => ctx.updateHud?.(), toast: (m2, ms) => toast(m2, ms), inventory: () => inventory, insideSafe: (x, z) => insideSafeZoneH(x, z), onFoot: () => on && onFoot })).then(x => { mm = x || null; try { api.mm = mm; } catch {} }).catch(e => console.warn('[money-makers]', e)); // [v349 money-makers] BANKSY t204u: bounties, coliseum, crates, diving / pots / mining, cottage rum
  let shipHull = null; try {
    shipHull = createShipHull({
      scene, world, walker, pirate, crewF, petF, fnet, camera, renderer, game,
      toast: (m, ms) => toast(m, ms), sfx: ctx.sfx, fadeTo: (fn) => fadeTo(fn),
      houses, low: LOW, ocean, islands, openWardrobe: (from) => openWardrobe(from), // [t408u]
      openParrotCage: () => { for (const code of ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','Space']) walker.onKey({ code, preventDefault() {}, stopPropagation() {} }, false); window.PFP_PETS?.open(); },
      closeParrotCage: () => window.PFP_PETS?.close(),
      loadParrots: () => ctx.pvp?.()?.inv?.call?.('parrot_list'),
      openCrewRoom: (member) => openCrewRoom(member),
      closeCrewRoom: () => { import('../islandShop.js').then(m => m.closeHullCrewRoom()); },
    });
  } catch (e) { console.warn('[ship-hull]', e); }
  document.addEventListener('cq-leave-request', () => { try { leaveHull(); } catch {} });
  // [bed-desk] t405u / t406u: LIE IN BED / SIT AT DESK in the hull + cottage cabins (js/dock/bedDesk.js)
  // [t408u] BANKSY "Also make it so they can change clothes in hull and cabin": the existing island shop's CHANGING ROOM (owned clothes, free)
  function openCrewRoom(member) {
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space']) {
      try { walker.onKey({ code, preventDefault() {}, stopPropagation() {} }, false); } catch {}
    }
    import('../islandShop.js').then(m => m.openHullCrewRoom(member)).catch(() => toast('CREW ROOM UNAVAILABLE · TRY AGAIN', 2200));
  }
  function openWardrobe(from = 'hull') {
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space']) { try { walker.onKey({ code, preventDefault() {}, stopPropagation() {} }, false); } catch {} } // no walking off while dressing
    Promise.resolve(window.openShop ? window.openShop({ vendor: 'wardrobe', tab: 'wardrobe', from }) : false)
      .then(ok => { if (!ok) toast('THE WARDROBE IS STUCK RIGHT NOW<br><small>check your connection and try again</small>', 2400); }).catch(() => {});
  }
  function restPosed() { return !!(shipHull?.posed || houses?.posed); }
  function standUp(why = 'getup') { let r = false; try { r = !!shipHull?.standUp?.(why) || r; } catch {} try { r = !!houses?.standUp?.(why) || r; } catch {} return r; }
  if (shipHull?.leaveBtn) shipHull.leaveBtn.addEventListener('cq-leave-request', () => { try { leaveHull(); } catch {} });
  let safeMarks = null; try { safeMarks = buildSafeZoneMarks(scene, world, layout); } catch (e) { console.warn('[safe-marks]', e); }
  try {
    lootBags = createLootBags({
      scene, world, walker, toast: (m, ms) => toast(m, ms), sfx: ctx.sfx,
      invApi: async (action, body = {}) => {
        try { return await ctx.pvp?.()?.inv?.call?.(action, body); } catch { return null; }
      },
      inventory: () => inventory,
      roomKey: () => { const h = ctx.pvp?.()?.harborInfo?.(); return h?.prefix && h.copy > 0 ? `${h.prefix}-${h.copy}` : ''; },
      dropContext: () => {
        if (!on || !onFoot || houses?.inHouse || shipHull?.inHull || game.state !== 'playing' || ctx.pvp?.()?.where !== 'harbor') return null;
        const W = walker.w; if (W.air || zip?.riding) return null; return { x: W.x, z: W.z, y: W.y, sea: !!W.swim };
      },
      myId: () => { const v = typeof myId === 'function' ? myId() : myId; return v || 'local'; },
      myName: () => ctx.pvp?.()?.name || 'PIRATE',
      isOwner: () => !!(ownerAllSkins?.() || shopCache?.()?.owner || accountInfo?.()?.owner || (typeof location !== 'undefined' && /[?&]banksy=1(&|$)/.test(location.search || ''))),
      inHouse: () => !!houses?.inHouse, inSafe: (x, z) => insideSafeZoneH(x, z), now: () => game.t || 0, waveHeight: ctx.waveHeight,
      broadcast: (msg) => { try { return ctx.pvp?.()?.lootNet?.(msg); } catch { return false; } },
    });
  } catch (e) { console.warn('[loot-bags]', e); }
  // joystick
  { let id = null, cx = 0, cy = 0; const knob = joy.querySelector('i'), R = 52;
    joy.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); id = e.pointerId; const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; walker.w.joy.on = true; mv(e); try { joy.setPointerCapture(e.pointerId); } catch {} });
    const mv = (e) => { if (e.pointerId !== id) return; let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; walker.w.joy.x = dx / R; walker.w.joy.y = dy / R; };
    joy.addEventListener('pointermove', mv);
    const end = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; walker.w.joy.on = false; walker.w.joy.x = walker.w.joy.y = 0; };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end); joy.addEventListener('lostpointercapture', end); }
  jumpB.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (on && onFoot) { if (zip?.riding) walker.w.jumpQ = true; else walker.jump(); } }); // [v106] phone JUMP; [zipline-v2] JUMP = drop mid-ride
  boardX.onclick = (e) => { e.stopPropagation(); closeBoard(); };
  // [Emerly gamepad] what the pad needs from the dock (js/gamepad.js): the prompts, the walker stick + camera, jump, the musket sights
  { let padJoy = false;
    onPadMode(() => { uiSig = ''; setActs(actA, actB, actC); if (battle) battle.padHud?.(); });
    const inCanoe = () => on && canoe?.mode === 'canoe'; // [v314] the canoe paddles on the walker stick + looks on the right stick
    registerPadDock({ on: () => on, onFoot: () => on && (onFoot || inCanoe()),
      prompts: () => [!!(actA && !actA.disabled && actA.fn), !!(actB && !actB.disabled && actB.fn), !!(actC && !actC.disabled && actC.fn)], press: (i) => { if (game.state === 'playing') press(i === 2 ? actC : i ? actB : actA); },
      // [v349] Triangle / Y = ENTER HULL while moored at a berth OR anchored at sea (not on foot / canoe / already inside)
      canEnterHull: () => !!(on && !onFoot && !inCanoe() && !shipHull?.inHull && (docking.mode === 'docked' || (docking.mode === 'sea' && !!P()?.anchor))),
      enterHull: () => { if (game.state === 'playing') enterHull(); },
      // [v350 t1838u] Triangle / Y (or A) leaves only when standing at the exit door prompt
      canLeaveHullDoor: () => !!(shipHull?.inHull && actA && !actA.disabled && actA.tag === 'leave' && actA.fn),
      leaveHullDoor: () => { if (game.state === 'playing' && actA?.tag === 'leave') press(actA); },
      zone: () => !!battle?.zone, armed: () => (battle?.stance || 0) > 0, // [t1734u] RT attack outside pit/range when a weapon is drawn
      cycleWeapon: () => battle?.cycleStance?.(), // [t1734u] Square / X cycles Unarmed → Musket → Sword ([bed-desk] battle.setStance refuses while in bed / at the desk)
      posed: () => restPosed(), standUp: () => standUp('pad'), // [bed-desk] B = GET UP while lying / seated
      tps: () => battle?.tps || null,
      ads: (v) => { const t = battle?.tps; if (t?.st) t.st.adsHeld = !!v && t.on; },
      jump: () => { if (on && onFoot && game.state === 'playing') walker.jump(); },
      move: (x, y, act) => { const j = walker.w.joy; if (act && on && (onFoot || inCanoe())) { j.on = true; j.x = x; j.y = y; padJoy = true; } else if (padJoy) { padJoy = false; j.on = false; j.x = j.y = 0; } },
      look: (rx, ry, dt) => { if (inCanoe()) { canoe.padLook(rx, ry, dt, PAD.look); return; } if (!on || !onFoot) return; const t = battle?.tps; if (t?.on && t.padLook) { t.padLook(rx * PAD.aim * dt, ry * PAD.aim * dt); return; }
        const w = walker.w; w.camYaw -= rx * PAD.look[0] * dt; w.pitch = Math.min(1.1, Math.max(-0.35, w.pitch + ry * PAD.look[1] * dt)); w.look = performance.now(); },
      camBehind: () => { if (inCanoe()) { canoe.camBehind(); return; } if (on && onFoot) { walker.w.camYaw = walker.w.yaw; walker.w.look = 0; } },
      hasInvites: () => !!squadHall?.hasInvites?.(), openInvites: () => squadHall?.openInvites?.(),
      islandMap: imap }); } // [map-zoom] [invite-discreet] VIEW → invite pill; islandMap = pad pan/zoom/close
  function openBoard() { document.documentElement.classList.add('dk-board'); ctx.pvp()?.harborUi?.(); }
  function closeBoard() { document.documentElement.classList.remove('dk-board'); }

  // ---------- state ----------
  let viewing = false; // [v105] harbor spectate view
  let on = false, onFoot = false, lastShot = 0, leftAt = -99, sprintHinted = false;
  // [v145] combat watch for the treasure-map reveal queue: a hit taken, a broadside fired or an AI ship close = fighting
  let combatT = -99, lastHitT = -99, lastHp = null, lastCd = 0, bossOn = false;
  function calm() {
    const s = P(); if (!on || game.state !== 'playing' || !s || !s.alive || imap.isOpen || document.documentElement.classList.contains('dk-board')) return false;
    if (onFoot || docking.mode === 'docked' || zone.inside(s.x, s.z)) return true;
    if (game.t - combatT < 6) return false;
    return !(mapSt.ai || []).some(e => Math.hypot(e.x - s.x, e.z - s.z) < (e.boss ? 260 : 150));
  }
  const P = () => ctx.getPlayer();
  const inHarbor = () => game.mode === 'pvp' && !!ctx.pvp() && ctx.pvp().where === 'harbor' && !ctx.pvp().spectating && ['playing', 'paused', 'shop'].includes(game.state);
  // the harbor zone (clear water round the coast, curated islets, the coast colliders, no grid rocks on the land): sailing it OR spectating it
  let zoneOn = null; const setZone = (v) => { v = !!v; if (v === zoneOn) return; zoneOn = v; islands.setHarbor(v ? { clearR: SAIL_ALL ? 1350 : 470, islets: ctx.islets, island: sets, land: (x, z) => layout.FM.H(...layout.harborToFoot(x, z)) > -6 } : null); };
  // [v330] BANKSY t1754u "Do the old open sea map for waves and arena": a few harbor / island pieces hang straight off the scene (not under
  // world.root), so they floated over the open sea in Storm Hunt and the Battle Royale arena: the zipline towers + cables, the SWORD PIT /
  // MUSKET RANGE rings, the cottage name plaques and fallback cottage shells. They follow the island now (shown only while the harbor world
  // is on or harbor-spectated). Bonus: ~150 fewer draw calls at sea.
  const EXTRA_RE = /^(zipline|battle_areas|house_plaques|house_fallback_exteriors)$/;
  function harborExtras(vis) { for (const o of scene.children) if (EXTRA_RE.test(o.name || '')) o.visible = vis; }
  function syncDockHud() {
    document.documentElement.classList.toggle('dk-harbor', !!on);
    document.documentElement.classList.toggle('dk-moored', !!(on && docking.mode === 'docked' && !onFoot && !shipHull?.inHull));
  }
  function setOn(v) {
    if (v === on) return; on = v; world.root.visible = v;
    setZone(v || viewing);
    if (!v) { casinoUi?.close?.(); canoe?.clearAll?.(P()); shipHull?.clear?.(); houses?.clear?.(); lootBags?.clear?.(); isleSafeTag.style.display = 'none'; skinPick.close(); imap.close(); radarEl?.classList.remove('isle-tap'); if (onFoot) goAboard(true); docking.release(); fnet.clear(); signs.clear(); peerNames.clear(); safeTag.style.display = 'none'; setActs(null, null); closeBoard(); squadHall?.close?.(); battery?.clear(); battle?.clear(); }
    syncDockHud();
    harborExtras(v || viewing); // [v330] t1754u
  }
  // ---------- actions ----------
  // [v152] BANKSY "When they join harbor spawn them at an empty berth unless they are full then spawn them at sea": joining the harbor
  // (first join, back from the arena / spectate, a re-join) or respawning there after a sinking moors your ship at a free berth B1-B10.
  // [v157] BANKSY "Start them at dock": moored on the very frame you join / respawn (was: 1.5 s at the sea spawn, then a fade + jump to the berth).
  // The berth is provisional: a pirate already moored there (or a lower-id fresh spawn) still wins and you move over (the v152 'ds' clash rule);
  // every berth taken = back to the sea spawn. Those moves fade (no toast while the name card is up).
  // ?berthspawn=0 = the old sea spawn (tests)
  const BERTH_SPAWN = new URLSearchParams(location.search).get('berthspawn') !== '0';
  let spawnFrom = null, wasAlive = false;
  const hidden = () => { const en = document.getElementById('pvp-entry'); return !!en && !en.classList.contains('hidden'); }; // the name card is up: nothing on screen to jump
  function spawnNow(s) { // snap-moor on the spawn frame (no ease-in, no fade: the camera starts there)
    if (!BERTH_SPAWN || !s?.alive || onFoot || docking.mode !== 'sea') return;
    spawnFrom = { x: s.x, z: s.z, yaw: s.yaw };
    const b = docking.spawnPick(); if (!b) return; // all berths taken: the sea spawn stands
    docking.moor(s, b); ctx.camReset?.(); if (!hidden()) toast(`MOORED AT BERTH ${b.id} · SAFE HARBOR`, 2000);
  }
  function dockNow(b) { const s = P(); docking.begin(s, b); ctx.sfx?.coin?.(); toast(`MOORING AT BERTH ${b.id}`); }
  function goAshoreAt(x, z, yaw) { // [Emerly sail-around] canoe beach landing (any shore / islet)
    fadeTo(() => { onFoot = true; controls.enabled = false; document.documentElement.classList.add('pfp-onfoot');
      walker.enter(x, z, yaw ?? 0); crewF?.enter(); petF?.enter(walker.w); toast('ASHORE'); });
  }
  function goAshore() {
    if (docking.mode !== 'docked') return; const b = docking.berth;
    fadeTo(() => { onFoot = true; controls.enabled = false; document.documentElement.classList.add('pfp-onfoot');
      walker.enter(b.ashore.x, b.ashore.z, b.out ? Math.atan2(-b.out.x, -b.out.z) : b.yaw + Math.PI); // face inland
      crewF?.enter(); petF?.enter(walker.w);
      if (!sprintHinted) { sprintHinted = true; toast(touch || padActive() ? 'ASHORE<br><small>push the stick to the edge to sprint</small>' : `ASHORE<br><small>WASD walk · hold ${keyName(binds('sprint')[0])} to sprint</small>`, 2600); } });
  }
  function goAboard(instant = false) {
    const fin = () => { onFoot = false; pirate.object.userData.emote = null; for (const c of crewF?.list || []) c.p.object.userData.emote = null; walker.exit(); crewF?.exit(); petF?.exit(); pillyF?.exit(); // [Raul emotes] no half-played emote next time ashore
      closeBoard(); document.documentElement.classList.remove('pfp-onfoot'); controls.enabled = true; ctx.camReset(); };
    if (instant) fin(); else fadeTo(fin);
  }
  // [v254] BANKSY 9:38 PM "if spectate from castle they go back to castle when exit": only the fort spyglass sets specFrom; back in the harbor
  // (after the berth moor) you land on foot at that spot with the same facing. Joining a battle instead drops it. No berth free = the usual harbor spawn.
  let specFrom = null;
  function fortReturn() {
    const r = specFrom; specFrom = null; if (!r || r.src !== 'fort' || docking.mode !== 'docked' || onFoot) return false;
    onFoot = true; controls.enabled = false; document.documentElement.classList.add('pfp-onfoot');
    walker.enter(r.x, r.z, r.yaw); const w = walker.w; w.camYaw = r.camYaw; if (Number.isFinite(r.pitch)) w.pitch = r.pitch; walker.snapCam?.();
    crewF?.enter(); petF?.enter(walker.w); window.__pfpFortReturn = { x: w.x, z: w.z, yaw: w.yaw, camYaw: w.camYaw }; return true;
  }
  function setSail() { if (docking.setSail(P())) { const s = P(); s.anchor = false; s.sail = 1; toast('SET SAIL!'); } }
  function weighAnchor() {
    const s = P(); if (!s?.alive || !s.anchor) return;
    if (docking.mode === 'docked') return; // moored ships use SET SAIL
    s.anchor = false; if (s.sail === 0) s.sail = 1; s._offshore = false; toast('⚓ ANCHOR WEIGHED · SET SAIL!', 1600);
  }
  function enterHull() {
    if (!shipHull || shipHull.inHull) return;
    if (onFoot) return; // only from aboard (docked or anchored)
    const s = P(); if (!s?.alive) return;
    const fromDock = docking.mode === 'docked';
    const fromSea = docking.mode === 'sea' && !!s.anchor;
    if (!fromDock && !fromSea) return;
    if (canoe?.mode === 'canoe' || canoe?.mode === 'beached') return;
    // [t1769u] anti-combat-log: hatch sealed for 8s after taking ship damage
    if ((game.t || 0) - lastHitT < HULL_COMBAT_LOCK_S) {
      toast('Hull hatch battened down during combat!', 1800); return;
    }
    const ax = s.x, az = s.z, ayaw = s.yaw;
    fadeTo(() => {
      onFoot = true; controls.enabled = false; document.documentElement.classList.add('pfp-onfoot');
      try { walker.enter(s.x, s.z, s.yaw); } catch {}
      crewF?.exit?.(); petF?.exit?.(); pillyF?.exit?.();
      shipHull.enter({ from: fromDock ? 'dock' : 'sea', ax, az, ayaw, berthId: docking.berth?.id || null, skipFade: true });
    });
  }
  function leaveHull() {
    if (!shipHull?.inHull) return;
    shipHull.leave((ctx) => {
      const s = P();
      // Put player back aboard in the exact state they entered from
      onFoot = false; pirate.object.userData.emote = null;
      for (const c of crewF?.list || []) c.p.object.userData.emote = null;
      walker.exit(); crewF?.exit(); petF?.exit(); pillyF?.exit();
      document.documentElement.classList.remove('pfp-onfoot', 'pfp-inhull', 'pfp-inhouse');
      controls.enabled = true;
      if (s) {
        if (ctx?.from === 'sea' && Number.isFinite(ctx.ax)) {
          s.x = ctx.ax; s.z = ctx.az; s.yaw = Number.isFinite(ctx.ayaw) ? ctx.ayaw : s.yaw;
          s.speed = 0; s.sail = 0; s.turn = 0; s.anchor = true; s._offshore = false; s._canoeAway = false;
        } else {
          // docked: stay moored at berth
          s.speed = 0; s.sail = 0; s.turn = 0; s.anchor = true;
        }
      }
      ctx?.from === 'sea' ? null : null;
    });
  }
  // [island-rework] what an area activity may do to you: a toast, or put you back at a spot (trap runs). Foot-frame coords.
  // [fish2] + your pirate for the fishing dock (js/island/areas/fishing2.js): where you stand / face in the foot frame, turn you, a body pose, its sounds
  const FOOT_YAW = (() => { const a = layout.footToHarbor(0, 0), b = layout.footToHarbor(1, 0); return Math.atan2(-(b[1] - a[1]), b[0] - a[0]); })();
  const areaFish = { me: () => (onFoot ? { y: walker.w.y, yaw: walker.w.yaw - FOOT_YAW } : null), face(yaw) { if (onFoot && Number.isFinite(yaw)) walker.w.yaw = yaw + FOOT_YAW; },
    camYaw: () => walker.w.camYaw - FOOT_YAW, emote(e) { if (!onFoot) return; if (e < 0) { const m = pirate.object.userData.emote; if (m) m.live = false; } else pirate.emote?.(e); }, sfx: (k, a) => ctx.sfx?.fish?.(k, a),
    rumble: (w, s, ms) => padRumble(w, s, ms), key: () => (padActive() ? padGlyph('A') : touch ? 'TAP' : 'E') }; // [fish2] the reel bar says the button you use
  const areaApi = { ...areaFish, toast: (m, ms) => toast(m, ms), teleport(fx, fz, yaw) { const [x, z] = layout.footToHarbor(fx, fz), w = walker.w; w.x = x; w.z = z; if (yaw !== undefined) { w.yaw = yaw; w.camYaw = yaw; } w.y = world.ground(x, z); walker.snapCam?.(); },
    // [castle-flag-daily] fort mast claims holder daily gold (server holder_claim unchanged)
    holder: () => { const h = ctx.pvp?.()?.holder; return h ? { on: !!h.on, claimed: !!h.claimed, checked: !!h.checked } : null; },
    claimDaily: () => { const pv = ctx.pvp?.(); if (!pv?.claimHolderGold) return Promise.reject(new Error('pvp offline')); return pv.claimHolderGold({ fromFlag: true, quiet: true }); } };
  // [Timothy] THE GOLDEN DOUBLOON CASINO (#47): the four tables inside the hall open the casino UI (js/casino/ui.js, loaded on first use).
  // Live: the server plays every hand (pvp.inv.call('casino_play')) and its gold is the gold; ?casinoqa=1 / no server casino = the practice table.
  function openCasino(gameId) {
    import('../casino/ui.js').then(m => {
      casinoUi ||= m.createCasinoUi({ pvp: () => ctx.pvp(), getGold: () => (game.gold | 0),
        setGold: (g, meta) => { const pv = ctx.pvp?.(); if (meta?.fromServer && pv?.serverGold) { try { pv.serverGold(g, meta); } catch {} } /* [v342] the server already moved it: re-base, never sync it twice */ else { game.gold = Math.max(0, Math.min(1e7, Math.floor(+g || 0))); try { pv?.save?.({ now: true, force: true }); } catch {} } try { ctx.updateHud?.(); const el = document.getElementById('gold'); if (el) el.textContent = game.gold; } catch {} },
        sfx: (k) => { const f = { win: ctx.sfx?.coin, card: ctx.sfx?.equip, dice: ctx.sfx?.equip, spin: ctx.sfx?.equip }[k]; f?.(); } });
      for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space']) { try { walker.onKey({ code, preventDefault() {}, stopPropagation() {} }, false); } catch {} }   // no walking off while seated
      casinoUi.open(gameId);
    }).catch(e => { console.warn('[casino] ui failed', e); toast('THE CASINO IS CLOSED RIGHT NOW', 2200); });
  }
  function interact(q) {
    const pv = ctx.pvp(), t = game.t;
    if (q.mm) { mm?.interact(q); return; } // [v349 money-makers]
    const casinoGame = casinoInteract(q.src || q.kind); if (casinoGame) { openCasino(casinoGame); return; }
    if (q.src?.id === 'fort_spyglass' || q.id === 'fort_spyglass') { const W = walker.w; specFrom = { src: 'fort', x: W.x, z: W.z, yaw: W.yaw, camYaw: W.camYaw, pitch: W.pitch }; goAboard(true); pv?.harborSpectate?.(false); return; } // [v254] specFrom tags the castle as the spectate source: EXIT puts you back here on foot (fortReturn) // [v252] BANKSY: Hilltop Fort spyglass = arena spectate (same as the mole spyglass); EXIT = usual spectate exit back to the harbor
    if (q.src?.area) { const m = world.foot.areas?.activate(q.src, t, areaApi); Promise.resolve(m).then(msg => { if (msg) toast(msg, 3200); }).catch(() => {}); return; } // [island-rework] area activities (+ [castle-flag-daily] async holder claim at fort_flag)
    if (q.kind === 'zipline') { zip?.start(q); return; } // [Emerly zipline]
    switch (q.kind) {
      case 'waves': case 'arena': plaza.openBoard(q.kind); break; // [v103] live leaderboard; START WAVES / JOIN BATTLE buttons in the panel
      case 'pumpfun': pumpfun.open(); break;
      case 'token': plaza.openToken(q.sym); break;
      case 'cannon': battery?.fire(q); break; // [Timothy] headland gun; [v171] live: hits AI + pirate ships (pvp.batteryStep)
      case 'exchange': plaza.openToken('SUNK'); break;
      case 'squadhall': if (pv?.lob?.state === 'harbor' && pv.mode !== 'squads') pv.setMode?.('squads'); if (squadHall) squadHall.open(); else openBoard(); break; // [squad-hall]
      case 'spyglass': specFrom = null; goAboard(true); pv?.harborSpectate?.(); break; // [fort-spectate-return] mole/other: clear castle return
      case 'shop': if (q.open === 'upgrades') { let ok = false; try { ok = !!window.PFP_OPEN_UPGRADES?.(); } catch {} if (!ok) toast('THE UPGRADE SHOP IS CLOSED RIGHT NOW<br><small>ship upgrades open from the harbor</small>', 2400); break; } // [v146] the UPGRADE SHOP storefront: straight to the upgrades panel (its own shop: never the skins grid)
        Promise.resolve(window.openShop ? window.openShop({ vendor: q.vendor || 'shop', tab: q.tab || (q.vendor === 'clothes' ? 'gear' : 'skins'), slot: q.slot, title: q.title, from: 'island' }) : false) // [Emerly] q.tab / q.title: SWORD SHOP / MUSKET SHOP
        .then(ok => { if (!ok) toast('THE SHOP IS CLOSED RIGHT NOW<br><small>check your connection and try again</small>', 2400); }); break;
      case 'tavern': if (layout.CO?.SHOW_TAVERN) toast('THE TAVERN<br><small>daily claim moves here soon</small>', 2200); break; // [hide-tavern]
      case 'bounties': if (mm) mm.openBoard(); else if (layout.CO?.SHOW_BOUNTY_BOARDS) toast('BOUNTY BOARD<br><small>opening soon</small>', 2200); break; // [v349 money-makers] the WANTED board (contracts + live bounties)
      case 'stall': toast(`${q.id === 'stall_red' ? 'THE TAILOR' : 'CURIOS'} · COMING SOON<br><small>${q.id === 'stall_red' ? 'hats, clothes + eye patches' : 'parrots, hooks + treasure maps'} for gold</small>`, 2400); break; // [v102] gear: no model on the pirate yet
      case 'dig': case 'cave': treasure.dig(q, t).then(h => { if (!h) toast(q.label); }); break; // [v122] server digs (the cave needs a legendary map)
      default: toast(q.label);
    }
  }
  // capture-phase keys: E = the main prompt, W = SET SAIL while moored; on foot the walker eats movement / fire keys
  const onKeyDown = (e) => {
    if (!on || e.target?.tagName === 'INPUT' || treasure.isOpen || ADM.frozen) return; // [admin-menu] frozen: no E / Q // [v145] the treasure map closes on its own keys (Esc / M)
    if ((document.getElementById('crew-room')?.classList.contains('on') || window.PFP_PETS?.isOpen)) return; // dressing owns gameplay keys
    if (casinoUi?.isOpen) { casinoUi.onKey(e); e.stopImmediatePropagation(); e.preventDefault(); return; } // [Timothy] the casino table has the keys (Esc closes)
    if (imap.isOpen && (e.code === 'Escape' || isKey('map', e.code))) { imap.close(); e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (isKey('map', e.code) && !e.repeat && game.state === 'playing' && !document.documentElement.classList.contains('dk-board')) { openIsleMap(); e.stopImmediatePropagation(); e.preventDefault(); return; }
    // [v339] I = Inventory (Harbor); ignore while typing / other modals that own keys
    if (isKey('inventory', e.code) && !e.repeat && game.state === 'playing' && inventory) {
      if (inventory.isOpen) inventory.close();
      else if (!anyModalOpen?.()) inventory.open('bag');
      e.stopImmediatePropagation(); e.preventDefault(); return;
    }
    if (e.code === 'Escape' && inventory?.isOpen) { // [v350 t1840u] B/Esc cancels MOVE/SPLIT first, then closes the panel
      const cancel = document.querySelector('#inv-panel.on [data-a="cancelmove"]');
      if (cancel) { cancel.click(); e.stopImmediatePropagation(); e.preventDefault(); return; }
      inventory.close(); e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (e.code === 'Escape' && document.getElementById('pvp-harbor')?.classList.contains('hb-modal-open')) {
      document.getElementById('pvp-harbor').classList.remove('hb-modal-open'); e.stopImmediatePropagation(); e.preventDefault(); return;
    }
    if (e.code === 'Escape' && squadHall?.isOpen) { squadHall.close(); e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (e.code === 'Escape' && houses?.storageOpen) { houses.closeStorage(); e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (e.code === 'Escape' && document.documentElement.classList.contains('dk-board')) { closeBoard(); e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (game.state !== 'playing') return;
    // [v339] Build Mode owns Q/E to rotate props — never fire actA/actB or broadsides
    if (document.documentElement.classList.contains('pfp-tedit') || document.querySelector('#te-bar')?.offsetParent) {
      if (e.code === 'KeyE' || e.code === 'KeyQ') return;
    }
    let used = false;
    if (skinPick.isOpen) { if (!e.repeat && (e.code === 'Escape' || e.code === 'KeyQ')) skinPick.close(); e.stopImmediatePropagation(); e.preventDefault(); return; } // [dock-skin] no walking while the shipyard panel is up
    const inCanoe = canoe?.mode === 'canoe'; // [v314] in the canoe the big ship never hears these keys
    const inHull = !!shipHull?.inHull;
    if (e.code === 'KeyQ' && (onFoot || inCanoe || inHull) && actB?.key === 'Q') { if (!e.repeat) press(actB); used = true; } else
    if (e.code === 'KeyE') { if (!e.repeat && actA && actA.key === 'E') { press(actA); used = true; } else if (onFoot || inCanoe || inHull) used = true; }
    else if (e.code === 'KeyH' && !e.repeat && ((actC && actC.key === 'H') || (!onFoot && !inCanoe && (docking.mode === 'docked' || (docking.mode === 'sea' && P()?.anchor))))) { if (actC?.key === 'H') press(actC); else enterHull(); used = true; }
    else if ((e.code === 'KeyW' || e.code === 'ArrowUp') && !onFoot && !inHull && docking.mode === 'docked') { setSail(); used = true; }
    else if ((e.code === 'KeyW' || e.code === 'ArrowUp') && !onFoot && !inHull && docking.mode === 'sea' && P()?.anchor && actC?.key === 'W') { press(actC); used = true; }
    else if (inCanoe) { if (canoe.onKey(e, true)) used = true; }
    else if (onFoot && walker.onKey(e, true)) used = true;
    else if (!onFoot && docking.mode !== 'sea' && ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'KeyS', 'ArrowDown', 'Space'].includes(e.code)) used = true; // moored / easing: no helm
    if (used) { e.stopImmediatePropagation(); e.preventDefault(); }
  };
  const onKeyUp = (e) => { if (on && onFoot) walker.onKey(e, false); canoe?.onKey?.(e, false); };
  addEventListener('keydown', onKeyDown, true); addEventListener('keyup', onKeyUp, true);

  // ---------- per frame (main.js: after pvp.update, before floatShip) ----------
  // [v330 perf] write-on-change DOM pill (display / class / text); other code that sets style.display = 'none' directly is respected
  function pill(el, show, cls = '', txt = null) { if (!el) return; const d = show ? 'block' : 'none'; if (el.style.display !== d) el.style.display = d; if (!show) return;
    if (el.className !== cls) el.className = cls; if (txt !== null && el.textContent !== txt) el.textContent = txt; }
  function ship(dt) {
    const want = inHarbor() || (on && game.mode === 'pvp' && ctx.pvp()?.where === 'harbor' && game.state !== 'title'); const was = on; setOn(want);
    // [v105] HARBOR SPECTATE: show + stream the whole coast island (terrain chunks / LOD follow the spectate camera); no docking or walking
    const view = !on && game.mode === 'pvp' && !!ctx.pvp()?.specHarbor && game.state !== 'title'; if (view !== viewing) { viewing = view; world.root.visible = view || on; setZone(view || on); harborExtras(view || on); } // [v330] t1754u + the scene-level island pieces if (view) world.update(camera.position, game.t, game.storm || 0);
    treasure.tick(); squadHall?.tick?.(performance.now()); if (friends) { friends.tick(performance.now()); if (!frPickerHooked) hookFriendsPicker(); } // [v356 friends] presence heartbeat ~30 s (8 s while the panel is open)
    if (specFrom && ctx.pvp()?.where === 'arena') specFrom = null; // [fort-spectate-return] joined a battle: no castle return
    if (!on) return;
    const s = P(), now = game.t; uTime.value = now;
    // [Emerly sail-around] canoe / offshore-anchor tick (owns camera while paddling)
    const canoeCam = canoe?.tick(dt, { s, onFoot, W: walker.w, joy: walker.w.joy, camera, controls, pirateObj: pirate.object }); // [v314] the canoe reads its own keys
    if ((!was || (s.alive && !wasAlive)) && s.alive) { canoe?.clearAll?.(s, controls); spawnNow(s); if (!was) fortReturn(); } wasAlive = !!s.alive; // [v152]/[v157] + [v328] stow offshore canoe before berth snap
    if (hidden() && docking.fresh()) docking.st.spawnAt = performance.now(); // [v157] the clash grace starts when the name card closes
    { const cd = Math.max(s.cd?.port || 0, s.cd?.star || 0); if (lastHp !== null && s.hp < lastHp - 0.01) { combatT = now; lastHitT = now; } else if (cd > lastCd + 0.05) combatT = now; lastHp = s.hp; lastCd = cd;
      const b = (mapSt.ai || []).some(e => e.boss); if (bossOn && !b) treasure.soon(6000); bossOn = b; } // a boss just sank: its map drop shows soon
    if (restPosed() && (!s.alive || s.sinking || lastHitT === now)) standUp('hit'); // [bed-desk] a hit / your ship sinking = up out of the bunk / chair
    if (!s.alive) { if (docking.mode !== 'sea') docking.release(); if (onFoot) goAboard(true); }
    const r = docking.tick(s, dt);
    syncDockHud();
    if (r === 'docked') toast('MOORED · SAFE HARBOR');
    if (r === 'free') { s.anchor = false; s.sail = Math.max(1, s.sail); leftAt = now; }
    zone.tick(s, now);
    battery?.tick(dt, walker, onFoot); // [Timothy] aim the gun you stand at, fly the cosmetic balls
    // HUD tag
    const g = zone.graceLeft(s, now);
    // [v330 perf] the two pills only touch the DOM when what they show changes (were 3-6 style / class / text writes every frame)
    if (onFoot) {
      pill(safeTag, false); // BANKSY: no SAFE HARBOR tag while walking the island
      // [backpack-pvp] Island Safe Zone pill (never while inside a cottage — BANKSY)
      if (SAFEZONES_ON && !houses?.inHouse && !shipHull?.inHull) {
        const W = walker.w, tnow = now;
        const zn = tickIsleSafe(isleSafeHud, ...layout.harborToFoot(W.x, W.z), tnow); // walker = harbor frame
        const gl = graceLeft(isleSafeHud, tnow, SAFE_GRACE_S);
        if (zn) pill(isleSafeTag, false); // [v340] BANKSY t1805u: no floating SAFE ZONE HUD banner text; safe-zone rules unchanged (was `🛡️ SAFE ZONE · ${zn.name}`)
        else if (gl > 0) pill(isleSafeTag, true, 'grace', `NO FIRING · ${Math.ceil(gl)}s`);
        else pill(isleSafeTag, false);
      } else pill(isleSafeTag, false);
    } else {
      pill(isleSafeTag, false);
      if (s._safe) pill(safeTag, false); // [v176] BANKSY: no ⚓ SAFE HARBOR pill (it covered the top hint); the zone itself is unchanged
      else if (g > 0) pill(safeTag, true, 'grace', `NO FIRING · ${Math.ceil(g)}`);
      else pill(safeTag, false);
    }
    // prompts
    if (onFoot) {
      if ((document.getElementById('crew-room')?.classList.contains('on') || window.PFP_PETS?.isOpen)) {
        const w = walker.w; for (const code in w.keys) w.keys[code] = false;
        w.joy.on = false; w.joy.x = w.joy.y = 0; w.jumpQ = false; w.speed = 0; w.drags.clear();
      } // phone pointer capture / held controller input cannot walk behind the wardrobe
      if (!zip?.riding && !houses?.inHouse) ladders?.tick(dt); /* [dock-ladders] before the walker: swim into a ladder / JUMP next to it = climb */ walker.update(dt); houses?.tick?.(dt); /* [storage-houses] pin interior floor AFTER walker ground */ crewF?.update(dt, camera); petF?.update(dt, walker.w, { camera, pirateObj: pirate.object, petId: getLocalGear().parrot }); if (pillyF) { if (pillyS?.show) pillyF.update(dt, walker.w, { camera, hide: !!shipHull?.inHull || !!houses?.inHouse }); else if (pillyF.active) pillyF.exit(); }
      world.foot.areas?.onPlayer(layout.harborToFoot(walker.w.x, walker.w.z), game.t, areaApi); // [island-rework] traps / leaving the dock
      const W = walker.w, b = docking.berth;
      let best = null, bd = 1e9;
      let skinAct = null; // [dock-skin] BANKSY 8:42 PM: E = BOARD SHIP, Q = CHANGE SKIN at your own berth (phone: a 2nd button, pad: X)
      // [board-anywhere] BANKSY t1722u "make it so they can board their ship anywhere around it": the berth's step-ashore spot, OR within
      // BOARD_REACH.hull m of your moored hull (js/hullReach.js oriented box: bow, stern, port, starboard), on the pier or swimming beside it
      if (!houses?.inHouse && b && docking.mode === 'docked' && boardReach(W, b, s)) { const wet = !!W.swim; best = { label: 'BOARD SHIP', fn: () => { skinPick.close(); canoe?.clearAll?.(s); goAboard(wet); } };
        if (!wet) skinAct = { label: 'CHANGE SKIN', key: 'Q', fn: () => (skinPick.isOpen ? skinPick.close() : skinPick.open()) }; }
      if (FLAG_DAILY) { try { const h = ctx.pvp?.()?.holder; globalThis.__pfpFlagDailyHolder = h ? { on: !!h.on, claimed: !!h.claimed, checked: !!h.checked } : null; } catch { globalThis.__pfpFlagDailyHolder = null; } } // [castle-flag-daily] fort.label reads this
      if (zip?.riding) { setActs({ label: 'JUMP / E · DROP OFF', key: 'E', primary: true, fn: () => { walker.w.zipDrop = true; } }, { label: 'S / Q · TURN BACK', key: 'Q', fn: () => zip.reverse?.() }); }
      else if (ladders?.climbing) setActs(null, null); // [dock-ladders] mid-climb: no prompts (the climb itself never has one)
      else if (shipHull?.inHull) {
        shipHull.tick?.();
        const hp = shipHull.prompts();
        const run = (tag) => { const r = shipHull.act(tag); if (r === 'leave') leaveHull(); };
        // [v350 t1838u] door-only LEAVE HULL (tag:'leave'); chest = OPEN STORAGE only; mid-room = clear #dk-acts
        setActs(hp?.a ? { label: hp.a.label, key: hp.a.key || 'E', primary: !!hp.a.primary, tag: hp.a.tag, pad: hp.a.tag === 'leave' ? 'Y' : undefined, fn: () => run(hp.a.tag) } : null,
                hp?.b ? { label: hp.b.label, key: hp.b.key || 'Q', primary: !!hp.b.primary, tag: hp.b.tag, fn: () => run(hp.b.tag) } : null,
                null);
        skinPick.close();
      }
      else if (houses?.inHouse) { const hp = houses.prompts({ onFoot: true, W }); const a = hp?.a || (hp && { label: hp.label, key: hp.key || 'E', primary: !!hp.primary, tag: hp.tag }); const b = hp?.b || null; setActs(a ? { label: a.label, key: a.key || 'E', primary: !!a.primary, fn: () => houses.act(a.tag, { door: hp.door }) } : null, b ? { label: b.label, key: b.key || 'Q', primary: !!b.primary, fn: () => houses.act(b.tag) } : null); skinPick.close(); }
      else {
        if (!best) for (const q of [...layout.interact, ...world.footInteract, ...(zip?.spots || [])]) { if (q.used || q.src?.hidden?.()) continue; /* [wish] a spot that is switched off */ const d = Math.hypot(q.x - W.x, q.z - W.z); if (d < (q.r || 3) && d < bd) { bd = d; best = { label: (q.src?.area && world.foot.areas?.label(q.src)) || treasure.label(q) || q.label, fn: () => interact(q) }; } }
        if (!best && lootBags?.on) { const lp = lootBags.prompts({ onFoot: true, W }); if (lp) best = { label: lp.label, primary: true, key: 'E', fn: () => lootBags.act() }; }
        if (!best && houses?.on) { const hp = houses.prompts({ onFoot: true, W }); if (hp) best = { label: hp.label, primary: !!hp.primary, key: hp.key || 'E', fn: () => houses.act(hp.tag, { door: hp.door }) }; }
        { const cp = canoe?.prompts({ s, onFoot: true, W, docking });
          if (cp?.a && !best) {
            const run = (tag) => canoe.act(tag, { s, controls, goAshoreAt, goAboard: (inst) => goAboard(inst), docking, walkerExit: () => { onFoot = false; walker.exit(); crewF?.exit(); petF?.exit(); pillyF?.exit(); document.documentElement.classList.remove('pfp-onfoot'); }, walker });
            setActs({ label: cp.a.label, key: 'E', primary: true, fn: () => run(cp.a.tag) }, skinAct);
          } else setActs(best ? { ...best, key: 'E', primary: true } : null, skinAct); }
      }
    } else if (docking.mode === 'docked') setActs({ label: 'GO ASHORE', key: 'E', primary: true, fn: goAshore }, { label: 'SET SAIL', key: 'W', fn: setSail }, { label: 'ENTER HULL', key: 'H', pad: 'Y', fn: enterHull }); // [v349] pad Triangle / Y
    else if (canoe?.mode === 'canoe') { // [v314] before the ship prompts: GO TO ISLAND (E) + BOARD SHIP (Q) can both show
      const cp = canoe.prompts({ s, onFoot: false, W: walker.w, docking });
      const run = (tag) => canoe.act(tag, { s, controls, goAshoreAt, goAboard: (inst) => goAboard(inst), docking, walker });
      const mk = (q, k) => (!q ? null : q.disabled ? q : { label: q.label, key: q.key || k, primary: !!q.primary, fn: () => run(q.tag) });
      setActs(mk(cp?.a, 'E'), mk(cp?.b, 'Q'));
    }
    else if (docking.mode === 'sea' && s.alive && game.state === 'playing') {
      // [v314] BANKSY t1675u: the dock approach ALWAYS wins; the canoe prompt only shows when you anchored with the on-screen ⚓ offshore
      const q = now - leftAt > 5 ? docking.query(s) : null; // no DOCK prompt for 5 s after SET SAIL
      const cp = q ? null : canoe?.prompts({ s, onFoot: false, W: walker.w, docking });
      if (q) {
        if (q.reason === 'fast') setActs({ label: 'SLOW DOWN TO DOCK', disabled: true }, null);
        else if (q.reason === 'full') setActs({ label: 'ALL BERTHS TAKEN', disabled: true }, null);
        else if (q.reason === 'taken') setActs({ label: 'BERTH TAKEN', disabled: true }, null);
        else setActs({ label: '⚓ DOCK', key: 'E', primary: true, fn: () => dockNow(q.berth) }, null);
      } else if (s.anchor && cp?.a) {
        // [v333] BANKSY t1768u: anchored at sea → ENTER HULL / LAUNCH CANOE / WEIGH ANCHOR
        const run = (tag) => canoe.act(tag, { s, controls, goAshoreAt, goAboard, docking, walkerExit: () => { onFoot = false; walker.exit(); crewF?.exit(); petF?.exit(); pillyF?.exit(); document.documentElement.classList.remove('pfp-onfoot'); }, walker });
        const canoeAct = cp.a.disabled ? cp.a : { label: (cp.a.tag === 'launchCanoe' ? 'LAUNCH CANOE' : cp.a.label), key: 'Q', primary: false, fn: () => run(cp.a.tag) };
        setActs({ label: 'ENTER HULL', key: 'E', pad: 'Y', primary: true, fn: enterHull }, canoeAct, { label: 'WEIGH ANCHOR', key: 'W', fn: weighAnchor }); // [v349] pad Triangle / Y = ENTER HULL (LAUNCH CANOE stays X / □, WEIGH ANCHOR keeps W)
      } else if (cp?.a) {
        const run = (tag) => canoe.act(tag, { s, controls, goAshoreAt, goAboard, docking, walkerExit: () => { onFoot = false; walker.exit(); crewF?.exit(); petF?.exit(); pillyF?.exit(); document.documentElement.classList.remove('pfp-onfoot'); }, walker });
        setActs(cp.a.disabled ? cp.a : { label: cp.a.label, key: cp.a.key || 'E', primary: !!cp.a.primary, fn: () => run(cp.a.tag) }, null);
      } else if (s.anchor) {
        setActs({ label: 'ENTER HULL', key: 'E', pad: 'Y', primary: true, fn: enterHull }, null, { label: 'WEIGH ANCHOR', key: 'W', fn: weighAnchor }); // [v349] pad Triangle / Y
      } else setActs(null, null);
    } else setActs(null, null);
    battle?.tick(dt, onFoot, pirate); // [Timothy] battle areas: weapons, swings / shots, KOs, HUD
    mm?.tick(dt, onFoot && !shipHull?.inHull); // [v349 money-makers]
    if (onFoot) lootBags?.tick?.(dt, { walker: walker.w }); // [backpack-pvp]
    fnet.tick(dt);
    if (onFoot) crewFight.tick(dt); else if (crewFight.active) crewFight.clear(); // [backpack-pvp] after every crew moved
    if (!onFoot) lootBags?.tick?.(dt, { ship: P(), sailing: !canoe || canoe.mode !== 'canoe', canoe: canoe?.mode === 'canoe' ? { x: canoe.state.cx, z: canoe.state.cz } : null }); // sea crates bob + scoop while sailing
    signs.tick(dt, (b) => docking.berth === b && docking.mode === 'docked' ? (ctx.pvp()?.name || 'PIRATE') : (docking.takenBy(b.id) ? peerNames.get(docking.takenBy(b.id)) || 'PIRATE' : ''));
    if (bcLink) bcLink.tick();
  }
  // camera: true = we drove it this frame (main.js skips its ship camera)
  function footNetState(fast = false) {
    if (canoe?.mode !== 'canoe') return { ...fnet.netState(walker, fast), cn: null };
    const o = pirate.object, c = canoe.state;
    return { ...fnet.netState({ active: true, w: { x: o.position.x, z: o.position.z, yaw: c.cyaw, speed: 0 } }, true),
      cn: [o.position.y, o.rotation.x, o.rotation.z] };
  }
  function cameraHook() { const pos = onFoot ? walker.w : ctx.getPlayer?.(); const shown = on && !shipHull?.inHull && !houses?.inHouse; pumpfun.update(shown, pos, game.t); plaza.update(shown, {position:pos, nearHQ:pumpfun.near, hqOpen:pumpfun.openNow}); if (!on) return false; if (!shipHull?.inHull && !houses?.inHouse) world.update(camera.position, game.t, game.storm || 0); return onFoot || canoe?.mode === 'canoe' || !!houses?.inHouse || !!shipHull?.inHull; }

  // ---------- test transport (?harborbc=1): two tabs share a BroadcastChannel as their "harbor room" ----------
  let bcLink = null;
  if (new URLSearchParams(location.search).has('harborbc')) {
    const ch = new BroadcastChannel('pfp-harbor-test'); let last = 0;
    ch.onmessage = (ev) => { if (!on) return; const m = ev.data; if (Number.isInteger(m?.emo)) { const a = api.peerEmote(m.i, m.emo); if (a) showEmote(a, m.emo, { anchor: a, vol: 0 }); return; } handlePeer(m); }; // [Raul emotes] 'emo' on the 2-tab test channel
    bcLink = { tick() { const now = performance.now(); if (now - last < 250) return; last = now; ch.postMessage({ i: myId(), n: ctx.pvp()?.name || 'PIRATE', ...footNetState(), ...(battery?.netState() || {}), ...(battle?.netState() || {}), gr: gearToWire(getLocalGear()), sk: ctx.pvp()?.skinId || 'classic' }); }, emo: (e) => ch.postMessage({ i: myId(), emo: e }) };
  }
  function handlePeer(m) { if (m && typeof m.n === 'string') peerNames.set(m.i, m.n); battery?.onPeer(m); const r = fnet.onPeerState(m); battle?.onPeer(m); houses?.onPeerState?.(m); mm?.onPeer?.(m); /* [v349] */
    if (r && r.spawnMoved !== undefined) { const s = P(), b = r.spawnMoved; // [v152] two pirates spawned onto the same berth: the other keeps it
      const go = () => { if (!on || onFoot || !docking.fresh()) return;
        if (b) { docking.moor(s, b); ctx.camReset?.(); if (!hidden()) toast(`BERTH TAKEN · MOORED AT ${b.id}`); }
        else { docking.release(); if (spawnFrom) { s.x = spawnFrom.x; s.z = spawnFrom.z; s.yaw = spawnFrom.yaw; s.speed = 0; s.anchor = false; ctx.camReset?.(); } if (!hidden()) toast('ALL BERTHS TAKEN · AT SEA'); } };
      fadeTo(go); // [v157] a fade, never a visible jump (the name card is see-through)
      return; }
    if (r && r.moved !== undefined) { if (r.moved) { dockNow(r.moved); toast(`BERTH TAKEN · MOVING TO ${r.moved.id}`); } else { docking.release(); toast('NO FREE BERTH'); } } }

  const CREW_EMOTE = { 0: 0, 1: 100, 2: 100, 4: 4, 6: 6, 7: 7 };
  const api = {
    layout, world, zone, docking, walker, fnet, NO_TARGET, plaza, battery, battle, crewFight, toast: (m, ms) => toast(m, ms), // [v347] shore <-> sea combat toasts (pvp.js)
    get lootBags() { return lootBags; }, safeZone: { inside: (x, z) => insideSafeZoneH(x, z), zoneAt: (x, z) => zoneAtH(x, z), coliseum: (x, z) => isInsideColiseumH(x, z), hud: isleSafeHud },
    get on() { return on; }, get onFoot() { return onFoot; }, get canoeing() { return canoe?.mode === 'canoe'; }, get inHull() { return !!shipHull?.inHull; }, get posed() { return restPosed(); }, standUp, shipHull, canoe, pet: petF, pirate, goAshoreAt,
    ship, camera: cameraHook,
    focus: () => (on && onFoot ? walker.w : on && canoe?.mode === 'canoe' ? { x: canoe.state.cx, z: canoe.state.cz } : null), followers: crewF, // [v314] the sea follows the canoe
    canoeHull: () => (on ? canoe?.hullCap?.() : null),
    // [Raul emotes] the crew's answer: copy Arr! / Attack! / Yo ho ho!, bow on GG, nod + look on the points (Follow me! / Boss incoming!); none on Need help! / Retreat!
    // [Raul emotes] quick-chat on land (js/emotes.js sendEmote / js/pvp.js onEmote): body motion (js/onfoot/emotePose.js) on your pirate, your shore
    // crew answer it (CREW_EMOTE, staggered); returns the pirate to hang the bubble over (null = aboard: the bubble stays on the ship)
    footEmote(e) { if (!on || !onFoot || !pirate.object.visible || restPosed()) return null; pirate.emote(e); // [bed-desk] no jig in bed
      const ce = CREW_EMOTE[e]; if (ce != null) (crewF?.list || []).forEach((c, i) => { if (c.p.object.visible) c.p.emote(ce, 0.12 + i * 0.1); });
      bcLink?.emo?.(e); return pirate.object; },
    peerEmote(id, e) { const p = on ? fnet.peers.get(id) : null; if (!p) return null; p.pirate.emote(e); return p.pirate.object; },   // a harbor pirate walking in YOUR copy
    canFire(s) { if (!on) return true; const ok = zone.canFire(s, game.t);
      if (!ok && s === P() && !onFoot && performance.now() - lastShot > 1200) { lastShot = performance.now(); toast(zone.inside(s.x, s.z) ? 'SAFE HARBOR · NO FIRING' : 'NO FIRING · JUST LEFT SAFE HARBOR', 1200); }
      return ok; },
    invuln: (s) => on && (zone.inside(s.x, s.z) || !!shipHull?.inHull),
    isSafe: (s) => on && !!s && zone.inside(s.x, s.z),
    aiSteer: (e, desired) => on ? zone.steer(e, desired) : desired,
    netState: () => (on ? { ...footNetState((battle?.fastHz?.() || 0) > 1), ...(battery?.netState() || {}), ...(battle?.netState() || {}), ...(houses?.netState?.() || {}), ...(mm?.netState?.() || {}) } : {}), // [v349] + mc (smuggler crate) // [Timothy] + 'bc'/'ba'/'bh' · [storage-houses] + ih
    onPeerState: (m) => { if (on) handlePeer(m); else if (m && typeof m.i === 'string' && typeof m.dk === 'string' && m.dk) docking.onPeer(m.i, m.dk, m.ds === 1 ? 1 : 0); }, // [v157] off: just note their berth (spawnPick skips it)
    // [v339] Harbor session auto-resume helpers (js/main.js pfp_harbor_resume_v1)
    resumeState: () => { const W = walker?.w, s = P?.(); return { onFoot: !!onFoot && !shipHull?.inHull && canoe?.mode !== 'canoe', inHull: !!shipHull?.inHull, moored: docking.mode === 'docked', x: +(onFoot ? W?.x : s?.x) || 0, z: +(onFoot ? W?.z : s?.z) || 0, yaw: +(onFoot ? W?.yaw : s?.yaw) || 0 }; },
    // [v347] BANKSY t1826u "make them spawn at ship when refresh tab incase get stuck": a tab refresh NEVER puts you back ashore / in the
    // hull where you were (that re-trapped pirates stuck in geometry): always aboard YOUR ship at its Harbor berth.
    applyResume: (r) => { if (!r || !on) return false; try { const s = P();
      if (shipHull?.inHull) leaveHull(); if (onFoot) goAboard(true); canoe?.clearAll?.(s, controls);
      if (docking.mode !== 'docked' && s) { s.alive = true; s.sinking = 0; if (s.mesh) s.mesh.visible = true; docking.release(); spawnNow(s); }
      return docking.mode === 'docked' && !onFoot && !shipHull?.inHull;
    } catch (e) { console.warn('[resume] apply', e); return false; } },
    ladders, /* [dock-ladders] */ dockAt: (id) => { const b = layout.berths.find(q => q.id === id); if (b) dockNow(b); }, goAshore, goAboard, setSail, enterHull, leaveHull, weighAnchor, interact, zipline: zip, /* [Emerly zipline] */  openBoard, closeBoard, treasure, houses, get inventory() { return inventory; },
    // [v103] main.js drawRadar: on foot, draw the island map instead (true = drawn)
    drawMinimap: (ctx, W, st = {}) => { mapSt = st; if (on && !onFoot && !imap.ready) imap.bakeRows(4); const ok = on && onFoot && imap.drawLocal(ctx, W, minimapState(st), walker.w.camYaw); radarEl?.classList.toggle('isle-tap', !!ok); updateMapLocHud(); return ok; }, // [v108] on foot only (local, heading-up); on the ship = the original harbor radar
    islandMap: imap, openIsleMap,
    // [t1726u] ZERO Safe Zone / Safe Harbor visuals on the at-sea ship radar
    radarZones: () => false,
    stats: () => ({ ...world.stats, berths: layout.berths.length, shipCircles: layout.shipCircles.length, sets: sets.length }),
  };
  harborExtras(on || viewing); // [v330] t1754u: the scene-level island pieces start hidden until the harbor world switches on
  return api;
}
