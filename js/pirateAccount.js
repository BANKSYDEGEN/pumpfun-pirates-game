// ===================================================================
// PUMPFUN PIRATES · read-only wallet sign-in + server-saved progress
// ===================================================================
// CONNECT WALLET asks an injected Solana wallet (Phantom, Solflare, Backpack, or any window.solana) for its
// public key, then has it sign a plain-text message with a server nonce (signMessage ONLY). That proves you own
// the wallet; it is not a transaction and cannot move funds. The `pirate` Edge Function checks the signature and
// returns a session. While connected, skins (owned + equipped) and your best run are saved on the server for that
// wallet, so they follow you to any device. Guests keep saving on this device only, exactly as before.
// NEVER add signTransaction / signAllTransactions / signAndSendTransaction or anything that spends.
import { PIRATE_FN_URL, SUPABASE_ANON_KEY } from './config.js';
import { skinState, replaceSkins, onSkinsChange } from './skins.js';
import { shortWallet, saveWallet } from './wallet.js';

const SESSION_KEY = 'pfp_session_v1';
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
let session = readSession(), player = null, hooks = { getRun: () => null, getName: () => '', onChange: () => {}, onSkins: () => {}, msg: () => {} };

function readSession() { try { const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); return s && s.token && Date.parse(s.expires_at) > Date.now() ? s : null; } catch { return null; } }
function writeSession(s) { session = s; try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch { /* private mode */ } }

export const account = {
  get connected() { return !!session && !!player; },
  get wallet() { return session?.wallet || ''; },
  get player() { return player; },
};

// injected providers, best first
export function findProvider() {
  const w = window;
  const list = [
    ['Phantom', w.phantom?.solana?.isPhantom ? w.phantom.solana : null],
    ['Solflare', w.solflare?.isSolflare ? w.solflare : null],
    ['Backpack', w.backpack?.isBackpack ? w.backpack : (w.backpack?.solana || null)],
    ['Wallet', w.solana || null],
  ];
  for (const [name, p] of list) if (p && typeof p.signMessage === 'function') return { name, p };
  return null;
}
// inside the itch.io iframe (html*.itch.zone) send phones to the real site instead of the bare CDN frame
const ON_ITCH = /(^|\.)itch\.zone$/.test(location.hostname);
export const phantomDeepLink = (url = ON_ITCH ? 'https://game.pumpfunpirates.com/' : location.href) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(location.origin)}`;

async function api(action, body = {}) {
  const r = await fetch(PIRATE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY }, body: JSON.stringify({ action, ...body }) });
  let j = null; try { j = await r.json(); } catch { /* empty */ }
  if (!r.ok) { const e = new Error(j?.error || `pirate ${action} ${r.status}`); e.status = r.status; e.body = j; throw e; }
  return j;
}
const b64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };

// errors carry the stage they failed at, so the status line can say why
const tagged = (stage, e) => { const x = e instanceof Error ? e : new Error(e?.message || String(e)); if (e && typeof e === 'object' && 'code' in e) x.code = e.code; x.stage = x.stage || stage; return x; };
const step = async (stage, fn) => { try { return await fn(); } catch (e) { throw tagged(stage, e); } };
const isRejection = (e) => e?.code === 4001 || /reject|cancel|denied|declin|closed/i.test(e?.message || '');
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function fromB58(str) {
  const out = [0]; for (const ch of str) { let c = B58.indexOf(ch); if (c < 0) return null;
    for (let i = 0; i < out.length; i++) { c += out[i] * 58; out[i] = c & 255; c >>= 8; } while (c) { out.push(c & 255); c >>= 8; } }
  for (const ch of str) { if (ch === '1') out.push(0); else break; }
  return new Uint8Array(out.reverse());
}
// every signMessage return shape seen in the wild -> 64 raw bytes
export function sigBytes(res) {
  let s = res?.signature ?? res?.data?.signature ?? res;
  if (s?.type === 'Buffer' && Array.isArray(s.data)) s = s.data;      // JSON-ified Buffer
  if (s instanceof ArrayBuffer) s = new Uint8Array(s);
  else if (ArrayBuffer.isView(s)) s = new Uint8Array(s.buffer, s.byteOffset, s.byteLength);
  else if (Array.isArray(s)) s = Uint8Array.from(s);
  else if (typeof s === 'string') {
    let b = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(s) ? fromB58(s) : null;
    if (!b || b.length !== 64) { try { b = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)); } catch { b = null; } }
    if (!b && /^(0x)?[0-9a-f]{128}$/i.test(s)) b = Uint8Array.from(s.replace(/^0x/, '').match(/../g), (h) => parseInt(h, 16));
    s = b;
  } else if (s && typeof s === 'object' && typeof s.length !== 'number') { const v = Object.values(s); if (v.length === 64 && v.every(Number.isInteger)) s = Uint8Array.from(v); }
  if (!(s instanceof Uint8Array) || s.length !== 64) throw new Error(`unexpected signature format (${Object.prototype.toString.call(res)})`);
  return s;
}
async function signBytes(p, message) { return sigBytes(await p.signMessage(new TextEncoder().encode(message), 'utf8')); }
export function connectError(e) {
  const m = String(e?.message || e || '').slice(0, 80);
  if (isRejection(e)) return e.stage === 'connect' ? 'Wallet connection cancelled.' : 'Signature cancelled.';
  if (e?.stage === 'server') return e.status ? `Server error: ${m}` : 'Could not reach the save server. Check your connection.';
  if (e?.stage === 'connect') return `Wallet would not connect${e.code != null ? ` (${e.code})` : ''}: ${m}`;
  if (e?.stage === 'sign') return `Wallet would not sign${e.code != null ? ` (${e.code})` : ''}: ${m}`;
  return `Could not connect: ${m}`;
}

function adopt(p) {
  player = p;
  if (p?.skins) { replaceSkins(p.skins); hooks.onSkins(); }
  hooks.onChange();
}
function dropSession(why) { writeSession(null); player = null; hooks.onChange(); if (why) hooks.msg(why); }

export async function connect() {
  const found = findProvider();
  if (!found) {
    if (isMobile()) { if (ON_ITCH) window.open(phantomDeepLink(), '_blank', 'noopener'); else location.href = phantomDeepLink(); return false; }
    hooks.msg('No Solana wallet found. Install Phantom or Solflare, then reload.', true);
    return false;
  }
  const { p } = found;
  const r = await step('connect', () => p.connect());
  const pk = (r?.publicKey || p.publicKey)?.toString?.();
  if (!pk || pk === '[object Object]') throw tagged('connect', new Error('wallet gave no public key'));
  hooks.msg(`Sign the message in ${found.name}. It's free and read-only, not a transaction.`);
  let n = await step('server', () => api('nonce', { wallet: pk }));
  let sig;
  try { sig = await signBytes(p, n.message); }
  catch (e) {
    if (isRejection(e)) throw tagged('sign', e);
    // wallet refused the Sign-In-With-Solana form without prompting (Phantom -32000 etc): retry once with plain text
    console.warn('[wallet save] SIWS sign failed, retrying with a plain message:', e);
    n = await step('server', () => api('nonce', { wallet: pk, plain: true }));
    sig = await step('sign', () => signBytes(p, n.message));
  }
  const v = await step('server', () => api('verify', { wallet: pk, nonce: n.nonce, signature: b64(sig), local_skins: skinState(), name: hooks.getName() || null }));
  writeSession({ token: v.token, wallet: pk, expires_at: v.expires_at });
  saveWallet(pk);
  adopt(v.player);
  hooks.msg(v.player.merged ? 'Wallet connected. This device’s skins were added to your saved progress.' : 'Wallet connected. Your progress now saves to this wallet.');
  return true;
}

