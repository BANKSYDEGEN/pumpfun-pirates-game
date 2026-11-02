// PUMPFUN PIRATES · [security] where am I running?
//   IS_PROD_HOST  the live web build (game.pumpfunpirates.com, banksydegen.github.io). Test/debug switches are ignored here.
//   DEV           a local dev / test server (localhost, 127.0.0.1, file:). Only here do the window.PFP* console hooks exist,
//                 so the headless tests in /workspace/pfp-test keep working while the live game exposes no cheat handles.
//   devHook(name, value)   window[name] = value, in DEV only.
const H = typeof location !== 'undefined' ? location.hostname : '';
export const IS_PROD_HOST = /(^|\.)pumpfunpirates\.com$/i.test(H) || /^banksydegen\.github\.io$/i.test(H);
export const DEV = typeof location !== 'undefined' && (H === 'localhost' || H === '127.0.0.1' || H === '[::1]' || location.protocol === 'file:');
export function devHook(name, value) { if (DEV && typeof window !== 'undefined') window[name] = value; return value; }
