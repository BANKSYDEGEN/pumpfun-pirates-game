import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const a = read('js/crewAiPilly.js');
const c = read('js/crew.js');
const s = read('js/ships.js');
const f = read('js/features.js');
const sw = read('sw.js');
const pre = read('js/preloadList.js');

test('AI Pilly is a pirate skin flag, separate from the paused pet', () => {
  assert.match(f, /export const AI_PILLY_CREW = true/);
  assert.match(f, /export const PILLY_ENABLED = pillyEnabledFor\(\)/);
  assert.match(f, /pillyEnabledFor = \(_env = globalThis\) => false/);
});

test('lazy shared GLB load — no static import of onfoot/pilly, no pet systems', () => {
  assert.doesNotMatch(a, /from ['"].*onfoot\/pilly/);
  assert.doesNotMatch(a, /createPillyState|followStep|PILLY_LADDER|PILLY_PRICE/);
  assert.doesNotMatch(c, /onfoot\/pilly/);
  assert.match(a, /AI_PILLY_URL = 'assets\/pirates\/items\/v7\/pet_pilly\.glb'/);
  assert.match(a, /loadAsync\(new URL\(AI_PILLY_URL, document\.baseURI\)\.href\)/);
  assert.match(a, /SkeletonUtils\.clone/);
  assert.doesNotMatch(pre, /pet_pilly|crewAiPilly|onfoot\/pilly/);
  assert.doesNotMatch(sw, /pet_pilly/);
  assert.match(sw, /js\/crewAiPilly\.js/);
});

test('true V7 retarget is documented as infeasible; clips map from crew roles onto Pilly Idle/Walk', () => {
  assert.match(a, /13 joints/);
  assert.match(a, /6 joints/);
  assert.match(a, /CLIP_MAP/);
  assert.match(a, /cannon: 'Idle'/);
  assert.match(a, /steer: 'Idle'/);
  assert.match(a, /walk: 'Walk'/);
  assert.match(a, /AI_PILLY_H_TARGET = 1\.75/);
});

test('same crew stations / LOD budget / distant fallback as native V7', () => {
  assert.match(a, /role > 2\.5/);
  assert.match(a, /role < 0\.5/);
  assert.match(a, /role > 1\.5/);
  assert.match(a, /s\.low \? 24 : 36/);
  assert.match(a, /candidates\[0\]\?\.low \? 1 : 2/);
  assert.match(a, /uNativeCrew\.value = 1/);
  assert.match(a, /AI Pilly preload failed — distant crew fallback/);
  assert.match(a, /crew-wheel-and-telescope/);
});

test('AI ships only — player scheme keeps attachNativeCrew', () => {
  assert.equal((s.match(/aiPilly: scheme !== 'player'/g) || []).length, 2);
  assert.match(c, /aiPilly && AI_PILLY_CREW\) \? attachAiPillyCrew/);
  assert.match(c, /attachNativeCrew\(lod,mesh,crew,crewLow\(\)\)/);
  assert.ok(c.split('attachNativeCrew(').length - 1 >= 2);
});

test('dispose releases clones; no pet wander hooks', () => {
  assert.match(a, /states\.delete\(state\)/);
  assert.match(a, /mixer\.uncacheRoot/);
  assert.doesNotMatch(a, /followStep|makeTrail|placeBody/);
  assert.doesNotMatch(a, /function enter\(|function exit\(/);
});

test('GLB asset present and skeleton matches documented 6-bone PillRig', () => {
  const buf = readFileSync(new URL('../assets/pirates/items/v7/pet_pilly.glb', import.meta.url));
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  const joints = (json.skins?.[0]?.joints || []).map((i) => json.nodes[i]?.name);
  assert.deepEqual(joints, ['root', 'body', 'arm_R', 'arm_L', 'foot_R', 'foot_L']);
  const anims = (json.animations || []).map((x) => x.name).sort();
  assert.deepEqual(anims, ['Idle', 'Run', 'Walk', 'Wave']);
});
