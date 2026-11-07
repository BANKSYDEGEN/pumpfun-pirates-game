// [v280 crew holes] V6 shore crew / mannequins: hairRim on V6 (V5 heads spliced in), classic pants cover on shore followers,
// ship gear bake stays on V5 Low, &crewholes=0 restores the old skip. CREW_EXTRA_SLOTS stays [].
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const glb = readFileSync(new URL('../js/pirateGLB.js', import.meta.url), 'utf8');
const crew = readFileSync(new URL('../js/crewV4.js', import.meta.url), 'utf8');
const fol = readFileSync(new URL('../js/onfoot/followers.js', import.meta.url), 'utf8');
const net = readFileSync(new URL('../js/onfoot/net.js', import.meta.url), 'utf8');
const thumbs = readFileSync(new URL('../js/gearThumbs.js', import.meta.url), 'utf8');

test('prepV5Body hairRim runs on V6 unless &crewholes=0', () => {
  assert.match(glb, /crewholes=0/);
  assert.match(glb, /skipV6 && o\.userData\?\.v6/);
  assert.doesNotMatch(glb, /_tint && !o\.userData\?\.v6\) hairRim/);
});
test('PirateGLB accepts body:\'v5\'; ship gear bake uses it', () => {
  assert.match(glb, /body = null/);
  assert.match(glb, /body === 'v5'/);
  assert.match(crew, /PirateGLB\.create\(\{ female: sex === 'f', lod: 'lo', body: 'v5'/);
});
test('shore crew respect the underwear / empty pants choice; CREW_EXTRA_SLOTS stays empty', () => {
  assert.match(crew, /export function shoreCrewGear/);
  assert.match(crew, /export function shoreCrewGear\(gear\) \{ return crewGearOf\(gear\); \}/);
  assert.doesNotMatch(crew, /pants: 'classic_pants'/);
  assert.match(crew, /export const CREW_EXTRA_SLOTS = \[\]/);
  assert.match(fol, /shoreCrewGear\(\{ \.\.\.crewGear\(\), \.\.\.crewWeaponsOf\(getLocalGear\(\)\) \}\)/);   // [crew-weapons] + the captain's weapons
  assert.match(net, /shoreCrewGear\(\{ \.\.\.crewGear\(/);
});
test('mannequin covers waist with classic pants unless pants/boots card', () => {
  assert.match(thumbs, /pants: 'classic_pants'/);
  assert.match(thumbs, /slot !== 'pants' && slot !== 'boots'/);
});
test('V6 hi body material is DoubleSide; eyes FrontSide + glossy', () => {
  assert.match(glb, /side: isFace \? THREE\.FrontSide : THREE\.DoubleSide/);
  assert.match(glb, /roughness: isFace \? 0\.22 : 0\.42/);
  assert.match(glb, /MeshPhysicalMaterial/);
  assert.match(glb, /bumpScale: isFace \? 0\.0 : 0\.0035/);
  assert.match(glb, /k === 'v5eyes'/);
});
