// [Timothy] PUMPFUN PIRATES · BATTLE AREAS, game side (BANKSY, approved 1:40 PM Nov 3): on-foot SWORD fights in the SWORD PIT and
// MUSKET fights at the MUSKET RANGE (js/island/battleAreas.js: layout + static art). Harbor only, on foot only.
//  - walk into the pit (inside the rope ring) = your SWORD is drawn; walk into the range (inside the fence) = you shoulder a MUSKET.
//    Leave and it is put away and you are back to full health. Everywhere else nothing changes.
//  - attack: F, a left click (a click, not a camera drag) or the phone's round SWING / FIRE button. Sword: 3 hits = KO (arc in
//    front of you, ~2.5 m). Musket: aim with the camera, 5-6 hits = KO (19 dmg), 1.25 s reload; crates / barrels / hay bales stop a ball.
//  - KO: you drop for 3 s and get back up at the gate with full health (1.5 s guard). Free-for-all by default (1v1 = two pirates);
//    [Emerly] 2v2 TEAMS: tap the team chip in the HUD (desktop: G) to cycle FFA -> RED -> BLUE. Teammates can't hurt each other,
//    respawn on their own side, and the HUD keeps a RED · BLUE KO tally (this device only, no rewards). Up to the harbor
//    room's 4 pirates. Practice alone: 2 straw dummies in the pit, 3 flip targets on the range lanes.
//  - COSMETIC + NO REWARDS (BANKSY): arena KOs are NEVER sent to pvp_claim_kill, never count towards a kill goal, pay no gold and
//    touch no stat, save or ship HP. The only thing a KO changes is this little HUD tally (this session, this device).
//  - weapons: the sword + musket you USE AS PRIMARY (inventory rare-equip -> carriedWeapons) or, if none, the WEAPON STORE pick
//    (gear.sword / gear.musket). Look = the base id (SWORD_IDS / MUSKET_IDS); rarity stats via PFP_WEAPON_RARITY (my swings only).
//    &pitsword=0 = store pick only (old). Peers see the look index in ba[5] / ba[7].
//  - animation: the v5 clips are idle / walk / run / cannon / steer only, so the sword swing and the musket aim / fire are
//    procedural: after the clip each frame the right (and for the musket, left) upper arm + forearm are aimed at key directions
//    in the pirate's own space (+ a little spine twist), the legs keep their walk / run clip.
// Network: two small fields in the harbor room state you already send (js/onfoot/net.js / js/transport.js only send what changed):
//   ba = [zone 1 pit | 2 range, hp, life, actSeq, actKind 1 swing | 2 fire, sword index, down 0|1, musket index, team 0 FFA | 1 RED | 2 BLUE]   (0 = not in an area)
//   [Emerly] while you share an area with another pirate the harbor room sends YOUR state faster (fastHz(): HARBOR_NET.fight, 10 Hz
//   1v1, 5 Hz for 3-4 fighters; js/transport.js Batcher.boost), so swings / shots / hits land in ~0.1-0.2 s instead of up to ~1 s.
//   Everyone else in the harbor keeps the 1 Hz room rate.
//   bh = { victimId: [their life, damage you dealt that life] }  cumulative, so a lost message never loses a hit. The VICTIM applies
//   it (and checks you were in the same area and close enough): no new service, no new message, older clients ignore both.
import * as THREE from 'three';
import { SHIP_RANGE } from '../shoreCombat.js'; // [v347] t1821u musket balls reach ships over the water
import * as CO from '../island/coast.js';
import * as BA from '../island/battleAreas.js';
import { swordGeo, musketGeo, swordGlow, SWORD_IDS, SWORD_DEFAULT, MUSKET_IDS, MUSKET_DEFAULT, musketMuzzle, loadWeaponModels, weaponEmpty, applyLegendaryOrnament } from './swords.js';
import { toon } from '../toon.js';
import { carryArmed } from '../carryWeapons.js';
import { pitSwordOn, pitWeaponId } from '../carryRules.js'; // [Emerly pitsword]
import { carriedWeapons } from '../pirateGear.js';
import { isKey, binds, keyName, anyModalOpen } from '../keybinds.js'; // [v339] weapon key (Q) replaces Tab for stance cycle // [Emerly pitsword] inventory USE AS PRIMARY
import { swordHand, mirrorTwist, handAxis } from './swordHand.js';
import { isNetId } from '../safe.js';
import { ADM } from '../adminState.js'; // [admin-menu] GOD MODE / FREEZE
import { HARBOR_NET } from '../config.js'; // [Emerly] fight sync rate while two pirates share an area
import { createTps, TPS_ON } from './tps.js';
import { padActive, padGlyph } from '../gamepad.js'; // [Emerly gamepad] HUD hints name the pad buttons while a pad is in use
import { applyMuskUpg, muskLook, swordLook, applyGunAcc, gunAccOn, gunAcc } from '../musketUpgrades.js';
import { localWeaponLook, decodeWeaponLook, setObjLook, COMMON_LOOK, wsyncOn } from './weaponLook.js'; // [weapon-sync] rarity + attachments: yours + every peer's ('wl')
import { decorateSword, decorateMusket, swordTint, musketTint } from './weaponDecor.js'; // [Emerly gunacc] accessories on the held musket // [Emerly musket-upgrades] + [musket-rank] look
import { weaponStats } from '../inventory/catalog.js'; // [inventory v209] rarity stats on the equipped sword / musket (common = the ARENA numbers exactly) // [Timothy tps] Fortnite-style over-the-shoulder musket aim (&tps=0 = off)
import { canFightOnFoot, tickIsleSafe, graceLeft, SAFE_GRACE_S, SAFEZONES_ON, insideSafeZoneH, isInsideColiseumH } from '../island/safeZones.js'; // [backpack-pvp]
import { zipGrip } from '../dock/zipline.js'; // [zipline-shoot] one-hand trolley grip while GUN is drawn mid-ride

import { STANCES_ON, STANCE_LABEL, STANCE_ICON, stanceForKey, stanceTap, holsterToggle, nextStance, peerReach, openHitOk, footRegenStep } from './stances.js'; // [backpack-pvp] t1710u UNARMED / SWORD / GUN anywhere on foot

// [backpack-pvp] BANKSY t1711u "Make players take 5-6 shots to kill": 100 HP, sword + musket 19 dmg (common 6 hits; rare / epic 20 and
// legendary 21 = 5 hits; + bayonet 3 point-blank still 5). Musket reload 1.25 s (was 2.0) so a 5-6 shot firefight stays snappy.
export const ARENA = {
  hp: 100, sword: { dmg: 19, reach: 2.5, arc: 1.15, cool: 0.55, dur: 0.42, hitAt: 0.2 },
  musket: { dmg: 19, range: 60, wide: 0.55, reload: 1.25, delay: 0.16 }, downS: 3, guardS: 1.5,
};

const Z_PIT = 1, Z_RANGE = 2; // (also the held stance codes: 1 sword drawn, 2 gun drawn)
// [inventory v209] MY weapon's numbers: ARENA + the equipped rarity (window.PFP_WEAPON_RARITY from the inventory; DB flag weapon_stats via inv_state, else catalog FLAGS). Peers' replays stay on ARENA.
const myW = (slot) => { const o = myW0(slot); return slot === 'musket' ? (gunAccOn() ? applyGunAcc : (x) => x)(applyMuskUpg(o, (typeof window !== 'undefined' && window.PFP_WEAPON_RARITY?.musket) || 'common')) : o; }; // + [gunacc] // [Emerly musket-upgrades] tiers on top, capped by the musket's rank
const myW0 = (slot) => { const f = typeof window !== 'undefined' && window.PFP_INV_FLAGS; return weaponStats(slot, (typeof window !== 'undefined' && window.PFP_WEAPON_RARITY?.[slot]) || 'common', ARENA[slot], f && 'weapon_stats' in f ? !!f.weapon_stats : undefined); };
const CSS = `
#bt-hud{position:fixed;left:50%;top:calc(var(--safe-t,0px) + 54px);transform:translateX(-50%);z-index:8;pointer-events:none;display:none;text-align:center;font:22px 'Just Another Hand',cursive;color:#ffcd77;letter-spacing:.05em}
#bt-hud b{display:inline-block;background:rgba(22,22,22,.8);border:2px solid #ffcd77;border-radius:999px;padding:2px 16px 0}
#bt-hud small{display:block;font-size:17px;color:#fff;text-shadow:0 1px 3px #000}
#bt-hud .tm{pointer-events:auto;cursor:pointer;margin-left:8px;vertical-align:2px;font:20px 'Just Another Hand',cursive;letter-spacing:.05em;padding:2px 12px 0;border-radius:999px;border:2px solid #ffcd77;background:rgba(22,22,22,.8);color:#ffcd77;touch-action:manipulation}
#bt-hud .tm.t1{background:#c0221d;color:#fff}
#bt-hud .tm.t2{background:#1f56c8;color:#fff}
#bt-hud .sc{display:block;font-size:20px;color:#ffcd77;text-shadow:0 1px 3px #000}
#bt-hud .sc i{font-style:normal;color:#ff6a5a}
#bt-hud .sc u{text-decoration:none;color:#7fb2ff}
html.bt-on #dk-safe{display:none!important}
#bt-atk{position:fixed;right:calc(var(--safe-r,0px) + 26px);bottom:calc(var(--safe-b,0px) + 150px);width:92px;height:92px;border-radius:50%;z-index:8;display:none;font:26px 'Just Another Hand',cursive;color:#fff;background:radial-gradient(#ff3b30,#a8110c);border:4px solid #ffcd77;box-shadow:0 4px 10px rgba(0,0,0,.55);touch-action:none;padding:4px 0 0;letter-spacing:.04em}
#bt-atk:active,#bt-atk.hit{transform:scale(.9)}
#bt-atk[disabled]{filter:grayscale(.7) brightness(.8)}
html.dk-touch.bt-on #bt-atk{display:block}
#bt-flash{position:fixed;inset:0;pointer-events:none;z-index:7;background:radial-gradient(transparent 55%,rgba(216,50,47,.55));opacity:0;transition:opacity .35s}
#bt-msg{position:fixed;left:50%;top:30%;transform:translate(-50%,-50%);z-index:9;pointer-events:none;font:40px 'Just Another Hand',cursive;color:#fff;text-shadow:0 3px 6px #000;opacity:0;transition:opacity .25s;text-align:center;white-space:nowrap}
#bt-msg small{display:block;font-size:22px;color:#ffcd77}
@media (max-width:600px){#bt-hud{top:calc(var(--safe-t,0px) + 112px)}}
/* [t1730u] compact circular weapon switch directly ABOVE #btn-emote (💬) — cycles Unarmed→Musket→Sword */
#bt-stance{position:fixed;right:calc(18px + var(--safe-r, 0px));bottom:calc(84px + var(--safe-b, 0px));width:52px;height:52px;border-radius:50%;z-index:18;display:none;align-items:center;justify-content:center;padding:0;margin:0;border:2px solid var(--gold, #f5c542);background:rgba(10,10,10,0.72);color:#fff;box-shadow:0 3px 0 #000;cursor:pointer;touch-action:manipulation;font-size:24px;line-height:1}
#bt-stance.on{display:flex}
#bt-stance .bt-ico{pointer-events:none;font-size:24px;line-height:1}
#bt-stance .bt-tab{pointer-events:none;position:absolute;right:-4px;top:-4px;font:bold 9px system-ui,sans-serif;letter-spacing:.04em;color:#161616;background:linear-gradient(#ffd98a,#d99a2b);border:1px solid #fff3c4;border-radius:4px;padding:1px 3px;box-shadow:0 1px 0 #000}
#bt-stance.safe-locked{border-color:#2ee88a;box-shadow:0 0 10px rgba(46,232,138,.45),0 3px 0 #000}
#bt-stance.safe-locked .bt-tab{display:none}
#bt-stance .bt-safe{display:none;position:absolute;left:-4px;bottom:-4px;font-size:12px;line-height:1;filter:drop-shadow(0 1px 0 #000)}
#bt-stance.safe-locked .bt-safe{display:block}
html.dk-touch #bt-stance .bt-tab{display:none}
@media (orientation: portrait){#bt-stance{right:calc(10px + var(--safe-r, 0px));bottom:calc(316px + var(--safe-b, 0px));width:46px;height:46px;font-size:22px}#bt-stance .bt-ico{font-size:22px}}
@media (orientation: landscape) and (max-height: 520px), (orientation: landscape) and (max-width: 760px){#bt-stance{right:calc(10px + var(--safe-r, 0px));bottom:auto;top:calc(44% - 54px);width:44px;height:44px;font-size:20px}#bt-stance .bt-ico{font-size:20px}}
`;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
// arm key directions in the pirate's own space (+Z front, +X his LEFT, +Y up). u = upper arm, f = forearm, b = where the blade points
const P_READY = { u: v3(-0.35, -0.75, 0.55), f: v3(-0.1, -0.15, 1), b: v3(0.1, 0.85, 0.5), sp: 0 };
const P_WIND = { u: v3(-0.75, 0.55, -0.1), f: v3(-0.35, 0.9, -0.15), b: v3(-0.25, 0.25, -0.95), sp: -0.35 };
const P_SLASH = { u: v3(0.35, -0.4, 0.82), f: v3(0.8, -0.3, 0.5), b: v3(0.9, -0.3, 0.3), sp: 0.45 };
const P_MUSKET = { uR: v3(-0.12, -0.5, 0.86), fR: v3(0.25, 0.12, 0.96), uL: v3(0.2, -0.3, 0.93), fL: v3(-0.5, 0.18, 0.85) };
const lerpDir = (a, b, t, out) => out.copy(a).lerp(b, t).normalize();
const ease = (t) => t * t * (3 - 2 * t);

