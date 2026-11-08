import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const main = read('js/main.js'), hull = read('js/dock/shipHull.js');
test('transitions avoid hidden island rebuilds, forced gear clones and realtime island light variants', () => {
  assert.match(read('js/dock/index.js'), /if \(!shipHull\?\.inHull && !houses\?\.inHouse\) world.update/);
  assert.match(read('js/onfoot/followers.js'), /function enter\(\) \{\n    redress\(\)/);
  const foot = read('js/island/foot.js');
  assert.match(foot, /if \(realLights\) for/);
  assert.match(foot, /light: L.opts.light && realLights/);
  assert.match(main, /graphicsLastFrame = performance.now\(\); graphicsFrameSeen = true/);
  assert.match(hull, /else releaseQuartersGpu\(\)/);
  assert.match(hull, /for \(const t of textures\) t\?\.dispose/);
});
test('actual loss and missing-event watchdog recover once in LOW without overwriting saved graphics; loop bounded', () => {
  const code = main.slice(main.indexOf('let glLost ='), main.indexOf('renderer.toneMapping ='));
  const saved = new Map(); let reloads = 0;
  for (let boot = 0; boot < 3; boot++) {
    const events = {}, timers = []; let now = 0, notice, interval, lost = false;
    const canvas = { addEventListener: (n,f) => events[n] = f, dispatchEvent: e => events[e.type](e) };
    vm.runInNewContext(code, { Number, JSON, Error, Date, Event, GFX_KEY:'pfp_gfx', quality:'high',
      performance:{ now:()=>now }, window:{},
      sessionStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},
      localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},
      canvas, renderer:{info:{memory:{geometries:12,textures:6},programs:[]},getContext:()=>({isContextLost:()=>lost})},
      document:{hidden:false,addEventListener(){},getElementById:()=>notice,
        createElement:()=>({style:{},setAttribute(){},remove(){}}), body:{appendChild:b=>notice=b}},
      setInterval:f=>interval=f, setTimeout:f=>{timers.push(f);return timers.length}, clearTimeout(){},
      harborResumeSave(){}, location:{reload:()=>reloads++} });
    if (boot===0) { lost=true; interval(); } // Chrome omitted the native event
    else { const e=new Event('webglcontextlost',{cancelable:true}); canvas.dispatchEvent(e); assert.ok(e.defaultPrevented); }
    assert.ok(notice); assert.equal(saved.get('pfp_gfx'),undefined);
    assert.equal(saved.get('pfp_ctx_last_loss'),undefined);
    timers.shift()();
    if(boot===2) assert.match(notice.textContent,/GRAPHICS PAUSED/);
  }
  assert.equal(reloads,2);
});

test('a long island build is not a lost WebGL context and must not reload', () => {
  const code = main.slice(main.indexOf('let glLost ='), main.indexOf('renderer.toneMapping ='));
  let interval, notices = 0, saves = 0;
  const context = vm.createContext({ Number, JSON, Error, Date, Event, quality: 'high',
    performance: { now: () => 20000 }, window: {},
    canvas: { addEventListener() {}, dispatchEvent() { throw Error('healthy context treated as lost'); } },
    renderer: { getContext: () => ({ isContextLost: () => false }) },
    document: { hidden: false, addEventListener() {}, getElementById() {},
      createElement() { notices++; }, body: { appendChild() {} } },
    setInterval: f => interval = f, setTimeout() {}, clearTimeout() {},
    harborResumeSave() { saves++; }, location: { reload() { throw Error('unexpected reload'); } } });
  vm.runInContext(code, context);
  vm.runInContext('graphicsFrameSeen = true; graphicsLastFrame = 0; graphicsVisibleAt = 0;', context);
  interval();
  assert.equal(notices, 0); assert.equal(saves, 0);
});
