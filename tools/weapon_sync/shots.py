#!/usr/bin/env python3
# [Raul weapon-sync] headless in-engine close-ups: YOUR holstered Legendary weapons + 3D attachments, and remote peers fed through the
# real room-state path (PFP.dock.onPeerState -> js/onfoot/net.js decode of 'wl' -> battle.js / carryWeapons.js dress).
import asyncio, os, json
from pathlib import Path
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw, ImageFont

ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']
BASE = os.environ.get('WSYNC_URL', 'http://127.0.0.1:18997')
OUT = Path(os.environ.get('WSYNC_OUT', '/workspace/raul-weapon-sync-shots')); OUT.mkdir(parents=True, exist_ok=True)
BOOT = "try{localStorage.setItem('pfp_name','WSYNC_QA');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_v1','1');localStorage.setItem('pfp_tutorial_off','1');localStorage.setItem('pfp_gfx_hint','1')}catch(e){}"

SETUP = """async () => {
  const G = await import('./js/pirateGear.js'), MU = await import('./js/musketUpgrades.js'), WL = await import('./js/onfoot/weaponLook.js');
  window.PFP_WEAPON_RARITY = { sword: 'legendary', musket: 'legendary' };
  MU.setGunInstances([{ gid: 'qa-gun', item: 'wpn:musket:navy:legendary', place: 'equip', acc: { scope: 'val:acc_scope', bayonet: 'val:acc_bayonet', stock: 'val:acc_stock', horn: 'val:acc_horn' } }]);
  G.setCarriedWeapons({ sword: 'cutlass', musket: 'navy' }, 'inventory');
  const w = PFP.dock.walker.w; w.yaw = w.camYaw = 0.6; w.x += Math.sin(w.yaw) * 3; w.z += Math.cos(w.yaw) * 3; w.y = PFP.dock.world.ground(w.x, w.z);
  const st = document.createElement('style'); st.textContent = 'body *{visibility:hidden !important}'; document.head.appendChild(st);
  PFP.renderer.domElement.style.setProperty('visibility', 'visible', 'important');
  window.__WL = WL; window.__G = G; window.__peers = new Map();
  const gear = { ...G.getLocalGear(), carrySword: 'cutlass', carryMusket: 'navy' };
  window.__gr = G.gearToWire(gear);
  clearInterval(window.__feed); window.__feed = setInterval(() => { for (const m of window.__peers.values()) PFP.dock.onPeerState(m); }, 250);
  return { wl: WL.localWireLook(), gr: window.__gr };
}"""

# local camera: angle a (rad) around the pirate from its facing, dist, height, look height
CAM_LOCAL = """([a, dist, h, ly, fov]) => { const w = PFP.dock.walker.w, c = PFP.camera; c.fov = fov || 50; c.updateProjectionMatrix();
  w.camHook = () => { const yaw = w.yaw + a; c.position.set(w.x + Math.sin(yaw) * dist, w.y + h, w.z + Math.cos(yaw) * dist); c.lookAt(w.x, w.y + ly, w.z); }; }"""
# near plane just in front of the peer(s): props / ships between the camera and them are clipped away (a clean studio close-up)
CAM_PEER = """([ids, a, dist, h, ly, fov]) => { const w = PFP.dock.walker.w, c = PFP.camera, f = PFP.dock.fnet; c.fov = fov || 50; c.near = Math.max(0.1, dist - 1.6); c.updateProjectionMatrix();
  w.camHook = () => { const ps = ids.map(i => f.peers.get(i)).filter(Boolean); if (!ps.length) return; let x = 0, z = 0, y = 0;
    for (const p of ps) { x += p.x; z += p.z; y += p.body?.y ?? 0; } x /= ps.length; z /= ps.length; y /= ps.length; const yaw = ps[0].yaw + a;
    c.position.set(x + Math.sin(yaw) * dist, y + h, z + Math.cos(yaw) * dist); c.lookAt(x, y + ly, z); }; }"""
PEER = """([id, name, dx, dz, stance, wl]) => { const w = PFP.dock.walker.w, S = ['rusty','cutlass','rapier','bone','sabre_gilded','blade_gold'], M = ['rusty','navy','blunder','dragoon','bone','blunder_gold'];
  const x = w.x + Math.sin(w.yaw + Math.PI / 2) * dx + Math.sin(w.yaw) * dz, z = w.z + Math.cos(w.yaw + Math.PI / 2) * dx + Math.cos(w.yaw) * dz;
  window.__peers.set(id, { i: id, n: name, sk: 'classic', gr: window.__gr, ft: [Math.round(x * 10) / 10, Math.round(z * 10) / 10, Math.round(w.yaw * 100), 0], ba: [stance, 100, 1, 0, 0, S.indexOf('cutlass'), 0, M.indexOf('navy'), 0], ...(wl == null ? {} : { wl }) }); }"""
