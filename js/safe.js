// PUMPFUN PIRATES · [security] tiny shared helpers for anything that comes from the network or the URL.
//   escHtml(s)    HTML-escape for text AND attribute values (& < > " ' ` ->  entities). Use it on every value that goes into innerHTML.
//   NET_ID_RE     the ONLY accepted shape of a PvP network / player id (js/pvp.js myId: base36, 6-20 chars). Same rule as server/relay.js ID_RE.
//   isNetId(v)    true when v is a string id of that shape (anything else from a peer is dropped before it is used).
//   safeMerge     Object.assign for untrusted JSON: own enumerable keys only, never __proto__ / constructor / prototype.
//   num(v, d)     a finite number or the default (for numbers from a server / peer that end up in HTML).
//   isBase58(v)   a Solana address / pair address shape (32-44 base58 chars).
export const NET_ID_RE = /^[a-z0-9]{6,20}$/;
export const isNetId = (v) => typeof v === 'string' && NET_ID_RE.test(v);
const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
export const escHtml = (s) => String(s ?? '').replace(/[&<>"'`]/g, (c) => ENT[c]);
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export function safeMerge(target, src) {
  if (!src || typeof src !== 'object' || Array.isArray(src)) return target;
  for (const k of Object.keys(src)) if (!BAD_KEYS.has(k)) target[k] = src[k];
  return target;
}
export const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
export const isBase58 = (v) => typeof v === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
