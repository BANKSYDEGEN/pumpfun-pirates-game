import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tokenURL} from '../js/pumpfun/links.js';
import {WATCH_TOKENS} from '../js/pumpfun/market.js';
import {PUMP_SHARE_URLS} from '../js/config.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('every public and discovered token uses the game caller and referral',()=>{
 assert.deepEqual(PUMP_SHARE_URLS,{});
 for(const mint of [...WATCH_TOKENS.map(t=>t.ca),'GDRSWpEeKWngc26CVLFXZyZCUwo9fEzctZoEAp1qpump'])
  assert.equal(tokenURL(mint),'https://pump.fun/coin/'+mint+'?caller=3kDkcoVoJNmrC6fe98SQU7cK1rwvGT77ouBDB871wy34&ref=PUMPFUNPIRATES');
 for(const f of ['js/config.js','js/pumpfun/links.js'])assert.ok(!src(f).includes('pump.fun/c/'));
});
test('title and legacy island token controls never navigate to DexScreener',()=>{
 assert.match(src('js/tokenChip.js'),/tokenURL\(T.ca\)/);
 assert.ok(!src('js/tokenChip.js').includes('dex.href = T.dex'));
 assert.match(src('js/island/main.js'),/openPump\(t.ca\)/);
 assert.ok(!src('js/island/main.js').includes('<iframe title="$${sym} chart"'));
 assert.ok(!src('js/island/main.js').includes('href="${t.chart}"'));
});
