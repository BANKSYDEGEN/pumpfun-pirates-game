# turntable frames + 8-angle contact sheets from the real ship compiler (tools/ship_viewer.html)
import asyncio, json, sys, os, math
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
ORBIT = """(a)=>{ const [yaw, pitch, k, ty] = a; const s = V.ship, T = V.THREE; const box = new T.Box3().setFromObject(s); const c = box.getCenter(new T.Vector3()), z = box.getSize(new T.Vector3());
  const R = Math.max(z.x, z.y, z.z) * k; const o = s.position; const tgt = [c.x - o.x, c.y - o.y - z.y * ty, c.z - o.z];
  V.cam([tgt[0] + Math.sin(yaw) * Math.cos(pitch) * R, tgt[1] + Math.sin(pitch) * R, tgt[2] + Math.cos(yaw) * Math.cos(pitch) * R], tgt, 30); }"""
async def main():
    mode, tree, out = sys.argv[1], sys.argv[2], sys.argv[3]; os.makedirs(out, exist_ok=True)
    size = int(os.environ.get('TT_SIZE', '1080')); qual = os.environ.get('TT_Q', 'high')
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = await b.new_page(viewport={'width': size, 'height': size}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'http://127.0.0.1:18952/{tree}/tools/ship_viewer.html?quality={qual}', timeout=120000)
        await pg.wait_for_function('window.V_READY', timeout=120000)
        if mode == 'tt':  # two full turns: level 0, then max cannons
            f = 0; N = int(os.environ.get('TT_N', '150'))
            for cfg in json.loads(os.environ.get('TT_CFGS', '[{"levels": {}}, {"levels": {"cannons": 8}}]')):
                await pg.evaluate('(c)=>V.show(c)', cfg)
                for i in range(N):
                    yaw = 0.5 + 2 * math.pi * i / N
                    await pg.evaluate(ORBIT, [yaw, 0.2, 2.1, -0.02]); await pg.evaluate('()=>V.step(1/30)')
                    await pg.screenshot(path=f'{out}/{f:04d}.jpg', type='jpeg', quality=92); f += 1
        else:  # contact sheet frames: 8 angles of each config in argv[4]
            cfg = json.loads(sys.argv[4]); tag = sys.argv[5]
            await pg.evaluate('(c)=>V.show(c)', cfg)
            for i in range(8):
                yaw = 2 * math.pi * i / 8
                await pg.evaluate(ORBIT, [yaw, 0.16, 1.85, 0.04])
                for _ in range(8): await pg.evaluate('()=>V.step(1/30)')
                await pg.screenshot(path=f'{out}/{tag}_{i}.jpg', type='jpeg', quality=93)
        print(mode, tree, 'errors', errs[:5], flush=True)
asyncio.run(main())
