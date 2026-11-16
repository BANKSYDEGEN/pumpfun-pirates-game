import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPixelRatio, sceneSamples, PIXEL_BUDGET } from '../js/graphicsBudget.js';
test('HIGH is capped at 2× and by the QHD pixel budget before first island upload', () => {
  assert.equal(renderPixelRatio(1280,720,2), 2);
  assert.equal(+renderPixelRatio(1920,1080,2).toFixed(4), +(Math.sqrt(PIXEL_BUDGET.standard / (1920*1080))).toFixed(4));
  assert.equal(+renderPixelRatio(3840,2160,2).toFixed(4), +(Math.sqrt(PIXEL_BUDGET.standard / (3840*2160))).toFixed(4));
  assert.equal(renderPixelRatio(1280,720,1), 1);
  assert.equal(renderPixelRatio(390,844,1.5), 1.5);
  assert.equal(renderPixelRatio(390,844,2), 2);
  for (const [w,h] of [[1280,720],[1920,1080],[3840,2160],[5120,2880]]) {
    const r = renderPixelRatio(w,h,3); assert.ok(w*h*r*r <= PIXEL_BUDGET.standard+1);
  }
});
test('ULTRA is still explicit and has its own bounded budget', () => {
  assert.equal(renderPixelRatio(1280,720,2,true),2);
  assert.equal(renderPixelRatio(3840,2160,2,true),1);
  assert.equal(sceneSamples(),2); assert.equal(sceneSamples(true),4);
});
