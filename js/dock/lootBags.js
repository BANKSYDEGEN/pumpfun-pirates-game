// [backpack-pvp] BANKSY t1693u: 3D Plunder Loot Bags from on-foot PvP deaths (unequipped haul only).
// Kill switch: &pvploot=0. Offline/local fallback when Supabase unreachable.
// [backpack-pvp] t1698u Option B: sea: true = a FLOATING SEA LOOT CRATE (sunk at sea by a pirate) that rides the swell; claim it on foot /
// swimming / in the canoe ([E] LOOT PLUNDER <= 3.5 m) or by sailing through it (hull reach <= 15 m: auto-scoop, 16-slot cap, BANKSY ∞).
// Coords: the scene / walker HARBOR frame; the Safe Zone test converts (inSafe hook).
import * as THREE from 'three';
import { escHtml, isNetId, num } from '../safe.js';
import {
  countBackpackSlots, canAcceptItem, splitLootForCap, isUnlimitedBag, BAGCAP_ON, BACKPACK_CAP, splitHaulForDrop,
} from '../inventory/backpackCap.js';
import { insideSafeZoneH } from '../island/safeZones.js';
import { itemInfo } from '../inventory/catalog.js';
import { showLootCard } from '../lootCard.js'; // [v370] BANKSY t1967u: show WHAT you looted

export const PVPLOOT_ON = !(typeof location !== 'undefined' && /[?&]pvploot=0(&|$)/.test(location.search || ''));
export const LOOT_TTL_S = 120;
export const LOOT_PROMPT_R = 2.6;
export const SEA_FOOT_R = 3.5, SEA_HULL_R = 15;
export const MAX_BAGS = 12;

const LOCAL_KEY = 'pfp_loot_bags_v1';

function lsLoad() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}
function lsSave(rows) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, MAX_BAGS))); } catch {}
}

