// Run with the game's Three.js import map (Node loader or installed three@0.165.0).
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
let THREE, GLTFLoader, MeshoptDecoder, G;
try { THREE = await import('three'); ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')); ({ MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js')); G = await import('../js/onfoot/gaitPose.js'); } catch {}
test('V7 gait: stride-matched clips, phase-kept blends, bounded layer on body bones only', { skip: !G && 'Needs game Three.js import map' }, async () => {
  const b = fs.readFileSync(new URL('../assets/pirates/pirate_male_v7_hi.glb', import.meta.url));
  const L = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); L.register(() => ({ name: 'EXT_texture_webp', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const g = await L.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), '');
  const scene = g.scene; scene.traverse((o) => { if (o.isBone) o.userData.swRest = o.quaternion.clone(); });
  const root = new THREE.Group(); root.add(scene); root.scale.setScalar(1.25);
  const p = { scene, root, female: true, clips: Object.fromEntries(g.animations.map((a) => [a.name, a])), mixer: new THREE.AnimationMixer(scene),
    addPost(k, fn) { (this.posts ||= []).push(fn); }, play(n, { fade = .2 } = {}) { const a = this.mixer.clipAction(this.clips[n]); a.reset().play(); if (this.action) this.action.crossFadeTo(a, fade, false); this.action = a; this.clip = n; } };
  p.play('idle'); G.attachGait(p); G.attachGait(p); assert.equal(p.posts.length, 1);
  assert.ok(G.clipSpeed(p, 'walk') > 0 && G.clipSpeed(p, 'run') > G.clipSpeed(p, 'walk'));
  const braid = scene.getObjectByName('braid'), bq = () => braid.quaternion.clone();
  for (let i = 0; i < 40; i++) { G.locomote(p, 'walk', 2.4); p.mixer.update(1 / 60); const before = bq(); p.posts[0].call(p, 1 / 60); assert.ok(bq().equals(before), 'hair untouched'); }
  const ph = p.action.time / p.action.getClip().duration; G.locomote(p, 'run', 6);
  assert.ok(Math.abs(p.action.time / p.action.getClip().duration - ph) < 1e-6, 'walk -> run keeps foot phase');
  assert.ok(p.action.getEffectiveTimeScale() <= 1.75 && p._strideK >= 1 && p._strideK <= 1.5);
  scene.traverse((o) => { if (o.isBone) for (const v of o.quaternion.toArray()) assert.ok(Number.isFinite(v)); });
});
