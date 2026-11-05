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
import { V6_LEGACY, v6Legacy as v6Legacy0, addLegacyOwned } from './v6Legacy.js';   // [V6 store] legacy pants + boots grant
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
  return (ownerAll = OWNER_DEVS.includes('dev:' + h.slice(0, 24)) || !!acct()?.owner); } catch { return false; } })(); // [v106] + the owner's account logged in on another device (the server decides; this only shows it)
// [v102] pirate gear slots (js/shopCatalog.js ids): the first id of each slot is the free default (shirtless start)
export const GEAR_SLOTS = { hat: ['none', 'bandana', 'tricorn', 'bicorne', 'crown', 'crown_imperial', 'helmet_hq', 'mask_luchador'], outfit: ['shirtless', 'tank', 'tshirt', 'coat', 'shirt', 'suit', 'singlet'], eyes: ['plain', 'eyepatch', 'sunglasses', 'laser'], parrot: ['none', 'parrot_green', 'parrot_red', 'parrot_gold', 'parrot_blue', 'parrot_cockatoo', 'parrot_black', 'parrot_diamond', 'pet_monkey', 'pet_cat', 'pet_cat_black', 'pet_chimp', 'pet_gorilla', 'pet_gorilla_white', 'pet_tiger'], hook: ['none', 'hook_iron', 'hook_gold'], leg: ['none', 'peg', 'peg_gold', 'peg_kraken', 'peg_ghost'], face: ['none', 'facepaint_retardio'], beard: ['none', 'beard_moustache', 'beard_forked', 'beard_black'], ears: ['none', 'earring_hoop', 'earring_double', 'earring_skull'], teeth: ['none', 'tooth_gold', 'grill_gold', 'grill_diamond'], boots: ['none', 'boots_buckle', 'boots_cavalier', 'boots_gold', 'boots_classic', 'sandals', 'shoes_buckle', 'boots_sea'], cape: ['none', 'cape_tattered', 'cape_captain', 'cape_royal'], flag: ['none', 'flag_cutlass', 'flag_red', 'flag_gold'], figure: ['none', 'fig_mermaid', 'fig_kraken', 'fig_lion'],  // [Raul shop items 2] (lib.ts mirror)
  pants: ['none', 'classic_pants', 'canvas_pants', 'sailor_trousers', 'leather_breeches'], // [V6 store] PANTS (APPEND-ONLY; server lib.ts GEAR_SLOTS)
  crewhat: ['bandana', 'tricorn', 'bicorne', 'crown', 'crown_imperial', 'helmet_hq'], crewoutfit: ['tank', 'tshirt', 'coat', 'shirt', 'suit'], sword: ['rusty', 'cutlass', 'rapier', 'bone', 'sabre_gilded', 'blade_gold'], musket: ['rusty', 'navy', 'blunder', 'dragoon', 'bone', 'blunder_gold'] }; // [Timothy] WEAPON STORE sword + musket (js// [Timothy] CREW SHOP: the crew's own loadout (js/crewLoadout.js CREW_SLOTS, first = the free crew uniform) // [Timothy] + crown, shirt, suit, 4 parrots, leg slot (server lib.ts GEAR_SLOTS must match)
export function cleanGear(g) { const o = {}; for (const [sl, ids] of Object.entries(GEAR_SLOTS)) o[sl] = ids.includes(g?.[sl]) ? g[sl] : ids[0];
  const h = Math.floor(+g?.hatColor); o.hatColor = Number.isFinite(h) && h >= 0 && h <= 12 ? h : 0;
  const ch = Math.floor(+g?.crewhatColor); if (Number.isFinite(ch) && ch > 0 && ch <= 12) o.crewhatColor = ch; if (g?.v6legacy === 1 || g?.v6legacy === 2) o.v6legacy = g.v6legacy; return o; }   // [V6 store] 1 = checked, 2 = legacy pants + boots granted // [Raul gear colours] the crew's free hat colour (additive: only when picked) // [v105] free hat colour (HAT_SWATCHES index)