export function createBattle({ scene, world, layout, walker, fnet, sfx, camera, canvas, touch, myId, myName, low, lootBags = null, inHouse = () => false, inventory = null, crewFight = null, kd = null, isSquadMate = null, respawnOnShip = null, ships = null }) { // [v347] ships: { test, hit, aim } (pvp.js gunShipTest / gunShipHit / gunAimCyls) // [backpack-pvp] + [v328] Harbor squad FF off + ship respawn
  const H = (lx, lz) => layout.footToHarbor(...CO.t2w(lx, lz));            // town-local -> harbor (scene) x, z
  const toTown = (x, z) => CO.w2t(...layout.harborToFoot(x, z));
  const yawW = (ly) => CO.t2wYaw(ly);
  const zoneAt = (x, z) => { const [lx, lz] = toTown(x, z); return BA.inPit(lx, lz, 0.3) ? Z_PIT : BA.inRange(lx, lz, 0.3) ? Z_RANGE : 0; };
  const mat = toon(0xffffff, null, { vertexColors: true, key: 'battle-props' });
  loadWeaponModels(low); // [Raul] v5 sword + musket GLBs (hi / lo) swap into the placeholder geometries when they land
  const outM = new THREE.MeshBasicMaterial({ color: 0x161616, side: THREE.BackSide });
  const root = new THREE.Group(); root.name = 'battle_areas'; scene.add(root);
  // [Emerly] weapons: the ink shell is pushed out along the normals by a constant amount (local units) instead of scaled about the grip / butt,
  // which overshot the blade tip + muzzle by 7 % of their length
  const shellM = (t) => { const m = new THREE.MeshBasicMaterial({ color: 0x161616, side: THREE.BackSide }); m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed += normalize(normal) * ${t.toFixed(4)};`); }; m.customProgramCacheKey = () => 'bt-shell-' + t; return m; };
  const shellSword = shellM(0.016), shellMusket = shellM(0.02);
  const goldM = toon(0xffffff, null, { vertexColors: true, emissive: 0x6b4a00, emissiveIntensity: 0.55, key: 'battle-gold-blade' }); // [Emerly] the LEGENDARY GOLD BLADE glows a little
  const weaponMesh = (geo, shell, m0 = mat) => { const m = new THREE.Mesh(geo, m0); if (!low) { const o = new THREE.Mesh(geo, shell); o.userData.outline = true; m.add(o); } return m; };
  const WSYNC_ON = wsyncOn(); // [weapon-sync] &wsync=0 = peers draw common weapons again
  const LOOKM = new Map(), lookMat = (lk) => { if (!lk) return mat; if (!LOOKM.has(lk.id)) LOOKM.set(lk.id, toon(lk.c, null, { vertexColors: true, emissive: lk.e, emissiveIntensity: lk.ei, key: 'battle-musk-' + lk.id })); return LOOKM.get(lk.id); }; // [Emerly musket-rank]
  const withOutline = (geo, k = 1.06) => { const m = new THREE.Mesh(geo, mat); if (!low) { const o = new THREE.Mesh(geo, outM); o.scale.setScalar(k); o.userData.outline = true; m.add(o); } return m; };

  // ---------- [Emerly] MAIN STREET WEAPON SHOPS: SWORD SHOP + MUSKET SHOP (config: js/island/battleAreas.js MAIN_ST_SHOPS) ----------
  // Each gets a door interact point (E / tap -> the shop window on its tab) + a simple placeholder hanging sign. The buildings are not touched here.
  // Timothy's Blender exteriors drop in later: an Object3D named door_swords / door_muskets anywhere in the scene becomes the door (polled, or call
  // battle.setShopDoor(id, obj)); its +z = out of the door. Works the same with either plaza (Main Street is not part of the plaza build).
  // storeDoors(): a helper listing other candidate doors, town-local { id, name, lx, lz, ly (the way the door faces), note } (ly = 0 faces +lz, towards the sea)
  function storeDoors() { const FM = layout.FM || {}, S = FM.STREET, PV = FM.PV, out = [];
    if (S && Array.isArray(FM.LOTS_MAP)) { const L = FM.LOTS_MAP.filter(l => !/SQUAD|SQUARE/.test(l.label || '')), west = L.filter(l => l.side === -1).sort((a, b) => b.z - a.z);
      for (const l of L) { const n = l.side === -1 ? west.indexOf(l) : west.findIndex(w => Math.abs(w.z - l.z) < 0.01), id = 'street:' + (l.side === -1 ? 'L' : 'R') + n;
        out.push({ id, name: 'Main Street house ' + (l.side === -1 ? 'L' : 'R') + n + (l.label ? ` · ${l.label}` : ''), lx: S.x + l.side * (S.half + 1 - 1.6), lz: l.z, ly: l.side === -1 ? Math.PI / 2 : -Math.PI / 2, house: { lx: l.lx, lz: l.z, w: l.w, d: l.d }, note: l.label ? 'already has a sign / prompt' : '' }); }
      const sq = FM.LOTS_MAP.find(l => /SQUAD/.test(l.label || '')); if (sq) out.push({ id: 'squadhall', name: 'SQUAD HALL', lx: sq.lx - 8.6, lz: sq.z, ly: -Math.PI / 2, house: { lx: sq.lx, lz: sq.z, w: sq.w, d: sq.d }, note: 'its door opens the Squad Hall board today' });
      out.push({ id: 'gate', name: 'TOWN GATE (top of Main Street)', lx: S.x, lz: S.z1 + 8, ly: 0, note: 'no building: a counter spot under the arch' }); }
    if (PV?.PLAZA_V2 && PV.FACADE_LZ !== undefined) { const fz = PV.FACADE_LZ + 0.7 + 3.8;
      for (const h of PV.HALLS || []) out.push({ id: 'plaza:' + h.id, name: 'PLAZA ' + (h.id === 'hall_w' ? 'WEST' : 'EAST') + ' TOKEN HALL (balconies)', lx: h.lx, lz: fz, ly: 0, note: 'token billboards on its ground floor' });
      for (const h of PV.HOUSES || []) out.push({ id: 'plaza:' + (h.tavern ? 'tavern_house' : 'house_' + h.lx), name: 'PLAZA ' + (h.tavern ? 'TAVERN HOUSE' : 'HOUSE') + ' (balconies)', lx: h.lx, lz: fz, ly: 0, note: '' });
      for (const sf of PV.STOREFRONTS || []) out.push({ id: 'plaza:' + sf.id, name: sf.name + ' (plaza row, balconies)', lx: sf.lx, lz: fz, ly: 0, note: 'already a shop (' + (sf.vendor || 'soon') + ')' }); }
    return out; }
  const SH = BA.MAIN_ST_SHOPS;
  const SH_SIGNS = SH.filter((r) => !r.noSign); // [t1714u] musket_upgrades shares the musket store facade (no 2nd outdoor sign)
  const shopSignTex = (() => { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 150 * Math.max(1, SH_SIGNS.length); const g = cv.getContext('2d'); // placeholder: js/island/art.js board() + text() style
    const draw = () => SH_SIGNS.forEach((r, i) => { const y = i * 150, w = 512, h = 150; g.fillStyle = '#5a3219'; g.fillRect(0, y, w, h); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(0, y + h * k / 4 + (k % 2) * 3); g.lineTo(w, y + h * k / 4); g.stroke(); } g.lineWidth = 10; g.strokeStyle = '#161616'; g.strokeRect(5, y + 5, w - 10, h - 10);
      const px = r.sign.length > 9 ? 100 : 120; g.font = `${px}px "Just Another Hand", cursive`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = px * 0.12; g.strokeStyle = '#161616'; g.strokeText(r.sign, 256, y + 80); g.fillStyle = '#ffcd77'; g.fillText(r.sign, 256, y + 80); });
    draw(); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; document.fonts?.ready?.then(() => { draw(); t.needsUpdate = true; }); return { cv, t }; })(); // redrawn once the hand font is in
  const shopSignMat = new THREE.MeshBasicMaterial({ map: shopSignTex.t, toneMapped: false }), ironM = toon(0x2b2f36, null, { key: 'battle-iron' });
  const boardGeo = (() => { const g = new THREE.BoxGeometry(2.9, 1.15, 0.12), c = new Float32Array(g.attributes.position.count * 3); for (let k = 0; k < c.length; k += 3) c.set([0.42, 0.27, 0.15], k); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; })();
  const shops = SH.map((r, i) => {
    const tab = r.tab || (r.id === 'musket_shop' ? 'muskets' : r.id === 'musket_upgrades' ? 'muskupg' : 'swords');
    const vendor = r.vendor || (tab === 'muskupg' ? 'musket_upgrades' : tab === 'muskets' ? 'muskets' : 'swords');
    const slot = r.slot || (tab === 'muskets' || tab === 'muskupg' ? 'musket' : 'sword');
    const [hx, hz] = H(r.lx, r.lz), wy = yawW(r.yaw), c = Math.cos(wy), sn = Math.sin(wy);
    const dx = hx + c * r.door[0] + sn * r.door[1], dz = hz - sn * r.door[0] + c * r.door[1]; // building frame -> harbor (three.js rotation.y)
    const q = { id: r.id, kind: 'shop', vendor, slot, tab, title: r.sign, x: dx, z: dz, r: r.r || 2.4, label: r.label }; layout.interact.push(q);
    let g = null;
    if (!r.noSign) {
      const si = SH_SIGNS.indexOf(r);
      g = new THREE.Group(); g.name = r.id + '_placeholder_sign'; g.position.set(hx, world.ground(hx, hz), hz); g.rotation.y = wy;
      const at = (m, px, py, pz, ry = 0) => { m.position.set(px, py, pz); m.rotation.y = ry; g.add(m); return m; }, sx = -r.w * 0.3, fz = r.d / 2;
      at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.4), ironM), sx, 3.9, fz + 0.7); at(withOutline(boardGeo, 1.03), sx, 3.3, fz + 1.25);
      for (const [ry, pz] of [[0, fz + 1.32], [Math.PI, fz + 1.18]]) { const geo = new THREE.PlaneGeometry(2.7, 0.95), uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (si + 1 - uv.getY(k)) / SH_SIGNS.length); at(new THREE.Mesh(geo, shopSignMat), sx, 3.3, pz, ry); }
      root.add(g);
    }
    const [dlx, dlz] = toTown(dx, dz);
    return { ...r, tab, vendor, slot, q, g, glb: null, door: { lx: dlx, lz: dlz, ly: r.yaw, house: { lx: r.lx, lz: r.lz, w: r.w, d: r.d } } };
  });
  // [v250]/[t1714u] door_swords / door_muskets hide the outdoor placeholder once the GLB loads.
  // Counter interact points (fixCounter) stay at the customer side of each physical counter — setShopDoor must NOT clobber them onto the doorway.
  const _dv = new THREE.Vector3(), _dq = new THREE.Quaternion(), _df = new THREE.Vector3();
  function setShopDoor(id, obj) {
    const hits = shops.filter((s) => s.id === id || (s.empty && obj?.name && s.empty === obj.name));
    const list = hits.length ? hits : shops.filter((s) => s.id === id);
    if (!list.length || !obj) return false;
    obj.updateWorldMatrix(true, false); obj.getWorldPosition(_dv); obj.getWorldQuaternion(_dq); _df.set(0, 0, 1).applyQuaternion(_dq);
    for (const s of list) {
      if (!s.fixCounter) {
        s.q.x = _dv.x - _df.x * 3.0; s.q.z = _dv.z - _df.z * 3.0; s.q.r = s.r || 3.2;
        [s.door.lx, s.door.lz] = toTown(s.q.x, s.q.z);
      }
      if (s.g) s.g.visible = false;
      s.glb = obj;
    }
    return true;
  }
  { let tries = 0; const poll = setInterval(() => {
    for (const empty of [...new Set(shops.map((s) => s.empty).filter(Boolean))]) {
      const o = scene.getObjectByName(empty); if (!o) continue;
      const pending = shops.filter((s) => s.empty === empty && !s.glb);
      if (pending.length) setShopDoor(pending[0].id, o);
    }
    if (shops.every((s) => s.glb || !s.empty) || ++tries > 60) clearInterval(poll);
  }, 3000); }
  const store = shops.find((s) => s.id === 'sword_shop') || shops[0] || null; // (tests / older callers)
  // [t1714u] openWeaponStore routes to the dedicated single-menu vendors
  window.openWeaponStore = (tab = 'swords') => {
    if (tab === 'muskupg') return window.openShop?.({ vendor: 'musket_upgrades', tab: 'muskupg', slot: 'musket', title: 'MUSKET UPGRADES' });
    if (tab === 'muskets') return window.openShop?.({ vendor: 'muskets', tab: 'muskets', slot: 'musket', title: 'MUSKET SHOP' });
    return window.openShop?.({ vendor: 'swords', tab: 'swords', slot: 'sword', title: 'SWORD SHOP' });
  };
  window.openMusketUpgrades = () => window.openWeaponStore('muskupg');

  // ---------- signs (one canvas, one material) ----------
  const SIGNS = [['MUSKET RANGE', '#ffcd77', '#5a3219'], ['SWORD PIT', '#ffcd77', '#5a3219']];
  { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const g = cv.getContext('2d');
    SIGNS.forEach(([t, fg, bg], i) => { const y = i * 128; g.fillStyle = bg; g.fillRect(0, y, 512, 128); g.strokeStyle = '#161616'; g.lineWidth = 10; g.strokeRect(5, y + 5, 502, 118);
      g.fillStyle = fg; g.font = '86px "Just Another Hand", cursive'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 256, y + 70); });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sm = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
    const plane = (i, w, h) => { const geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1 - uv.getY(k)) / 2); return new THREE.Mesh(geo, sm); };
    const put = (m, lx, lz, y, ly) => { const [x, z] = H(lx, lz); m.position.set(x, y, z); m.rotation.y = yawW(ly); root.add(m); };
    const R = BA.RANGE; put(plane(0, 4.6, 1.15), R.gate[0], R.lz1 + 0.22, R.y + 3.45, 0);
    const [gx, gz] = BA.pitAt(BA.PIT.gateA, BA.PIT.r + 0.42); put(plane(1, 3.4, 0.85), gx, gz, BA.PIT.y + 3.35, BA.PIT.gateA); }

  // ---------- range targets (flip back when hit) + pit dummies (wobble) ----------
  const ringGeo = (() => { const parts = [[0.72, 0xfff1d2], [0.56, 0xd8322f], [0.4, 0xfff1d2], [0.24, 0xd8322f], [0.1, 0x161616]];
    const gs = parts.map(([r, c], i) => { const g = new THREE.CylinderGeometry(r, r, 0.06, 20).toNonIndexed(); g.rotateX(Math.PI / 2); g.translate(0, 0, i * 0.008); const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let k = 0; k < n; k++) col.toArray(a, k * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; });
    const hang = new THREE.BoxGeometry(0.06, 0.5, 0.04).toNonIndexed(); hang.translate(0, 0.72, 0); { const n = hang.attributes.position.count, a = new Float32Array(n * 3); new THREE.Color(0x3d2a1c); for (let k = 0; k < n * 3; k += 3) { a[k] = 0.24; a[k + 1] = 0.16; a[k + 2] = 0.11; } hang.setAttribute('color', new THREE.BufferAttribute(a, 3)); hang.deleteAttribute('uv'); }
    gs.push(hang); return mergeAll(gs); })();
  function mergeAll(gs) { const pos = [], col = [], nor = []; for (const g of gs) { g.computeVertexNormals(); pos.push(...g.attributes.position.array); col.push(...g.attributes.color.array); nor.push(...g.attributes.normal.array); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g; }
  const targets = BA.RANGE.lanes.map((lx, i) => { const [x, z] = H(lx, BA.RANGE.targetLz - 0.2), piv = new THREE.Group(); piv.position.set(x, BA.RANGE.y + 2.4, z); piv.rotation.y = yawW(0); root.add(piv);
    const b = withOutline(ringGeo); b.position.set(0, -1.05, 0.08); piv.add(b); return { i, x, z, piv, flip: 0, t: 0, cx: x, cy: BA.RANGE.y + 1.35, cz: z }; });
  const dummyGeo = (() => { const S = 0xe6c35a, R = 0x8a5a2b, col = (g, c) => { g = g.toNonIndexed(); g.deleteAttribute('uv'); const cc = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let k = 0; k < n; k++) cc.toArray(a, k * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
    const tr = (g, x, y, z, sx = 1, sy = 1, sz = 1) => { g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
    return mergeAll([col(tr(new THREE.CylinderGeometry(0.34, 0.4, 0.9, 10), 0, 0.55, 0), S), col(tr(new THREE.SphereGeometry(0.3, 10, 8), 0, 1.25, 0), S), col(tr(new THREE.BoxGeometry(1.3, 0.18, 0.18), 0, 0.82, 0), S),
      col(tr(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 10), 0, 0.3, 0), R), col(tr(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 10), 0, 0.78, 0), R), col(tr(new THREE.BoxGeometry(0.34, 0.08, 0.04), 0, 1.28, 0.28), 0xd8322f)]); })();
  const dummies = BA.DUMMIES.map(d => { const [x, z] = H(d.lx, d.lz), g = new THREE.Group(); g.position.set(x, BA.PIT.y + 0.9, z); g.rotation.y = yawW(d.ly); root.add(g); const m = withOutline(dummyGeo); g.add(m); return { x, z, g, m, w: 0, wv: 0 }; });
  // cover (blocks musket balls) in harbor coords
  const cover = BA.COVER.map(([lx, lz, k]) => { const [x, z] = H(lx, lz); return { x, z, r: k === 'hay' ? 1.25 : 0.85 }; });
  // [Timothy tps] the third-person musket camera / crosshair / sights (js/onfoot/tps.js): what the crosshair ray can land on
  const peerFeetY = (p) => (p.fy != null ? p.fy : (p.body?.y ?? world.ground(p.x, p.z))); // [zipline-shoot] cable height, not ground under the line
  const zipState = (R) => R?.v4?._zip || null; // [zipline-shoot] _zip lives on PirateGLB (v4), not pirate-v4 mesh
  const rangeMen = () => [...fnet.peers].filter(([id]) => { const r = peerR.get(id); return r && r.ba[0] === Z_RANGE && !r.ba[6]; }).map(([, p]) => p);
  const tps = TPS_ON ? createTps({ walker, camera, canvas, touch, world, sfx, attack: () => attack(),
    aimables: () => { const sp = [], cy = []; for (const t of targets) if (t.flip <= 0.2) sp.push([t.cx, t.cy, t.cz, 0.75, 'target']);
      for (const p of rangeMen()) { const g = peerFeetY(p); cy.push([p.x, p.z, 0.5, g - 0.2, g + 1.95, 'pirate']); }
      for (const c of cover) { const g = world.ground(c.x, c.z); cy.push([c.x, c.z, c.r, g - 0.5, g + 1.4, 'cover']); } return { spheres: sp, cyls: cy }; },
    farAimables: ships?.aim ? () => ({ cyls: ships.aim() || [] }) : null, // [v347] ships / captains out over the water
    pointers: () => [...targets.filter(t => t.flip <= 0.2).map(t => [t.cx, t.cy, t.cz]), ...rangeMen().map(p => [p.x, peerFeetY(p) + 1.2, p.z])] }) : null;

  // ---------- small FX pool: muzzle flash, smoke, sparks, tracers ----------
  const fxs = [], dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
  function puff(p, col, size, life, vel = null, add = false) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: col, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true }));
    m.position.copy(p); m.scale.setScalar(size); scene.add(m); fxs.push({ m, life, t: 0, size, vel: vel || new THREE.Vector3(0, 0.6, 0), grow: add ? 0.2 : 1.6 }); }
  const tracerGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 4, 1, true); tracerGeo.rotateX(Math.PI / 2); tracerGeo.translate(0, 0, 0.5);
  function tracer(a, b) { const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.9, depthWrite: false })); m.position.copy(a); m.lookAt(b); m.scale.set(1, 1, a.distanceTo(b)); scene.add(m); fxs.push({ m, life: 0.12, t: 0, tracer: true }); }
  function tickFx(dt) { for (let i = fxs.length - 1; i >= 0; i--) { const f = fxs[i]; f.t += dt; const k = f.t / f.life;
    if (k >= 1) { f.m.removeFromParent(); f.m.material.dispose(); fxs.splice(i, 1); continue; }
    if (f.tracer) { f.m.material.opacity = 0.9 * (1 - k); continue; }
    f.m.position.addScaledVector(f.vel, dt); f.m.scale.setScalar(f.size * (1 + f.grow * k)); f.m.material.opacity = 1 - k; } }
  const vol = (p) => Math.max(0.05, Math.min(1, 1 - p.distanceTo(camera.position) / 90));

  // ---------- pirates: weapon meshes + the procedural arm pose (runs right after each body's clip, see hookBody) ----------
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _a = new THREE.Vector3(), _x = new THREE.Vector3(), _rq = new THREE.Quaternion(), _s = new THREE.Vector3();
  const BONE_DIR = new THREE.Vector3(-1, 0, 0), BONE_PERP = new THREE.Vector3(0, 0, 1);
  function aimBone(bone, dirRoot, k, rootQ, rollRoot = null, axis = -1) { // point the bone (its -X) along dirRoot (pirate space), blend k
    if (!bone || k <= 0) return; bone.updateWorldMatrix(true, false); bone.getWorldQuaternion(_q);
    _v.copy(BONE_DIR).multiplyScalar(-axis).applyQuaternion(_q); _w.copy(dirRoot).applyQuaternion(rootQ);
    _q2.setFromUnitVectors(_v, _w); _q2.slerp(_rq.identity(), 1 - k); _q.premultiply(_q2);
    if (rollRoot) { _w.normalize(); _a.copy(rollRoot).applyQuaternion(rootQ); _a.addScaledVector(_w, -_a.dot(_w)).normalize(); _x.copy(BONE_PERP).applyQuaternion(_q); _x.addScaledVector(_w, -_x.dot(_w)).normalize();
      if (_a.lengthSq() > 0.5 && _x.lengthSq() > 0.5) { const ang = Math.atan2(_v.crossVectors(_x, _a).dot(_w), _x.dot(_a)); _q2.setFromAxisAngle(_w, ang * k); _q.premultiply(_q2); } }
    bone.parent.getWorldQuaternion(_pq); bone.quaternion.copy(_pq.invert().multiply(_q)); bone.updateMatrixWorld(true);
  }
  function twist(bone, ang, rootQ) { if (!bone || !ang) return; bone.updateWorldMatrix(true, false); bone.getWorldQuaternion(_q); _w.set(0, 1, 0).applyQuaternion(rootQ); _q2.setFromAxisAngle(_w, ang); _q.premultiply(_q2);
    bone.parent.getWorldQuaternion(_pq); bone.quaternion.copy(_pq.invert().multiply(_q)); bone.updateMatrixWorld(true); }
  // st: { zone, sword, act: { kind, t }, down, recoil }  (one per pirate: you + each peer)
  function rig(pirateObj) { const fig = pirateObj.children.find(c => c.name === 'pirate-v4'); return { fig, v4: null, bones: null, sword: null, swordId: null, musket: null, musketId: null, st: { zone: 0, w: 0, act: null, down: 0, recoil: 0 } }; }
  const _dir = new THREE.Vector3(), _dir2 = new THREE.Vector3(), _blade = new THREE.Vector3(), _rootQ = new THREE.Quaternion();
  // [Emerly musket-arm] bone names: GLTFLoader strips '.' (upperarm.R -> upperarmR); also accept dotted / any punctuation (same as swimPose).
  // &musketarm=0 restores the original lookup, attachment and arm pose.
  const MUSKET_ARM_ON = typeof location === 'undefined' || !/[?&]musketarm=0(&|$)/.test(location.search || '');
  function boneByName(sc, want) {
    const w = want.replace(/[^a-zA-Z]/g, ''); let hit = sc.getObjectByName(want) || sc.getObjectByName(want.replace(/([LR])$/, '.$1'));
    if (hit) return hit;
    sc.traverse((o) => { if (!hit && o.isBone && o.name.replace(/[^a-zA-Z]/g, '') === w) hit = o; });
    return hit;
  }
  function hookBody(R) { // (re)attach to the pirate's current v5/v6 body: wrap its clip update so our arm pose runs right after the clip
    if (!R.fig && R.obj) R.fig = R.obj.children.find(c => c.name === 'pirate-v4'); // a peer's body can still be loading
    const v4 = R.fig?.userData?.v4; if (!v4 || v4 === R.v4) return !!v4;
    R.v4 = v4; const sc = v4.scene, b = MUSKET_ARM_ON ? (n) => boneByName(sc, n) : (n) => sc.getObjectByName(n);
    R.bones = { uR: b('upperarmR'), fR: b('forearmR'), uL: b('upperarmL'), fL: b('forearmL'), spine: b('spine') };
    R.sword?.removeFromParent(); R.sword = null; R.swordId = null; R.musket?.removeFromParent(); R.musket = null;
    if (!v4.__btWrapped) { const u = v4.update.bind(v4); v4.update = (dt) => { u(dt); const f = v4.__btPose; if (f) try { f(); } catch (e) { if (!v4.__btErr) { v4.__btErr = 1; console.warn('[battle] pose', e); } } }; v4.__btWrapped = true; } // never break the clip
    v4.__btPose = () => pose(R); return true;
  }
  // [Emerly] 2-bone reach: upper arm + forearm (elbow out to the side + down) so the forearm's far end (hand) lands on a world point
  const _gT = new THREE.Vector3(), _gS = new THREE.Vector3(), _gE = new THREE.Vector3(), _gD = new THREE.Vector3(), _gP = new THREE.Vector3(), _gA = new THREE.Vector3(), _gU = new THREE.Vector3(), _gF = new THREE.Vector3(), _gQ = new THREE.Quaternion(), _mArm = new THREE.Matrix4();
  function reachArm(uB, fB, target, side, k, roll) { if (!uB || !fB) return false;
    uB.updateWorldMatrix(true, false); fB.updateWorldMatrix(true, false); uB.getWorldPosition(_gS); fB.getWorldPosition(_gE);
    const a = Math.max(0.05, _gS.distanceTo(_gE)), b = a * 1.12; _gD.copy(target).sub(_gS); const d0 = _gD.length(); if (d0 < 1e-4) return false; _gD.divideScalar(d0);
    // [Emerly musket-arm] skip IK when the grip is far past the arm's reach (old parent/scale mismatch left grips ~0.35 m out on a ~0.25 m arm)
    if (MUSKET_ARM_ON && d0 > (a + b) * 1.15) return false;
    const d = Math.min(d0, (a + b) * 0.999);
    const A = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
    _gP.set(side * 0.6, -1, -0.2).applyQuaternion(_rootQ); _gA.crossVectors(_gD, _gP); if (_gA.lengthSq() < 1e-6) return false; _gA.normalize();
    _gU.copy(_gD).applyAxisAngle(_gA, A); _gF.copy(_gS).addScaledVector(_gD, d).sub(_gE.copy(_gS).addScaledVector(_gU, a)).normalize();
    _gQ.copy(_rootQ).invert(); const axis = MUSKET_ARM_ON ? side : -1;
    aimBone(uB, _gU.applyQuaternion(_gQ), k, _rootQ, null, axis); aimBone(fB, _gF.applyQuaternion(_gQ), k, _rootQ, roll, axis); return true; }
  function pose(R) {
    const st = R.st, B = R.bones; if (!B || st.w <= 0.001) return;
    R.fig.updateWorldMatrix(true, false); R.fig.getWorldQuaternion(_rootQ); const k = st.w;
    if (st.zone === Z_PIT) {
      let p0 = P_READY, p1 = P_READY, t = 0;
      if (st.act && st.act.kind === 1) { const s = st.act.t / ARENA.sword.dur;
        if (s < 0.28) { p0 = P_READY; p1 = P_WIND; t = ease(s / 0.28); } else if (s < 0.62) { p0 = P_WIND; p1 = P_SLASH; t = ease((s - 0.28) / 0.34); } else if (s < 1) { p0 = P_SLASH; p1 = P_READY; t = ease((s - 0.62) / 0.38); } }
      // [Emerly sword-hand] the blade + swing are in the hand without the hook (js/onfoot/swordHand.js); the left hand mirrors the right's poses
      const hd = R.swordHand || 'R', L = hd === 'L', ax = handAxis(hd);
      twist(B.spine, mirrorTwist((p0.sp + (p1.sp - p0.sp) * t) * k, hd), _rootQ);
      lerpDir(p0.u, p1.u, t, _dir); lerpDir(p0.f, p1.f, t, _dir2); lerpDir(p0.b, p1.b, t, _blade); if (L) { _dir.x = -_dir.x; _dir2.x = -_dir2.x; _blade.x = -_blade.x; }
      aimBone(L ? B.uL : B.uR, _dir, k, _rootQ, null, ax);
      aimBone(L ? B.fL : B.fR, _dir2, k, _rootQ, _blade, ax);
    } else if (st.zone === Z_RANGE) {
      const gr = R.musket && weaponEmpty('musket', R.musketId, 'grip_r'), gl = R.musket && weaponEmpty('musket', R.musketId, 'grip_l');
      const zp = R?.v4?._zip || null, zipOne = !!(zp && zp.w > 0.2 && zp.free === 'R'); // [zipline-shoot] left hand keeps the trolley bar (_zip on PirateGLB)
      // Establish a safe shoulder pose before reachable grips refine it. Left bones point along +X, right bones along -X.
      // With the fix disabled, retain the original grip-only path (including its early returns).
      if (MUSKET_ARM_ON || !(gr && gl) || zipOne) {
        const rc = st.recoil; _dir.copy(P_MUSKET.uR); _dir.y += rc * 0.25; _dir.normalize();
        aimBone(B.uR, _dir, k, _rootQ); aimBone(B.fR, P_MUSKET.fR, k, _rootQ, v3(0, 1, 0));
        if (!zipOne) {
          const axis = MUSKET_ARM_ON ? 1 : -1;
          aimBone(B.uL, P_MUSKET.uL, k, _rootQ, null, axis); aimBone(B.fL, P_MUSKET.fL, k, _rootQ, null, axis);
        }
      }
      if (gr && gl && !zipOne) { R.musket.updateWorldMatrix(true, false);
        reachArm(B.uR, B.fR, _gT.copy(gr).applyMatrix4(R.musket.matrixWorld), -1, k, v3(0, 1, 0));
        reachArm(B.uL, B.fL, _gT.copy(gl).applyMatrix4(R.musket.matrixWorld), 1, k, null); }
      else if (gr && zipOne) { R.musket.updateWorldMatrix(true, false);
        reachArm(B.uR, B.fR, _gT.copy(gr).applyMatrix4(R.musket.matrixWorld), -1, k, v3(0, 1, 0)); }
    }
  }
  const ringGeo2 = new THREE.RingGeometry(0.62, 0.8, 28).rotateX(-Math.PI / 2), RING_COL = [0, 0xff3b30, 0x2f7bff];
  function dress(R, zone, swordId, musketId = MUSKET_DEFAULT, team = 0) { // weapon meshes for the area you stand in
    // [Emerly] 2v2: a team-coloured ring under the pirate's feet (RED / BLUE), only in an area
    if (team && zone && !R.ring && R.obj) { R.ring = new THREE.Mesh(ringGeo2, new THREE.MeshBasicMaterial({ color: RING_COL[team], transparent: true, opacity: 0.85, depthWrite: false })); R.ring.position.y = 0.05; R.ring.renderOrder = 2; R.obj.add(R.ring); }
    if (R.ring) { R.ring.visible = !!(team && zone); if (team) R.ring.material.color.setHex(RING_COL[team]); }
    carryArmed(R.fig, zone === Z_PIT, zone === Z_RANGE);   // [Raul carry] the arena's weapon is in your hands: hide the carried sword / back musket
    // [weapon-sync] the look: yours (inventory rarity + fitted attachments) or the peer's decoded 'wl' (older clients / bots = common);
    // it also rides on the pirate root for the holstered copies (js/carryWeapons.js), set even before the v4 rig is ready.
    // Rebuilds keyed on ints: zero per-frame allocation.
    const LK = R === mineR ? localWeaponLook() : (R.look || R.obj?.userData?.wlook || COMMON_LOOK); if (R.obj) setObjLook(R.obj, LK);
    if (!R.v4 || !R.bones) return;
    const wantSword = zone === Z_PIT, wantMusket = zone === Z_RANGE;
    const hd = swordHand(R.fig?.userData?.gear);   // [Emerly sword-hand] same hand as the carried sword (no hook / left hook: right)
    if (wantSword && (R.swordId !== swordId || !R.sword || R.swordHand !== hd || R.swordLook !== LK.sw)) { R.sword?.removeFromParent(); R.swordHand = hd; R.swordLook = LK.sw;
      const s = weaponMesh(swordGeo(swordId), shellSword, swordId === 'blade_gold' ? goldM : lookMat(swordTint(LK)));
      decorateSword(s, swordId, LK);
      const fr = hd === 'L' ? R.bones.fL : R.bones.fR; fr.updateWorldMatrix(true, false); fr.getWorldScale(_s); const sc = 0.85 / Math.max(1e-3, _s.x);
      s.scale.setScalar(sc); s.position.set(handAxis(hd) * 0.15 / Math.max(1e-3, _s.x), 0, 0); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), BONE_PERP); fr.add(s); R.sword = s; R.swordId = swordId; }
    if (R.sword) R.sword.visible = wantSword;
    // [Emerly musket-arm] parent the musket to the SCALED body root (v4.root), not pirate-v4: pirate-v4's child p.root carries the
    // height scale, so a gun on fig sat in bind metres while the arms lived in scaled metres → grips out of reach → T-pose sleeves.
    // [Emerly musket-rank / gunacc] rank tint / GILDED skin + accessories; [weapon-sync] now for peers too (LK above), keyed on LK.mu
    if (wantMusket && (!R.musket || R.musketId !== musketId || R.musketLook !== LK.mu)) { R.musket?.removeFromParent(); R.musketLook = LK.mu; const m = weaponMesh(musketGeo(musketId), shellMusket, lookMat(musketTint(LK))); decorateMusket(m, musketId, LK); m.scale.setScalar(0.7);
      (MUSKET_ARM_ON && R.v4?.root ? R.v4.root : R.fig).add(m); R.musket = m; R.musketId = musketId; }
    if (R.musket) { R.musket.visible = wantMusket; const rc = R.st.recoil;
      if (MUSKET_ARM_ON && R.bones?.spine) {
        // seat the stock at the right shoulder in the body root's local space (bind units, same as the scaled skeleton)
        const sh = R.bones.uR; sh?.updateWorldMatrix(true, false);
        const root = R.musket.parent; root.updateWorldMatrix(true, false); const inv = _mArm.copy(root.matrixWorld).invert();
        if (sh) { sh.getWorldPosition(_gS); _gS.applyMatrix4(inv); R.musket.position.set(_gS.x * 0.55, _gS.y + 0.02 + rc * 0.04, Math.max(0.08, _gS.z + 0.12) - rc * 0.07); }
        else R.musket.position.set(-0.13, 0.9 + rc * 0.04, 0.1 - rc * 0.07);
        R.musket.rotation.set(-0.04 - rc * 0.22, 0.04, 0);
      } else { R.musket.position.set(-0.13, 0.9 + rc * 0.04, 0.1 - rc * 0.07); R.musket.rotation.set(-0.04 - rc * 0.22, 0.04, 0); } }
  }
  function muzzleWorld(R, out) { if (!R.musket) return out.set(0, 0, 0); R.musket.updateWorldMatrix(true, false); return out.copy(musketMuzzle(R.musketId)).applyMatrix4(R.musket.matrixWorld); }
  function bladeTip(R, out) { if (!R.sword) return null; R.sword.updateWorldMatrix(true, false); const e = weaponEmpty('sword', R.swordId, 'tip'); return (e ? out.copy(e) : out.set(0, 0.8, 0)).applyMatrix4(R.sword.matrixWorld); } // [Emerly] the model's tip empty (rapier ~1.0 m)
  function knock(R, k) { if (R.fig) { R.fig.rotation.x = -1.45 * k; R.fig.position.y = 0.25 * k; } }

  // ---------- your state ----------
  const me = { stance: 0, drawn: 1, arena: 0, onFoot: false, downArena: 0, lastHitT: -99, repT: 0, repairing: false, pvpOk: true, zone: 0, hp: ARENA.hp, life: (Date.now() / 1000 | 0) % 50000, seq: 0, kind: 0, down: 0, guard: 0, cool: 0, kos: 0, downs: 0, lastBy: '', fireAt: -1, aim: 0, team: 0, score: [0, 0, 0] }; // [Emerly] team 0 FFA | 1 RED | 2 BLUE; score[team] = KOs that team scored (this device)
  const isleSafe = { _isleSafe: false, _isleSafeOut: 0, _isleSafeZone: null }; // [backpack-pvp]
  let mineR = null;
  const dealt = new Map();     // victimId -> { life, n }
  const seenHit = new Map();   // attackerId -> { life, n } (what we already applied of their bh[myId])
  const peerR = new Map();     // peerId -> rig + their ba
  let swordId = SWORD_DEFAULT, musketId = MUSKET_DEFAULT;
  // [Emerly pitsword] prefer inventory carry (rare USE AS PRIMARY) over store gear.sword; &pitsword=0 = store only
  const PIT_SWORD_ON = typeof location === 'undefined' || pitSwordOn(location.search || '');
  function readSword() { let g = null; try { g = window.PFP_PVP?.profile?.gear; } catch {} const c = PIT_SWORD_ON ? (carriedWeapons() || {}) : {};
    swordId = pitWeaponId(SWORD_IDS, SWORD_DEFAULT, c.sword, g?.sword, PIT_SWORD_ON); musketId = pitWeaponId(MUSKET_IDS, MUSKET_DEFAULT, c.musket, g?.musket, PIT_SWORD_ON); }
  readSword(); addEventListener('pfp-gear', readSword); addEventListener('pfp-gear-local', readSword); addEventListener('pfp-shop', (e) => { if (!e.detail?.open) readSword(); });

  // ---------- UI ----------
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = (tag, id, html = '') => { const e = document.createElement(tag); e.id = id; e.innerHTML = html; document.body.appendChild(e); return e; };
  const hud = el('div', 'bt-hud', '<b></b><button type="button" class="tm"></button><span class="sc"></span><small></small>'), atk = el('button', 'bt-atk', 'SWING'), flash = el('div', 'bt-flash'), msg = el('div', 'bt-msg');
  const stanceBar = el('button', 'bt-stance', '<span class="bt-ico">🤚</span><span class="bt-tab"></span><span class="bt-safe">🛡️</span>');
  const weaponKeyLabel = () => keyName(binds('weapon')[0] || 'KeyQ'); // [v340] the real weapon key (Q by default), never a stale "TAB"
  stanceBar.type = 'button'; stanceBar.title = `${weaponKeyLabel()} · cycle Unarmed → Musket → Sword`;
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) stanceBar.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  stanceBar.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); cycleStance(); });
  let stanceSig = '';
  function drawStance(show) {
    const safeLock = !!(isleSafe._isleSafe && !me.arena);
    const pd = padActive();
    const sig = show ? `${me.stance}|${me.arena}|${me.down > 0}|${safeLock ? 1 : 0}|${pd ? padGlyph('X') : weaponKeyLabel()}` : '';
    if (sig === stanceSig) return; stanceSig = sig;
    stanceBar.classList.toggle('on', !!show); if (!show) return;
    stanceBar.classList.toggle('safe-locked', safeLock);
    stanceBar.querySelector('.bt-ico').textContent = STANCE_ICON[me.stance] || '🤚';
    const tab = stanceBar.querySelector('.bt-tab');
    if (tab) tab.textContent = pd ? padGlyph('X') : weaponKeyLabel(); stanceBar.title = `${pd ? padGlyph('X') : weaponKeyLabel()} · cycle Unarmed → Musket → Sword`; // [v340] keybind label // [t1734u] □ / X while a pad is in use
    stanceBar.disabled = me.down > 0;
  }
  function setStance(s, auto = false) {
    if (!STANCES_ON) return false; s = s | 0; if (s < 0 || s > 2 || me.down > 0) return false;
    if (s && inHouse?.()) return false;
    if (me.arena === Z_PIT && s === 2) { if (!auto) say('⚔ SWORD PIT<small>swords only in the pit</small>', 1200); s = 1; }
    // [t1729u] Safe Zone: weapons stay holstered (arena pads exempt)
    if (s !== 0 && isleSafe._isleSafe && !me.arena) {
      if (me.stance !== 0) { me.stance = 0; stanceSig = ''; hudSig = ''; }
      if (!auto) { say('🛡️ SAFE ZONE<small>weapons stay holstered in Safe Zones</small>', 1100); stanceSig = ''; drawStance(true); }
      return false;
    }
    if (s === me.stance) return true;
    me.stance = s; if (s) { me.drawn = s; readSword(); sfx?.equip?.(); }
    stanceSig = ''; hudSig = '';
    if (!auto) say(s ? `${STANCE_LABEL[s]} DRAWN<small>${touch ? (s === 1 ? 'tap SWING' : 'tap FIRE') : (s === 1 ? 'R / CLICK = SWING' : 'R / CLICK = FIRE')} · ${keyName(binds('weapon')[0] || 'KeyQ')} = switch · X = holster</small>` : `🤚 UNARMED<small>weapons holstered · ${keyName(binds('weapon')[0] || 'KeyQ')} = Musket</small>`, 1100);
    return true;
  }
  function cycleStance() { return setStance(nextStance(me.stance)); }
  // keys 1 / 2 / 3 + X + Tab (bubble phase: the emote wheel's capture handler owns 1..8 while it is open)
  addEventListener('keydown', (e) => {
    if (!STANCES_ON || !me.onFoot || !walker.active || e.repeat) return;
    if (anyModalOpen?.()) return;
    const tg = e.target?.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || e.target?.isContentEditable) return;
    // ignore when a modal / map / shop is up
    if (document.documentElement.classList.contains('isle-map-open')) return;
    const shop = document.getElementById('shop'); if (shop && shop.style.display !== 'none' && !shop.hidden && shop.offsetParent) return;
    const ew = document.getElementById('emote-wheel'); if (ew && !ew.classList.contains('hidden') && ew.style.display !== 'none' && ew.offsetParent) return;
    // [v339] Tab = PvP menu only (js/pvp.js isKey('menu')); Q = switch weapon on foot (unless a secondary Q prompt is up — dock capture owns that)
    if (isKey('weapon', e.code)) {
      if (document.querySelector('#dk-acts button:not([hidden]) kbd') && [...document.querySelectorAll('#dk-acts button:not([hidden])')].some(b => /\bQ\b/.test(b.textContent || ''))) return; // actB KeyQ prompt wins
      e.preventDefault(); e.stopPropagation(); cycleStance(); return;
    }
    const k = stanceForKey(e.code); if (k !== null) { setStance(k); e.preventDefault(); return; }
    if (e.code === 'KeyX') { setStance(holsterToggle(me.stance, me.drawn)); e.preventDefault(); }
  });
  let msgT = 0; function say(html, ms = 1500) { msg.innerHTML = html; msg.style.opacity = 1; clearTimeout(msgT); msgT = setTimeout(() => { msg.style.opacity = 0; }, ms); }
  atk.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); attack(); });
  // [Emerly] 2v2: the team chip (tap / click; desktop G) cycles FFA -> RED -> BLUE. Your team rides in ba[8]; teammates can't hurt each other.
  const TEAM = ['FFA', 'RED', 'BLUE'];
  function setTeam(t = (me.team + 1) % 3) { if (me.down > 0) return; me.team = t; hudSig = ''; drawHud(); say(t ? `TEAM ${TEAM[t]}<small>2v2: teammates can't hurt each other</small>` : 'FREE-FOR-ALL<small>every pirate for themselves</small>', 1300); }
  const tmBtn = hud.querySelector('.tm'); for (const ev of ['pointerdown', 'touchstart', 'mousedown']) tmBtn.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  tmBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setTeam(); });
  // [v328] Coliseum 2v2 team mate OR Harbor/Island squad mate — NEVER friendly fire
  const isMate = (id, r) => (!!me.team && r?.team === me.team) || !!isSquadMate?.(id);
  const mate = (r) => isMate(null, r); // legacy team-only callers (prefer isMate with id)
  let hudSig = '';
  function drawHud() { const z = me.zone, showH = STANCES_ON ? !!(me.arena || me.down > 0) : !!z; /* [t1724u] one HP bar: the captain card #player-hp; #bt-hud = a tiny arena / KO pill only */ document.documentElement.classList.toggle('bt-on', !!z); if (!showH) { if (hudSig || hud.style.display !== 'none') { hud.style.display = 'none'; hudSig = ''; } return; }
    const reload = z === Z_RANGE && me.cool > 0, teams = me.team || [...peerR.values()].some(r => r.ba[0] === z && r.team), pd = padActive(), sig = [z, me.arena, me.down > 0, me.kos, me.downs, reload ? Math.ceil(me.cool * 2) : 0, me.team, teams, pd && padGlyph('RT'), ...me.score].join('|'); if (sig === hudSig) return; hudSig = sig;
    hud.style.display = 'block'; hud.querySelector('b').textContent = !STANCES_ON ? (z === Z_PIT ? '⚔ SWORD PIT' : '🎯 MUSKET RANGE') : me.arena === Z_PIT ? '⚔ SWORD PIT' : me.arena === Z_RANGE ? '🎯 MUSKET RANGE' : STANCE_LABEL[z] + (z ? ' DRAWN' : '') + (isleSafe._isleSafe ? ' · 🛡️ SAFE' : ' · ⚔ OPEN PvP');
    tmBtn.textContent = (me.team ? 'TEAM ' : '') + TEAM[me.team] + (pd ? ' · ' + padGlyph('LB') : touch ? '' : ' · G'); tmBtn.className = 'tm t' + me.team;
    hud.querySelector('.sc').innerHTML = teams ? `<i>RED ${me.score[1]}</i> · <u>BLUE ${me.score[2]}</u>` : '';
    hud.querySelector('small').textContent = me.down > 0 ? 'KNOCKED OUT · back up in a moment' : ''; // [t1724u] no KOs / DOWNS / hint clutter
    atk.textContent = z === Z_PIT ? 'SWING' : reload ? '…' : 'FIRE'; atk.disabled = me.down > 0 || reload; }
  // desktop: R (unbound everywhere; F = fullscreen) or a left click (not a drag) attacks while you are in an area
  addEventListener('keydown', (e) => { if (!me.zone || (e.code !== 'KeyR' && e.code !== 'KeyG') || e.repeat || e.target?.tagName === 'INPUT' || !walker.active) return; if (e.code === 'KeyG') setTeam(); else attack(); e.stopImmediatePropagation(); e.preventDefault(); }, true);
  let pd = null; canvas?.addEventListener('pointerdown', (e) => { if (me.zone && !tps?.on && e.button === 0 && e.pointerType === 'mouse') pd = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  addEventListener('pointerup', (e) => { if (!pd || e.pointerType !== 'mouse') return; const d = pd; pd = null; if (me.zone && walker.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && performance.now() - d.t < 300) attack(); });

  // ---------- attacking ----------
  const fwd = (yaw, out) => out.set(Math.sin(yaw), 0, Math.cos(yaw));
  function attack() {
    if (ADM.frozen) return false; // [admin-menu] frozen by the owner (server-checked)
    if (!me.zone || me.down > 0 || me.cool > 0 || !walker.active) return false;
    const W = walker.w;
    // [backpack-pvp] Island Safe Zones + 3s exit grace block PvP (Coliseum battle pads stay fightable when outside sanctuaries)
    me.pvpOk = !SAFEZONES_ON || canFightOnFoot(isleSafe, ...layout.harborToFoot(W.x, W.z), performance.now() / 1000, { inHouse: !!inHouse?.() }); // walker = harbor frame, zones = foot frame
    if (!me.pvpOk) { say('🛡️ SAFE ZONE — no PvP here<small>' + (STANCES_ON ? 'practice swings / shots only · 0 PvP damage' : 'leave to fight') + '</small>', 1400); if (!STANCES_ON) return false; }
    if (me.zone === Z_PIT) { me.cool = myW('sword').cool; mineR.st.act = { kind: 1, t: 0, hit: false }; me.kind = 1; sfx?.equip?.(); }
    else { W.yaw = W.camYaw; me.cool = myW('musket').reload; me.fireAt = ARENA.musket.delay; me.kind = 2; }
    me.seq = (me.seq + 1) % 1000; atk.classList.add('hit'); setTimeout(() => atk.classList.remove('hit'), 120); return true;
  }
  const victimOpen = (p) => !SAFEZONES_ON || canFightOnFoot({}, ...layout.harborToFoot(p.x, p.z), 0); // nobody snipes INTO (or out of) a Safe Zone
  const canHitPeer = (r, p, need, id) => !!r && !r.ba[6] && r.guard <= 0 && !isMate(id, r) && (STANCES_ON ? (me.pvpOk && victimOpen(p)) : r.ba[0] === need);
  function addDmg(id, life, n) { const d = dealt.get(id); if (!d || d.life !== life) dealt.set(id, { life, n }); else d.n += n; }
  function swordHit() { // my blade at its hit frame: every pirate + dummy in the arc
    const W = walker.w, f = fwd(W.yaw, _v), S = myW('sword'); let any = false;
    for (const [id, p] of fnet.peers) { const r = peerR.get(id); if (!canHitPeer(r, p, Z_PIT, id)) continue; const dx = p.x - W.x, dz = p.z - W.z, d = Math.hypot(dx, dz);
      if (d > S.reach + 0.45 || d < 0.01) continue; const ang = Math.acos(Math.max(-1, Math.min(1, (dx * f.x + dz * f.z) / d))); if (ang > S.arc) continue;
      addDmg(id, r.ba[2], S.dmg); r.hpShown = Math.max(0, (r.hpShown ?? r.ba[1]) - S.dmg); any = true; spark(p.x, world.ground(p.x, p.z) + 1.1, p.z); try { crewFight?.engage('me', 'sword', id); } catch {} } // [backpack-pvp] your blade on a pirate: your crew rush THEIR crew
    for (const d of dummies) { const dx = d.x - W.x, dz = d.z - W.z, dd = Math.hypot(dx, dz); if (dd > S.reach + 0.6) continue; const ang = Math.acos(Math.max(-1, Math.min(1, (dx * f.x + dz * f.z) / Math.max(0.01, dd)))); if (ang > S.arc) continue;
      d.wv += 6 * (((dx * f.z - dz * f.x) > 0) ? 1 : -1); any = true; spark(d.x, BA.PIT.y + 1.6, d.z); }
    if (any) sfx?.hit?.(0.8);
  }
  function spark(x, y, z) { const p = new THREE.Vector3(x, y, z); for (let i = 0; i < 6; i++) puff(p, 0xfff1b0, 0.25, 0.25, new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5), true); puff(p, 0xffffff, 0.8, 0.12, new THREE.Vector3(), true); }
  // a musket ball (yours or a peer's replay): first thing along the line = a pirate (yours only), a target board, cover, or 60 m
  function shoot(R, x, z, yaw, mine) {
    let aim = null; if (mine && tps?.on) { const s = tps.shotYaw(x, z); yaw = s.yaw; aim = s.aim; walker.w.yaw = yaw; } // [Timothy tps] the line through the crosshair's aim point
    const S = mine ? myW('musket') : ARENA.musket, f = fwd(yaw, new THREE.Vector3()), mz = muzzleWorld(R, new THREE.Vector3()); if (!mz.lengthSq()) mz.set(x, world.ground(x, z) + 1.3, z);
    let best = S.range, hit = null;
    // [Timothy tps] with the crosshair the ball also has a height: muzzle -> aim point (null = the old flat line, peers' replays, &tps=0)
    const aimD = aim ? Math.max(0.1, Math.hypot(aim[0] - x, aim[2] - z)) : 0, slope = aim ? (aim[1] - mz.y) / aimD : null, vOk = (a, y0, y1) => slope === null || (mz.y + slope * a >= y0 && mz.y + slope * a <= y1);
    const along = (px, pz, r) => { const dx = px - x, dz = pz - z, a = dx * f.x + dz * f.z; if (a < 0.3 || a > best) return -1; const side = Math.abs(dx * f.z - dz * f.x); return side <= r ? a : -1; };
    for (const c of cover) { const a = along(c.x, c.z, c.r); if (a > 0 && vOk(a, -1e9, world.ground(c.x, c.z) + 1.4)) { best = a; hit = { kind: 'cover' }; } }
    for (const t of targets) { if (t.flip > 0.2) continue; const a = along(t.x, t.z, 0.72); if (a > 0 && vOk(a, t.cy - 0.85, t.cy + 0.85)) { best = a; hit = { kind: 'target', t, off: Math.abs((t.x - x) * f.z - (t.z - z) * f.x) }; } }
    if (mine) for (const [id, p] of fnet.peers) { const r = peerR.get(id); if (!canHitPeer(r, p, Z_RANGE, id)) continue; const a = along(p.x, p.z, S.wide); const py = peerFeetY(p); if (a > 0 && vOk(a, py - 0.2, py + 2.1)) { best = a; hit = { kind: 'pirate', id, p, r }; } }
    if (aim && slope < 0 && !hit) { const g = mz.y + slope * best; if (g < world.ground(x + f.x * best, z + f.z * best)) best = Math.min(best, aimD); } // [Timothy tps] aimed at the ground: the ball lands there
    // [v347] t1821u / t1822u: past every pirate / board / cover, the ball flies on over the water at a ship: its CAPTAIN first, else the hull
    if (mine && ships?.test) { const ak = tps?.st?.lastAim?.kind, lim = hit ? best : (aim && ak === 'ground' ? aimD + 2 : SHIP_RANGE);
      const h = ships.test({ x, y: mz.y, z }, f, slope, lim);
      if (h && h.a > 0.3) { let clear = true; const yAt = (a) => (slope === null ? mz.y - 0.05 : mz.y + slope * a);
        for (let a = 1.5; a < h.a - 1; a += 2) if (yAt(a) < world.ground(x + f.x * a, z + f.z * a) - 0.15) { clear = false; break; } // the hill / quay in the way
        if (clear) { const [, lz] = toTown(x + f.x * h.a, z + f.z * h.a), [, bz] = toTown(x, z); if (zoneAt(x, z) === Z_RANGE && lz < BA.RANGE.lz0 + 1.8 && bz >= BA.RANGE.lz0 + 1.8) clear = false; } // from the range: its back wall
        if (clear) { best = h.a; hit = { kind: h.kind, ship: h }; } } }
    if (!hit?.ship) { const [lx, lz] = toTown(x + f.x * best, z + f.z * best); if (lz < BA.RANGE.lz0 + 1.8) { const [bx, bz] = toTown(x, z); const t = (bz - (BA.RANGE.lz0 + 1.8)) / Math.max(1e-3, bz - lz); best *= Math.min(1, t); if (!hit) hit = { kind: 'cover' }; } void lx; }
    const end = new THREE.Vector3(x + f.x * best, slope === null ? mz.y - 0.05 : mz.y + slope * best, z + f.z * best);
    tracer(mz, end); puff(mz.clone().addScaledVector(f, 0.1), 0xffd27a, 0.9, 0.09, new THREE.Vector3(), true);
    for (let i = 0; i < 4; i++) puff(mz.clone().addScaledVector(f, 0.3 + i * 0.25), 0xe8e2d4, 0.55 + i * 0.12, 1.2, new THREE.Vector3(f.x * 0.8, 0.5, f.z * 0.8));
    sfx?.cannon?.(Math.min(0.35, vol(mz) * 0.35)); R.st.recoil = S.recoil ?? 1; // [gunacc] stock = less kick
    if (hit?.kind === 'target') { hit.t.flip = 1.4; hit.t.t = 2.2; if (mine) say(hit.off < 0.18 ? 'BULLSEYE!' : hit.off < 0.42 ? 'NICE SHOT' : 'HIT', 900); spark(end.x, end.y, end.z); }
    else if (hit?.kind === 'pirate') { const dm = S.dmg + (S.bayonet && best <= S.bayonet.reach ? S.bayonet.dmg : 0); /* [gunacc] bayonet point-blank */ addDmg(hit.id, hit.r.ba[2], dm); hit.r.hpShown = Math.max(0, (hit.r.hpShown ?? hit.r.ba[1]) - dm); spark(end.x, end.y, end.z); sfx?.hit?.(0.6); try { crewFight?.engage('me', 'gun', hit.id); } catch {} } // [backpack-pvp] you shot a pirate: your crew volley THEIR crew
    else if (hit?.ship) { const dm = me.pvpOk === false ? 0 : ships.hit(hit.ship, end, S.dmg); spark(end.x, end.y, end.z); // [v347] practice shots out of a Safe Zone: 0 damage
      if (hit.kind === 'captain') { for (let i = 0; i < 5; i++) puff(end, 0xb3121a, 0.3, 0.35, new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3)); sfx?.hit?.(0.6); }
      else puff(end, 0x8a6a44, 0.6, 0.5, new THREE.Vector3(0, 0.6, 0)); if (mine && dm) say(hit.kind === 'captain' ? `🎯 CAPTAIN HIT! -${dm}` : `⚓ SHIP HIT -${dm}`, 800); }
    else puff(end, 0xb89a6a, 0.7, 0.6);
    if (mine) tps?.onShot(hit); // [Timothy tps] hit marker + sound, recoil kick, bloom
  }

  // ---------- getting hit (peers' bh) / KO / respawn ----------
  function spawnPoint(zone) { const tm = me.team; // [Emerly] 2v2: RED and BLUE get up on opposite sides (FFA: by the gate)
    if (zone === Z_PIT) { const a = BA.PIT.gateA + (tm ? (tm === 1 ? 1 : -1) * Math.PI / 2 : 0) + (Math.random() - 0.5) * 0.6, [lx, lz] = BA.pitAt(a, BA.PIT.r - 2.2); return [...H(lx, lz), a + Math.PI]; }
    const R = BA.RANGE; if (tm === 2) return [...H(R.lx1 - 5 + (Math.random() - 0.5) * 3, R.lz0 + 5), 0];
    return [...H((tm === 1 ? R.divider + 4 : R.gate[0]) + (Math.random() - 0.5) * 4, R.lz1 - 2.5), Math.PI]; }
  function takeHit(n, by) { if (ADM.god) { me.hp = ARENA.hp; return; } /* [admin-menu] GOD MODE */
    if (me.down > 0 || me.guard > 0 || (STANCES_ON ? !me.onFoot : !me.zone)) return;
    const W0 = walker.w;
    // [backpack-pvp] incoming PvP deals 0 inside Safe Zone / grace / cottage
    if (SAFEZONES_ON && !canFightOnFoot(isleSafe, ...layout.harborToFoot(W0.x, W0.z), performance.now() / 1000, { inHouse: !!inHouse?.() })) {
      say('🛡️ SAFE ZONE<small>you are protected here</small>', 1200); return;
    }
    me.hp = Math.max(0, me.hp - n); me.lastBy = by; me.lastHitT = t; me.repT = 0; me.repairing = false; /* [t1724u] a hit restarts the 20 s wait */ sfx?.playerHit?.(0.7); flash.style.opacity = 1; setTimeout(() => { flash.style.opacity = 0; }, 160);
    if (me.hp <= 0) {
      me.down = ARENA.downS; me.downs++; try { kd?.('d', `me:${me.life}`); } catch {} if (me.team) me.score[3 - me.team]++; me.downAt = [walker.w.x, walker.w.z]; if (mineR) mineR.st.act = null;
      const coli = STANCES_ON ? !!me.arena || isInsideColiseumH(walker.w.x, walker.w.z) : false; me.downArena = STANCES_ON ? me.arena : (me.zone || me.lastZone);
      say(`KNOCKED OUT<small>by ${esc(by || 'a pirate')} · ${coli ? 'Coliseum: just for fun, back up at the gate' : 'unequipped haul dropped · respawning on your ship'}</small>`, 2400);
      // [backpack-pvp] drop unequipped haul outside Safe Zones (never inHouse); Coliseum games stay just-for-fun (no drop)
      if (!coli) try {
        const inv = typeof inventory === 'function' ? inventory() : inventory;
        const d = inv?.data || {};
        lootBags?.dropHaul?.({
          items: d.items || [], equipped: d.equipped || {},
          x: walker.w.x, y: world.ground(walker.w.x, walker.w.z), z: walker.w.z,
          killer_id: String(by || '').slice(0, 40), room: 'island',
        });
      } catch {}
    }
  }
  const esc = (s) => String(s).replace(/[<>&"'`\\]/g, '').slice(0, 20);
  /** [backpack-pvp] t1710u KO'd on the open island: back up in the Harbor Plaza / Dock Safe Zone (a berth's ashore spot), facing the plaza */
  function harborRespawn() {
    const a = (layout.berths || []).map((b) => b.ashore).filter((q) => q && Number.isFinite(q.x) && (!SAFEZONES_ON || insideSafeZoneH(q.x, q.z)));
    const q = a.length ? a[Math.floor(Math.random() * Math.min(3, a.length))] : null, [x, z] = q ? [q.x, q.z] : H(-40, 10), [cx, cz] = H(-40, -30);
    return [x, z, Math.atan2(cx - x, cz - z)];
  }
  function footRegen(dt) { footRegenStep(me, dt, t, ARENA.hp); } // [t1724u]
  function respawn() { const W = walker.w, open = STANCES_ON && !me.downArena;
    me.hp = ARENA.hp; me.repT = 0; me.repairing = false; me.down = 0; me.guard = ARENA.guardS * (open ? 2 : 1); me.life = (me.life + 1) % 50000; me.downArena = 0;
    if (open) {
      setStance(0, true);
      // [v328] BANKSY t1740u/t1741u: open-island death → respawn aboard your ship (moored Harbor OR anchored elsewhere)
      try { if (respawnOnShip?.()) return; } catch {}
      const [x, z, ly] = harborRespawn(); W.x = x; W.z = z; W.y = world.ground(x, z); W.yaw = W.camYaw = ly; walker.snapCam?.();
      say('🛡️ HARBOR SAFE ZONE<small>back on your feet · full health</small>', 1800); return;
    }
    const [x, z, ly] = spawnPoint(me.downArena || me.zone || me.lastZone);
    W.x = x; W.z = z; W.y = world.ground(x, z); W.yaw = W.camYaw = yawW(ly); walker.snapCam?.(); }

  // ---------- peers ----------
  function onPeer(m) {
    if (!m || !isNetId(m.i)) return; const p = fnet.peers.get(m.i);
    try { crewFight?.remote(m.i, m.cm | 0, typeof m.ct === 'string' && (m.ct === myId() || isNetId(m.ct)) ? m.ct : '', myId()); } catch {} // [backpack-pvp] their crew vs ct's crew
    const ba = Array.isArray(m.ba) && m.ba.length >= 7 && m.ba.length <= 9 && m.ba.every(Number.isFinite) ? m.ba.map(v => v | 0) : null; // [Emerly] 9 = + team
    let r = peerR.get(m.i);
    if (!ba || !p) { if (r) { r.ba = [0, 100, 0, 0, 0, 0, 0]; r.st.zone = 0; r.team = 0; } return; }
    if (!r || r.obj !== p.pirate.object) { const o = r; r = { ...rig(p.pirate.object), obj: p.pirate.object, ba: o ? o.ba : ba, guard: 0, lastSeq: o ? o.lastSeq : ba[3], lastDown: o ? o.lastDown : ba[6], hpShown: ba[1], name: '' }; peerR.set(m.i, r); } // [Emerly] their model swapped (v5 load): keep the seq / down edges
    const prevLife = r.ba[2], prevHp = r.ba[1]; r.name = String(m.n ?? '').replace(/[<>&"'`\\]/g, '').slice(0, 20) || 'PIRATE';
    if (ba[3] !== r.lastSeq) { r.lastSeq = ba[3]; if (ba[4] === 1 && ba[0] === Z_PIT) r.st.act = { kind: 1, t: 0 }; else if (ba[4] === 2 && ba[0] === Z_RANGE) r.fireAt = ARENA.musket.delay; }
    r.team = ba[8] === 1 || ba[8] === 2 ? ba[8] : 0;
    if (ba[6] && !r.lastDown) { if (r.team && ba[0] === me.zone) me.score[3 - r.team]++; const d = dealt.get(m.i); if (d && d.life === ba[2] && d.n > 0) { me.kos++; try { kd?.('k', `${m.i}:${ba[2]}`); } catch {} say(`KO! <small>${esc(r.name)} is down · just for fun</small>`, 1600); } }
    if (!ba[6] && r.lastDown) r.guard = ARENA.guardS;
    r.lastDown = ba[6]; if (ba[2] !== prevLife || ba[1] > prevHp) r.hpShown = ba[1]; else r.hpShown = Math.min(r.hpShown ?? ba[1], ba[1]);
    r.ba = ba; r.st.zone = ba[0]; r.swordId = SWORD_IDS[ba[5]] || SWORD_DEFAULT; r.musketId = MUSKET_IDS[ba[7] | 0] || MUSKET_DEFAULT;
    r.look = WSYNC_ON ? decodeWeaponLook(m.wl) : COMMON_LOOK; // [weapon-sync] their rarity + fitted attachments (missing = common)
    // their hits on YOU: bh[myId] = [your life, total they dealt you that life]; applied once, only from a pirate in your area + in reach
    const bh = m.bh && typeof m.bh === 'object' && !Array.isArray(m.bh) ? m.bh[myId()] : null;
    if (Array.isArray(bh) && bh.length === 2 && bh.every(Number.isFinite)) { const [life, n] = bh, s = seenHit.get(m.i);
      if (life === me.life) { const prev = s && s.life === life ? s.n : 0, delta = Math.min(100, n - prev); seenHit.set(m.i, { life, n: Math.max(prev, n) });
        const d = Math.hypot(p.x - walker.w.x, p.z - walker.w.z);
        const ok = STANCES_ON ? me.onFoot && d <= peerReach(ba[0]) && victimOpen(p) // [backpack-pvp] any stance of mine, their weapon's reach, never from inside a Safe Zone
          : me.zone && ba[0] === me.zone && d <= (me.zone === Z_PIT ? 5.5 : 70);
        if (delta > 0 && ok && !isMate(m.i, r)) takeHit(delta, r.name); } }
  }
  // HP bars over the pirates you fight (canvas sprite, redrawn only when it changes)
  function hpBar(r) { if (!r.bar) { const c = document.createElement('canvas'); c.width = 128; c.height = 20; const t = new THREE.CanvasTexture(c); r.bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); r.bar.scale.set(1.3, 0.2, 1); r.bar.renderOrder = 9; r.bar.position.y = 2.45; r.bar.userData.c = c; r.obj.add(r.bar); r.barV = -1; }
    const v = Math.max(0, r.hpShown ?? r.ba[1]); if (v !== r.barV || r.team !== r.barT) { r.barV = v; r.barT = r.team; const g = r.bar.userData.c.getContext('2d'); g.clearRect(0, 0, 128, 20); g.fillStyle = r.team === 1 ? '#ff4a3d' : r.team === 2 ? '#4a8dff' : '#161616'; g.fillRect(0, 0, 128, 20); g.fillStyle = '#161616'; g.fillRect(2, 2, 124, 16); g.fillStyle = v > 34 ? '#2fbf5a' : '#d8322f'; g.fillRect(3, 3, 122 * v / 100, 14); r.bar.material.map.needsUpdate = true; }
    r.bar.visible = !!r.st.zone || (STANCES_ON && (r.hpShown ?? r.ba[1]) < ARENA.hp); }

  // ---------- per frame ----------
  let t = 0;
  function tick(dt, onFoot, pirate) {
    t += dt; tickFx(dt);
    for (const tg of targets) { if (tg.t > 0) tg.t -= dt; const want = tg.t > 0 ? tg.flip : 0, cur = tg.piv.rotation.x; tg.piv.rotation.x = cur + (-want - cur) * Math.min(1, dt * (tg.t > 0 ? 18 : 4)); if (tg.t <= 0) tg.flip = 0; }
    for (const d of dummies) { d.wv += (-d.w * 60 - d.wv * 6) * dt; d.w += d.wv * dt; d.g.rotation.z = d.w * 0.35; }
    if (!onFoot || !pirate) { if (me.zone || me.onFoot) leave(); drawStance(false); return; }
    // [backpack-pvp] track Island Safe Zone + exit grace while on foot
    try { tickIsleSafe(isleSafe, ...layout.harborToFoot(walker.w.x, walker.w.z), performance.now() / 1000); } catch {}
    if (!mineR || mineR.obj !== pirate.object) { mineR = { ...rig(pirate.object), obj: pirate.object }; }
    hookBody(mineR); if (WSYNC_ON) setObjLook(pirate.object, localWeaponLook()); // [weapon-sync] YOUR holstered copies wear your look everywhere on foot (not only in an arena)
    const W = walker.w;
    if (me.down > 0) { me.down -= dt; if (me.downAt) { W.x = me.downAt[0]; W.z = me.downAt[1]; W.speed = 0; pirate.object.position.x = W.x; pirate.object.position.z = W.z; } if (me.down <= 0) respawn(); }
    me.guard = Math.max(0, me.guard - dt); me.cool = Math.max(0, me.cool - dt);
    if (STANCES_ON) { // [backpack-pvp] t1710u stances: arena = where you stand (pit / range), me.zone = what you hold
      me.onFoot = true; if (me.stance && inHouse?.()) setStance(0, true);
      const ar = me.down > 0 ? me.arena : zoneAt(W.x, W.z);
      if (ar !== me.arena) { me.arena = ar; if (ar) { readSword(); me.lastZone = ar; setStance(ar === Z_PIT ? 1 : 2, true); say(ar === Z_PIT ? '⚔ SWORD PIT<small>' + (touch ? 'tap SWING' : 'R or click to swing') + ' · no rewards, just glory</small>' : '🎯 MUSKET RANGE<small>' + (touch ? 'aim with the camera, tap FIRE' : 'aim with the camera · R or click to fire') + '</small>', 2200); } }
      // [t1729u] auto-holster to Unarmed inside Island Safe Zone (arena pads exempt)
      if (isleSafe._isleSafe && !me.arena && me.stance !== 0) setStance(0, true);
      const held = me.down > 0 ? me.zone : me.stance;
      if (held !== me.zone) { me.zone = held; me.cool = 0; mineR.st.act = null; me.fireAt = -1; if (held !== Z_RANGE) tps?.off(); }
      footRegen(dt); // [t1724u] the ship rule: 20 s without a hit -> +5% every 4 s
      drawStance(walker.active && !inHouse?.());
    } else {
    const z = me.down > 0 ? me.zone : zoneAt(W.x, W.z);
    if (z !== me.zone) { if (z) { readSword(); me.lastZone = z; if (!me.zone) say(z === Z_PIT ? '⚔ SWORD PIT<small>' + (touch ? 'tap SWING' : 'R or click to swing') + ' · no rewards, just glory</small>' : '🎯 MUSKET RANGE<small>' + (tps ? (touch ? 'drag the right side to aim · hold AIM for sights · tap FIRE' : 'click where you want to shoot · hold RIGHT to zoom') : touch ? 'aim with the camera, tap FIRE' : 'aim with the camera · R or click to fire') + '</small>', 2200); } else leave(); me.zone = z; me.cool = 0; mineR.st.act = null; }
    }
    // my rig
    const st = mineR.st; st.zone = me.zone; st.w += ((me.zone ? 1 : 0) - st.w) * Math.min(1, dt * 8); st.recoil = Math.max(0, st.recoil - dt * 5);
    if (st.act) { const a = st.act; a.t += dt; if (!a.hit && a.t >= ARENA.sword.hitAt) { a.hit = true; swordHit(); } if (a.t >= ARENA.sword.dur) st.act = null; }
    if (me.fireAt >= 0) { me.fireAt -= dt; if (me.fireAt < 0) shoot(mineR, W.x, W.z, W.yaw, true); }
    // [zipline-shoot] one hand on the trolley while GUN is drawn mid-ride; free-look ADS works on the cable
    const onZip = !!W.ride; W.zipAim = onZip && me.zone === Z_RANGE;
    if (onZip) zipGrip(pirate, true, 0, { free: me.zone === Z_RANGE ? 'R' : null });
    else { const zp = zipState(mineR); if (zp) zp.free = null; }
    tps?.tick(dt, me.zone === Z_RANGE); // [Timothy tps] over-the-shoulder camera while you hold a musket (also on zipline)
    if (me.zone === Z_RANGE && !st.act && !tps?.on && !onZip) { let dy = W.camYaw - W.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); if (W.speed < 0.3) W.yaw += dy * Math.min(1, dt * 6); }   // standing at the range you face where you aim
    dress(mineR, me.zone, swordId, musketId, me.team); knock(mineR, me.down > 0 ? Math.min(1, (ARENA.downS - me.down) * 4) : 0);
    if (me.guard > 0 && mineR.fig) mineR.fig.visible = Math.floor(t * 12) % 2 === 0; else if (mineR.fig) mineR.fig.visible = true;
    // peers
    for (const [id, r] of peerR) { const p = fnet.peers.get(id); if (!p || p.pirate.object !== r.obj) { r.bar?.removeFromParent(); r.bar = null; r.ring?.removeFromParent(); r.ring = null; if (!p) peerR.delete(id); continue; } // [Emerly] body swapped: onPeer re-rigs it and keeps the seq / down edges (a KO is never missed)
      hookBody(r); const s = r.st; s.zone = r.ba[0]; s.w += ((s.zone ? 1 : 0) - s.w) * Math.min(1, dt * 8); s.recoil = Math.max(0, s.recoil - dt * 5); r.guard = Math.max(0, r.guard - dt);
      if (s.act) { s.act.t += dt; if (s.act.t >= ARENA.sword.dur) s.act = null; }
      if (r.fireAt >= 0) { r.fireAt -= dt; if (r.fireAt < 0) shoot(r, p.x, p.z, p.yaw, false); }
      // [zipline-shoot] peer on a cable with musket drawn: left hand grips, right aims (matches local)
      if (p.fy != null) { zipGrip(p.pirate, true, 0, { free: s.zone === Z_RANGE ? 'R' : null }); }
      else { const zp = zipState(r); if (zp) zp.free = null; }
      dress(r, s.zone, r.swordId || SWORD_DEFAULT, r.musketId || MUSKET_DEFAULT, r.team || 0); knock(r, r.ba[6] ? 1 : 0); hpBar(r); }
    drawHud();
  }
  function leave() { tps?.off(); me.zone = 0; me.stance = 0; me.arena = 0; me.onFoot = false; me.downArena = 0; me.hp = ARENA.hp; me.repT = 0; me.repairing = false; me.down = 0; me.fireAt = -1; me.score = [0, 0, 0]; if (walker?.w) walker.w.zipAim = false; if (mineR) { mineR.st.act = null; mineR.st.zone = 0; knock(mineR, 0); if (mineR.fig) { mineR.fig.visible = true; const zp = zipState(mineR); if (zp) zp.free = null; } } drawHud(); }
  function netState() {
    const cw = crewFight?.wire?.('me') || { cm: 0, ct: '' }; // [backpack-pvp] cm 1 gun | 2 sword, ct = the pirate whose crew yours fights
    if (STANCES_ON ? !me.onFoot : !me.zone) return { ba: 0, cm: cw.cm, ct: cw.ct }; // [backpack-pvp] stances: ba rides whenever you are on foot (ba[0] = held: 0 unarmed)
    const out = { cm: cw.cm, ct: cw.ct, ba: [me.zone, Math.round(me.hp), me.life, me.seq, me.kind, Math.max(0, SWORD_IDS.indexOf(swordId)), me.down > 0 ? 1 : 0, Math.max(0, MUSKET_IDS.indexOf(musketId)), me.team] };
    if (dealt.size) { const bh = {}; for (const [id, d] of dealt) if (fnet.peers.has(id)) bh[id] = [d.life, d.n]; out.bh = bh; }
    return out;
  }
  // [Emerly] fight sync: while you and at least one other pirate are in the same area, ask the harbor room (js/transport.js Batcher.boost,
  // wired in js/pvp.js) to send YOUR state at HARBOR_NET.fight.hz (1v1) / hz4 (3-4 fighters). 0 = the normal 1 Hz harbor rate.
  // [v337] BANKSY t1789u Free-tier budget: each sent packet fans out to every peer in the room (cost M msgs), so clamp fHz so
  // (k * fHz + Math.max(0, M - k) * HARBOR_NET.hz) * M <= fight.budget (default 64). Still prefers 10 Hz in 2p / 5 Hz in 3-4p.
  function fastHz(roomN) { if (!me.zone) return 0; let n = 0; for (const r of peerR.values()) if (STANCES_ON ? r.ba[0] > 0 : r.ba[0] === me.zone) n++; if (!n) return 0;
    const F = HARBOR_NET.fight || {}, k = n + 1, want = k <= 2 ? (F.hz ?? 10) : (F.hz4 ?? 5), base = HARBOR_NET.hz || 1;
    const M = Math.max(2, (roomN | 0) || (1 + peerR.size) || 2), budget = F.budget || 64;
    const maxHz = Math.max(base, (budget / M - Math.max(0, M - k) * base) / k);
    return Math.min(want, F.max ?? 10, maxHz); }
  // [Emerly] crew followers stay OUT of the arenas: a point inside the pit / range (+1.6 m) -> the spot where follower i waits
  // (just outside the gate, harbor coords); null = free to walk there. js/onfoot/followers.js keepOut.
  function keepOut(x, z, i = 0) { const [lx, lz] = toTown(x, z);
    if (BA.inPit(lx, lz, -1.6)) { const [a, b] = BA.pitAt(BA.PIT.gateA + (i - 1) * 0.17, BA.PIT.r + 3.4); return H(a, b); }
    if (BA.inRange(lx, lz, -1.6)) { const R = BA.RANGE; return H(R.gate[0] + (i - 1) * 1.8, R.lz1 + 3.4); }
    return null; }
  function clear() { leave(); for (const r of peerR.values()) { r.bar?.removeFromParent(); r.ring?.removeFromParent(); } peerR.clear(); dealt.clear(); seenHit.clear(); for (const f of fxs) f.m.removeFromParent(); fxs.length = 0; document.documentElement.classList.remove('bt-on'); }
  // shop card renders (tools/battle/weapon_thumbs.html): pose any loaded v5 pirate with a weapon, outside the game loop
  function preview(obj, zone, id, act = null) { const R = { ...rig(obj), obj }; if (!hookBody(R)) return null; R.st.zone = zone; R.st.w = 1; R.st.act = act;
    dress(R, zone, zone === Z_PIT ? id : SWORD_DEFAULT, zone === Z_RANGE ? id : MUSKET_DEFAULT); return R; }
  return { hpState: () => ({ hp: me.hp, maxHp: ARENA.hp, repairing: !!me.repairing, onFoot: !!me.onFoot, down: me.down > 0 }), // [t1724u] main.js drives the captain-card #player-hp from this on foot
    muzzleAt: () => mineR ? muzzleWorld(mineR, new THREE.Vector3()).toArray().map(v => +v.toFixed(2)) : null, root, store, shops, setShopDoor, storeDoors, targets, dummies, attack, tick, onPeer, netState, clear, me, fastHz, keepOut, setTeam, peers: peerR, get zone() { return me.zone; }, setStance, cycleStance, get stance() { return me.stance; }, get arena() { return me.arena; }, harborRespawn, openHitOk, takeHit, respawn, get rig() { return mineR; }, swordId: () => swordId, musketId: () => musketId, preview, tps, padHud: () => { hudSig = ''; stanceSig = ''; drawHud(); drawStance(stanceBar.classList.contains('on')); }, isleSafe, graceLeft: (now) => graceLeft(isleSafe, now, SAFE_GRACE_S) };
}
