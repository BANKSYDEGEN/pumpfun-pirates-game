import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {boardRefreshDue,BOARD_MIN_MS,boardDataKey} from '../js/pumpfun/boardRefresh.js';
test('no unchanged board upload storm; live data capped to 3 seconds and age labels refresh by minute',()=>{
 assert.equal(BOARD_MIN_MS,3000);assert.equal(boardRefreshDue('a','a',10000,11000),false);assert.equal(boardRefreshDue('a','b',10000,11000),false);assert.equal(boardRefreshDue('a','b',10000,13000),true);assert.equal(boardRefreshDue('a','a',10000,59000),false);assert.equal(boardRefreshDue('a','a',10000,60000),true);assert.equal(boardRefreshDue('a','a',10000,13000,1000),true);
 let at=0,rev=-1,draws=0;for(let t=100000;t<110000;t+=16){if(boardRefreshDue(rev,t,at,t)){at=t;rev=t;draws++}}assert.ok(draws<=4);
});
test('all three HQ canvas paths require camera visibility and rate budget; no filter allocation each frame',()=>{const s=readFileSync(new URL('../js/dock/pumpfun.js',import.meta.url),'utf8');for(const p of ['hq.board','dex.mesh','w.mesh'])assert.ok(s.includes('boardVisible('+p+')'));assert.ok(s.includes('boardFrustum.intersectsSphere'));assert.ok(s.includes('boardNormal.dot(boardToCamera)<=0'));assert.ok(!s.includes('walls=walls.filter'));assert.ok(!s.includes('Date.now()-hqBoardAt>200'));assert.ok(s.includes('now-boardCheckAt>=250'));});

test('new token events do not dirty prices or unrelated wall boards',()=>{const s={updated:{prices:1,bonding:2,newtokens:3},status:{},newtokens:[{mint:'a'}]};const main=boardDataKey(s,'main'),bond=boardDataKey(s,'bonding');s.updated.newtokens=4;s.newtokens=[{mint:'b'}];assert.equal(boardDataKey(s,'main'),main);assert.equal(boardDataKey(s,'bonding'),bond);s.trades={SUNK:[{id:'new'}]};assert.notEqual(boardDataKey(s,'main'),main);});