// shop state from the server: { rev, skins: [...], gear: [...] } (null until it answers); the ONE copy of shop_rev on this device
const shop = { rev: null, skins: null, gear: null };
let seenPrestige = 0; // [prestige] the highest prestige level the server has told this page (see notePrestige)
export const blankProfile = () => ({ v: 1, gold: 0, levels: Object.fromEntries(UPGRADES.map(u => [u.id, 0])), skins: { owned: [], equipped: 'classic' }, gear: cleanGear(null), gearOwned: [], rev: 0, prestige: 0, stats: { kills: 0, deaths: 0, botKills: 0, harborKills: 0, bossKills: 0 } }); // [v98] + harbor AI / boss kills (unlock tracks)
export function cleanProfile(p) {
  const b = blankProfile(); if (!p || typeof p !== 'object') return b;
  const n = (x, hi) => Math.max(0, Math.min(hi, Math.floor(Number(x) || 0)));
  b.gold = n(p.gold, 1e7);
  for (const u of UPGRADES) b.levels[u.id] = n(p.levels?.[u.id], u.tiers.length);
  const st = p.stats || {}; b.stats = { kills: n(st.kills, 1e7), deaths: n(st.deaths, 1e7), botKills: n(st.botKills, 1e7), harborKills: n(st.harborKills, 1e7), bossKills: n(st.bossKills, 1e7), batteryHits: n(st.batteryHits, 1e7) }; // [cliff gold]
  // [v102] THE ISLAND SHOP: skins are BOUGHT with gold. The owned list is the server's (pvp_owned, cached here by dev_sync / load):
  // shop.skins once the server answered, else whatever this save already had (an older save's kill-tier list = what it could use)
  const known = new Set([...PVP_SKIN_TIERS.map(t => t.id), ...PVP_UNLOCK_SKINS.map(u => u.id)]);
  b.skins.owned = ownerAll ? [...known].filter(id => id !== 'classic') : (shop.skins || (Array.isArray(p.skins?.owned) ? p.skins.owned : [])).filter(id => known.has(id) && id !== 'classic');
  const eq = p.skins?.equipped; b.skins.equipped = eq === 'classic' || b.skins.owned.includes(eq) ? eq : 'classic';
  b.gear = cleanGear(p.gear); b.gearOwned = ownerAll ? ['*'] : (shop.gear || (Array.isArray(p.gearOwned) ? p.gearOwned : [])).filter(k => typeof k === 'string' && /^[a-z]{2,10}:[a-z0-9_]{2,24}$/.test(k));
  addLegacyOwned(b.gear, b.gearOwned);   // [V6 store] (also granted by the server)
  for (const [sl, ids] of Object.entries(GEAR_SLOTS)) if (b.gear[sl] !== ids[0] && !ownerAll && !b.gearOwned.includes(`${sl}:${b.gear[sl]}`)) b.gear[sl] = ids[0];
  b.prestige = Math.max(n(p.prestige, 100), seenPrestige); // [prestige] never below what the server last said (a stale copy can't lower it)
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
// [security H4] the first wallet is saved as typed; CHANGING it needs a free signature from the NEW wallet (server answers 428):
// confirmAirdrop() asks the wallet app to sign a Sign-In-With-Solana message (signMessage only, never a transaction).
export async function saveAirdrop(wallet, name) {
  const key = 'pfp_pvp_airdrop_sent', tag = `${wallet}|${name}`; if (ls.get(key) === tag) return { ok: true, cached: true };
  const s = session(), id = s ? { token: s.token } : { dk: deviceKey() };
  try { const r = await api('airdrop', { ...id, wallet, name }); ls.set(key, tag); return r; }
  catch (e) { if (e.status === 428) return { ok: false, need: 'signature' }; throw e; }
}
export async function confirmAirdrop(wallet, name) {
  const found = findProvider(); if (!found) return { ok: false, error: 'no wallet app' };
  const { p } = found; const r = await p.connect(); const pk = (r?.publicKey || p.publicKey)?.toString?.();
  if (pk !== wallet) return { ok: false, error: 'switch your wallet app to the new address first' };
  const s = session(), id = s ? { token: s.token } : { dk: deviceKey() };
  const n = await api('airdrop_nonce', { ...id, wallet });
  const sig = sigBytes(await p.signMessage(new TextEncoder().encode(n.message), 'utf8'));
  const j = await api('airdrop', { ...id, wallet, name, nonce: n.nonce, signature: b64(sig) });
  ls.set('pfp_pvp_airdrop_sent', `${wallet}|${name}`); return j;
}
export const kd = (k, d) => d ? (k / d).toFixed(2) : String(k);

function session() { try { const s = JSON.parse(ls.get(SESSION_KEY) || 'null'); return s && s.token && Date.parse(s.expires_at) > Date.now() ? s : null; } catch { return null; } }
export const walletSession = () => session();
export function signOut() { const s = session(); ls.set(SESSION_KEY, null); claimAuth = null; if (s) api('logout', { token: s.token }).catch(() => {}); }

async function api(action, body = {}, opts = {}) {
  const r = await fetch(PVP_FN_URL, { method: 'POST', keepalive: !!opts.keepalive, headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY }, body: JSON.stringify({ action, ...body }) });
  let j = null; try { j = await r.json(); } catch {}
  if (r.ok && j && Number.isFinite(j.prestige) && action !== 'prestige') notePrestige(j.prestige); // [prestige] every save / sync / load answer carries it
  if (!r.ok) { const e = new Error(j?.error || `pvp ${action} ${r.status}`); e.status = r.status; e.body = j; throw e; }
  return j;
}
// ---------- [prestige] PRESTIGE (BANKSY: "Add ability to prestige when max out ship") ----------
// The level lives on the server (pvp_prestige, migration 031). A HIGHER level than this device knew (prestiged on another device /
// account / the wallet) = this device's upgrades were reset there: they go back to base here too, once ('pfp-prestige' tells pvp.js).
export const prestigeLevel = () => seenPrestige;
function notePrestige(level) { const lv = Math.max(0, Math.min(100, level | 0)); if (lv <= seenPrestige) return;
  const d = readDevice(), reset = lv > (d.prestige | 0); seenPrestige = lv;
  if (reset) writeDevice(cleanProfile({ ...d, prestige: lv, levels: Object.fromEntries(UPGRADES.map(u => [u.id, 0])) }));
  try { dispatchEvent(new CustomEvent('pfp-prestige', { detail: { level: lv, reset } })); } catch {} }
