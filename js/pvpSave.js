// PUMPFUN PIRATES · PvP progress saving.
//   ALWAYS on this device (localStorage, automatic, no prompt; a new device starts at zero).
//   OPTIONAL "Connect wallet to save": READ-ONLY wallet sign-in (signMessage of a plain-text message, NEVER a
//   transaction / approval / funds). The `pvp` Edge Function verifies the ed25519 signature, then the save is kept in
//   the pvp_profiles table too, so the same wallet restores it on any device. Once linked, saves go to BOTH.
//   Linking: the wallet's save wins when it has progress; a brand-new wallet save is seeded from this device once.
// A save holds gold (whatever you're carrying), upgrade levels, skins (selected + unlocked by kills) and lifetime K/D.
// Storage is keyed by a PROFILE KEY ('device' / 'wallet:<pubkey>' today) so a later version can key upgrades by a
// ship NFT mint ('mint:<mint>'); the server table already has a nullable `mint` column for that.
import { PVP_FN_URL, PIRATE_FN_URL, SUPABASE_ANON_KEY, PVP_SKIN_TIERS, PVP_UNLOCK_SKINS, UNLOCK_STAT, HOLDER_DAILY_GOLD } from './config.js';
import { UPGRADES } from './upgrades.js';
import { findProvider, sigBytes } from './pirateAccount.js';

const DEVICE_KEY = 'pfp_pvp_save_v1', SESSION_KEY = 'pfp_pvp_session_v1';
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };

// [v85] OWNER-ONLY one-off (BANKSY, game owner): his two no-wallet devices (one merged BATTLE ROYALE account, BANKSYDEGEN)
// get every PvP skin. Matched on the SHA-256 device id of this device's private key, so no one else can claim it; not a feature.
const OWNER_DEVS = ['dev:e191a32e15abea4f14355121', 'dev:c53da939472a7ae23f6dd873'];
let ownerAll = false;
export const ownerAllSkins = () => ownerAll;
export const ownerReady = (async () => { try { const k = ls.get('pfp_pvp_dk_v1'); if (!k || !crypto?.subtle) return false;
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pfp-dev:' + k)))].map(x => x.toString(16).padStart(2, '0')).join('');
  return (ownerAll = OWNER_DEVS.includes('dev:' + h.slice(0, 24))); } catch { return false; } })();
