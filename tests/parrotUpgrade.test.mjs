import test from 'node:test';
import assert from 'node:assert/strict';
import { parrotUpgradeState as state, parrotUpgradeFeedback as feedback } from '../js/inventory/parrotUpgrade.js';
test('treat estimate follows existing server XP, costs, affordability and cap',()=>{
 assert.deepEqual(state(0,250),{xp:0,lv:0,cost:250,max:false,can:true,remaining:100});
 assert.equal(state(100,999).can,false);assert.equal(state(100,1000).cost,1000);
 assert.equal(state(300,1000).remaining,100);assert.equal(state(400,10000).lv,2);
 assert.equal(state(10000,1e9).can,false);assert.equal(state(10000,1e9).max,true);
 assert.equal(state(0,undefined).can,false);
});
test('feedback reports real level progress, not an automatic level per treat',()=>{
 assert.match(feedback(0,{xp:100}),/LEVEL UP.*LV 1.*NEW COLOR UNLOCKED · RED/);
 assert.match(feedback(100,{xp:200}),/PARROT TREAT · LV 1/);
 assert.doesNotMatch(feedback(100,{xp:200}),/UNLOCKED/);
 assert.match(feedback(300,{xp:400}),/BLUE/);
 assert.match(feedback(9900,{xp:10000}),/DIAMOND/);
});