// every track at its top level (the server checks its own copy again)
export const isMaxed = (levels) => UPGRADES.every(u => (levels?.[u.id] | 0) >= u.tiers.length);
// PRESTIGE now: the latest save goes up first (so a level bought a moment ago counts), then the server checks + resets in one step.
// Returns { ok, prestige, levels } or { ok: false, error }. The CALLER puts the returned (base) levels on the ship and saves.
export async function prestigeNow(profile) {
  if (!PVP_FN_URL) return { ok: false, error: 'offline' };
  await ownerReady; const s = session(), p = cleanProfile(profile), ac = !s && !group && !ownerAll && acct();
  try {
    if (s) await saveProfile(p, { now: true }); else if (!s && group) { gPending = p; await groupFlush(); } else if (ac) await acctSyncNow(p, 5000); else await devSyncNow(p, 5000);
    const j = await api('prestige', { ...(s ? { token: s.token } : { dk: deviceKey() }), confirm: true, from: p.prestige | 0, profile: p, rev: p.rev | 0 });
    const lv = Math.max(0, Math.min(100, j.prestige | 0)); seenPrestige = Math.max(seenPrestige, lv);
    writeDevice(cleanProfile({ ...readDevice(), prestige: lv, levels: Object.fromEntries(UPGRADES.map(u => [u.id, 0])) }));
    return { ok: true, prestige: lv, levels: j.levels || null, owner: !!j.owner };
  } catch (e) { if (Number.isFinite(e.body?.prestige)) notePrestige(e.body.prestige);
    return { ok: false, status: e.status, error: ({ 'not maxed': 'max every upgrade first (the server copy is still catching up: try again in a few seconds)', 'prestige changed': 'already prestiged on another device', "prestige isn't switched on yet": "prestige isn't switched on yet" })[e.message] || e.message || 'offline' }; }
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
  try { dispatchEvent(new CustomEvent('pfp-shop-sync', { detail: { owned: { skins: ['classic', ...(shop.skins || [])], gear: shop.gear || [] }, rev: shop.rev, gold: shopGold, stats: shopStats, owner: shopOwner, goals: j.goals || null, modes: j.modes || null, boosts: j.boosts || null } })); } catch {} } // [Emerly] + the server's boosts (supabase lib.ts boostsFor) // [v105] + Timothy's goals.ts progress
