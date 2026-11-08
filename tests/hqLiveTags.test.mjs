import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMarketFeed } from '../js/pumpfun/market.js';
import { ageLabel, markRows } from '../js/pumpfun/liveui.js';
test('PumpPortal opens across island without polling HTTP and closes on world exit', async()=>{let opened=0,closed=0,http=0;const socket=()=>{opened++;return {close(){closed++;}}};const f=makeMarketFeed({storage:null,portalSocket:socket,fetcher:()=>{http++;throw Error('unexpected')}});await f.tick(false,false,true);await f.tick(false,false,true);assert.equal(opened,1);assert.equal(http,0);await f.tick(false,false,false);assert.equal(closed,1);});
test('live age ticks in seconds and flashes only new or changed values',()=>{assert.equal(ageLabel(1000,6000),'updated 5s ago');assert.equal(ageLabel(null,6000),'Feed offline');const s={trending:[{mint:'a',price:1}]};markRows(s,'trending',[{mint:'a',price:1}],5000);assert.equal(s.flashes.trending.a,undefined);markRows(s,'trending',[{mint:'a',price:2},{mint:'b',price:3}],5000);assert.equal(s.flashes.trending.a,7500);assert.equal(s.flashes.trending.b,7500);});
