// [v339] BANKSY t1792u "On mobile the tab refreshes and restarts me" + t1793u "optimize ... casino on mobile".
// node --test --import ./tests/helpers/threeRegister.mjs tests/v339MobileStabilityCasino.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const MAIN = read('js/main.js'), SW = read('sw.js'), BOOT = read('js/boot.js'), HULL = read('js/dock/shipHull.js'), HOUSES = read('js/dock/houses.js'), CAS = read('js/casino/ui.js'), PVP = read('js/pvp.js');

test('sw.js is pfp-v339', () => { assert.ok(+(SW.match(/const VERSION = 'pfp-v(\d+)'/) || [])[1] >= 339); });

test('WebGL context loss: preventDefault, no draws while lost, 12 s grace, no blind reload in a live session', () => {
  assert.match(MAIN, /addEventListener\('webglcontextlost', \(e\) => \{ e\.preventDefault\(\); glLost = true;/);
  assert.match(MAIN, /if \(!glLost\) \{ if \(composer\) composer\.render\(\); else renderer\.render\(scene, camera\); \}/);
  assert.match(MAIN, /\}, 12000\); \}, false\);/);
  assert.match(MAIN, /if \(game\.state === 'title' && n < 1\)/); // only the title screen may auto-reload
  assert.doesNotMatch(MAIN, /if \(n < 1 && !match\) return location\.reload\(\);/);
  assert.match(MAIN, /webglcontextrestored', \(\) => \{ glLost = false;/);
});

test('boot failsafe never reloads after boot or on benign rejections', () => {
  assert.match(BOOT, /pfp-booted/); assert.match(BOOT, /if \(booted\(\) \|\| benign\(e && e\.reason\)\) return;/);
  assert.match(BOOT, /NotAllowedError/);
});

test('Harbor auto-resume: sessionStorage snapshot, cleared on MAIN MENU / Storm Hunt / logout, resumes on boot', () => {
  assert.match(MAIN, /RESUME_KEY = 'pfp_harbor_resume_v1'/); assert.match(MAIN, /sessionStorage\.setItem\(RESUME_KEY/);
  assert.match(MAIN, /RESUME_MAX_MS = 15 \* 60 \* 1000/); assert.match(MAIN, /noresume=1/);
  assert.match(MAIN, /function toTitle\(\) \{\n  harborResumeClear\(\);/); assert.match(MAIN, /if \(mode !== 'pvp'\) harborResumeClear\(\);/);
  assert.match(MAIN, /addEventListener\('pagehide', \(\) => harborResumeSave\(true\)\)/); assert.match(MAIN, /visibilityState === 'hidden'\) harborResumeSave\(true\)/);
  assert.match(MAIN, /setTimeout\(\(\) => harborResumeBoot\(\), 0\)/); assert.doesNotMatch(MAIN.slice(MAIN.indexOf('async function harborResumeBoot'), MAIN.indexOf('async function harborResumeBoot') + 2500), /goAshoreAt|enterHull/); // [v347] t1826u: refresh = at your ship
  assert.match(PVP, /harborInfo: \(\) =>/); assert.match(PVP, /resumeServer: \(r\) =>/);
});

test('phones: no eager Captain\'s Quarters / cabin decode, 1 Draco worker, _lo maps, anisotropy 1, GPU freed on leave', () => {
  assert.match(HULL, /if \(!QUARTERS_LOW_MEM\) preloadQuartersGlb\(\);/); assert.match(HULL, /if \(QUARTERS_LOW_MEM\) draco\.setWorkerLimit\(1\);/);
  assert.match(HULL, /assets\/ships\/kit\/\$\{k\}_lo\.jpg/); assert.match(HULL, /const Q_ANISO = QUARTERS_LOW_MEM \? 1 : 8;/);
  assert.match(HULL, /if \(QUARTERS_LOW_MEM\) releaseQuartersAssets\(\);/); assert.match(HULL, /export function releaseQuartersAssets\(\)/);
  assert.doesNotMatch(HULL, /anisotropy = 8/);
  assert.match(HOUSES, /preloadCabinAssets\(\{ boot: true \}\)/); assert.match(HOUSES, /if \(boot && HOUSES_LOW_MEM\) return;/);
  assert.match(HOUSES, /deck_d_lo\.jpg/); assert.match(HOUSES, /disposeRoom\(interior\)/); assert.doesNotMatch(HOUSES, /anisotropy = 8/);
});

test('sw install: old caches opened once, pooled copies, phones skip heavy art incl. captains_quarters.glb', () => {
  assert.match(SW, /const oldCaches = await Promise\.all\(/); assert.match(SW, /const POOL = [6-8];/);
  assert.doesNotMatch(SW, /await Promise\.all\(ASSETS\.map/); assert.match(SW, /captains_quarters\\\.glb\$\/\.test\(u\)/);
  assert.match(SW, /if \(shellFail\) throw/);
});

test('mobile casino: no backdrop blur on phones, touch-action, portrait 4-up tabs + fluid roulette grid, landscape merged bar', () => {
  assert.match(CAS, /@media \(pointer:coarse\),\(max-width:720px\),\(max-height:540px\)\{\.cas-ov\{backdrop-filter:none/);
  assert.match(CAS, /touch-action:manipulation/); assert.match(CAS, /overscroll-behavior:contain/);
  assert.match(CAS, /@media \(max-width:600px\)\{/); assert.match(CAS, /@media \(max-height:540px\) and \(min-width:560px\)\{/);
  assert.ok((CAS.match(/grid-template-columns:repeat\(13,minmax\(0,1fr\)\)/g) || []).length >= 2);
  assert.ok((CAS.match(/\.cas-tabs\{grid-area:tabs;display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/g) || []).length === 1);
  // the phone rules come AFTER the old 720 px rule (else its fixed 22 px board columns win)
  assert.ok(CAS.indexOf('@media (max-width:600px){') > CAS.indexOf('@media (max-width:720px){'));
  assert.match(CAS, /class="cas-ts">\$\{esc\(SHORT\[g\]\)\}/);
});