let shopStats = null, shopGold = null, shopOwner = false;
function devFlush(keepalive = false) {
  clearTimeout(devTimer); devTimer = 0;
  return (devChain = devChain.then(async () => { const body = devPending; devPending = null; if (!body || !PVP_FN_URL || session() || group || acct()) return { ok: true, device: true };
    try { const j = await api('dev_sync', { dk: deviceKey(), profile: body, rev: body.rev ?? 0 } /* the rev the snapshot was taken at */, { keepalive }); takeShop(j); const d = readDevice(); writeDevice(d); return { ok: true, device: true, shop: j }; }
    catch (e) { return { ok: true, device: true, error: e.message }; } }));
}
async function devSyncNow(p, ms = 0) { devPending = p || readDevice(); const r = devFlush(); const out = ms ? await Promise.race([r, new Promise(res => setTimeout(() => res(null), ms))]) : await r; return out?.shop || null; }
export const shopCache = () => ({ owned: { skins: ['classic', ...(shop.skins || [])], gear: shop.gear || [] }, rev: shop.rev, gold: shopGold, stats: shopStats, owner: shopOwner || ownerAll });
// fresh shop state from the server (device: syncs this save first so the gold is current). null = offline.
export async function shopState(profile) {
  await ownerReady; const s = session();
  try { if (!s && !group && !ownerAll && acct()) { const r = await acctSyncNow(profile); if (r) return shopCache(); } // [v106] logged in: the account's save
    else if (!s && !group && !ownerAll) { const r = await devSyncNow(profile); if (r) return shopCache(); }
    const j = await api('shop_state', s ? { token: s.token } : { dk: deviceKey() }); takeShop(j); return shopCache(); }
  catch (e) { console.warn('[shop] state', e.message); return null; }
}
const reqId = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return b64(a).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
// buy one catalog item ('skin:blood'). The SERVER checks the price, the goal, the gold and ownership. Returns { ok, price, gold, rev } or { ok:false, error }.
// [v122] TREASURE MAPS (migration 026, server-side drops): maps_state scans for new maps (boss kills from the stored save, confirmed BR
// kills) + lists your undug ones; map_dig claims one at its spot. Like a shop buy the server credits the server copy, the CALLER adds the
// same gold to its save in the same tick (pvp.js), and a logged-in device sends mirror: true so the account save counts it once.
export async function mapsState(profile) { if (!PVP_FN_URL) return null; await ownerReady; const s = session();
  try { return await api('maps_state', { ...(s ? { token: s.token } : { dk: deviceKey() }), ...(!s && ownerAll && profile ? { profile: cleanProfile(profile) } : {}) }); }
  catch (e) { console.warn('[maps] state', e.message); return null; } }
export async function mapDig(map, spot, profile) {
  if (!PVP_FN_URL) return { ok: false, error: 'offline' }; await ownerReady; const s = session(), ac = !s && !group && !ownerAll && acct();
  if (ac) await acctSyncNow(profile, 4000); else if (!s && !group && !ownerAll) await devSyncNow(profile, 4000);
  if (ac) acctHold(); // nothing in flight until the caller has added the dig gold to this save (its next save unholds)
  try { const j = await api('map_dig', { ...(s ? { token: s.token } : { dk: deviceKey() }), map: String(map), spot: String(spot), mirror: true });
    if (ac) acctBoughtFor(-(j.gold | 0));
    if (j && j.loot && j.loot.item && !j.loot.dup && shop.gear) shop.gear = [...new Set([...shop.gear, String(j.loot.item)])]; // [v152] chest item = owned now (server-granted)
    return j; }
  catch (e) { if (ac) acctUnhold(); return { ok: false, error: e.message, status: e.status }; } }
