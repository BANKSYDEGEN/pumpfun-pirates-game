import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tokenURL} from '../js/pumpfun/links.js';
import {WATCH_TOKENS} from '../js/pumpfun/market.js';
import {PUMP_SHARE_URLS} from '../js/config.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('all three public tokens use their verified pump.fun share links; others use /coin/<mint>',()=>{for(const t of WATCH_TOKENS){assert.ok(PUMP_SHARE_URLS[t.ca],t.sym);assert.equal(tokenURL(t.ca),PUMP_SHARE_URLS[t.ca]);}const other='GDRSWpEeKWngc26CVLFXZyZCUwo9fEzctZoEAp1qpump';assert.equal(tokenURL(other),'https://pump.fun/coin/'+other+'?ref=PUMPFUNPIRATES');});
test('title and legacy island token controls never navigate to DexScreener',()=>{
 assert.match(src('js/tokenChip.js'),/tokenURL\(T.ca\)/);
 assert.ok(!src('js/tokenChip.js').includes('dex.href = T.dex'));
 assert.match(src('js/island/main.js'),/openPump\(t.ca\)/);
 assert.ok(!src('js/island/main.js').includes('<iframe title="$${sym} chart"'));
 assert.ok(!src('js/island/main.js').includes('href="${t.chart}"'));
});