// [v102] pirate gear slots (js/shopCatalog.js ids): the first id of each slot is the free default (shirtless start)
export const GEAR_SLOTS = { hat: ['none', 'bandana', 'tricorn', 'bicorne'], outfit: ['shirtless', 'tank', 'tshirt', 'coat'], eyes: ['plain', 'eyepatch', 'sunglasses', 'laser'], parrot: ['none', 'parrot_green', 'parrot_red', 'parrot_gold'], hook: ['none', 'hook_iron', 'hook_gold'] };
export function cleanGear(g) { const o = {}; for (const [sl, ids] of Object.entries(GEAR_SLOTS)) o[sl] = ids.includes(g?.[sl]) ? g[sl] : ids[0]; return o; }
// shop state from the server: { rev, skins: [...], gear: [...] } (null until it answers); the ONE copy of shop_rev on this device
const shop = { rev: null, skins: null, gear: null };
export const blankProfile = () => ({ v: 1, gold: 0, levels: Object.fromEntries(UPGRADES.map(u => [u.id, 0])), skins: { owned: [], equipped: 'classic' }, gear: cleanGear(null), gearOwned: [], rev: 0, stats: { kills: 0, deaths: 0, botKills: 0, harborKills: 0, bossKills: 0 } }); // [v98] + harbor AI / boss kills (unlock tracks)
export function cleanProfile(p) {
  const b = blankProfile(); if (!p || typeof p !== 'object') return b;
  const n = (x, hi) => Math.max(0, Math.min(hi, Math.floor(Number(x) || 0)));
  b.gold = n(p.gold, 1e7);
  for (const u of UPGRADES) b.levels[u.id] = n(p.levels?.[u.id], u.tiers.length);
  const st = p.stats || {}; b.stats = { kills: n(st.kills, 1e7), deaths: n(st.deaths, 1e7), botKills: n(st.botKills, 1e7), harborKills: n(st.harborKills, 1e7), bossKills: n(st.bossKills, 1e7) };
  // [v102] THE ISLAND SHOP: skins are BOUGHT with gold. The owned list is the server's (pvp_owned, cached here by dev_sync / load):
  // shop.skins once the server answered, else whatever this save already had (an older save's kill-tier list = what it could use)
  const known = new Set([...PVP_SKIN_TIERS.map(t => t.id), ...PVP_UNLOCK_SKINS.map(u => u.id)]);
  b.skins.owned = ownerAll ? [...known].filter(id => id !== 'classic') : (shop.skins || (Array.isArray(p.skins?.owned) ? p.skins.owned : [])).filter(id => known.has(id) && id !== 'classic');
  const eq = p.skins?.equipped; b.skins.equipped = eq === 'classic' || b.skins.owned.includes(eq) ? eq : 'classic';
  b.gear = cleanGear(p.gear); b.gearOwned = ownerAll ? ['*'] : (shop.gear || (Array.isArray(p.gearOwned) ? p.gearOwned : [])).filter(k => typeof k === 'string' && /^[a-z]{2,10}:[a-z0-9_]{2,24}$/.test(k));
  for (const [sl, ids] of Object.entries(GEAR_SLOTS)) if (b.gear[sl] !== ids[0] && !ownerAll && !b.gearOwned.includes(`${sl}:${b.gear[sl]}`)) b.gear[sl] = ids[0];
  b.rev = Number.isFinite(p.rev) ? Math.max(0, p.rev | 0) : (shop.rev ?? 0); // the rev travels WITH the gold it was taken at (bumped only by a buy)
  return b;
}
// HOLDER PERK: server-checked (the client can't fake the balance or claim twice). Fails closed: any error = no perk.
// [v85] OWNER-ONLY (BANKSYDEGEN's two devices, no wallet): the holder perk (2× earned gold, daily gold) without a wallet. Gold is
// kept on the device when no wallet is signed, so the daily claim is tracked on the device too (once per Indianapolis day).
const OWNER_DAY_KEY = 'pfp_owner_daily_v1', indyDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Indiana/Indianapolis' }).format(new Date());
export async function holderStatus() { const s = session(); await ownerReady;
  if (!s && ownerAll) return { holder: true, claimed: ls.get(OWNER_DAY_KEY) === indyDay(), daily: HOLDER_DAILY_GOLD, owner: true };
  if (!s) return { holder: false }; try { return await api('holder', { token: s.token }); } catch { return { holder: false }; } }
export async function holderClaim() { const s = session();
  if (!s && ownerAll) { const d = indyDay(); if (ls.get(OWNER_DAY_KEY) === d) { const e = new Error('already claimed today'); e.status = 409; throw e; }
    ls.set(OWNER_DAY_KEY, d); return { ok: true, gold: HOLDER_DAILY_GOLD, day: d, owner: true }; } if (!s) throw new Error('connect a wallet first'); return api('holder_claim', { token: s.token }); }
// optional airdrop wallet (PvP entry pop-up): sent once per change, private server-side (never broadcast)
export async function saveAirdrop(wallet, name) {
  const key = 'pfp_pvp_airdrop_sent', tag = `${wallet}|${name}`; if (ls.get(key) === tag) return { ok: true, cached: true };
  const s = session(); const r = await api('airdrop', { ...(s ? { token: s.token } : { dk: deviceKey() }), wallet, name }); ls.set(key, tag); return r;
}
export const kd = (k, d) => d ? (k / d).toFixed(2) : String(k);

function session() { try { const s = JSON.parse(ls.get(SESSION_KEY) || 'null'); return s && s.token && Date.parse(s.expires_at) > Date.now() ? s : null; } catch { return null; } }
export const walletSession = () => session();
export function signOut() { const s = session(); ls.set(SESSION_KEY, null); claimAuth = null; if (s) api('logout', { token: s.token }).catch(() => {}); }

async function api(action, body = {}, opts = {}) {
  const r = await fetch(PVP_FN_URL, { method: 'POST', keepalive: !!opts.keepalive, headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY }, body: JSON.stringify({ action, ...body }) });
  let j = null; try { j = await r.json(); } catch {}
  if (!r.ok) { const e = new Error(j?.error || `pvp ${action} ${r.status}`); e.status = r.status; e.body = j; throw e; }
  return j;
}
const b64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };

