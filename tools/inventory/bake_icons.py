"""Reproducible offline item thumbnails. No generation service or runtime 3D render.
python3 tools/inventory/bake_icons.py [fish|gear|valuables|goods|pets|all]
Requires Playwright + Pillow and local Chrome. Starts its own local asset server.
"""
import asyncio, base64, functools, http.server, io, json, sys, threading, subprocess
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw, ImageFont
from playwright.async_api import async_playwright
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/items'
ART = Path('/workspace/inv-icons')
ART.mkdir(parents=True, exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self, *args): pass

def finish(raw, color, rotation=0):
 image=Image.open(io.BytesIO(raw)).convert('RGBA'); bb=image.getchannel('A').getbbox()
 if not bb: raise ValueError('Empty render')
 if rotation:
  image=image.crop(bb).rotate(rotation,Image.Resampling.BICUBIC,expand=True);bb=image.getchannel('A').getbbox()
 image=image.crop(bb); image.thumbnail((220,220),Image.Resampling.LANCZOS)
 canvas=Image.new('RGBA',(256,256));canvas.alpha_composite(image,((256-image.width)//2,(256-image.height)//2))
 alpha=canvas.getchannel('A'); halo=alpha.filter(ImageFilter.GaussianBlur(8)).point(lambda a:int(a*.27))
 glow=Image.new('RGBA',(256,256),color);glow.putalpha(halo)
 glow.alpha_composite(canvas);return glow

def contact():
 manifest=json.loads((ART/'manifest.json').read_text())
 cols=7;cell=154;rows=(len(manifest)+cols-1)//cols
 image=Image.new('RGB',(cols*cell,rows*174),'#171b25');d=ImageDraw.Draw(image)
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',10)
 for n,(key,meta) in enumerate(manifest.items()):
  icon=Image.open(OUT/(key+'.webp')).convert('RGBA');icon.thumbnail((142,142));x=n%cols*cell;y=n//cols*174
  image.paste(icon,(x+6,y+2),icon);d.text((x+4,y+145),meta['label'][:25],font=font,fill=meta['color']);d.text((x+4,y+159),meta['rarity'].upper(),font=font,fill='#a4a9b6')
 image.save(ART/'contact.jpg',quality=91)

async def main(group):
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   page=await browser.new_page();page.on('pageerror',lambda e:print('PAGE ERROR:',str(e),flush=True))
   await page.goto(f'http://127.0.0.1:{server.server_port}/tools/inventory/render_icons.html');await page.wait_for_function('window.ready',timeout=120000)
   defs=await page.evaluate('window.iconDefs');manifest=json.loads((ART/'manifest.json').read_text()) if (ART/'manifest.json').exists() else {}
   types={'fish':['fish'],'gear':['sword','musket','acc'],'valuables':['custom'],'goods':['custom'],'pets':['parrot','custom']}
   selected={k:v for k,v in defs.items() if group=='all' or (v['type'] in types[group] and (group not in ['valuables','goods','pets'] or (group=='valuables' and k.startswith('val_')) or (group=='goods' and k.startswith('isl_')) or (group=='pets' and k.startswith('parrot'))))}
   for key,meta in selected.items():
    # Already-good detailed fish, weapon and treasure paintings are retained,
    # uniformly framed and given the same restrained rarity halo. The historical
    # blob keeps regeneration deterministic without shipping duplicate originals.
    retained = key.startswith('fish_') or (key.startswith('wpn_') and not key.startswith('wpn_musket_bone')) or (key.startswith('val_') and key not in ['val_idol_shard','val_musket_parts'] and not key.startswith('val_acc_'))
    if retained:
     raw=subprocess.run(['git','show','71f0152:assets/items/'+key+'.webp'],cwd=ROOT,check=True,capture_output=True).stdout
     meta['source']='Retained detailed artwork at 71f0152; reframed + rarity halo'
    elif key=='val_idol_shard':
     raw=subprocess.run(['git','show','71f0152:assets/items/val_golden_idol.webp'],cwd=ROOT,check=True,capture_output=True).stdout
     shard=Image.open(io.BytesIO(raw)).convert('RGBA').crop((65,10,189,146))
     mask=Image.new('L',shard.size);ImageDraw.Draw(mask).polygon([(0,0),(124,0),(124,99),(94,102),(103,120),(72,113),(57,136),(35,118),(12,123),(19,96),(0,85)],fill=255)
     from PIL import ImageChops
     shard.putalpha(ImageChops.multiply(shard.getchannel('A'),mask));buffer=io.BytesIO();shard.save(buffer,'PNG');raw=buffer.getvalue()
     meta['source']='Fragment cropped from existing gold V7 male statue render (v467)'
    else:
     data=await page.evaluate('key=>window.bakeIcon(key)',key);raw=base64.b64decode(data.split(',')[1])
    rotation=35 if key.startswith('wpn_musket_bone') or key in ['val_acc_scope','val_acc_bayonet'] else 0
    image=finish(raw,meta['color'],rotation);image.save(OUT/(key+'.webp'),'WEBP',quality=84,method=6)
    manifest[key]=meta;print(key,(OUT/(key+'.webp')).stat().st_size,flush=True)
   (ART/'manifest.json').write_text(json.dumps(manifest,indent=2));contact()
   print('BAKED',len(selected),'TOTAL',len(manifest),'BYTES',sum((OUT/(k+'.webp')).stat().st_size for k in manifest),flush=True)
   await browser.close()
 finally: server.shutdown();server.server_close()
if __name__=='__main__':asyncio.run(main(sys.argv[1] if len(sys.argv)>1 else 'all'))