export async function shopBuy(item, profile) {
  await ownerReady; const s = session(); const req = reqId(), ac = !s && !group && !ownerAll && acct();
  if (ac) await acctSyncNow(profile); else if (!s && !group && !ownerAll) await devSyncNow(profile);
  if (ac) acctHold(); // [v106] no sync until the caller has taken the price off this save (the server took it off this device's last sync)
  for (let i = 0; i < 2; i++) try {
    const j = await api('shop_buy', { ...(s ? { token: s.token } : { dk: deviceKey() }), item, req });
    if (j.owner) { acctUnhold(); return { ok: true, owner: true, price: 0 }; }
    if (ac && !j.retry) acctBoughtFor(j.price); else if (ac) acctUnhold();
    if (Number.isFinite(j.rev)) shop.rev = j.rev | 0; // the gold change is applied by the caller in the SAME tick (pvp.js), then saved
    const [kind, ...rest] = item.split(':'), id = rest.join(':');
    if (kind === 'skin') shop.skins = [...new Set([...(shop.skins || []), id])]; else shop.gear = [...new Set([...(shop.gear || []), id])];
    shopGold = j.gold | 0; return { ok: true, price: j.price | 0, gold: j.gold | 0, rev: j.rev };
  } catch (e) { if (!e.status && i === 0) continue; acctUnhold(); return { ok: false, error: e.message || 'shop offline', status: e.status }; } // network blip: same req id = never charged twice
  acctUnhold(); return { ok: false, error: 'shop offline' };
}
// [wish] the roundabout fountain: 100 gold off the server save (pvp wish_toss, same req / rev handling as shopBuy). Just a wish.
export async function wishToss(profile) {
  if (!PVP_FN_URL) return { ok: false, error: 'offline' }; await ownerReady; const s = session(); const req = reqId(), ac = !s && !group && !ownerAll && acct();
  if (ac) await acctSyncNow(profile); else if (!s && !group && !ownerAll) await devSyncNow(profile);
  if (ac) acctHold();
  for (let i = 0; i < 2; i++) try {
    const j = await api('wish_toss', { ...(s ? { token: s.token } : { dk: deviceKey() }), req });
    if (j.owner) { acctUnhold(); return { ok: true, owner: true, price: 0 }; }
    if (ac && !j.retry) acctBoughtFor(j.price); else if (ac) acctUnhold();
    if (Number.isFinite(j.rev)) shop.rev = j.rev | 0;
    shopGold = j.gold | 0; return { ok: true, price: j.retry ? 0 : (j.price | 0), gold: j.gold | 0, rev: j.rev };
  } catch (e) { if (!e.status && i === 0) continue; acctUnhold(); return { ok: false, error: e.message || 'offline', status: e.status }; }
  acctUnhold(); return { ok: false, error: 'offline' };
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
  const ac = !s && !ownerAll && acct(); if (ac) { await acctSyncNow(null, 4000); acctHold(); } // [v106] logged in: nothing in flight while the payout lands
  try {
    const j = await api('waves_claim', { ...(s ? { token: s.token } : { dk: deviceKey() }), run, score: score | 0, wave: wave | 0, sunk: sunk | 0 });
    const g = j.gold | 0; if (g <= 0) return j;
    const d = readDevice();
    if (!s && ownerAll) { await api('group_sync', { dk: deviceKey(), profile: d, delta: g }).then(r => writeDevice(cleanProfile({ ...d, gold: r.gold | 0 }))).catch(() => {}); } // owner: the shared pot
    else { d.gold = Math.min(1e7, d.gold + g); writeDevice(d); if (ac) acctPending = d; } // device / wallet save (the server copy was credited by the claim)
    return j;
  } catch (e) { return { ok: false, error: e.message, status: e.status }; }
  finally { if (ac) { acctUnhold(); acctFlush(); } }
}
// [security H1] the Waves leaderboard row goes through the pvp function (checked against the server-timed run, one row per run).
// Throws like api(); e.status 400 / 404 = old function or a run the server never noted (the caller may fall back).
export async function wavesScore(e) {
  if (!PVP_FN_URL || typeof e?.run !== 'string') { const x = new Error('no run'); x.status = 404; throw x; }
  const s = session();
  return api('waves_score', { ...(s ? { token: s.token } : { dk: deviceKey() }), run: e.run, wallet: e.wallet, name: e.name || null, score: e.score | 0, wave: e.wave | 0, sunk: e.sunk | 0, duration_s: e.duration_s | 0, ...(e.mode === 'daily' ? { mode: 'daily', seed: e.seed } : {}) });
}
function readDevice() { let all; try { all = JSON.parse(ls.get(DEVICE_KEY) || '{}'); } catch { all = {}; } return cleanProfile(all.profiles?.device); }
function writeDevice(p) { if (acctFrozen) return; let all; try { all = JSON.parse(ls.get(DEVICE_KEY) || '{}'); } catch { all = {}; } all.profiles = all.profiles || {}; all.profiles.device = { ...p, updated: Date.now() }; ls.set(DEVICE_KEY, JSON.stringify(all)); }