// Connect + sign the plain-text message the server issued. Returns { wallet, profile }.
export async function walletSignIn(msg = () => {}) {
  const found = findProvider();
  if (!found) throw new Error('No Solana wallet found. Install Phantom, Solflare or Backpack (or open the game in your wallet app).');
  const { p, name } = found;
  const r = await p.connect();
  const wallet = (r?.publicKey || p.publicKey)?.toString?.();
  if (!wallet || wallet === '[object Object]') throw new Error('wallet gave no public key');
  msg(`Sign the message in ${name}. Free and read-only: not a transaction.`);
  const n = await api('nonce', { wallet });
  const sig = sigBytes(await p.signMessage(new TextEncoder().encode(n.message), 'utf8'));   // signMessage ONLY
  const v = await api('verify', { wallet, nonce: n.nonce, signature: b64(sig), dk: deviceKey() }); // [v72] dk: this device's BR kills follow the wallet
  ls.set(SESSION_KEY, JSON.stringify({ token: v.token, wallet, expires_at: v.expires_at })); claimAuth = null; takeShop(v); // kills now count for the wallet
  return { wallet, profile: cleanProfile(v.profile), link: v.link || null };
}

export const isBlank = (p) => !p.gold && !p.stats.kills && !p.stats.deaths && !p.stats.botKills && !Object.values(p.levels).some(Boolean);
// ---------- [v102] THE ISLAND SHOP: server copy of this device's save + purchases ----------
// dev_sync sends the device save (~every 15 s while saving, right away before a purchase); the server keeps its own copy (same pace
// caps as wallet saves) and answers with what this pirate OWNS + the shop revision. Gold the shop spends is the SERVER's copy.
const DEV_SYNC_MS = 15000; let devPending = null, devTimer = 0, devChain = Promise.resolve(null);
function takeShop(j) { if (!j) return;
  const sk = j.owned?.skins || j.profile?.skins?.owned, gr = j.owned?.gear || j.profile?.gearOwned;
  if (Array.isArray(sk)) shop.skins = sk.filter(x => x !== 'classic'); if (Array.isArray(gr)) shop.gear = gr;
  if (j.stats) shopStats = j.stats; if (Number.isFinite(j.gold)) shopGold = j.gold | 0; shopOwner = !!j.owner;
  try { dispatchEvent(new CustomEvent('pfp-shop-sync', { detail: { owned: { skins: ['classic', ...(shop.skins || [])], gear: shop.gear || [] }, rev: shop.rev, gold: shopGold, stats: shopStats, owner: shopOwner } })); } catch {} }
