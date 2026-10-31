// PUMPFUN PIRATES · PvP progress saving.
//   ALWAYS on this device (localStorage, automatic, no prompt; a new device starts at zero).
//   OPTIONAL "Connect wallet to save": READ-ONLY wallet sign-in (signMessage of a plain-text message, NEVER a
//   transaction / approval / funds). The `pvp` Edge Function verifies the ed25519 signature, then the save is kept in
//   the pvp_profiles table too, so the same wallet restores it on any device. Once linked, saves go to BOTH.
//   Linking: the wallet's save wins when it has progress; a brand-new wallet save is seeded from this device once.
// A save holds gold (whatever you're carrying), upgrade levels, skins (selected + unlocked by kills) and lifetime K/D.
// Storage is keyed by a PROFILE KEY ('device' / 'wallet:<pubkey>' today) so a later version can key upgrades by a
// ship NFT mint ('mint:<mint>'); the server table already has a nullable `mint` column for that.
import { PVP_FN_URL, PIRATE_FN_URL, SUPABASE_ANON_KEY, PVP_SKIN_TIERS } from './config.js';
import { UPGRADES } from './upgrades.js';
import { findProvider, sigBytes } from './pirateAccount.js';

const DEVICE_KEY = 'pfp_pvp_save_v1', SESSION_KEY = 'pfp_pvp_session_v1';
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };

export const blankProfile = () => ({ v: 1, gold: 0, levels: Object.fromEntries(UPGRADES.map(u => [u.id, 0])), skins: { owned: [], equipped: 'classic' }, stats: { kills: 0, deaths: 0, botKills: 0 } });
export function cleanProfile(p) {
  const b = blankProfile(); if (!p || typeof p !== 'object') return b;
  const n = (x, hi) => Math.max(0, Math.min(hi, Math.floor(Number(x) || 0)));
  b.gold = n(p.gold, 1e7);
  for (const u of UPGRADES) b.levels[u.id] = n(p.levels?.[u.id], u.tiers.length);
  const st = p.stats || {}; b.stats = { kills: n(st.kills, 1e7), deaths: n(st.deaths, 1e7), botKills: n(st.botKills, 1e7) };
  // skins: unlocked ONLY by lifetime player kills (PVP_SKIN_TIERS); the selected one must be unlocked
  b.skins.owned = PVP_SKIN_TIERS.filter(t => t.id !== 'classic' && b.stats.kills >= t.kills).map(t => t.id);
  const eq = p.skins?.equipped; b.skins.equipped = eq === 'classic' || b.skins.owned.includes(eq) ? eq : 'classic';
  return b;
}
// HOLDER PERK: server-checked (the client can't fake the balance or claim twice). Fails closed: any error = no perk.
export async function holderStatus() { const s = session(); if (!s) return { holder: false }; try { return await api('holder', { token: s.token }); } catch { return { holder: false }; } }
export async function holderClaim() { const s = session(); if (!s) throw new Error('connect a wallet first'); return api('holder_claim', { token: s.token }); }
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
  ls.set(SESSION_KEY, JSON.stringify({ token: v.token, wallet, expires_at: v.expires_at })); claimAuth = null; // kills now count for the wallet
  return { wallet, profile: cleanProfile(v.profile), link: v.link || null };
}

export const isBlank = (p) => !p.gold && !p.stats.kills && !p.stats.deaths && !p.stats.botKills && !Object.values(p.levels).some(Boolean);
function readDevice() { let all; try { all = JSON.parse(ls.get(DEVICE_KEY) || '{}'); } catch { all = {}; } return cleanProfile(all.profiles?.device); }
function writeDevice(p) { let all; try { all = JSON.parse(ls.get(DEVICE_KEY) || '{}'); } catch { all = {}; } all.profiles = all.profiles || {}; all.profiles.device = { ...p, updated: Date.now() }; ls.set(DEVICE_KEY, JSON.stringify(all)); }

// Load: the device save, or (when a wallet is linked) the wallet's save if it has progress. Never throws.
export async function loadProfile() {
  const dev = readDevice(), s = session();
  if (!s) return { profile: dev, source: 'device' };
  try { const j = await api('load', { token: s.token }); const w = cleanProfile(j.profile);
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

// Save: device immediately; wallet (if linked) throttled ~3 s, or right away with now / keepalive (page closing).
let pending = null, timer = 0, inflight = null;
export function saveProfile(profile, { now = false, keepalive = false } = {}) {
  const p = cleanProfile(profile); writeDevice(p);
  const s = session(); if (!s) return Promise.resolve({ ok: true, device: true });
  pending = p;
  const flush = () => { timer = 0; const body = pending; pending = null; if (!body) return inflight || Promise.resolve({ ok: true });
    inflight = api('save', { token: s.token, profile: body }, { keepalive }).then(j => ({ ok: true, profile: cleanProfile(j.profile) })).catch(e => { if (e.status === 401) ls.set(SESSION_KEY, null); return { ok: false, error: e.message, status: e.status }; });
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
window.PFP_PVP_SAVE = { renameEverywhere, loadProfile, saveProfile, linkWallet, walletSession, signOut, kd, readDevice, claimKill, fetchKillsTop, clearKillsTopCache, fetchMe };
