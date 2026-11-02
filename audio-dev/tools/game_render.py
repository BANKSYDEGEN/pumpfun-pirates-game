# Render game sounds exactly as js/audio.js plays them (synth or recorded samples), offline in headless Chrome.
# Copies the worktree's js/ to /tmp/h4/js, appends a test-only __render() export (never committed), serves it locally.
# usage (python): from game_render import render; render([(outname, js_code, seconds, use_samples), ...])
import os, sys, shutil, subprocess, base64, threading, http.server, socketserver, functools, time
WT = '/workspace/pfp-sound'; H = '/tmp/h4'
HOOK = r'''
export async function __render(code, seconds, useSamples) {
  const oc = new OfflineAudioContext(2, Math.floor(44100 * seconds), 44100);
  const sv = { ctx, comp, master, sfxBus, musicBus, musicDuck, ambBus, noiseBuf, C, _liveVerb, muted, amb };
  const saved = { ...bufs }; for (const k of Object.keys(bufs)) delete bufs[k];
  if (useSamples) await Promise.all(Object.values(SAMPLES).flat().map(async n => { try { const r = await fetch(AUD + n + '.mp3'); if (r.ok) bufs[n] = await oc.decodeAudioData(await r.arrayBuffer()); } catch (e) {} }));
  ctx = new Proxy(oc, { get(t, p) { if (p === 'currentTime') return 0.3; const v = t[p]; return typeof v === 'function' ? v.bind(t) : v; } }); // t0 = 0.3 s so negative-offset ramps stay legal
  comp = makeLimiter(oc, oc.destination); master = oc.createGain(); sfxBus = oc.createGain(); musicBus = oc.createGain(); ambBus = oc.createGain(); musicDuck = oc.createGain();
  sfxBus.connect(master); musicBus.connect(musicDuck).connect(master); ambBus.connect(master); master.connect(comp);
  master.gain.value = settings.master; sfxBus.gain.value = settings.sfx; musicBus.gain.value = settings.music * 0.55; ambBus.gain.value = Math.min(1, settings.sfx * 1.1);
  noiseBuf = makeNoise(oc); _liveVerb = null; muted = false; offline = true; live();
  try { eval(code); } finally { offline = false; }
  const buf = await oc.startRendering();
  ({ ctx, comp, master, sfxBus, musicBus, musicDuck, ambBus, noiseBuf, C, _liveVerb, muted, amb } = sv);
  for (const k of Object.keys(bufs)) delete bufs[k]; Object.assign(bufs, saved);
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, b = new ArrayBuffer(44 + n * 4), v = new DataView(b);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, 44100, true); v.setUint32(28, 44100 * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
  let s = ''; const u = new Uint8Array(b); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
  return btoa(s);
}
'''
def sync():
    if os.path.exists(H + '/js'): shutil.rmtree(H + '/js')
    os.makedirs(H, exist_ok=True); shutil.copytree(WT + '/js', H + '/js')
    if not os.path.exists(H + '/assets'): os.symlink(WT + '/assets', H + '/assets')
    open(H + '/js/audio.js', 'a').write(HOOK)
    open(H + '/page.html', 'w').write('<!doctype html><script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.160.0/build/three.module.js"}}</script>'
        '<script type="module">import * as A from "./js/audio.js"; window.A = A; window.ready = true;</script>')
def render(jobs, outdir='/tmp/h4/out'):
    sync(); os.makedirs(outdir, exist_ok=True)
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Q, directory=H)); port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    from playwright.sync_api import sync_playwright
    out = {}
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required'])
        pg = b.new_page(); pg.on('pageerror', lambda e: print('PAGEERR', e))
        pg.goto(f'http://127.0.0.1:{port}/page.html'); pg.wait_for_function('window.ready === true', timeout=30000)
        for name, code, sec, samp in jobs:
            b64 = pg.evaluate('([c, s, u]) => window.A.__render(c, s, u)', [code, sec, samp])
            fn = f'{outdir}/{name}.wav'; open(fn, 'wb').write(base64.b64decode(b64)); out[name] = fn
        b.close()
    srv.shutdown(); return out
if __name__ == '__main__':
    print(render([('t_light_old', "impactSound({id:'light',vol:0.55},0.05,1)", 1.5, False)]))