let shopStats = null, shopGold = null, shopOwner = false;
function devFlush(keepalive = false) {
  clearTimeout(devTimer); devTimer = 0;
  return (devChain = devChain.then(async () => { const body = devPending; devPending = null; if (!body || !PVP_FN_URL || session() || group) return { ok: true, device: true };
    try { const j = await api('dev_sync', { dk: deviceKey(), profile: body, rev: body.rev ?? 0 } /* the rev the snapshot was taken at */, { keepalive }); takeShop(j); const d = readDevice(); writeDevice(d); return { ok: true, device: true, shop: j }; }
    catch (e) { return { ok: true, device: true, error: e.message }; } }));
}
async function devSyncNow(p, ms = 0) { devPending = p || readDevice(); const r = devFlush(); const out = ms ? await Promise.race([r, new Promise(res => setTimeout(() => res(null), ms))]) : await r; return out?.shop || null; }
export const shopCache = () => ({ owned: { skins: ['classic', ...(shop.skins || [])], gear: shop.gear || [] }, rev: shop.rev, gold: shopGold, stats: shopStats, owner: shopOwner || ownerAll });
// fresh shop state from the server (device: syncs this save first so the gold is current). null = offline.
export async function shopState(profile) {
  await ownerReady; const s = session();
  try { if (!s && !group && !ownerAll) { const r = await devSyncNow(profile); if (r) return shopCache(); }
    const j = await api('shop_state', s ? { token: s.token } : { dk: deviceKey() }); takeShop(j); return shopCache(); }
  catch (e) { console.warn('[shop] state', e.message); return null; }
}
const reqId = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return b64(a).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
// buy one catalog item ('skin:blood'). The SERVER checks the price, the goal, the gold and ownership. Returns { ok, price, gold, rev } or { ok:false, error }.
export async function shopBuy(item, profile) {
  await ownerReady; const s = session(); const req = reqId();
  if (!s && !group && !ownerAll) await devSyncNow(profile);
  for (let i = 0; i < 2; i++) try {
    const j = await api('shop_buy', { ...(s ? { token: s.token } : { dk: deviceKey() }), item, req });
    if (j.owner) return { ok: true, owner: true, price: 0 };
    if (Number.isFinite(j.rev)) shop.rev = j.rev | 0; // the gold change is applied by the caller in the SAME tick (pvp.js), then saved
    const [kind, ...rest] = item.split(':'), id = rest.join(':');
    if (kind === 'skin') shop.skins = [...new Set([...(shop.skins || []), id])]; else shop.gear = [...new Set([...(shop.gear || []), id])];
    shopGold = j.gold | 0; return { ok: true, price: j.price | 0, gold: j.gold | 0, rev: j.rev };
  } catch (e) { if (!e.status && i === 0) continue; return { ok: false, error: e.message || 'shop offline', status: e.status }; } // network blip: same req id = never charged twice
  return { ok: false, error: 'shop offline' };
}
// ---------- [v103] WAVES PAYS GOLD FROM SCORE ----------
// The server notes when a Waves run starts and, at the end, banks gold from the run's SCORE into your Battle Royale save
// (the shop's gold): round(2 * sqrt(score)), max 800 a run, x2 holder / owner, one payout per run, checked server-side.
const wavesRuns = new Set();
export function wavesStart(run) {
  if (!PVP_FN_URL || typeof run !== 'string') return; const s = session();
  api('waves_start', { ...(s ? { token: s.token } : { dk: deviceKey() }), run }).then(() => wavesRuns.add(run)).catch(e => console.warn('[waves gold] start', e.message));
}
export async function wavesClaim({ run, score, wave, sunk }) {
  if (!PVP_FN_URL || !wavesRuns.has(run)) return null; wavesRuns.delete(run); await ownerReady; const s = session();
  try {
    const j = await api('waves_claim', { ...(s ? { token: s.token } : { dk: deviceKey() }), run, score: score | 0, wave: wave | 0, sunk: sunk | 0 });
    const g = j.gold | 0; if (g <= 0) return j;
    const d = readDevice();
    if (!s && ownerAll) { await api('group_sync', { dk: deviceKey(), profile: d, delta: g }).then(r => writeDevice(cleanProfile({ ...d, gold: r.gold | 0 }))).catch(() => {}); } // owner: the shared pot
    else { d.gold = Math.min(1e7, d.gold + g); writeDevice(d); } // device / wallet save (the server copy was credited by the claim)
    return j;
  } catch (e) { return { ok: false, error: e.message, status: e.status }; }
}
function readDevice() { let all; try { all = JSON.parse(ls.get(DEVICE_KEY) || '{}'); } catch { all = {}; } return cleanProfile(all.profiles?.device); }
function writeDevice(p) { let all; try { all = JSON.parse(ls.get(DEVICE_KEY) || '{}'); } catch { all = {}; } all.profiles = all.profiles || {}; all.profiles.device = { ...p, updated: Date.now() }; ls.set(DEVICE_KEY, JSON.stringify(all)); }

// Load: the device save, or (when a wallet is linked) the wallet's save if it has progress. Never throws.
export async function loadProfile() {
  await ownerReady;
  const dev = readDevice(), s = session(); group = null;
  if (!s && ownerAll) { // [v92] owner-only shared save: first sync adds this device's gold once (max of each upgrade)
    try { const j = await api('group_sync', { dk: deviceKey(), profile: dev, delta: 0 }); const g = cleanProfile({ ...dev, gold: j.gold, levels: j.levels });
      group = { base: g.gold }; writeDevice(g); return { profile: g, source: 'group', seeded: !!j.seeded }; }
    catch (e) { return { profile: dev, source: 'device', error: e.message }; } }
  if (!s) { const r = await devSyncNow(dev, 4000); return { profile: r ? readDevice() : dev, source: 'device', shop: r }; } // [v102] server copy (shop gold, owned)
  try { const j = await api('load', { token: s.token }); takeShop(j); const w = cleanProfile({ ...j.profile, rev: j.rev | 0 });
    if (isBlank(w) && !isBlank(dev)) { await api('save', { token: s.token, profile: dev, seed: true }).catch(() => {}); return { profile: dev, source: 'device', wallet: s.wallet }; }
    writeDevice(w); return { profile: w, source: 'wallet', wallet: s.wallet }; }
  catch (e) { if (e.status === 401) ls.set(SESSION_KEY, null); return { profile: dev, source: 'device', error: e.message }; }
}
// After walletSignIn(): wallet save wins when it has progress, else seed it from this device. Returns the profile to use.
export async function linkWallet(serverProfile, deviceProfile) {
  const s = session(); if (!s) return deviceProfile;
  if (isBlank(deviceProfile)) { writeDevice(serverProfile); return serverProfile; }
  if (!isBlank(serverProfile)) { // [v72] both have progress: merge this device in once (max upgrades / gold / K/D), never lose either side
    try { const j = await api('save', { token: s.token, profile: deviceProfile, merge: true, dk: deviceKey() }); const m = cleanProfile(j.profile); writeDevice(m); return m; }
    catch (e) { const w = e.body?.profile ? cleanProfile(e.body.profile) : serverProfile; writeDevice(w); return w; } }
  try { const j = await api('save', { token: s.token, profile: deviceProfile, seed: true, dk: deviceKey() }); return cleanProfile(j.profile); } catch { return deviceProfile; }
}

