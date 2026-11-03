import asyncio, json, sys; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); out = {}
    for q in ['', 'plaza=2']:
      pg = await (await b.new_context()).new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
      await pg.goto(f'http://127.0.0.1:18960/timothy-plaza/island.html?shot&kit=0&quality=low&coast=1&{q}'); await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=240000)
      r = await pg.evaluate("""(async()=>{ const LY = await import('./js/dock/layout.js'), L = await LY.coastLayout(), PV = await import('./js/island/plazaTown.js'), CO = await import('./js/island/coast.js');
        const o = { berths: L.berths.map(b => b.id).join(','), decks: L.decks.length, interact: L.interact.filter(q => /shop|token/.test(q.kind)).map(q => q.id + (q.vendor ? '/' + q.vendor : '')).join(','), spawn: L.spawn };
        if (PV.PLAZA_V2) { const S = PV.SHIP, B = PV.BERTHS, fp = b => [b.lx - S.yardW / 2, b.lx + S.yardW / 2, b.lz - S.aft, b.lz + S.fwd], bad = [];
          for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) { const a = fp(B[i]), c = fp(B[j]); if (a[0] < c[1] && c[0] < a[1] && a[2] < c[3] && c[2] < a[3]) bad.push(B[i].id + 'x' + B[j].id); }
          for (const b of B) { const f = fp(b); for (const jt of PV.JETTIES) { const hx0 = b.lx - S.beam / 2, hx1 = b.lx + S.beam / 2; if (hx0 < jt.lx + 6 && jt.lx - 6 < hx1) bad.push(b.id + ' hull on ' + jt.id); }
            if (f[2] < 6.5) bad.push(b.id + ' stern near quay/boardwalk lz ' + f[2]); if (f[1] > CO.MOLE.lx - CO.MOLE.w / 2 - 2) bad.push(b.id + ' near mole');
            for (const p of CO.PIERS) if (PV.keepOldPier(p.lx) && f[0] < p.lx + p.half + 2 && p.lx - p.half - 2 < f[1]) bad.push(b.id + ' vs old pier ' + p.lx); }
          const gaps = B.slice(1).map((b, i) => +(b.lx - B[i].lx).toFixed(1));
          o.check = { overlaps: bad, centreGaps: [...new Set(gaps)], hullGapAcrossJetty: PV.JETTY.shipOff * 2 - S.beam, hullToJetty: +(PV.JETTY.shipOff - S.beam / 2 - PV.JETTY.w / 2).toFixed(2), yardGap: +(26 - S.yardW).toFixed(2), approach: PV.APPROACH }; }
        try { const IT = await import('./js/pirateItems.js'), GR = await import('./js/pirateGear.js'), SK = await import('./js/skins.js'), UP = await import('./js/upgrades.js');
          const c = {}; for (const it of (IT.ITEMS || [])) c['item:' + it.slot] = (c['item:' + it.slot] || 0) + 1;
          const G = GR.GEAR || GR.GEAR_ITEMS || GR.CATALOG; if (G) for (const [slot, list] of Object.entries(G)) c['gear:' + slot] = Array.isArray(list) ? list.length : Object.keys(list).length;
          o.inv = c; o.gearKeys = Object.keys(GR).slice(0, 40); o.skins = (SK.SKINS || SK.SHIP_SKINS || []).length; o.skinKeys = Object.keys(SK).slice(0, 20); o.upgrades = (UP.UPGRADES || []).length; } catch (e) { o.invErr = e.message; }
        return o; })()""")
      out[q or 'default'] = r; out[(q or 'default') + '_errors'] = errs[:5]
    print(json.dumps(out, indent=1)); await b.close()
asyncio.run(main())
