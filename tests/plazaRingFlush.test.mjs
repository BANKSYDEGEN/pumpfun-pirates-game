import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const r=JSON.parse(execFileSync('node',['--import','./reg.mjs','plaza_inlay_check.mjs'],{cwd:new URL('../tools/roundabout_blender/node/',import.meta.url),encoding:'utf8'}).trim().split('\n').pop());
test('fountain outer circle never projects beyond supporting plaza or creates NaN normals',()=>{assert.equal(r.escaped,0);assert.equal(r.badNormals,0);assert.ok(r.maxY<=r.ceiling+.00001)});
test('outer apron uses shared cobble palette, retaining saved editor piece order',()=>{const s=readFileSync(new URL('../js/island/areas/hillRound.js',import.meta.url),'utf8');assert.ok(!s.includes('0xb9ab92'));assert.match(s,/CylinderGeometry\(14, 14, 0.02, 56\).*0xc8bda7/);assert.match(s,/i < 64/);assert.match(s,/i < 16/);assert.match(s,/i < 8/);});
