// node --test helper for tests/adminMenu.test.mjs: load js/adminMenu.js in plain Node (no browser): 'three' -> the vendored build,
// js/pvpSave.js -> a stub whose invApi / owner hints the test controls through globalThis.
const THREE_URL = new URL('../../vendor/three-0.165.0/build/three.module.min.js', import.meta.url).href;
const STUB = `export const ownerReady = Promise.resolve(!!globalThis.__ownerHint);
export const ownerAllSkins = () => !!globalThis.__ownerHint;
export const accountInfo = () => null; export const walletSession = () => null; export const shopCache = () => ({ owner: false });
export async function invApi(a, b = {}) { (globalThis.__calls ||= []).push([a, b]); return globalThis.__invApi ? globalThis.__invApi(a, b) : { ok: false, error: 'offline' }; }`;
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: THREE_URL, shortCircuit: true };
  if (/(^|\/)pvpSave\.js$/.test(spec)) return { url: 'data:text/javascript,' + encodeURIComponent(STUB), shortCircuit: true };
  return next(spec, ctx);
}
