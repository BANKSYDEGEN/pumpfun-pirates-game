#!/usr/bin/env python3
# [zipline-shoot] headless verification: ride / aim / fire mid-zipline
import asyncio, os, sys
from pathlib import Path
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw, ImageFont

ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist', '--no-sandbox']
BASE = os.environ.get('ZIP_SHOOT_URL', 'http://127.0.0.1:18995')
OUT = Path(os.environ.get('ZIP_SHOOT_OUT', '/workspace/brand/zipline_shoot'))
OUT.mkdir(parents=True, exist_ok=True)

BOOT = """
try {
  localStorage.setItem('pfp_name','ZIP_SHOOT_QA');
  localStorage.setItem('pfp_tut_seen','1');
  localStorage.setItem('pfp_tutorial_v1','1');
  localStorage.setItem('pfp_tutorial_off','1');
  localStorage.setItem('pfp_gfx_hint','1');
} catch (e) {}
"""

async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    print('chrome pid', getattr(getattr(b, 'process', None), 'pid', '?'), flush=True)
    ctx = await b.new_context(service_workers='block', viewport={'width': 1280, 'height': 800})
    await ctx.route('**/*supabase.co/**', lambda r: r.abort())
    await ctx.add_init_script(BOOT)
    pg = await ctx.new_page()
    # safezones=0 so GUN stance can be drawn on the summit for QA framing
    url = f'{BASE}/index.html?quality=high&safezones=0'
    print('goto', url, flush=True)
    await pg.goto(url, wait_until='domcontentloaded', timeout=300000)
    await pg.wait_for_function('window.PFP && PFP.renderer', timeout=400000)
    await pg.wait_for_timeout(600)
    await pg.click('#btn-pvp')
    await pg.wait_for_function('PFP.dock && PFP.dock.on', timeout=240000)
    await pg.evaluate("document.getElementById('pvp-entry-go')?.click()")
    await pg.wait_for_timeout(1200)
    await pg.evaluate("""() => {
      PFP.game.stormOverride = 0; PFP.game.storm = 0;
      const d = PFP.dock;
      for (const ber of d.layout.berths) { d.dockAt(ber.id); if (d.docking.mode !== 'sea') break; }
    }""")
    await pg.wait_for_function("PFP.dock.docking.mode==='docked'", timeout=600000)
    await pg.evaluate('PFP.dock.goAshore()')
    await pg.wait_for_function('PFP.dock.onFoot', timeout=600000)
    await pg.wait_for_timeout(800)

    await pg.evaluate("""() => {
      try {
        const S = window.PFP_ISLAND_SHOP;
        if (S?.setShopProvider) S.setShopProvider(S.mockProvider({
          owner: true, gold: 999999,
          owned: { skins: ['classic'], gear: ['musket:navy', 'sword:cutlass'] },
          equipped: { skin: 'classic', gear: { musket: 'navy', sword: 'cutlass', hat: 'none', outfit: 'none', cape: 'none', eyes: 'plain', hook: 'none', leg: 'none', face: 'none', parrot: 'none' } }
        }));
        if (window.PFP_GEAR?.setLocalGear) PFP_GEAR.setLocalGear({ musket: 'navy', sword: 'cutlass' });
      } catch (e) { console.warn('gear', e); }
    }""")
    await pg.wait_for_timeout(500)

    info = await pg.evaluate("""() => {
      const z = PFP.dock.zipline; if (!z) return { err: 'no zipline' };
      const spot = (z.spots || []).find(s => s.lineId === 'waterfall_skull' && s.end === 'A')
        || (z.spots || []).find(s => s.kind === 'zipline');
      if (!spot) return { err: 'no spot', spots: (z.spots || []).map(s => s.id) };
      const w = PFP.dock.walker.w;
      w.x = spot.x; w.z = spot.z; w.y = PFP.dock.world.ground(spot.x, spot.z) + 0.2;
      w.yaw = w.camYaw = 0; PFP.dock.walker.snapCam?.();
      const ok = z.start(spot);
      // draw GUN after ride starts (safezones=0)
      PFP.dock.battle?.setStance?.(2);
      return { ok, id: spot.id, lineId: spot.lineId, end: spot.end, riding: !!z.riding,
        zone: PFP.dock.battle?.zone, stance: PFP.dock.battle?.stance };
    }""")
    print('start', info, flush=True)
    assert info.get('ok'), info
    await pg.wait_for_function('PFP.dock.zipline?.riding', timeout=30000)

    # Let the ride enter slide; keep forcing GUN
    await pg.wait_for_function("""() => {
      if (PFP.dock.battle?.stance !== 2) PFP.dock.battle?.setStance?.(2);
      const st = PFP.dock.zipline?.state;
      return st && (st.ph === 'slide' || (st.ph === 'lift' && st.t === 0 && (performance.now()/1000 - (PFP.dock.zipline.state && 0)) ));
    }""", timeout=20000)
    # hard wait past lift (0.7s) into slide with gun drawn
    for _ in range(20):
      await pg.evaluate("PFP.dock.battle?.setStance?.(2)")
      await pg.wait_for_timeout(100)
    await pg.wait_for_function("PFP.dock.zipline?.state?.ph === 'slide' || PFP.dock.zipline?.state?.ph === 'lower'", timeout=30000)

    st = await pg.evaluate("""() => {
      const z = PFP.dock.zipline, w = PFP.dock.walker.w, b = PFP.dock.battle;
      const zp = b?.rig?.v4?._zip;
      return {
        riding: !!z.riding, ph: z.state?.ph, t: z.state?.t, zone: b?.zone, stance: b?.stance,
        zipAim: !!w.zipAim, free: zp?.free || null, zipW: zp ? +zp.w.toFixed(2) : null,
        y: +w.y.toFixed(2), camHook: !!w.camHook, musket: !!b?.rig?.musket?.visible
      };
    }""")
    print('mid', st, flush=True)

    # QA three-quarter framing for ride (live cam restored for aim/fire)
    await pg.evaluate("""() => {
      const w = PFP.dock.walker.w, c = PFP.camera, yaw = w.yaw;
      w._qaAds = false;
      const live = w.camHook;
      w._qaLive = live;
      w.camHook = (dt) => {
        if (w._qaAds) { const fn = w._qaLive || live; if (fn) return fn(dt); return; }
        const a = yaw + Math.PI * 0.55, dist = 4.2;
        c.position.set(w.x + Math.sin(a) * dist, w.y + 1.9, w.z + Math.cos(a) * dist);
        c.lookAt(w.x, w.y + 1.1, w.z);
      };
    }""")
    await pg.wait_for_timeout(400)
    await pg.screenshot(path=str(OUT / '01_ride.png'))
    print('shot 01_ride', flush=True)

    # Aim ADS — force GUN + adsHeld; hand camera back to TPS
    await pg.evaluate("""() => {
      const w = PFP.dock.walker.w;
      PFP.dock.battle.setStance(2);
      w._qaAds = true;
      const t = PFP.dock.battle.tps;
      if (t?.st) t.st.adsHeld = true;
      // re-enable shoulder cam if TPS already on
      if (t?.on && t.st && !w.camHook) {
        // tps.set path: poke off/on via tick next frames; adsHeld is enough for zoom on PC
        t.st.ads = Math.max(t.st.ads, 0.85);
      }
    }""")
    for _ in range(40):
      await pg.evaluate("""() => {
        PFP.dock.battle?.setStance?.(2);
        const t = PFP.dock.battle?.tps?.st; if (t) { t.adsHeld = true; t.ads = Math.min(1, t.ads + 0.2); }
      }""")
      await pg.wait_for_timeout(40)
    aim = await pg.evaluate("""() => {
      const w = PFP.dock.walker.w, b = PFP.dock.battle, zp = b?.rig?.v4?._zip, t = b?.tps?.st;
      return {
        zone: b.zone, stance: b.stance, ads: t?.ads ?? 0, tpsOn: !!b.tps?.on,
        zipAim: !!w.zipAim, free: zp?.free ?? null, zipW: zp ? +zp.w.toFixed(2) : null,
        camHook: !!w.camHook, musket: !!b.rig?.musket?.visible, y: +w.y.toFixed(2)
      };
    }""")
    print('aim', aim, flush=True)
    await pg.wait_for_timeout(700)
    await pg.screenshot(path=str(OUT / '02_aim.png'))
    print('shot 02_aim', flush=True)

    fired = await pg.evaluate("""() => {
      const b = PFP.dock.battle;
      b.setStance(2);
      // ensure loaded
      if (b.me) { b.me.cool = 0; b.me.down = 0; }
      const ok = b.attack();
      return { ok, cool: b.me?.cool, kind: b.me?.kind, fireAt: b.me?.fireAt, zone: b.zone };
    }""")
    print('fire', fired, flush=True)
    await pg.wait_for_timeout(320)
    await pg.screenshot(path=str(OUT / '03_shoot.png'))
    print('shot 03_shoot', flush=True)

    paths = [OUT / f for f in ('01_ride.png', '02_aim.png', '03_shoot.png')]
    imgs = [Image.open(p).convert('RGB') for p in paths]
    labels = ['RIDE (hang)', 'AIM (ADS + one-hand grip)', 'SHOOT (muzzle / tracer)']
    tw, th = 1280, 800
    sheet = Image.new('RGB', (tw, th * 3 + 48), (12, 12, 14))
    draw = ImageDraw.Draw(sheet)
    try:
      font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 28)
      font2 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
    except Exception:
      font = ImageFont.load_default(); font2 = font
    draw.text((24, 10), 'ZIPLINE AIM + SHOOT  ·  raul/zipline-shoot', fill=(245, 197, 66), font=font)
    for i, (im, lab) in enumerate(zip(imgs, labels)):
      y0 = 48 + i * th
      sheet.paste(im.resize((tw, th)), (0, y0))
      draw.rectangle([0, y0, tw, y0 + 36], fill=(0, 0, 0))
      draw.text((16, y0 + 6), lab, fill=(255, 255, 255), font=font2)
    sheet_path = OUT / 'SHEET_zipline_aim_shoot.png'
    sheet.save(sheet_path, quality=92)
    print('sheet', sheet_path, flush=True)

    assert aim.get('zone') == 2, f'expected GUN zone: {aim}'
    assert aim.get('free') == 'R', f'expected free R hand: {aim}'
    assert aim.get('zipAim') is True, f'expected zipAim: {aim}'
    assert fired.get('ok') is True, f'expected fire ok: {fired}'

    await b.close()
    print('PASS', flush=True)

asyncio.run(main())
