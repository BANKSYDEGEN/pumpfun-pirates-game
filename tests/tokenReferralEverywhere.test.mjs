import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tokenURL} from '../js/pumpfun/links.js';
import {WATCH_TOKENS} from '../js/pumpfun/market.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('all three public tokens use the existing campaign links',()=>{for(const t of WATCH_TOKENS)assert.equal(tokenURL(t.ca),`https://pump.fun/c/${t.ca}/BANKSYDEGEN`)});
test('title and legacy island token controls never navigate to DexScreener',()=>{
 assert.match(src('js/tokenChip.js'),/tokenURL\(T.ca\)/);
 assert.ok(!src('js/tokenChip.js').includes('dex.href = T.dex'));
 assert.match(src('js/island/main.js'),/openPump\(t.ca\)/);
 assert.ok(!src('js/island/main.js').includes('<iframe title="$${sym} chart"'));
 assert.ok(!src('js/island/main.js').includes('href="${t.chart}"'));
});
