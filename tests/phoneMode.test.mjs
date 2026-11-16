// [phone-mode] BANKSY t2514u: AUTO on phones stays sharp (high-DPI, native textures); adaptive on every device. Visual, not pushed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { wantPhoneMode, phonePixelCap, adaptPlan, gfxFlags } from '../js/phoneMode.js';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('wantPhoneMode: iPhone, iPad, low-memory Android; never consoles or desktop without low mem', () => {
  assert.equal(wantPhoneMode({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605', isMobile: true }), true);
  assert.equal(wantPhoneMode({ ua: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 16_0 like Mac OS X)', isMobile: true }), true);
  assert.equal(wantPhoneMode({ ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', isMobile: true }), true);
  assert.equal(wantPhoneMode({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', isMobile: true, maxTouchPoints: 5 }), true);
  assert.equal(wantPhoneMode({ ua: 'Mozilla/5.0 (Linux; Android 14)', isMobile: true, deviceMemory: 4 }), true);
  assert.equal(wantPhoneMode({ ua: 'Mozilla/5.0 (Linux; Android 14)', isMobile: true, deviceMemory: 8 }), false);
  assert.equal(wantPhoneMode({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', isMobile: false, deviceMemory: 4 }), false);
  assert.equal(wantPhoneMode({ ua: 'Mozilla/5.0 (iPhone)', isMobile: true, isConsole: true }), false);
});

test('phonePixelCap keeps high-DPI (up to 2×), not a 1× framebuffer', () => {
  assert.equal(phonePixelCap(3), 2);
  assert.equal(phonePixelCap(2), 2);
  assert.equal(phonePixelCap(1.5), 1.5);
  assert.equal(phonePixelCap(1), 1);
});

test('adaptPlan is universal: steps down from the device cap, floor 1.25, recover quickly under 50 fps', () => {
  assert.deepEqual(adaptPlan(2).steps, [2, 1.75, 1.5, 1.25]);
  assert.deepEqual(adaptPlan(1.5).steps, [1.5, 1.25]);
  assert.equal(adaptPlan(2).min, 50);
  assert.equal(adaptPlan(2).upWaitMs, 4000);
  assert.equal(adaptPlan(2).upWindows, 3);
  assert.ok('phoneMode' in gfxFlags && 'nativeTex' in gfxFlags && 'lodBias' in gfxFlags);
});

test('AUTO on a phone-mode device stays sharp; HIGH / LOW / ?quality= still override', () => {
  const main = src('js/main.js');
  assert.match(main, /wantPhoneMode, phonePixelCap, adaptPlan, gfxFlags/);
  assert.match(main, /const PHONE_MODE = phoneModeAuto && !gfxPick && !qp/);
  assert.match(main, /PHONE_MODE \? phonePixelCap\(DPR\)/);
  assert.match(main, /gfxFlags\.nativeTex/);
  assert.match(main, /adaptPlan\(PR0/);
  assert.match(main, /ADAPT\.min = 50|min: 50|minFps: 50/);
  assert.match(main, /phoneModeAuto \? 'AUTO · PHONE' : 'AUTO'/);
  assert.match(main, /sharp \(up to 2/);
  assert.match(src('css/style.css'), /html\.pfp-phone-mode #title \.gfx-note/);
  assert.match(main, /\['low', 'LOW'\], \['high', 'HIGH'\]/);
  // no longer pins 1× or treats AUTO phone as an explicit LOW pick
  assert.doesNotMatch(main, /LOW_PICK = gfxPick === 'low' \|\| PHONE_MODE/);
});
