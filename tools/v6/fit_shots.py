# SHEET_v6_fit: every shop item on each V6 body (real game code via tools/gear_viewer.html), High + Low, idle + walk
import asyncio, json, urllib.parse; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
OUT='/workspace/brand/v6_characters/shots'; B='http://127.0.0.1:18970/raul-v6/'
R={'hat':['bandana','tricorn','bicorne','crown','crown_imperial','helmet_hq','mask_luchador'],'outfit':['tank','tshirt','coat','shirt','suit','singlet'],'eyes':['eyepatch','sunglasses','laser'],
 'parrot':['parrot_green','parrot_cockatoo','pet_monkey','pet_cat','pet_chimp','pet_gorilla','pet_tiger'],'hook':['hook_iron','hook_gold'],'leg':['peg','peg_gold','peg_kraken','peg_ghost'],'face':['facepaint_retardio'],
 'beard':['beard_moustache','beard_forked','beard_black'],'ears':['earring_hoop','earring_double','earring_skull'],'teeth':['tooth_gold','grill_gold','grill_diamond'],'boots':['boots_buckle','boots_cavalier','boots_gold','boots_classic','sandals','shoes_buckle','boots_sea'],'cape':['cape_tattered','cape_captain','cape_royal']}
R['pants']=['classic_pants','canvas_pants','sailor_trousers','leather_breeches']
import os, sys; ONLY=os.environ.get('ONLY')
COMBO=[['LEGACY PANTS+BOOTS',{'pants':'classic_pants','boots':'boots_classic'}],['CANVAS+BUCKLE SHOES',{'pants':'canvas_pants','boots':'shoes_buckle'}],['SAILOR+SANDALS',{'pants':'sailor_trousers','boots':'sandals'}],
 ['BREECHES+SEA BOOTS',{'pants':'leather_breeches','boots':'boots_sea'}],['SAILOR+SEA BOOTS',{'pants':'sailor_trousers','boots':'boots_sea'}],['PEG+PANTS+BOOTS',{'pants':'classic_pants','boots':'boots_classic','leg':'peg'}],
 ['COAT+PANTS+BOOTS',{'outfit':'coat','pants':'classic_pants','boots':'boots_classic'}],['SUIT+BREECHES+BUCKLE',{'outfit':'suit','pants':'leather_breeches','boots':'boots_buckle'}],['CAPE+SAILOR+GOLD',{'cape':'cape_captain','pants':'sailor_trousers','boots':'boots_gold'}]]
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); errs={}
    for sex in ('m','f'):
      cells=[['DEFAULT (V6 underwear)',{}],['SWORD+MUSKET',{'carrySword':'cutlass','carryMusket':'navy'}],['GOLD SWORD+MUSKET',{'carrySword':'blade_gold','carryMusket':'blunder_gold'}]]+[[i.upper(),{s:i}] for s,L in R.items() for i in L if not (sex=='f' and s=='beard')]
      if ONLY=='store': cells=[[i.upper(),{s:i}] for s in ('pants','boots') for i in R[s][-4:] if True]+COMBO
      else: cells=cells+COMBO
      for lod in ('hi','lo'):
        for clip in ('idle','walk'):
          ctx = await b.new_context(viewport={'width':2000,'height':1300}); await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}'))
          pg = await ctx.new_page(); k=('store_' if ONLY=='store' else '')+f'fit_{sex}_{lod}_{clip}'; E=errs[k]=[]
          pg.on('pageerror', lambda e: E.append('PAGE '+str(e))); pg.on('console', lambda m: E.append(m.text[:200]) if m.type=='error' else None)
          u=B+'tools/gear_viewer.html?'+urllib.parse.urlencode({'sex':sex,'lod':lod,'clip':clip,'view':'q','cols':(9 if ONLY=='store' else 12),'cells':json.dumps(cells)})
          await pg.goto(u); await pg.wait_for_function('window.GEARV && GEARV.ready()', timeout=400000); await pg.evaluate('GEARV.figs.forEach(f=>{ const p=f.userData.v4; if(p){ p.footSpeed=0; p.footState="idle"; } })'); await pg.wait_for_timeout(3000)
          await pg.screenshot(path=f'{OUT}/{k}.png', timeout=180000); print('shot',k,len(cells),flush=True); await ctx.close()
    json.dump(errs, open(f'{OUT}/fit_errors.json','w'), indent=0); print(json.dumps(errs)[:2000]); await b.close()
asyncio.run(main())
