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
export const phantomDeepLink = (url = location.href) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(location.origin)}`;

async function api(action, body = {}) {
  const r = await fetch(PIRATE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY }, body: JSON.stringify({ action, ...body }) });
  let j = null; try { j = await r.json(); } catch { /* empty */ }
  if (!r.ok) { const e = new Error(j?.error || `pirate ${action} ${r.status}`); e.status = r.status; e.body = j; throw e; }
  return j;
}
const b64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };

function adopt(p) {
  player = p;
  if (p?.skins) { replaceSkins(p.skins); hooks.onSkins(); }
  hooks.onChange();
}
function dropSession(why) { writeSession(null); player = null; hooks.onChange(); if (why) hooks.msg(why); }

export async function connect() {
  const found = findProvider();
  if (!found) {
    if (isMobile()) { location.href = phantomDeepLink(); return false; }
    hooks.msg('No Solana wallet found. Install Phantom or Solflare, then reload.', true);
    return false;
  }
  const { p } = found;
  const r = await p.connect();
  const pk = (r?.publicKey || p.publicKey)?.toString();
  if (!pk) throw new Error('no public key');
  hooks.msg(`Sign the message in ${found.name}. It's free and read-only, not a transaction.`);
  const n = await api('nonce', { wallet: pk });
  const res = await p.signMessage(new TextEncoder().encode(n.message), 'utf8');
  const sig = res?.signature ?? res;
  const v = await api('verify', { wallet: pk, nonce: n.nonce, signature: b64(sig instanceof Uint8Array ? sig : new Uint8Array(sig)), local_skins: skinState(), name: hooks.getName() || null });
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
    catch (e) { hooks.msg(e?.code === 4001 || /reject|cancel|denied/i.test(e?.message || '') ? 'Signature cancelled. You can still set sail as a guest.' : 'Could not connect the wallet. You can still set sail as a guest.', true); console.info('[wallet save]', e); }
    finally { ui.button.disabled = false; render(); }
  };
  ui.out.onclick = () => disconnect();
  render();
  return restore();
}
