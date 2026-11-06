#!/usr/bin/env python3
"""Headless Playwright shots for v333 hull UX. Port 18934 — never pkill chrome."""
import asyncio, os, http.server, socketserver, threading
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path('/workspace/emerly-v333-hull-backend')
OUT = Path('/workspace/v333-hull-shots')
OUT.mkdir(parents=True, exist_ok=True)
PORT = 18934
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

# Minimal mock page: dock/sea bars + Three.js Captain's Quarters interior
HTML = r'''<!doctype html>
<html><head>
<meta charset="utf-8"/>
<title>v333 hull shots</title>
<style>
html,body{margin:0;background:#0b1620;color:#ffcd77;font-family:'Just Another Hand',cursive,system-ui}
#dk-acts{position:fixed;left:50%;bottom:48px;transform:translateX(-50%);z-index:8;display:flex;gap:10px}
#dk-acts button{font:26px 'Just Another Hand',cursive;letter-spacing:.05em;padding:10px 20px 7px;border-radius:14px;border:3px solid #ffcd77;background:rgba(22,22,22,.86);color:#ffcd77}
#dk-acts button.primary{background:#fa0d0d;color:#fff}
#dk-acts kbd{font:16px system-ui;background:#ffcd77;color:#161616;border-radius:5px;padding:1px 6px;margin-right:8px}
#hs-panel{position:fixed;inset:0;z-index:64;display:none;align-items:center;justify-content:center;background:rgba(10,7,4,.72)}
#hs-panel.on{display:flex}
#hs-panel .hs-box{width:min(720px,92vw);background:linear-gradient(#2a1a0c,#1a1008);border:3px solid #ffcd77;border-radius:16px;padding:14px}
#hs-panel .hs-head{font-size:30px;color:#ffcd77;margin-bottom:8px}
#hs-panel .hs-cols{display:flex;gap:12px}
#hs-panel .hs-col{flex:1;min-height:180px;border:2px dashed rgba(255,205,119,.4);border-radius:10px;padding:8px}
#c{position:fixed;inset:0;z-index:1}
#tag{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:9;font-size:28px;text-shadow:0 2px 8px #000}
</style></head>
<body>
<div id="tag"></div>
<div id="dk-acts"></div>
<canvas id="c"></canvas>
<div id="hs-panel"><div class="hs-box">
  <div class="hs-head"><span>⚓ CAPTAIN'S CHEST</span></div>
  <div class="hs-cols">
    <div class="hs-col"><h4>🎒 YOUR BACKPACK</h4><div>gold_bar x2<br>cutlass</div></div>
    <div class="hs-col"><h4>🧰 SHIP CARGO <small>2/12</small></h4><div>gold_bar x3<br>wpn:sword:cutlass:rare</div></div>
  </div>
</div></div>
<script type="importmap">{"imports":{"three":"./vendor/three.module.js","three/addons/":"./vendor/addons/"}}</script>
<script type="module">
import * as THREE from 'three';
import { buildCaptainsQuartersRoom } from './js/dock/shipHull.js';

const acts = document.getElementById('dk-acts');
const tag = document.getElementById('tag');
const panel = document.getElementById('hs-panel');
function setActs(list, label) {
  tag.textContent = label || '';
  acts.innerHTML = '';
  for (const a of list) {
    const b = document.createElement('button');
    if (a.primary) b.classList.add('primary');
    b.innerHTML = (a.key ? `<kbd>${a.key}</kbd>` : '') + a.label;
    acts.appendChild(b);
  }
}
window.__shot = async (mode) => {
  document.getElementById('c').style.display = mode === 'interior' ? 'block' : 'none';
  panel.classList.toggle('on', mode === 'interior');
  if (mode === 'dock') setActs([
    { label: 'GO ASHORE', key: 'E', primary: true },
    { label: 'SET SAIL', key: 'W' },
    { label: 'ENTER HULL', key: 'H' },
  ], '⚓ MOORED · HARBOR DOCK');
  if (mode === 'sea') setActs([
    { label: 'ENTER HULL', key: 'E', primary: true },
    { label: 'LAUNCH CANOE', key: 'Q' },
    { label: 'WEIGH ANCHOR', key: 'W' },
  ], '⚓ ANCHORED · OPEN SEA');
  if (mode === 'interior') {
    setActs([
      { label: 'OPEN STORAGE', key: 'E', primary: true },
      { label: 'LEAVE HULL', key: 'Q' },
    ], "⚓ CAPTAIN'S QUARTERS");
    // render room
    const canvas = document.getElementById('c');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.setPixelRatio(1);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x120c08);
    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
    const room = buildCaptainsQuartersRoom({ low: true });
    scene.add(room);
    camera.position.set(0, 2.2, 4.2);
    camera.lookAt(0, 1.4, -1.5);
    renderer.render(scene, camera);
    // slight settle
    await new Promise(r => setTimeout(r, 200));
    renderer.render(scene, camera);
  }
  return true;
};
window.__ready = true;
</script>
</body></html>
'''

