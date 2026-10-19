// ===================================================================
// PUMPFUN PIRATES · wallet verification (VIEW-ONLY, built but DISABLED)
// ===================================================================
// Only loaded when WALLET_VERIFY_ENABLED = true in js/config.js (main.js imports it dynamically,
// so with the flag off this file is never even downloaded).
//
// What it does: Phantom connect + a Sign-In-With-Solana style signMessage. The signed text is
// plain, human-readable and says what it is. That signature proves you own the wallet. It can't move funds.
//
// What it NEVER does (do not add any of these):
//   - no signTransaction / signAllTransactions / signAndSendTransaction
//   - no transfers, approvals, swaps, token or NFT spend of any kind
//   - no private keys, seed phrases or wallet secrets ever touch this code
// It uses only the provider Phantom injects (window.phantom.solana). No Phantom SDK or other script is loaded.

const PROOF_KEY = 'pfp_wallet_proof_v1';
const PROOF_TTL_MS = 24 * 3600 * 1000; // the server rejects proofs older than this too

export function getProvider() {
  const p = window.phantom?.solana;
  return p && p.isPhantom ? p : null;
}
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
// No injected wallet on a phone: open this page inside the Phantom app's browser (universal link).
export function phantomDeepLink(url = location.href) {
  return `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(location.origin)}`;
}

export async function connect() {
  const p = getProvider();
  if (!p) {
    if (isMobile()) { location.href = phantomDeepLink(); return null; }
    window.open('https://phantom.app/download', '_blank', 'noopener');
    return null;
  }
  const r = await p.connect(); // read-only: asks Phantom for the public key
  return (r?.publicKey || p.publicKey).toString();
}

function nonce() { const a = new Uint8Array(16); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, '0')).join(''); }

// Human-readable sign-in message (SIWS style). The edge function checks every line.
export function buildMessage(wallet, { domain = location.host, uri = location.origin + location.pathname, n = nonce(), issuedAt = new Date().toISOString() } = {}) {
  return [
    `${domain} wants you to sign in with your Solana account:`,
    wallet,
    '',
    'Sign in to PUMPFUN PIRATES to verify your leaderboard scores.',
    'View-only: this proves you own this wallet. It cannot move funds or approve any transaction.',
    '',
    `URI: ${uri}`,
    'Version: 1',
    'Chain ID: mainnet',
    `Nonce: ${n}`,
    `Issued At: ${issuedAt}`,
  ].join('\n');
}

const b64 = (u8) => btoa(String.fromCharCode(...u8));

// Ask Phantom to sign the message. signMessage ONLY; never a transaction.
export async function signIn(wallet) {
  const p = getProvider(); if (!p) throw new Error('Phantom not found');
  const message = buildMessage(wallet);
  const { signature } = await p.signMessage(new TextEncoder().encode(message), 'utf8');
  const proof = { wallet, message, signature: b64(signature instanceof Uint8Array ? signature : new Uint8Array(signature)), issuedAt: Date.now() };
  try { sessionStorage.setItem(PROOF_KEY, JSON.stringify(proof)); } catch { /* private mode */ }
  return proof;
}

export function getProof(wallet) {
  try {
    const p = JSON.parse(sessionStorage.getItem(PROOF_KEY) || 'null');
    if (p && p.wallet === wallet && Date.now() - p.issuedAt < PROOF_TTL_MS - 60000) return p;
  } catch { /* none */ }
  return null;
}
export function clearProof() { try { sessionStorage.removeItem(PROOF_KEY); } catch { /* ignore */ } }

// Title-screen wiring: swaps the disabled "coming soon" button for CONNECT PHANTOM.
// ui = { button, walletInput, onWallet(addr), setMsg(text) }
export function initWalletVerify(ui) {
  const btn = ui.button; if (!btn) return;
  btn.disabled = false; btn.title = 'View-only: proves you own the wallet, cannot move funds';
  btn.classList.add('wv-connect');
  const label = () => {
    const w = ui.walletInput.value.trim(), ok = w && getProof(w);
    btn.textContent = ok ? '✅ WALLET VERIFIED' : (getProvider() ? '👻 CONNECT PHANTOM' : (isMobile() ? '👻 OPEN IN PHANTOM' : '👻 GET PHANTOM'));
  };
  label();
  ui.walletInput.addEventListener('input', label);
  btn.onclick = async () => {
    try {
      btn.disabled = true;
      const wallet = await connect(); if (!wallet) return;
      ui.onWallet(wallet);
      ui.setMsg?.('Sign the message in Phantom (view-only: it cannot move funds).');
      await signIn(wallet);
      ui.setMsg?.('Wallet verified. Your scores will be marked verified.');
    } catch (e) {
      ui.setMsg?.(e?.code === 4001 ? 'Signature cancelled. You can still play with the typed wallet.' : 'Could not verify the wallet. You can still play.');
    } finally { btn.disabled = false; label(); }
  };
}
