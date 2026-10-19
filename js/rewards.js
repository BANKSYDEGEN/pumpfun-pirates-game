// ===================================================================
// $AHOY REWARDS · PLACEHOLDER ONLY. NOTHING HERE IS FUNCTIONAL.
// No wallet connection, no signing, no funds handling.
// ===================================================================
//
// TODO (future, needs a real design + review before going live):
//  1. connectPhantom(): window.phantom?.solana.connect() -> publicKey.
//  2. proveOwnership(): ask the wallet to signMessage(nonce from a backend),
//     verify the ed25519 signature SERVER-SIDE, then link the wallet to scores.
//     Typed wallet addresses on the title screen are NOT verified today.
//  3. eligibility(): server checks verified wallet + leaderboard rank / NFT or
//     $AHOY holdings. Never trust anything computed in the browser.
//  4. claim(): server-side payout with its own limits and audit trail.
//     Client code must never hold keys or move funds.

export const REWARDS_ENABLED = false;

export function rewardsStatus() {
  return { enabled: false, label: 'Connect Wallet · $AHOY rewards coming soon' };
}

export async function connectPhantom() {
  // TODO: Phantom connect (disabled placeholder)
  throw new Error('Rewards are not live yet');
}

export async function proveOwnership(/* wallet */) {
  // TODO: signMessage + server-side verification (disabled placeholder)
  throw new Error('Rewards are not live yet');
}

export async function claim(/* wallet */) {
  // TODO: server-side claim (disabled placeholder)
  throw new Error('Rewards are not live yet');
}
