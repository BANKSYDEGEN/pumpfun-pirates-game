// Solana address helpers. Typed addresses are NOT verified as owned by the player.
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const KEY = 'pfp_wallet';

export function base58Decode(str) {
  let n = 0n;
  for (const ch of str) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  for (const ch of str) { if (ch === '1') bytes.unshift(0); else break; }
  return Uint8Array.from(bytes);
}

/** valid = base58 charset, 32-44 chars, decodes to a 32-byte public key */
export function isValidSolanaAddress(addr) {
  if (typeof addr !== 'string') return false;
  const a = addr.trim();
  if (!RE.test(a)) return false;
  const b = base58Decode(a);
  return !!b && b.length === 32;
}

export function shortWallet(a) {
  if (!a) return '';
  return a.length > 12 ? `${a.slice(0, 4)}...${a.slice(-5)}` : a;
}

export const getSavedWallet = () => localStorage.getItem(KEY) || '';
export const saveWallet = (a) => localStorage.setItem(KEY, a.trim());
export const getSavedName = () => localStorage.getItem('pfp_name') || '';
export const saveName = (n) => localStorage.setItem('pfp_name', (n || '').trim().slice(0, 20));
