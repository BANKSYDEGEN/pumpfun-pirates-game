// Use verified per-token share IDs, never mint addresses in /c/ URLs.
import { safeMint } from './market.js';
import { PUMP_SHARE_URLS } from '../config.js';
export const REFERRAL_CODE = 'BANKSYDEGEN';
export const REFERRAL_URL = 'https://pump.fun/u/BANKSYDEGEN';
export const TOKEN_REFERRAL_EXAMPLE = 'https://pump.fun/c/30ca27df-3478-499b-874a-bf617704feb3/BANKSYDEGEN';
export const REFERRAL_FALLBACK_URL = 'https://pump.fun/u/BANKSYDEGEN';
export function tokenURL(mint) { return safeMint(mint) ? (PUMP_SHARE_URLS[mint] || tokenFallbackURL(mint)) : null; }
export function tokenFallbackURL(mint) { return safeMint(mint) ? `https://pump.fun/coin/${mint}` : null; }
export function openPump(mint) { const url = tokenURL(mint); if (url) window.open(url, '_blank', 'noopener,noreferrer'); }
export function openReferral(fallback=false) { window.open(fallback ? REFERRAL_FALLBACK_URL : REFERRAL_URL, '_blank', 'noopener,noreferrer'); }
export const SQUAD_URL = 'https://pump.fun/squads/PFPIRATES';
// The verified public squad page exposes Top squads / Profit 1D navigation.
// No CORS-safe ranking API was verified: do not invent rows or prize amounts.
export const SQUAD_LEADERBOARD_URL = SQUAD_URL;
export const DAILY_LEADERBOARD_URL = 'https://pump.fun/leaderboard';
export function openSquad() { window.open(SQUAD_URL, '_blank', 'noopener,noreferrer'); }
export function openLeaderboard(daily=false) { window.open(daily ? DAILY_LEADERBOARD_URL : SQUAD_LEADERBOARD_URL, '_blank', 'noopener,noreferrer'); }
