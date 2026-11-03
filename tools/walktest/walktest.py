# [island-rework] WALK TEST driver: boots the harbor headless (one browser), runs tools/walktest/walktest.js in the page, writes
#   <out>/walktest_<set>.json + <out>/walktest_<set>.md (per cell + per route). A REPORT, not a gate (BANKSY 5:51 PM); exit 1 only on void.
#   PFP_B=http://127.0.0.1:8991 python3 tools/walktest/walktest.py batch|island [out_dir]
import asyncio, json, os, sys
from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
B = os.environ.get('PFP_B', 'http://127.0.0.1:8991'); SET = sys.argv[1] if len(sys.argv) > 1 else 'batch'; OUT = sys.argv[2] if len(sys.argv) > 2 else 'dev/walktest'
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); ctx = await b.new_context(viewport={'width': 640, 'height': 480})
    await ctx.route('**/*supabase.co/**', lambda r: r.abort()); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to' not in m.text and 'AudioContext' not in m.text else None)
    await pg.add_init_script("try{localStorage.setItem('pfp_gfx_hint','1');localStorage.setItem('pfp_tut_seen','1')}catch(e){}")
    await pg.goto(B + '/index.html?coast=1&quality=low'); await pg.wait_for_function('window.PFP && PFP.renderer', timeout=600000); await pg.wait_for_timeout(500)
    await pg.evaluate("document.getElementById('btn-pvp').click()"); await pg.wait_for_function("PFP.dock && PFP.dock.on", timeout=600000)
    r = await pg.evaluate("(async()=>{ const m = await import('./tools/walktest/walktest.js'); return m.run({ set: %s }); })()" % json.dumps(SET))
    r['console_errors'] = errs[:20]; os.makedirs(OUT, exist_ok=True); json.dump(r, open(f'{OUT}/walktest_{SET}.json', 'w'), indent=1)
    md = [f'# Walk test `{SET}` ({r["ms"]} ms, 2 cm steps, pop > {int(r["popMax"]*100)} cm)', '', 'Report, not a gate (BANKSY 5:51 PM). Hard blockers: void, stuck with no way out, console errors.', '',
          '| cell | pop | drop | slide | stuck | void | seam | cam | worst (x, z) |', '|---|---|---|---|---|---|---|---|---|']
    for c, v in sorted(r['cells'].items()): md.append(f"| {c} | {v['pop']} | {v['drop']} | {v['slide']} | {v['stuck']} | {v['void']} | {v['seam']} | {v['cam']} | " + '; '.join(f"{e['t']} {e.get('dy', e.get('gap', e.get('why', '')))} @({e['x']}, {e['z']}) {e['route']}" for e in v['worst'][:4]) + ' |')
    md += ['', '| route | m | events |', '|---|---|---|'] + [f"| {q['id']} | {q['len']} | {json.dumps(q['events'])} |" for q in r['routes']]
    md += ['', f"console errors: {len(errs)}"] + [f'- {e[:200]}' for e in errs[:10]]
    open(f'{OUT}/walktest_{SET}.md', 'w').write('\n'.join(md) + '\n'); print('\n'.join(md[:60])); await b.close()
    sys.exit(1 if any(v['void'] for v in r['cells'].values()) else 0)
asyncio.run(main())
