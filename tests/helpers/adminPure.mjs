// load js/adminMenu.js's pure helpers in Node (child-free): registers the stub loader, fakes a local host, imports once.
import { register } from 'node:module';
let M = null;
export async function load() {
  if (M) return M; register('./adminLoader.mjs', import.meta.url);
  globalThis.location ||= { hostname: '127.0.0.1', search: '', protocol: 'http:' };
  const m = await import('../../js/adminMenu.js'), s = await import('../../js/adminState.js');
  return (M = { ...m, ADM: s.ADM });
}
