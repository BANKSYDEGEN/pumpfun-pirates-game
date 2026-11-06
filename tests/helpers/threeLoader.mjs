// node --test helper: resolve the browser importmap ('three', 'three/addons/') to the vendored three.js build, so plain-data
// modules that import three (js/island/plazaTown.js and friends) load in Node without a browser.
const BASE = new URL('../../vendor/three-0.165.0/', import.meta.url).href;
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: BASE + 'build/three.module.min.js', shortCircuit: true };
  if (spec.startsWith('three/addons/')) return { url: BASE + 'examples/jsm/' + spec.slice('three/addons/'.length), shortCircuit: true };
  return next(spec, ctx);
}
