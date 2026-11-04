// [Timothy] node loader hook: 'three' + 'three/addons/*' -> the vendored three.js (no browser needed for the foot.js probes)
const ROOT = new URL('../../../vendor/three-0.165.0/', import.meta.url).href;   // the game's vendored three.js
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: ROOT + 'build/three.module.js', shortCircuit: true };
  if (spec.startsWith('three/addons/')) return { url: ROOT + 'examples/jsm/' + spec.slice(13), shortCircuit: true };
  return next(spec, ctx);
}
