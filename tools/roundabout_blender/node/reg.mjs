import { register } from 'node:module'; register('./hooks.mjs', import.meta.url);
globalThis.location = { search: process.env.QS || '?coast=1', href: 'http://x/island.html?coast=1', hostname: 'x' };
globalThis.window = globalThis; globalThis.self = globalThis;
const el = () => ({ getContext: () => null, style: {}, addEventListener() {}, appendChild() {}, setAttribute() {}, classList: { add() {}, remove() {} } });
globalThis.document = { createElement: el, createElementNS: el, addEventListener() {}, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
try { globalThis.navigator = globalThis.navigator || { userAgent: 'node' }; } catch (e) {}
