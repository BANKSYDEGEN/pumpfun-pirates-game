import test from 'node:test';
import assert from 'node:assert/strict';
import { createCasinoClient, createLocalCasino, diceMult, slotsMult, handTotal } from '../js/casino/engine.js';

test('payout display helpers match deployed dice bonuses and slot pairs', () => {
  assert.equal(diceMult('under7', 2, 3), 2.2);
  assert.equal(diceMult('under7', 3, 3), 2);
  assert.equal(diceMult('over7', 4, 5), 2.2);
  assert.equal(diceMult('over7', 4, 4), 2);
  assert.equal(diceMult('seven', 3, 4), 4);
  assert.equal(slotsMult(['ruby','ruby','anchor']), 0);
  assert.equal(slotsMult(['crown','crown','anchor']), 2);
  assert.equal(slotsMult(['doubloon','doubloon','anchor']), 1.5);
});

test('pending requests cannot double bet; only server balance with revision updates gold', async () => {
  let finish, calls = 0; const landed = [];
  const c = createCasinoClient({pvp: () => ({inv:{call:async () => { calls++; return new Promise(r => { finish = r; }); }}}), getGold:()=>100,
    setGold:(...v)=>landed.push(v)});
  const first = c.play('dice', {bet:10, choice:'seven'});
  await new Promise(r=>setTimeout(r,0));
  assert.equal((await c.play('dice',{bet:10,choice:'seven'})).ok,false);
  assert.equal(calls,1);
  finish({ok:true,gold:130,delta:30,rev:12,owner:true,detail:{dice:[3,4]}});
  assert.equal((await first).ok,true);
  assert.deepEqual(landed,[[130,{fromServer:true,rev:12,owner:true}]]);
});

test('no gold minting from delta-only replies and no practice replay after a dropped wager', async () => {
  let raw={ok:true,delta:500,detail:{dice:[3,4]}}, n=0;
  const c=createCasinoClient({pvp:()=>({inv:{call:async()=>{n++;return raw;}}}),getGold:()=>100,setGold:()=>assert.fail('must not invent a balance')});
  await c.play('dice',{bet:10,choice:'seven'});
  raw=null;
  const r=await c.play('dice',{bet:10,choice:'seven'});
  assert.equal(r.ok,false); assert.equal(r.mode,'live'); assert.equal(c.purse,null); assert.equal(n,2);
});

test('practice blackjack reserves gold, uses a finite shoe, stands on all 17, and settles once', () => {
  let seed=17;
  const rng=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  const c=createLocalCasino({purse:1000,rng});
  for(let i=0;i<100;i++) {
    c.gold=1000; const before=c.gold;
    let r=c.playSync({game:'blackjack',bet:50,action:'deal'});
    if(r.detail.finished) { assert.equal(c.gold,before+r.delta); continue; }
    assert.equal(c.gold,950); const id=r.state.stateId;
    assert.equal(c.playSync({game:'blackjack',bet:50,action:'deal'}).ok,false);
    r=c.playSync({game:'blackjack',action:'stand',stateId:id});
    assert.equal(c.gold,before+r.delta); assert(handTotal(r.detail.dealer)>=17);
    const all=[...r.detail.player,...r.detail.dealer].map(c=>c.r+c.s);
    assert.equal(new Set(all).size,all.length);
    const balance=c.gold;
    assert.equal(c.playSync({game:'blackjack',action:'stand',stateId:id}).ok,false);
    assert.equal(c.gold,balance);
  }
});