// [v92] OWNER-ONLY shared save (BANKSYDEGEN's two devices, no wallet): each sync sends this device's gold CHANGE since the last
// one (delta) + its upgrade levels; the server adds the delta to the shared pot and keeps the max of each upgrade. Gold or
// upgrades from the other device come back as 'pfp-group-sync' { drift, levels } (pvp.js applies them live). Serialized.
let group = null, gPending = null, gTimer = 0, gChain = Promise.resolve();
function groupFlush(keepalive = false) {
  gTimer = 0;
  return (gChain = gChain.then(async () => {
    const body = gPending; gPending = null; if (!body || !group) return { ok: true };
    const delta = body.gold - group.base; group.base += delta;
    try { const j = await api('group_sync', { dk: deviceKey(), profile: body, delta }, { keepalive }); if (!group) return { ok: true };
      const drift = (j.gold | 0) - group.base; group.base = j.gold | 0; if (gPending) gPending.gold = Math.max(0, gPending.gold + drift);
      const up = Object.keys(body.levels).some(k => (j.levels?.[k] | 0) > (body.levels[k] | 0));
      if (drift || up) { const d = readDevice(); writeDevice(cleanProfile({ ...d, gold: Math.max(0, d.gold + drift), levels: up ? { ...d.levels, ...Object.fromEntries(Object.keys(d.levels).map(k => [k, Math.max(d.levels[k] | 0, j.levels?.[k] | 0)])) } : d.levels }));
        try { dispatchEvent(new CustomEvent('pfp-group-sync', { detail: { drift, levels: up ? j.levels : null } })); } catch {} }
      return { ok: true, group: true, gold: j.gold };
    } catch (e) { if (e.status === 404) { group = null; return { ok: false, error: e.message }; }
      group.base -= delta; if (!gPending) gPending = body; if (!gTimer) gTimer = setTimeout(groupFlush, 5000); /* retried (422: the allowance grows) */ return { ok: false, error: e.message, status: e.status === 401 ? 0 : e.status }; }
  }));
}
// Save: device immediately; wallet (if linked) throttled ~3 s, or right away with now / keepalive (page closing).
let pending = null, timer = 0, inflight = null;
export function saveProfile(profile, { now = false, keepalive = false } = {}) {
  const p = cleanProfile(profile); writeDevice(p);
  const s = session();
  if (!s && group) { gPending = p; if (now || keepalive) { clearTimeout(gTimer); return groupFlush(keepalive); } if (!gTimer) gTimer = setTimeout(groupFlush, 3000); return Promise.resolve({ ok: true, queued: true }); }
  if (!s) { devPending = p; if (now || keepalive) return devFlush(keepalive); if (!devTimer) devTimer = setTimeout(devFlush, DEV_SYNC_MS); return Promise.resolve({ ok: true, device: true }); }
  pending = p;
  const flush = () => { timer = 0; const body = pending; pending = null; if (!body) return inflight || Promise.resolve({ ok: true });
    inflight = api('save', { token: s.token, profile: body, rev: body.rev }, { keepalive }).then(j => { takeShop(j); return { ok: true, profile: cleanProfile(j.profile) }; }).catch(e => { if (e.status === 401) ls.set(SESSION_KEY, null); return { ok: false, error: e.message, status: e.status }; });
    return inflight; };
  if (now || keepalive) { clearTimeout(timer); return flush(); }
  if (!timer) timer = setTimeout(flush, 3000);
  return Promise.resolve({ ok: true, queued: true });
}

