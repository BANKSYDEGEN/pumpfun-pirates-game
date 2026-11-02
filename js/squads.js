// PUMPFUN PIRATES · [v98] SQUADS (2v2) helpers: team making, team colours on a ship (sails + flag only, the hull keeps its
// skin), the ring under a teammate. The round itself (host-run phases, spawns, win, gold) lives in js/pvp.js.
import * as THREE from 'three';
import { clothTexture } from './toon.js';
import { sailMaterial, mirror, flagMats, makeSkullTexture } from './ships.js';
import { SQUADS } from './config.js';
import { dressMaterial } from './shipKit.js'; // [Timothy] kit cloth detail on team sails

// Team making for one round (the host runs it): party pairs stay together, everyone else is paired at random.
// players: [{ id, pc }] (pc = party tag, '' for none). Returns { A: [ids], B: [ids] } with SQUADS.size each when possible.
export function makeTeams(players, rand = Math.random) {
  const byPc = new Map(), solos = [];
  for (const p of players) { if (p.pc) { if (!byPc.has(p.pc)) byPc.set(p.pc, []); byPc.get(p.pc).push(p.id); } else solos.push(p.id); }
  const pairs = [];
  for (const ids of byPc.values()) { ids.sort(); while (ids.length >= 2) pairs.push(ids.splice(0, 2)); solos.push(...ids); } // a lone party member = a solo
  for (let i = solos.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [solos[i], solos[j]] = [solos[j], solos[i]]; }
  while (solos.length >= 2) pairs.push(solos.splice(0, 2));
  if (solos.length) pairs.push([solos[0]]);
  pairs.sort((a, b) => b.length - a.length);
  const A = [...(pairs[0] || [])], B = [...(pairs[1] || [])];
  if (!B.length && A.length > 1) B.push(A.pop()); // only 2 pirates (a test room's ?sqmin): 1v1, never one team alone
  if (rand() < 0.5) return { A: [...B], B: [...A] };
  return { A: [...A], B: [...B] };
}
export const partyTag = (code) => { if (!code) return ''; let h = 7; for (const ch of String(code)) h = (h * 131 + ch.charCodeAt(0)) >>> 0; return h.toString(36).slice(0, 6); };
export const PARTY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newPartyCode = () => Array.from({ length: 5 }, () => PARTY_CHARS[Math.floor(Math.random() * PARTY_CHARS.length)]).join('');
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

// ---- team colours: every sail (anything on the shared sail shader) + the flag; materials cached per colour ----
const kits = new Map();
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return c.getHex(); };
function teamKit(hex, skullImg) {
  if (kits.has(hex)) return kits.get(hex);
  const cloth = clothTexture({ base: hex, seed: 97, patchColors: [shade(hex, 0.82), shade(hex, 1.12)], border: shade(hex, 0.55) });
  const main = skullImg ? makeSkullTexture(skullImg, { w: 512, h: 400, bg: '#' + shade(hex, 0.62).toString(16).padStart(6, '0'), pad: 0.14 }) : cloth;
  const flag = skullImg ? makeSkullTexture(skullImg, { w: 512, h: 340, bg: '#' + hex.toString(16).padStart(6, '0'), pad: 0.1 }) : cloth;
  const k = { sail: sailMaterial(cloth, THREE.FrontSide, 1), sailBack: sailMaterial(mirror(cloth), THREE.BackSide, 1), main: sailMaterial(main, THREE.FrontSide, 1), mainBack: sailMaterial(mirror(main), THREE.BackSide, 1), flag: flagMats(flag) };
  for (const m of [k.sail, k.sailBack, k.main, k.mainBack]) dressMaterial(m, 'sail', { strength: 0.8 }); // [Timothy] team sails keep the Blender-kit cloth (seams, reef band); colour unchanged
  kits.set(hex, k); return k;
}
// hex = team colour, or null to put the skin's own sails / flag back. mainImg: the image of the skull main-sail map (so the
// big main sail keeps a skull, in team colours).
export function teamPaint(mesh, hex, { skullImg = null, mainImg = null } = {}) {
  const ud = mesh?.userData; if (!ud || ud.teamHex === hex) return;
  ud.teamHex = hex;
  const K = hex == null ? null : teamKit(hex, skullImg);
  const flagParts = new Set(ud.flag ? ud.flag.children : []);
  // the rig's own sail list too (front = child 0, back = child 1), so skins whose materialFx swapped the sail shader still recolour
  const sailParts = new Map(); (ud.sails || []).forEach((g, gi) => (g.children || []).forEach((c, ci) => { if (c.isMesh) sailParts.set(c, { back: ci === 1, idx: gi }); }));
  mesh.traverse(o => {
    if (!o.isMesh) return;
    const isFlag = flagParts.has(o), base = o.userData.teamOrig || o.material, sp = sailParts.get(o);
    const isSail = !isFlag && (!!sp || base?.customProgramCacheKey?.() === 'sail');
    if (!isFlag && !isSail) return;
    if (!o.userData.teamOrig) o.userData.teamOrig = o.material;
    if (!K) { o.material = o.userData.teamOrig; return; }
    const back = sp ? sp.back : base.side === THREE.BackSide;
    if (isFlag) { o.material = K.flag[back ? 1 : 0]; return; }
    const main = mainImg && base.map?.image === mainImg;
    o.material = main ? (back ? K.mainBack : K.main) : (back ? K.sailBack : K.sail);
  });
}
// a soft ring on the water under a teammate's ship
const ringGeo = new THREE.RingGeometry(0.86, 1, 48); ringGeo.rotateX(-Math.PI / 2);
const ringMat = new THREE.MeshBasicMaterial({ color: SQUADS.blue, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
export function mateRing(scene) { const m = new THREE.Mesh(ringGeo, ringMat); m.renderOrder = 5; m.userData.sharedGeo = true; m.frustumCulled = false; scene.add(m); return m; }
export const hexCss = (hex) => '#' + hex.toString(16).padStart(6, '0');
