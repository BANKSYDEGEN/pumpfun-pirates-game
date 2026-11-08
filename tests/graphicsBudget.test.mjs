import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPixelRatio, sceneSamples } from '../js/graphicsBudget.js';
test('ordinary HIGH is capped before first island upload, even at 4K/Windows scaling', () => {
  assert.equal(renderPixelRatio(1280,720,2), 1.5);
  assert.equal(renderPixelRatio(1920,1080,2), 1);
  assert.equal(renderPixelRatio(3840,2160,2), .5);
  assert.equal(renderPixelRatio(1280,720,1), 1);
  assert.equal(renderPixelRatio(390,844,1.5), 1.5);
  for (const [w,h] of [[1280,720],[1920,1080],[3840,2160],[5120,2880]]) {
    const r = renderPixelRatio(w,h,3); assert.ok(w*h*r*r <= 1920*1080+1);
  }
});
test('ULTRA is still explicit and has its own bounded budget', () => {
  assert.equal(renderPixelRatio(1280,720,2,true),2);
  assert.equal(renderPixelRatio(3840,2160,2,true),1);
  assert.equal(sceneSamples(),2); assert.equal(sceneSamples(true),4);
});