// ---------- PvP KILLS leaderboard ----------
// Identity for the board: the linked wallet, else a random secret kept on this device (only its hash is stored server-side).
// Fixed for the page's lifetime so a session's network id always maps to one player.
const DK_KEY = 'pfp_pvp_dk_v1';
function deviceKey() {
  let k = ls.get(DK_KEY);
  if (!k || !/^[A-Za-z0-9_-]{24,64}$/.test(k)) { const a = new Uint8Array(24); crypto.getRandomValues(a); k = b64(a).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); ls.set(DK_KEY, k); }
  return k;
}
let claimAuth = null;
// side 'k' = I sank v, side 'v' = k sank me. Recorded only when both sides report (server checks + anti-farming rules).
export function claimKill({ side, room, k, v, life, name, keepalive = false }) {
  if (!PVP_FN_URL) return Promise.resolve(null);
  if (!claimAuth) { const s = session(); claimAuth = s ? { token: s.token } : { dk: deviceKey() }; }
  return api('kill', { ...claimAuth, side, room, k, v, l: life | 0, name }, { keepalive }).then(j => j.result).catch(e => { console.warn('[pvp] kill claim', e.message); return null; });
}
// HUD: my all-time PvP kills rank (same order as the ALL TIME board) + confirmed kills / deaths, same identity as claimKill.
export function fetchMe() {
  if (!PVP_FN_URL) return Promise.resolve(null);
  const s = session(); return api('me', s ? { token: s.token } : { dk: deviceKey() }).catch(e => { console.warn('[pvp] me', e.message); return null; });
}
const topCache = new Map();
export async function fetchKillsTop(period = 'all') {
  const c = topCache.get(period); if (c && Date.now() - c.at < 20000) return c.rows;
  if (!PVP_FN_URL) return [];
  const j = await api('top', { period }); const rows = Array.isArray(j.rows) ? j.rows : [];
  topCache.set(period, { at: Date.now(), rows }); return rows;
}
export const clearKillsTopCache = () => topCache.clear();
// [v72] rename: push a new name to MY OWN leaderboard rows. BATTLE ROYALE board: wallet session, else this device's key.
// Waves board: only when a wallet is signed in (Waves rows are keyed by wallet). Name taken on the BR board -> toast, no merge.
let renameT = 0;
function nameToast(msg) {
  let t = document.getElementById('copy-toast');
  if (!t) { t = document.createElement('div'); t.id = 'copy-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600);
}
export async function renameEverywhere(name) {
  const out = {};
  if (PVP_FN_URL) { const s = session();
    out.br = await api('rename', { ...(s ? { token: s.token } : { dk: deviceKey() }), name }).then(j => (clearKillsTopCache(), j), e => ({ ok: false, status: e.status, error: e.message }));
    if (out.br?.status === 409) nameToast(`"${name}" is taken on the Battle Royale board`); }
  try { const ws = JSON.parse(ls.get('pfp_session_v1') || 'null');
    if (ws?.token && Date.parse(ws.expires_at) > Date.now() && PIRATE_FN_URL) {
      const r = await fetch(PIRATE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY }, body: JSON.stringify({ action: 'rename', token: ws.token, name }) });
      out.waves = await r.json().catch(() => null); } } catch {}
  return out;
}
let renamedTo = '';
addEventListener('pfp-name', (e) => { const n = e.detail?.name; if (!n || (e.detail?.force && n === renamedTo)) return; clearTimeout(renameT);
  renameT = setTimeout(async () => { const r = await renameEverywhere(n); if (r.br?.ok || r.waves?.ok) { renamedTo = n; try { dispatchEvent(new CustomEvent('pfp-renamed', { detail: { name: n } })); } catch {} } }, 800); });
// [v76] one name = one pirate (BR + Waves). true = free / mine, false = taken by someone else, null = couldn't check
// (offline: the server still blocks a taken name when it lands).
export async function checkName(name, { mode = 'br', wallet = '' } = {}) {
  const n = String(name || '').trim().slice(0, 20); if (!n || !PVP_FN_URL) return null;
  const s = session();
  try { const j = await api('name_check', { ...(s ? { token: s.token } : { dk: deviceKey() }), name: n, mode, ...(mode === 'waves' && wallet ? { wallet } : {}) }); return j.free === true; }
  catch { return null; }
}
window.PFP_PVP_SAVE = { checkName, renameEverywhere, loadProfile, saveProfile, linkWallet, walletSession, signOut, kd, readDevice, claimKill, fetchKillsTop, clearKillsTopCache, fetchMe };