export function buildLootBagMesh(THREE_ = THREE) {
  const g = new THREE_.Group(); g.name = 'loot_bag';
  const sack = new THREE_.Mesh(
    new THREE_.SphereGeometry(0.42, 10, 8),
    new THREE_.MeshStandardMaterial({ color: 0xc4a574, roughness: 0.85, metalness: 0.05 }),
  );
  sack.scale.set(1, 0.85, 1.05); sack.position.y = 0.38; g.add(sack);
  const cinch = new THREE_.Mesh(
    new THREE_.TorusGeometry(0.18, 0.035, 6, 10),
    new THREE_.MeshStandardMaterial({ color: 0x5a3a18, roughness: 0.7 }),
  );
  cinch.rotation.x = Math.PI / 2; cinch.position.y = 0.72; g.add(cinch);
  const clasp = new THREE_.Mesh(
    new THREE_.BoxGeometry(0.12, 0.08, 0.06),
    new THREE_.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.35 }),
  );
  clasp.position.set(0, 0.74, 0.16); g.add(clasp);
  for (let i = 0; i < 5; i++) {
    const coin = new THREE_.Mesh(
      new THREE_.CylinderGeometry(0.06, 0.06, 0.02, 8),
      new THREE_.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.3, emissive: 0x553300, emissiveIntensity: 0.35 }),
    );
    const a = (i / 5) * Math.PI * 2;
    coin.position.set(Math.cos(a) * 0.38, 0.04, Math.sin(a) * 0.38);
    coin.rotation.x = Math.PI / 2; g.add(coin);
  }
  const ring = new THREE_.Mesh(
    new THREE_.RingGeometry(0.55, 0.95, 24),
    new THREE_.MeshBasicMaterial({ color: 0xffcd77, transparent: true, opacity: 0.45, side: THREE_.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
  g.userData.bob = Math.random() * Math.PI * 2;
  return g;
}

/** Floating sea loot crate: sea-bound plunder chest + brass straps + a red / white buoy ring. */
export function buildSeaCrateMesh(THREE_ = THREE) {
  const g = new THREE_.Group(); g.name = 'sea_loot_crate';
  const wood = new THREE_.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.85 }), dark = new THREE_.MeshStandardMaterial({ color: 0x4a2e14, roughness: 0.9 });
  const brass = new THREE_.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.3, emissive: 0x3a2600, emissiveIntensity: 0.4 });
  const body = new THREE_.Mesh(new THREE_.BoxGeometry(1.5, 0.9, 1.05), wood); body.position.y = 0.35; g.add(body);
  const lid = new THREE_.Mesh(new THREE_.CylinderGeometry(0.53, 0.53, 1.5, 12, 1, false, 0, Math.PI), dark); lid.rotation.z = Math.PI / 2; lid.rotation.y = Math.PI / 2; lid.position.y = 0.8; lid.scale.set(1, 1, 1); g.add(lid);
  for (const x of [-0.5, 0, 0.5]) { const st = new THREE_.Mesh(new THREE_.BoxGeometry(0.09, 1.0, 1.1), brass); st.position.set(x, 0.42, 0); g.add(st); }
  const lock = new THREE_.Mesh(new THREE_.BoxGeometry(0.22, 0.26, 0.08), brass); lock.position.set(0, 0.72, 0.56); g.add(lock);
  const white = new THREE_.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.6 }), red = new THREE_.MeshStandardMaterial({ color: 0xd8342b, roughness: 0.6 });
  for (let i = 0; i < 8; i++) { const seg = new THREE_.Mesh(new THREE_.TorusGeometry(1.35, 0.17, 6, 6, Math.PI / 4), i % 2 ? red : white); seg.rotation.x = Math.PI / 2; seg.rotation.z = i * Math.PI / 4; seg.position.y = 0.05; g.add(seg); }
  const glow = new THREE_.Mesh(new THREE_.RingGeometry(1.6, 2.4, 28), new THREE_.MeshBasicMaterial({ color: 0xffcd77, transparent: true, opacity: 0.4, side: THREE_.DoubleSide, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02; glow.name = 'glow'; g.add(glow);
  const flag = new THREE_.Mesh(new THREE_.ConeGeometry(0.05, 1.4, 5), dark); flag.position.set(0.55, 1.5, -0.3); g.add(flag);
  const pennant = new THREE_.Mesh(new THREE_.PlaneGeometry(0.55, 0.32), new THREE_.MeshBasicMaterial({ color: 0x111111, side: THREE_.DoubleSide })); pennant.position.set(0.83, 2.0, -0.3); g.add(pennant);
  g.userData.bob = Math.random() * Math.PI * 2; g.scale.setScalar(1.7); // reads from the helm at 20-30 m
  return g;
}

export function createLootBags({
  scene, world, walker, toast = () => {}, sfx = null, invApi = null, inventory = null,
  myId = () => '', myName = () => 'PIRATE', isOwner = () => false, inHouse = () => false,
  inSafe = (hx, hz) => insideSafeZoneH(hx, hz), now = () => performance.now() / 1000, waveHeight = null, broadcast = null,
}) {
  if (!PVPLOOT_ON) {
    return {
      on: false, bags: () => [], tick() {}, prompts: () => null, act() {},
      dropHaul: async () => null, dropLocalHaul: async () => null, claim: async () => null, onNet() {}, clear() {},
    };
  }

  const bags = new Map(); // id -> { id, x, y, z, items, victim_id, victim_name, expires_at, mesh }
  let promptId = null;

  function groundY(x, z) {
    try { return world?.ground?.(x, z) ?? 0; } catch { return 0; }
  }

  function disposeBag(b) {
    if (!b?.mesh) return;
    try { scene.remove(b.mesh); } catch {}
    b.mesh.traverse?.((o) => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material.dispose?.();
      }
    });
    b.mesh = null;
  }

  function upsert(row) {
    if (!row?.id) return;
    const id = String(row.id);
    const items = Array.isArray(row.items) ? row.items.filter((it) => it?.item && (it.qty | 0) > 0) : [];
    if (!items.length) { remove(id); return; }
    let b = bags.get(id);
    const x = num(row.x, 0), z = num(row.z, 0), y = num(row.y, groundY(x, z));
    if (!b) {
      if (bags.size >= MAX_BAGS) {
        // drop oldest
        let oldest = null;
        for (const v of bags.values()) if (!oldest || v.expires_at < oldest.expires_at) oldest = v;
        if (oldest) remove(oldest.id);
      }
      b = { id, sea: !!row.sea, mesh: row.sea ? buildSeaCrateMesh() : buildLootBagMesh() };
      scene.add(b.mesh);
      bags.set(id, b);
    }
    b.x = x; b.y = y; b.z = z; b.items = items;
    b.victim_id = isNetId(row.victim_id) ? row.victim_id : String(row.victim_id || '').slice(0, 40);
    b.victim_name = String(row.victim_name || 'PIRATE').slice(0, 24);
    b.expires_at = Number(row.expires_at) || (Date.now() + LOOT_TTL_S * 1000);
    b.mesh.position.set(x, y, z);
  }
  const sane = (r) => r && /^[a-zA-Z0-9_-]{4,64}$/.test(String(r.id || ''));

  function remove(id) {
    const b = bags.get(id); if (!b) return;
    disposeBag(b); bags.delete(id);
    if (promptId === id) promptId = null;
  }

  function persistLocal() {
    lsSave([...bags.values()].map((b) => ({
      id: b.id, x: b.x, y: b.y, z: b.z, items: b.items, sea: !!b.sea,
      victim_id: b.victim_id, victim_name: b.victim_name, expires_at: b.expires_at,
    })));
  }

  // Restore local bags (offline / refresh)
  for (const row of lsLoad()) {
    if (Number(row.expires_at) > Date.now()) upsert(row);
  }

  async function dropHaul({ items, equipped, x, y, z, killer_id = '', room = 'island', sea = false }) {
    if (!PVPLOOT_ON) return null;
    if (!sea && inHouse?.()) return null;
    if (!sea && inSafe?.(x, z)) return null; // on-foot: never inside an Island Safe Zone (the sea: Safe Harbor ships can't be sunk anyway)
    const { drop } = splitHaulForDrop(items, equipped);
    if (!drop.length) return null;
    const victim_name = String(myName?.() || 'PIRATE').slice(0, 24);
    const victim_id = String(myId?.() || 'local');
    const payload = {
      x: num(x, 0), y: num(y, groundY(x, z)), z: num(z, 0),
      room: sea ? 'sea' : String(room || 'island').slice(0, 24), sea: !!sea,
      victim_name, killer_id: String(killer_id || '').slice(0, 40),
      items: drop, equipped: equipped || {},
    };
    let bag = null;
    try {
      if (invApi) {
        const r = await invApi('pvp_drop_haul', payload);
        if (r?.ok && r.bag) bag = r.bag;
        else if (r?.ok && (r.empty || r.bag === null)) return null; // the server says no unequipped haul: no phantom bag
      }
    } catch {}
    if (!bag) {
      bag = {
        id: 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        ...payload,
        victim_id,
        expires_at: Date.now() + LOOT_TTL_S * 1000,
      };
    }
    bag.sea = !!sea || bag.room === 'sea';
    upsert(bag);
    persistLocal();
    try { broadcast?.({ type: 'loot_spawn', bag: { ...bag, expires_at: bags.get(String(bag.id))?.expires_at } }); } catch {}
    toast(sea ? `🌊 SEA LOOT CRATE ADRIFT<br><small>${drop.reduce((a, i) => a + (i.qty | 0), 0)} haul items floating · equipped gear kept</small>` : `💀 PLUNDER DROPPED<br><small>${drop.reduce((a, i) => a + (i.qty | 0), 0)} items on the ground</small>`, 2400);
    return { bag, remainingInventory: splitHaulForDrop(items, equipped).keep };
  }

  /** Option B: sunk at sea by a pirate (js/pvp.js harborPvpSunk). Harbor coords; the inventory's unequipped haul only. */
  async function dropLocalHaul({ sea = true, hx, hz, killerId = '' } = {}) {
    let items = [], equipped = {};
    try { const inv = typeof inventory === 'function' ? inventory() : inventory; const d = inv?.data || {}; items = d.items || []; equipped = d.equipped || {}; } catch {}
    const y = sea && waveHeight ? waveHeight(hx, hz, now()) : groundY(hx, hz);
    return dropHaul({ items, equipped, x: num(hx, 0), y, z: num(hz, 0), killer_id: String(killerId || '').slice(0, 40), sea });
  }
  let claiming = null;
  async function claim(bagId) {
    const b = bags.get(bagId); if (!b) return null;
    if (claiming === bagId) return null; claiming = bagId;
    try { return await claim0(b, bagId); } finally { claiming = null; }
  }
  async function claim0(b, bagId) {
    let looterItems = [];
    let equipped = {};
    try {
      const inv = typeof inventory === 'function' ? inventory() : inventory;
      if (inv?.refresh) {
        const r = await inv.refresh();
        if (r?.ok) { looterItems = r.items || []; equipped = r.equipped || {}; }
      } else if (inv?.data) {
        looterItems = inv.data.items || []; equipped = inv.data.equipped || {};
      }
    } catch {}
    const state = { owner: !!isOwner?.(), name: myName?.() };
    const { take, left } = splitLootForCap(b.items, looterItems, equipped, state);
    if (!take.length) {
      toast('🎒 Backpack full (16/16)! Stash haul at your Cottage!', 2200);
      return null;
    }
    let ok = false;
    try {
      if (invApi) {
        const r = await invApi('pvp_claim_loot', { bag_id: bagId, equipped, take });
        if (r?.ok) {
          ok = true;
          if (r.bag?.items?.length) upsert(r.bag); else remove(bagId);
          try { await (typeof inventory === 'function' ? inventory() : inventory)?.refresh?.(); } catch {}
        }
      }
    } catch {}
    if (!ok) {
      // Local claim
      if (left.length) { b.items = left; upsert(b); } else remove(bagId);
      try {
        const st = JSON.parse(localStorage.getItem('pfp_houses_v1') || '{}');
        st.demoBag = st.demoBag || [];
        for (const it of take) {
          const row = st.demoBag.find((x) => x.item === it.item);
          if (row && !String(it.item).startsWith('wpn:')) row.qty += it.qty;
          else st.demoBag.push({ item: it.item, qty: it.qty, equipped: false });
        }
        localStorage.setItem('pfp_houses_v1', JSON.stringify(st));
      } catch {}
      persistLocal();
    }
    try { broadcast?.({ type: 'loot_claim', bag_id: bagId, bag: bags.has(bagId) ? { ...bags.get(bagId), mesh: undefined } : null }); } catch {}
    const n = take.reduce((a, i) => a + (i.qty | 0), 0);
    const who = escHtml(b.victim_name || 'a pirate');
    sfx?.coin?.();
    showLootCard({ title: b.sea ? 'SEA LOOT CRATE' : 'PLUNDER', from: b.victim_name || 'a pirate', items: take.map((it) => { const inf = (() => { try { return itemInfo(it.item); } catch { return null; } })(); return { icon: inf?.icon || '📦', name: inf?.name || String(it.item).split(':').pop().replace(/_/g, ' '), qty: it.qty | 0 || 1 }; }) });
    if (!n) toast(`💰 Looted ${who}'s plunder!`, 1600);
    if (left.length && !isUnlimitedBag(state)) toast('🎒 Backpack full — leftover plunder stays in the bag!', 2000);
    return { take, left };
  }

  function nearest(W) {
    let best = null, bd = Infinity;
    for (const b of bags.values()) {
      const d = Math.hypot(b.x - W.x, b.z - W.z);
      if (d < (b.sea ? SEA_FOOT_R : LOOT_PROMPT_R) && d < bd) { bd = d; best = b; }
    }
    return best;
  }

  function prompts({ onFoot, W }) {
    if (!onFoot || !W) { promptId = null; return null; }
    const b = nearest(W);
    if (!b) { promptId = null; return null; }
    promptId = b.id;
    const n = b.items.reduce((a, i) => a + (i.qty | 0), 0);
    const who = escHtml(b.victim_name || 'PIRATE');
    return {
      label: b.sea ? `LOOT SEA CRATE (${n} ITEMS)` : `LOOT PLUNDER (${n} ITEMS)`,
      key: 'E', primary: true, tag: 'loot',
      detail: who,
    };
  }

  function act() {
    if (promptId) return claim(promptId);
    return null;
  }

  // o.ship (manned, sailing): hull reach <= SEA_HULL_R auto-scoops a sea crate · o.canoe { x, z }: <= SEA_FOOT_R scoops too
  function tick(dt, o = {}) {
    const tn = Date.now(), t = now();
    for (const b of [...bags.values()]) {
      if (b.expires_at <= tn) { remove(b.id); continue; }
      if (!b.mesh) continue;
      b.userBob = (b.userBob || b.mesh.userData.bob || 0) + dt * 2.2;
      if (b.sea) { // rides the swell: wave height + a little roll / pitch from the slope
        const h = waveHeight ? waveHeight(b.x, b.z, t) : b.y, hx = waveHeight ? waveHeight(b.x + 1, b.z, t) - h : 0, hz = waveHeight ? waveHeight(b.x, b.z + 1, t) - h : 0;
        b.mesh.position.y = h - 0.15; b.mesh.rotation.z = -hx * 0.8 + 0.05 * Math.sin(b.userBob); b.mesh.rotation.x = hz * 0.8; b.mesh.rotation.y += dt * 0.12;
      } else { b.mesh.position.y = b.y + 0.06 * Math.sin(b.userBob); b.mesh.rotation.y += dt * 0.35; }
      const ring = b.mesh.children.find((c) => c.geometry?.type === 'RingGeometry');
      if (ring?.material) ring.material.opacity = 0.35 + 0.2 * Math.sin(b.userBob * 1.5);
      if (b.sea && claiming !== b.id && (b.scoopT || 0) < tn) {
        const s = o.ship, c = o.canoe;
        const near = (s && o.sailing && s.alive !== false && Math.hypot(s.x - b.x, s.z - b.z) <= SEA_HULL_R) || (c && Math.hypot(c.x - b.x, c.z - b.z) <= SEA_FOOT_R);
        if (near) { b.scoopT = tn + 2500; claim(b.id); }
      }
    }
  }

  function onNet(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'loot_spawn' && sane(msg.bag)) upsert(msg.bag);
    if (msg.type === 'loot_claim') {
      if (sane(msg.bag) && msg.bag?.items?.length) upsert(msg.bag);
      else if (msg.bag_id) remove(msg.bag_id);
    }
  }

  function clear() {
    for (const id of [...bags.keys()]) remove(id);
  }

  return {
    on: true,
    bags: () => [...bags.values()].map((b) => ({ id: b.id, x: b.x, y: b.y, z: b.z, sea: !!b.sea, items: b.items, victim_name: b.victim_name, expires_at: b.expires_at })),
    tick, prompts, act, dropHaul, dropLocalHaul, claim, onNet, clear, upsert, remove,
  };
}