DIAG = """(ids) => { const f = PFP.dock.fnet, b = PFP.dock.battle, out = {};
  const desc = (m) => m ? { vis: m.visible, leg: m.children.filter(c => /legendary/.test(c.name)).length, acc: m.children.filter(c => c.userData?.gunacc).length, em: m.material?.emissive?.getHexString?.() } : null;
  const carry = (o) => { let st = null; o.traverse(c => { if (!st && c.userData?.carryState) st = c.userData.carryState; }); return st ? { sword: desc(st.sword), musket: desc(st.musket), holstered: st.holstered } : null; };
  for (const id of ids) { const p = f.peers.get(id), r = b.peers.get(id); out[id] = p ? { look: p.look?.v, v6: !!p.pirate.object, carry: carry(p.pirate.object), heldSword: desc(r?.sword), heldMusket: desc(r?.musket), zone: r?.st?.zone } : null; }
  out.me = { carry: carry(PFP.dock.pirate?.object || PFP.dock.battle.rig?.obj), stance: b.stance, heldMusket: desc(b.rig?.musket), heldSword: desc(b.rig?.sword) };
  return out; }"""

async def settle(pg, ms=2500): await pg.wait_for_timeout(ms)

async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    print('chrome pid', getattr(getattr(b, 'process', None), 'pid', '?'), flush=True)
    ctx = await b.new_context(service_workers='block', viewport={'width': 1280, 'height': 800})
    await ctx.route('**/*supabase.co/**', lambda r: r.abort()); await ctx.add_init_script(BOOT)
    pg = await ctx.new_page(); pg.on('pageerror', lambda e: print('PAGEERR', e, flush=True))
    await pg.goto(f'{BASE}/index.html?quality=high&safezones=0&followers=0', wait_until='domcontentloaded', timeout=300000)
    await pg.wait_for_function('window.PFP && PFP.renderer', timeout=400000); await pg.wait_for_timeout(600)
    await pg.click('#btn-pvp'); await pg.wait_for_function('PFP.dock && PFP.dock.on', timeout=240000)
    await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await pg.wait_for_timeout(1200)
    await pg.evaluate("() => { PFP.game.stormOverride = 0; PFP.game.storm = 0; const d = PFP.dock; for (const ber of d.layout.berths) { d.dockAt(ber.id); if (d.docking.mode !== 'sea') break; } }")
    await pg.wait_for_function("PFP.dock.docking.mode==='docked'", timeout=600000)
    await pg.evaluate('PFP.dock.goAshore()'); await pg.wait_for_function('PFP.dock.onFoot', timeout=600000); await pg.wait_for_timeout(1500)
    print('setup', await pg.evaluate(SETUP), flush=True)
    await pg.evaluate("PFP.dock.battle.setStance(0)"); await settle(pg, 4000)
    # 01: you, unarmed: Legendary musket + 4 attachments slung on the back, Legendary cutlass carried (3/4 back view)
    await pg.evaluate(CAM_LOCAL, [2.45, 4.0, 1.6, 0.95, 30]); await settle(pg, 1500)
    d1 = await pg.evaluate(DIAG, []); print('01', json.dumps(d1), flush=True)
    await pg.screenshot(path=str(OUT / '01_local_holstered_legendary_acc.png'))
    # 01b: you, GUN drawn: the cutlass goes to the hip holster (Legendary on the hip)
    await pg.evaluate("PFP.dock.battle.setStance(2)"); await settle(pg, 2500)
    await pg.evaluate(CAM_LOCAL, [-0.8, 4.2, 1.5, 0.9, 30]); await settle(pg, 1200)
    print('01b', json.dumps(await pg.evaluate(DIAG, [])), flush=True)
    await pg.screenshot(path=str(OUT / '01b_local_gun_hip_sword.png'))
    await pg.evaluate("PFP.dock.battle.setStance(0)")
    # peers: 6 m to your right, facing your way
    await pg.evaluate(PEER, ['wsyncpeer01', 'LEGEND', 6, 0, 2, 255]); await settle(pg, 9000)
    await pg.wait_for_function("(() => { const r = PFP.dock.battle.peers.get('wsyncpeer01'); return r && r.musket && r.musket.children.some(c => c.userData?.gunacc); })()", timeout=240000)
    await settle(pg, 2500)
    await pg.evaluate(CAM_PEER, [['wsyncpeer01'], 0.9, 4.4, 1.5, 0.95, 30]); await settle(pg, 1500)
    d2 = await pg.evaluate(DIAG, ['wsyncpeer01']); print('02', json.dumps(d2), flush=True)
    await pg.screenshot(path=str(OUT / '02_peer_inhand_musket_legendary_acc.png'))
    # 03: same peer, SWORD drawn: Legendary cutlass in hand, Legendary musket + attachments slung on the back (3/4 back)
    await pg.evaluate(PEER, ['wsyncpeer01', 'LEGEND', 6, 0, 1, 255])
    await pg.wait_for_function("(() => { const r = PFP.dock.battle.peers.get('wsyncpeer01'); return r && r.sword && r.sword.visible && !(r.musket && r.musket.visible); })()", timeout=120000); await settle(pg, 2500)
    await pg.evaluate(CAM_PEER, [['wsyncpeer01'], 2.5, 3.6, 1.6, 1.0, 34]); await settle(pg, 1500)
    d3 = await pg.evaluate(DIAG, ['wsyncpeer01']); print('03', json.dumps(d3), flush=True)
    await pg.screenshot(path=str(OUT / '03_peer_inhand_sword_legendary_holstered_gun.png'))
    # 03b: same peer, UNARMED: Legendary musket + all 4 attachments holstered on the back, Legendary cutlass carried (close back view)
    await pg.evaluate(PEER, ['wsyncpeer01', 'LEGEND', 6, 0, 0, 255])
    await pg.wait_for_function("(() => { const p = PFP.dock.fnet.peers.get('wsyncpeer01'); let st = null; p.pirate.object.traverse(c => { if (!st && c.userData?.carryState) st = c.userData.carryState; }); return st && st.musket && st.musket.visible; })()", timeout=120000); await settle(pg, 2500)
    await pg.evaluate(CAM_PEER, [['wsyncpeer01'], 3.0, 3.0, 1.55, 1.0, 34]); await settle(pg, 1500)
    d3b = await pg.evaluate(DIAG, ['wsyncpeer01']); print('03b', json.dumps(d3b), flush=True)
    await pg.screenshot(path=str(OUT / '03b_peer_holstered_legendary_acc.png'))
    # 04: common peer (an older client: no 'wl') vs Legendary + attachments, both GUN drawn, side by side
    await pg.evaluate(PEER, ['wsyncpeer01', 'LEGEND', 6.8, 0, 2, 255]); await pg.evaluate(PEER, ['wsynccommon', 'COMMON', 5.2, 0, 2, None])
    await settle(pg, 9000)
    await pg.wait_for_function("(() => { const r = PFP.dock.battle.peers.get('wsynccommon'); return r && r.musket; })()", timeout=240000); await settle(pg, 2500)
    await pg.evaluate(CAM_PEER, [['wsyncpeer01', 'wsynccommon'], 0.25, 5.2, 1.5, 0.95, 30]); await settle(pg, 1500)
    d4 = await pg.evaluate(DIAG, ['wsyncpeer01', 'wsynccommon']); print('04', json.dumps(d4), flush=True)
    await pg.screenshot(path=str(OUT / '04_common_vs_legendary_peer_compare.png'))
    json.dump({'01': d1, '02': d2, '03': d3, '03b': d3b, '04': d4}, open(OUT / 'diag.json', 'w'), indent=1)
    await b.close()

  names = [('01_local_holstered_legendary_acc.png', 'YOU · unarmed: Legendary musket + scope/bayonet/stock/horn slung · Legendary cutlass carried'),
           ('01b_local_gun_hip_sword.png', 'YOU · GUN drawn: Legendary musket + 4 attachments in hand · Legendary cutlass holstered at the hip'),
           ('02_peer_inhand_musket_legendary_acc.png', "REMOTE PEER (net 'wl' 255) · aiming Legendary musket + 4 attachments · cutlass on hip"),
           ('03_peer_inhand_sword_legendary_holstered_gun.png', 'REMOTE PEER · Legendary cutlass drawn · Legendary musket + 4 attachments holstered on back'),
           ('03b_peer_holstered_legendary_acc.png', 'REMOTE PEER · unarmed: holstered Legendary musket (scope/bayonet/stock/horn) + cutlass'),
           ('04_common_vs_legendary_peer_compare.png', "TIER: COMMON peer (older client, no 'wl')  vs  LEGENDARY + 4 attachments peer")]
  W, H = 960, 600; sheet = Image.new('RGB', (W * 2, 56 + (H + 40) * 3), (12, 12, 14)); dr = ImageDraw.Draw(sheet)
  try: f1 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 28); f2 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17)
  except Exception: f1 = f2 = ImageFont.load_default()
  dr.text((20, 12), "WEAPON SYNC 3D · Legendary + musket attachments over the net ('wl'), in hand + holstered, you + remote peers", fill=(245, 197, 66), font=f1)
  for i, (fn, lab) in enumerate(names):
    col, row = i % 2, i // 2
    im = Image.open(OUT / fn).convert('RGB'); im = im.resize((W, int(W * im.height / im.width)), Image.LANCZOS)
    if im.height > H: t = (im.height - H) // 2; im = im.crop((0, t, W, t + H))
    y0 = 56 + row * (H + 40); dr.rectangle([col * W, y0, col * W + W, y0 + 38], fill=(0, 0, 0)); dr.text((col * W + 12, y0 + 9), lab, fill=(255, 255, 255), font=f2)
    sheet.paste(im, (col * W, y0 + 40))
  sheet.save(OUT / 'SHEET_weapon_sync_3d.png'); print('sheet', OUT / 'SHEET_weapon_sync_3d.png', flush=True)

asyncio.run(main())