export async function disconnect() {
  const t = session?.token; dropSession('Disconnected. Playing as a guest on this device.');
  try { await findProvider()?.p.disconnect?.(); } catch { /* ignore */ }
  if (t) api('logout', { token: t }).catch(() => {});
}

// load the server copy on page start (if a session is stored)
export async function restore() {
  if (!session) return;
  try { const r = await api('load', { token: session.token }); adopt(r.player); }
  catch (e) { if (e.status === 401) dropSession(); else console.info('[wallet save] offline, using this device for now:', e.message); }
}

let saveTimer = 0, saving = Promise.resolve();
// save skins + this run's stats. final = run over (counts the run, updates the best)
export function save({ now = false } = {}) {
  if (!session) return Promise.resolve();
  clearTimeout(saveTimer);
  const go = () => (saving = saving.then(async () => {
    if (!session) return;
    try {
      const r = await api('save', { token: session.token, skins: skinState(), run: hooks.getRun(), name: hooks.getName() || null });
      player = r.player; hooks.onChange();
    } catch (e) {
      if (e.status === 401) dropSession('Your wallet session ended. Connect again to keep saving.');
      else if (e.status === 422 && e.body?.player) { adopt(e.body.player); hooks.msg('That change could not be saved to your wallet.'); console.info('[wallet save] rejected:', e.message); }
      else console.info('[wallet save] save failed:', e.message);
    }
  }));
  if (now) return go();
  return new Promise((res) => { saveTimer = setTimeout(() => go().then(res), 600); });
}

// Title screen wiring. ui = { button, chip, addr, out, note }
export function initAccount(ui, h) {
  hooks = { ...hooks, ...h };
  onSkinsChange(() => { save(); }); // shop purchases, wave unlocks, equips
  const render = () => {
    const c = account.connected || (!!session && !player);
    ui.button.classList.toggle('hidden', c);
    ui.chip.classList.toggle('hidden', !c);
    ui.addr.textContent = shortWallet(session?.wallet || '');
    ui.chip.title = session?.wallet || '';
  };
  const prevChange = hooks.onChange;
  hooks.onChange = () => { render(); prevChange(); };
  hooks.msg = (t, warn) => { ui.note.textContent = t; ui.note.classList.toggle('warn', !!warn); };
  ui.button.onclick = async () => {
    ui.button.disabled = true;
    try { await connect(); }
    catch (e) { console.error('[wallet save] connect failed', e?.stage, e?.code, e); hooks.msg(`${connectError(e)} You can still set sail as a guest.`, true); }
    finally { ui.button.disabled = false; render(); }
  };
  ui.out.onclick = () => disconnect();
  render();
  return restore();
}
