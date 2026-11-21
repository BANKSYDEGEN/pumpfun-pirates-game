#!/usr/bin/env node
// Headless caption-card shots for the harbor tutorial (desktop + mobile). Does not need the 3D world.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (!globalThis.localStorage) {
  const m = Object.create(null);
  globalThis.localStorage = { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } };
}
if (!globalThis.matchMedia) globalThis.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {}, removeEventListener() {}, media: '' });
if (!globalThis.location) globalThis.location = { search: '', href: 'http://127.0.0.1/', protocol: 'http:' };
if (!globalThis.document) globalThis.document = { getElementById: () => null, documentElement: { classList: { contains: () => false } }, querySelector: () => null };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.HARBOR_TUT_SHOTS || '/workspace/harbor-tut-shots';
const CHROME = process.env.CHROME || ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
  .map((c) => { try { const r = spawnSync('which', [c], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; } catch { return null; } })
  .find(Boolean);
if (!CHROME) { console.error('no chrome'); process.exit(1); }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  let rel = decodeURIComponent(u.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(err.code === 'ENOENT' ? 404 : 500); res.end(String(err.message)); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
});

const idsMod = await import(pathToFileURL(path.join(ROOT, 'js/harborTutorialSteps.js')).href);
// harborTutorialSteps imports keybinds (localStorage). Provide a tiny shim if node throws.
const ids = idsMod.HARBOR_TUT_IDS();

await new Promise((res) => server.listen(0, '127.0.0.1', res));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/tools/harbor_tut_shots.html`;
fs.mkdirSync(OUT, { recursive: true });

function shot(url, file, w, h) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox', '--disable-dev-shm-usage',
      '--force-device-scale-factor=1', `--window-size=${w},${h}`,
      '--run-all-compositor-stages-before-draw', '--virtual-time-budget=4000',
      `--screenshot=${file}`, url,
    ];
    const p = spawn(CHROME, args, { stdio: 'inherit' });
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error('chrome ' + code + ' ' + file)));
  });
}

const sizes = {
  desktop: { w: 1280, h: 800, touch: false },
  mobile: { w: 390, h: 844, touch: true },
};

for (const [kind, sz] of Object.entries(sizes)) {
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const file = path.join(OUT, `${kind}-${String(i + 1).padStart(2, '0')}-${id}.png`);
    const url = `${base}?step=${i}${sz.touch ? '&touch=1' : ''}`;
    console.log('shot', path.basename(file));
    await shot(url, file, sz.w, sz.h);
  }
}

server.close();
console.log('wrote', ids.length * 2, 'shots to', OUT);
