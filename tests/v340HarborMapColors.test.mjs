// [v340] BANKSY t1801u/t1802u: Harbor map colors — other players BLACK, squad+crew GREEN, AI RED
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

test('sw.js VERSION is pfp-v340', () => {
  assert.ok(+(read('sw.js').match(/const VERSION = 'pfp-v(\d+)'/) || [])[1] >= 340);
});

test('pvp.js: Harbor squadmates green, non-squad black + flags; isHarborSquadMate exported', () => {
  const s = read('js/pvp.js');
  assert.match(s, /_hbSquad = squad/);
  assert.match(s, /_hbOther = !squad/);
  assert.match(s, /radarColor = squad \? '#2fd866' : '#0d0d10'/);
  assert.match(s, /nameEl\?\.classList\.toggle\('hb-mate', squad\)/);
  assert.match(s, /function isHarborSquadMate\(peer\)/);
  assert.match(s, /isHarborSquadMate: \(p\) => isHarborSquadMate\(p\)/);
  assert.doesNotMatch(s, /classList\.toggle\('hb-mate', hbv\)/);
  assert.doesNotMatch(s, /radarColor = hbv \? '#5ee08a'/);
});

test('main.js: peer/AI split uses net.kind===player (not radarColor green)', () => {
  const s = read('js/main.js');
  assert.match(s, /e\.net\?\.kind === 'player' \? peers : ai/);
  assert.doesNotMatch(s, /e\.radarColor === '#5ee08a' \? peers : ai/);
  assert.match(s, /squad: !!e\._hbSquad/);
  assert.match(s, /e\._hbOther \|\| e\.radarColor === '#0d0d10'/);
  assert.match(s, /dot\(e\.x, e\.z, '#0d0d10'/);
  assert.match(s, /e\._hbSquad \|\| e\.radarColor === '#2fd866'/);
  assert.match(s, /dot\(e\.x, e\.z, '#2fd866'/);
  assert.match(s, /'#fa0d0d'/);
});

test('dock/index.js: on-foot peers pass squad via isHarborSquadMate', () => {
  const s = read('js/dock/index.js');
  assert.match(s, /isHbSquadPeer\?\.\(p\)/);
  assert.match(s, /isHarborSquadMate\?\.\(p\)/);
  assert.match(s, /peers\.push\(\{ x: p\.x, z: p\.z, foot: true, squad/);
  assert.match(s, /PFP_MAP_DEMO/);
});

test('onfoot/net.js: party code pc stored on foot peers', () => {
  const s = read('js/onfoot/net.js');
  assert.match(s, /if \(typeof m\.pc === 'string'\) p\.pc = m\.pc\.slice\(0, 8\)/);
});

test('islandMap.js: black non-squad peers, green squad+crew, red AI, updated legend', () => {
  const s = read('js/islandMap.js');
  assert.match(s, /ctx\.fillStyle = '#2fd866'; ctx\.strokeStyle = '#082412'/);
  assert.doesNotMatch(s, /ctx\.fillStyle = '#33d6ff'/);
  assert.match(s, /ctx\.fillStyle = sq \? '#2fd866' : '#0d0d10'/);
  assert.match(s, /sq \? '#ffffff' : '#f5efe0'/);
  assert.match(s, /ctx\.fillStyle = '#fa0d0d'; ctx\.strokeStyle = th\.ink/);
  assert.match(s, /im-k-other[^>]*>[\s\S]*?other pirates/);
  assert.match(s, /background:#0d0d10;box-shadow:0 0 0 2px #f5efe0/);
  assert.match(s, /im-k-squad[^>]*>[\s\S]*?squad/);
  assert.match(s, /im-k-crew[^>]*>[\s\S]*?crew/);
  assert.match(s, /background:#2fd866/);
  assert.match(s, /im-k-ai[^>]*>[\s\S]*?AI ships/);
  assert.match(s, /background:#fa0d0d/);
  assert.doesNotMatch(s, /#33d6ff;transform:rotate\(45deg\)/);
});

test('pvp.js: hbPaint + hbRepaintAll on party code change', () => {
  const s = read('js/pvp.js');
  assert.match(s, /function hbPaint\(/);
  assert.match(s, /function isHbSquadPeer\(/);
  assert.match(s, /function hbRepaintAll\(/);
  assert.match(s, /hbRepaintAll\(\); if \(!silent\) harborUi/);
  assert.match(s, /joining…'; hbRepaintAll\(\)/);
});
