import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatGoldAmount,setGoldText} from '../js/goldFormat.js';
import {fmtGold as shopGold} from '../js/shopCatalog.js';
import {fmtGold as casinoGold,fmtG} from '../js/casino/engine.js';
const text=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('gold display is en-US grouped, including millions, independent of device locale',()=>{
 for(const [n,s] of [[0,'0'],[999,'999'],[1250,'1,250'],[2500000,'2,500,000'],[-1250,'-1,250'],[10000000,'10,000,000']])assert.equal(formatGoldAmount(n),s);
 assert.equal(formatGoldAmount('2500000'),'2,500,000');
 assert.equal(shopGold(2500000),'2,500,000g');assert.equal(casinoGold(2500000),'2,500,000 GOLD');assert.equal(fmtG(1250),'1,250g');
});
test('formatting never mutates numeric values, input fields or request payloads',()=>{
 const data={gold:2500000,price:1250};formatGoldAmount(data.gold);assert.equal(data.gold,2500000);assert.equal(typeof data.gold,'number');
 const s=text('js/inventory/ui.js');assert.match(s,/max="\$\{MARKET\.maxPrice\}"/);assert.match(s,/price: \+\(a\.querySelector\('\.pr'\)\.value \|\| 0\) \| 0/);
 assert.match(text('js/casino/ui.js'),/data-c="\$\{c\}"/);
 for(const p of ['js/main.js','js/pvp.js'])assert.match(text(p),/setGoldText\(\$\('gold'\), game.gold\)/);
 assert.match(text('js/pvp.js'),/formatGoldAmount\(gold\)\} VICTORY GOLD/);
 assert.match(text('js/pvp.js'),/formatGoldAmount\(HOLDER_DAILY_GOLD\)/);
 assert.match(text('js/pvp.js'),/<td>\$\{formatGoldAmount\(r.g\)\}<\/td>/);
});

test('unchanged HUD balances do not write DOM again',()=>{let writes=0,value;const node={set textContent(v){writes++;value=v}};for(let i=0;i<1000;i++)setGoldText(node,2500000);assert.equal(writes,1);assert.equal(value,'2,500,000');setGoldText(node,2500001);assert.equal(writes,2);});