# Need three vendor for import — symlink from node_modules or existing
def ensure_vendor():
    vend = ROOT / 'vendor'
    vend.mkdir(exist_ok=True)
    # Prefer existing three in the project via import map pointing to js that already works —
    # The game uses importmap from index.html. Copy approach: serve from ROOT and reuse game's three URL.
    pass

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)
    def log_message(self, *a): pass

def serve():
    # Write shot page into ROOT
    (ROOT / 'v333_hull_shot.html').write_text(HTML)
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), Handler)
    httpd.allow_reuse_address = True
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd

async def main():
    # Fix HTML to use the same three path the game uses
    html = HTML.replace(
        '{"imports":{"three":"./vendor/three.module.js","three/addons/":"./vendor/addons/"}}',
        open(ROOT / 'index.html').read().split('importmap')[1].split('</script>')[0].split('>',1)[-1] if False else
        '{"imports":{"three":"https://unpkg.com/three@0.170.0/build/three.module.js","three/addons/":"https://unpkg.com/three@0.170.0/examples/jsm/"}}'
    )
    # Prefer local three if present
    for cand in [
        ROOT / 'node_modules/three/build/three.module.js',
        Path('/workspace/pumpfun-pirates-game/node_modules/three/build/three.module.js'),
    ]:
        if cand.exists():
            # serve via relative path from ROOT
            rel = os.path.relpath(cand, ROOT) if cand.is_relative_to(ROOT) else None
            break
    # Check how game imports three
    idx = (ROOT / 'index.html').read_text()
    import re
    m = re.search(r'<script type="importmap">(\s*\{.*?\})\s*</script>', idx, re.S)
    if m:
        imap = m.group(1)
        html = HTML.replace(
            '{"imports":{"three":"./vendor/three.module.js","three/addons/":"./vendor/addons/"}}',
            imap.strip()
        )
    (ROOT / 'v333_hull_shot.html').write_text(html)
    httpd = serve()
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        ctx = await browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        page = await ctx.new_page()
        await page.goto(f'http://127.0.0.1:{PORT}/v333_hull_shot.html', wait_until='domcontentloaded', timeout=120000)
        await page.wait_for_function('window.__ready === true', timeout=120000)

        await page.evaluate('window.__shot("dock")')
        await page.wait_for_timeout(400)
        path = OUT / '1_dock_enter_hull_buttons.png'
        await page.screenshot(path=str(path), type='png')
        print('WROTE', path, flush=True)

        await page.evaluate('window.__shot("sea")')
        await page.wait_for_timeout(400)
        path = OUT / '2_sea_anchored_enter_hull_canoe.png'
        await page.screenshot(path=str(path), type='png')
        print('WROTE', path, flush=True)

        await page.evaluate('window.__shot("interior")')
        await page.wait_for_timeout(1200)
        path = OUT / '3_captains_quarters_interior_and_storage.png'
        await page.screenshot(path=str(path), type='png')
        print('WROTE', path, flush=True)

        await browser.close()
    httpd.shutdown()

asyncio.run(main())