// [V6 store] LEGACY GRANT (js/v6Legacy.js): once, on load, a pre-V6 save gets + wears classic pants + classic boots
export { V6_LEGACY };
export const v6Legacy = (p) => v6Legacy0(p, isBlank(p), Object.fromEntries(Object.entries(GEAR_SLOTS).map(([k, v]) => [k, v[0]])));
// Load: the device save, or (when a wallet is linked) the wallet's save if it has progress. Never throws.
export async function loadProfile() { const r = await loadProfile0(); if (r?.profile && v6Legacy(r.profile) && r.source !== 'wallet') writeDevice(r.profile); return r; }
async function loadProfile0() {
  await ownerReady;
  const dev = readDevice(), s = session(); group = null;
  if (!s && ownerAll) { // [v92] owner-only shared save: first sync adds this device's gold once (max of each upgrade)
    try { const j = await api('group_sync', { dk: deviceKey(), profile: dev, delta: 0 }); const g = cleanProfile({ ...dev, gold: j.gold, levels: j.levels });
      group = { base: g.gold }; writeDevice(g); return { profile: g, source: 'group', seeded: !!j.seeded }; }
    catch (e) { return { profile: dev, source: 'device', error: e.message }; } }
  if (!s && acct()) { const r = await acctSyncNow(dev, 4000); return { profile: readDevice(), source: 'account', name: acct()?.name || '', shop: r }; } // [v106] logged in
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
  if (acctFrozen) return Promise.resolve({ ok: true, frozen: true }); // [v106] this device just switched pirates: nothing more is saved until the reload
  const p = cleanProfile(profile); writeDevice(p);
  const s = session();
  if (!s && group) { gPending = p; if (now || keepalive) { clearTimeout(gTimer); return groupFlush(keepalive); } if (!gTimer) gTimer = setTimeout(groupFlush, 3000); return Promise.resolve({ ok: true, queued: true }); }
  if (!s && acct()) { acctPending = p; if (acctBought) { acctBought = false; acctUnhold(); } if (now || keepalive) return acctFlush(keepalive); if (!acctTimer) acctTimer = setTimeout(acctFlush, ACCT_SYNC_MS); return Promise.resolve({ ok: true, account: true }); } // [v106]
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
// [security M1 + H2] Realtime ticket for one channel (arena / harbor copy / party): proves the lobby seat; the server notes it for the
// kill board and returns { jwt } for a private channel when that is switched on. Any failure = null (the caller joins publicly).
export async function pvpTicket({ topic, net, seat, name, relay = false }) {
  if (!PVP_FN_URL) return null; const s = session();
  try { return await api('ticket', { ...(s ? { token: s.token } : { dk: deviceKey() }), topic, net, seat, name, ...(relay ? { relay: true } : {}) }); } catch { return null; }
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
export function nameToast(msg) {
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
  try { const j = await api('name_check', { ...(s ? { token: s.token } : { dk: deviceKey() }), name: n, mode, ...(mode === 'waves' && wallet ? { wallet } : {}) }); nameAccount = j.free !== true && !!j.account ? n : ''; return j.free === true; }
  catch { return null; }
}
// [v106] the last name checkName found taken BY A PIRATE WITH A PASSWORD ('' = none): the name pop-ups offer LOG IN for it
let nameAccount = '';
export const takenByAccount = (n) => !!n && nameAccount.toLowerCase() === String(n).trim().slice(0, 20).toLowerCase();

// ---------- [v106] PLAYER ACCOUNTS (name + password, no email) ----------
// Progress stays on this device by default. SET PASSWORD (profile) makes this pirate's name an account; LOG IN (home / profile)
// on another device makes that device play as the same pirate: the server maps its device key to the account (pvp_main), so the
// board, shop, goals and treasure maps are the same pirate. Saves: acct_sync sends this device's save; the server adds only what
// changed since this device's last sync (another device's gold / kills come back as 'pfp-group-sync' { drift, levels, stats }).
// Only the session token is kept here (pfp_acct_v1); the password goes to the pvp Edge Function over HTTPS and nowhere else.
// Logging in keeps this device's own save aside (pfp_acct_guest_v1); LOG OUT brings it back (or starts fresh on the device that
// set the password, whose old key was retired).
const ACCT_KEY = 'pfp_acct_v1', GUEST_KEY = 'pfp_acct_guest_v1', ACCT_NOTE_KEY = 'pfp_acct_note', ACCT_SYNC_MS = 10000;
function acct() { try { const a = JSON.parse(ls.get(ACCT_KEY) || 'null'); return a && a.token && Date.parse(a.expires_at) > Date.now() ? a : null; } catch { return null; } }
export const accountInfo = () => { const a = acct(); return a ? { name: a.name, owner: !!a.owner, expires_at: a.expires_at } : null; };
let acctPending = null, acctTimer = 0, acctHeld = 0, acctBought = false;
// [v106] set when this device switches pirates (log in / log out / logged out elsewhere): the old pirate's in-memory save
// (e.g. the page-close save) must never land on the new one, so every save / device write stops until the page reloads
let acctFrozen = false;
function acctFreeze() { acctFrozen = true; clearTimeout(acctTimer); clearTimeout(devTimer); clearTimeout(gTimer); acctPending = null; devPending = null; gPending = null; group = null; }
function acctHold() { acctHeld = Date.now(); acctBought = false; }
function acctUnhold() { acctHeld = 0; acctBought = false; }
// a buy went through: a save snapshot taken meanwhile gets the price off too; the hold ends with the caller's next save
function acctBoughtFor(price) { if (acctPending) acctPending.gold = Math.max(0, acctPending.gold - (price | 0)); acctBought = true; }
const newDk = () => { const a = new Uint8Array(24); crypto.getRandomValues(a); return b64(a).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
function acctFlush(keepalive = false) {
  clearTimeout(acctTimer); acctTimer = 0;
  return (devChain = devChain.then(async () => {
    const a = acct(); if (!a || a.owner || !PVP_FN_URL || acctFrozen) { acctPending = null; return { ok: true }; }
    if (acctHeld && Date.now() - acctHeld < 4000) { if (!acctTimer) acctTimer = setTimeout(acctFlush, 1000); return { ok: true, held: true }; }
    const body = acctPending || readDevice(); acctPending = null;
    try { const j = await api('acct_sync', { dk: deviceKey(), acct: a.token, profile: body }, { keepalive }); takeShop(j);
      if (j.expires_at) ls.set(ACCT_KEY, JSON.stringify({ ...a, expires_at: j.expires_at, name: j.name || a.name }));
      const x = j.acct; if (!x) return { ok: true, account: true, shop: j };
      const drift = (x.gold | 0) + (x.pend | 0) - body.gold, sd = {}; let sAny = false;
      for (const k of Object.keys(body.stats)) { sd[k] = (x.stats?.[k] | 0) - (body.stats[k] | 0); if (sd[k]) sAny = true; }
      const up = Object.keys(body.levels).some(k => (x.levels?.[k] | 0) > (body.levels[k] | 0));
      if (acctPending) { acctPending.gold = Math.max(0, acctPending.gold + drift); for (const k of Object.keys(sd)) acctPending.stats[k] = Math.max(0, acctPending.stats[k] + sd[k]); }
      if (drift || up || sAny) { const d = readDevice();
        writeDevice(cleanProfile({ ...d, gold: Math.max(0, d.gold + drift), stats: Object.fromEntries(Object.keys(d.stats).map(k => [k, Math.max(0, (d.stats[k] | 0) + (sd[k] | 0))])),
          levels: up ? Object.fromEntries(Object.keys(d.levels).map(k => [k, Math.max(d.levels[k] | 0, x.levels?.[k] | 0)])) : d.levels }));
        try { dispatchEvent(new CustomEvent('pfp-group-sync', { detail: { drift, levels: up ? x.levels : null, stats: sAny ? sd : null } })); } catch {} }
      return { ok: true, account: true, shop: j };
    } catch (e) {
      if (e.status === 401) { acctDrop('You were logged out (the password was changed or the session ended). This device is back to its own save.'); return { ok: false, status: 401 }; }
      if (!acctPending) acctPending = body; if (!acctTimer) acctTimer = setTimeout(acctFlush, 5000); return { ok: false, error: e.message, status: e.status };
    } }));
}
async function acctSyncNow(p, ms = 0) { if (p) acctPending = p; const r = acctFlush(); const o = ms ? await Promise.race([r, new Promise(res => setTimeout(() => res(null), ms))]) : await r; return o?.shop || null; }
// this device leaves the account: its own save (kept aside at login) comes back, or a fresh start on a retired key
function acctRestore() {
  acctFreeze(); let g = null; try { g = JSON.parse(ls.get(GUEST_KEY) || 'null'); } catch {}
  ls.set(ACCT_KEY, null); ls.set(GUEST_KEY, null); ls.set('pfp_pvp_airdrop_sent', null); claimAuth = null;
  if (g && typeof g.dk === 'string') { ls.set(DK_KEY, g.dk); ls.set(DEVICE_KEY, g.save ?? null); ls.set('pfp_name', g.name ?? null); if (g.session) ls.set(SESSION_KEY, g.session); }
  else { ls.set(DK_KEY, newDk()); ls.set(DEVICE_KEY, null); ls.set('pfp_name', null); }
}
function acctDrop(why) { acctRestore(); if (why) ls.set(ACCT_NOTE_KEY, why); try { dispatchEvent(new CustomEvent('pfp-acct', { detail: { out: true, why } })); } catch {} }
export const acctNote = () => { const n = ls.get(ACCT_NOTE_KEY); if (n) ls.set(ACCT_NOTE_KEY, null); return n || ''; };
// SET PASSWORD for this pirate's name (the device that owns the name). Returns { ok, name } or { ok: false, error, taken }.
export async function acctSetPassword(pw, name = ls.get('pfp_name') || '') {
  if (!PVP_FN_URL) return { ok: false, error: 'offline' }; if (acct()) return { ok: false, error: 'already logged in' };
  await ownerReady; const s = session(), nd = ownerAll ? null : newDk();
  if (!s && !ownerAll) await devSyncNow(readDevice(), 4000).catch(() => {}); // the server copy is current first
  try { const j = await api('acct_set', { dk: deviceKey(), ...(nd ? { newdk: nd } : {}), name: String(name).trim().slice(0, 20), pw, profile: readDevice(), ...(s ? { token: s.token } : {}) });
    if (j.rotated && nd) ls.set(DK_KEY, nd); claimAuth = null; // this device now uses its new key (the old one is retired)
    ls.set(GUEST_KEY, null); ls.set(ACCT_KEY, JSON.stringify({ token: j.token, name: j.name, owner: !!j.owner, expires_at: j.expires_at }));
    if (j.name && j.name !== ls.get('pfp_name')) ls.set('pfp_name', j.name); takeShop(j);
    try { dispatchEvent(new CustomEvent('pfp-acct', { detail: { set: true, name: j.name } })); } catch {}
    return { ok: true, name: j.name };
  } catch (e) { return { ok: false, error: e.message, taken: !!e.body?.taken, status: e.status }; }
}
// LOG IN on this device: keeps this device's own save aside, takes the account's save. The caller reloads the page.
export async function acctLogin(name, pw) {
  if (!PVP_FN_URL) return { ok: false, error: 'offline' };
  if (acct()) return { ok: false, error: 'Log out first.' };
  try { const j = await api('acct_login', { dk: deviceKey(), name: String(name || '').trim().slice(0, 20), pw });
    acctFreeze(); // the guest's in-memory save never lands on the account (page-close save etc.): frozen until the reload
    if (!ls.get(GUEST_KEY)) ls.set(GUEST_KEY, JSON.stringify({ dk: deviceKey(), save: ls.get(DEVICE_KEY), name: ls.get('pfp_name'), session: ls.get(SESSION_KEY) }));
    ls.set(SESSION_KEY, null); // the account's save is used here (LINK WALLET again any time for the wallet's save + boost)
    takeShop(j); const p = cleanProfile({ ...j.profile, gold: j.owner ? 0 : j.profile?.gold });
    { let all; try { all = JSON.parse(ls.get(DEVICE_KEY) || '{}'); } catch { all = {}; } all.profiles = { ...(all.profiles || {}), device: { ...p, updated: Date.now() } }; ls.set(DEVICE_KEY, JSON.stringify(all)); }
    ls.set('pfp_name', j.name); ls.set(ACCT_KEY, JSON.stringify({ token: j.token, name: j.name, owner: !!j.owner, expires_at: j.expires_at }));
    return { ok: true, name: j.name, owner: !!j.owner };
  } catch (e) { return { ok: false, error: e.message, status: e.status }; }
}
export async function acctLogout() {
  const a = acct(); if (!a) return { ok: true };
  try { dispatchEvent(new CustomEvent('pfp-save-now')); } catch {} // pvp.js saves its live state first
  if (!a.owner) await acctSyncNow(null, 4000).catch(() => {});
  await api('acct_logout', { dk: deviceKey(), acct: a.token }).catch(() => {});
  acctRestore(); return { ok: true };
}
export async function acctChangePassword(old, pw) {
  const a = acct(); if (!a) return { ok: false, error: 'Logged out. Log in again.' };
  try { const j = await api('acct_change', { dk: deviceKey(), acct: a.token, old, pw }); return { ok: true, loggedOut: j.logged_out | 0 }; }
  catch (e) { if (e.status === 401 && /log in/i.test(e.message)) acctDrop(''); return { ok: false, error: e.message, status: e.status }; }
}
// the session is still alive (owner devices and page start): 401 = logged out elsewhere (password changed)
export async function acctCheck() { const a = acct(); if (!a || !PVP_FN_URL) return null;
  if (!a.owner) return acctSyncNow(null, 5000);
  try { const j = await api('acct_sync', { dk: deviceKey(), acct: a.token }); if (j.expires_at) ls.set(ACCT_KEY, JSON.stringify({ ...a, expires_at: j.expires_at })); return j; }
  catch (e) { if (e.status === 401) acctDrop('You were logged out (the password was changed or the session ended). This device is back to its own save.'); return null; } }
window.PFP_ACCT = { info: accountInfo, setPassword: acctSetPassword, login: acctLogin, logout: acctLogout, changePassword: acctChangePassword, check: acctCheck, note: acctNote, takenByAccount };
window.PFP_PVP_SAVE = { prestigeLevel, checkName, renameEverywhere, loadProfile, saveProfile, linkWallet, walletSession, signOut, kd, readDevice, claimKill, fetchKillsTop, clearKillsTopCache, fetchMe };

// [terrain-edit] the island's height deltas (pvp function): load = anyone (+ whether YOU are the owner, decided by the server); put = owner only
const ident = () => { const s = session(); return s ? { token: s.token } : { dk: deviceKey() }; };
export async function terrainLoad() { if (!PVP_FN_URL) return null; try { return await api('terrain_get', ident()); } catch { return null; } }
export async function terrainSave(cells, rev, pieces = {}, paint = undefined) { if (!PVP_FN_URL) return { ok: false, error: 'offline' };
  try { return await api('terrain_put', { ...ident(), cells, pieces, rev, ...(paint ? { paint } : {}) }); } catch (e) { return { ok: false, status: e.status, error: e.message, body: e.body }; } }
// [inventory] migration 036: one call for every inventory / shop / gift / Marketplace action. The SERVER decides everything (what you
// hold, prices, the sell multiplier, recipients); this only carries the request. inv_pot = the owner's sales landing on his save.
export async function invApi(action, body = {}) {
  if (!PVP_FN_URL) return { ok: false, error: 'offline' }; await ownerReady; const s = session();
  try { return await api(action, { ...(s ? { token: s.token } : { dk: deviceKey() }), ...body }); }
  catch (e) { return { ok: false, error: e.message, status: e.status }; } }
