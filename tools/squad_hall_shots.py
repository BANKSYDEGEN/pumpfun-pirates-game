# Squad Hall shots: interior desktop+phone, player-list panel (fake peers), invite toast.
# python3 tools/squad_hall_shots.py
import asyncio, os, json
from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
OUT = '/workspace/squad-hall-shots'
os.makedirs(OUT, exist_ok=True)
BASE = 'http://127.0.0.1:18955/emerly-squadhall'
gy = lambda lz: 3.0 + max(0, -lz - 50) * 0.11
# hill street squad hall (town coords): door faces west; inside looking at war table
SHOTS = {
  'interior': ((16.5, -76.5, 1.7), (24.0, -76.5, 1.5), 62),
  'front': ((3.0, -76.5, 1.9), (16, -76.5, 4.5), 70),
}
CAM = """(async([c,t,fov])=>{ const CO = await import('./js/island/coast.js'); const I = ISLAND; const [cx, cz] = CO.t2w(c[0], c[1]), [tx, tz] = CO.t2w(t[0], t[1]);
  I.camera.fov = fov; I.camera.updateProjectionMatrix(); I.camera.position.set(cx, c[2], cz); if (I.controls) { I.controls.target.set(tx, t[2], tz); I.controls.update(); } I.camera.lookAt(tx, t[2], tz); window.__lock = [cx, c[2], cz, tx, t[2], tz]; })"""

PANEL_JS = """() => {
  // inject the squad hall panel with fake online pirates (no server)
  import('./js/dock/squadHall.js').then(({ createSquadHall }) => {
    const fake = [
      { n: 'Blackbeard', w: 'harbor', copy: 2 },
      { n: 'AnneBonny', w: 'harbor', copy: 1 },
      { n: 'CalicoJack', w: 'arena', mode: 'solo' },
      { n: 'MaryRead', w: 'arena', mode: 'squads' },
      { n: 'Rackham', w: 'queue', mode: 'squads' },
      { n: 'Sparrow', w: 'harbor', copy: 3 },
    ];
    const hall = createSquadHall({
      pvp: () => ({
        name: 'BANKSYDEGEN',
        where: 'harbor', mode: 'squads', roomIdx: 1,
        partyInfo: () => ({ code: 'AB12C', mate: null, msg: 'waiting for your mate…' }),
        partyMake: () => 'AB12C', partyLeave: () => {}, partyJoin: () => {},
        inv: { call: async (a) => a === 'inv_online' ? ({ ok: true, players: fake }) : a === 'squad_invites' ? ({ ok: true, invites: [] }) : ({ ok: true }) },
        joinWorld: async () => ({ ok: true, msg: 'ok' }),
      }),
      toast: () => {},
      nearby: () => ['AnneBonny'],
    });
    window.__sqHall = hall;
    hall._setOnline(fake);
    hall.open();
  });
}"""

INVITE_JS = """() => {
  const inv = document.getElementById('sq-invite');
  if (!inv) return false;
  inv.querySelector('.m').innerHTML = '<b>Blackbeard</b> invites you to party <b>AB12C</b><br><small>Harbor 2</small>';
  inv.classList.add('on');
  return true;
}"""

async def shot_device(dev):
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    mob = dev == 'phone'
    kw = dict(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width': 1600, 'height': 900})
    ctx = await b.new_context(**kw)
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}'))
    await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    pg = await ctx.new_page()
    await pg.goto(f'{BASE}/island.html?coast=1&shot&quality={"low" if mob else "high"}', wait_until='domcontentloaded')
    await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=300000)
    await pg.wait_for_timeout(5000)
    for name, (c, t, fov) in SHOTS.items():
      cc = [c[0], c[1], gy(c[1]) + c[2]]; tt = [t[0], t[1], gy(t[1]) + t[2]]
      await pg.evaluate(CAM, [cc, tt, fov]); await pg.wait_for_timeout(2800)
      path = f'{OUT}/{name}_{dev}.png'
      await pg.screenshot(path=path, type='png'); print('WROTE', path, flush=True)
    # panel over interior
    cc = [16.5, -76.5, gy(-76.5) + 1.7]; tt = [24.0, -76.5, gy(-76.5) + 1.5]
    await pg.evaluate(CAM, [cc, tt, 62]); await pg.wait_for_timeout(1500)
    await pg.evaluate(PANEL_JS); await pg.wait_for_timeout(1200)
    await pg.wait_for_selector('#sq-hall.on', timeout=15000)
    await pg.wait_for_timeout(800)
    path = f'{OUT}/panel_{dev}.png'
    await pg.screenshot(path=path, type='png'); print('WROTE', path, flush=True)
    # invite toast
    ok = await pg.evaluate(INVITE_JS); await pg.wait_for_timeout(400)
    path = f'{OUT}/invite_{dev}.png'
    await pg.screenshot(path=path, type='png'); print('WROTE', path, 'invite', ok, flush=True)
    await b.close()

async def main():
  await shot_device('desktop')
  await shot_device('phone')

asyncio.run(main())
