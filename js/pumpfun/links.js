// Use the game account app-share format for every token.
import { safeMint } from './market.js';
export const PUMP_CALLER_WALLET = '3kDkcoVoJNmrC6fe98SQU7cK1rwvGT77ouBDB871wy34';
export const REFERRAL_CODE = 'PUMPFUNPIRATES';
export const REFERRAL_URL = 'https://pump.fun/u/pumpfunpirates';
export const TOKEN_REFERRAL_EXAMPLE = tokenURL('By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump');
export const REFERRAL_FALLBACK_URL = 'https://pump.fun/u/pumpfunpirates';
export function tokenURL(mint) { return safeMint(mint) ? `https://pump.fun/coin/${mint}?caller=${PUMP_CALLER_WALLET}&ref=${REFERRAL_CODE}` : null; }
export function tokenFallbackURL(mint) { return tokenURL(mint); }
export function openPump(mint) { const url = tokenURL(mint); if (url) window.open(url, '_blank', 'noopener,noreferrer'); }
export function openReferral(fallback=false) { window.open(fallback ? REFERRAL_FALLBACK_URL : REFERRAL_URL, '_blank', 'noopener,noreferrer'); }
export const SQUAD_URL = 'https://pump.fun/squads/PFPIRATES';
// The verified public squad page exposes Top squads / Profit 1D navigation.
// No CORS-safe ranking API was verified: do not invent rows or prize amounts.
export const SQUAD_LEADERBOARD_URL = SQUAD_URL;
export const DAILY_LEADERBOARD_URL = 'https://pump.fun/leaderboard';
export function openSquad() { window.open(SQUAD_URL, '_blank', 'noopener,noreferrer'); }
export function openLeaderboard(daily=false) { window.open(daily ? DAILY_LEADERBOARD_URL : SQUAD_LEADERBOARD_URL, '_blank', 'noopener,noreferrer'); }
