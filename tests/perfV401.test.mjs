import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {animStep,setOptCamera} from '../js/opt.js';
const main=fs.readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
test('mobile cap and no HDR/shadow pipeline even on an explicit HIGH pick',()=>{
  assert.match(main,/CONSOLE \? 1.25 : isMobile \? 1.5 : 2/);
  assert.match(main,/const HIGH = quality === 'high' && !isMobile/);
  assert.match(main,/renderTarget1.samples = 0; composer.renderTarget1.depthBuffer = false/);
  assert.match(main,/composer.readBuffer = composer.renderTarget2; composer.writeBuffer = composer.renderTarget1; composer.render/);
});
test('hidden ancestor stops pirate facial, accessory and skeletal updates',()=>{
 const src=fs.readFileSync(new URL('../js/pirates.js',import.meta.url),'utf8');
 const expr=src.match(/const inScene = (.*);/)[1];
 const visible=Function('return ('+expr+')')();
 const scene={isScene:true,visible:true}, area={parent:scene,visible:false};
 const root={parent:area,visible:true};
 assert.equal(visible(root),false);area.visible=true;assert.equal(visible(root),true);
});
test('distance animation accumulates actual elapsed time across skipped frames',()=>{
 const camera=new THREE.PerspectiveCamera();camera.position.set(0,0,0);setOptCamera(camera);
 const root=new THREE.Group();root.position.set(50,0,0);const pirate={root};
 assert.equal(animStep(pirate,.01),0);assert.equal(animStep(pirate,.04),.05);
 root.position.set(100,0,0);pirate._opt={acc:0,n:0};
 assert.equal(animStep(pirate,.01),0);assert.equal(animStep(pirate,.02),0);assert.equal(animStep(pirate,.03),0);assert.equal(animStep(pirate,.04),.1);
});
