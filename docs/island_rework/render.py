import json, math
from PIL import Image, ImageDraw, ImageFont
d=json.load(open('dump.json')); g=d['grid']; B=g['B']; S=g['S']; nx=g['nx']; nz=g['nz']; H=d['H']; BL=d['BL']
sh=d['sheet']; x0,z0,k=sh['x0'],sh['z0'],sh['k']
def idx(x,z):
  i=round((x-B['x0'])/S); j=round((z-B['z0'])/S); return j*nx+i if 0<=i<nx and 0<=j<nz else None
def h(x,z): q=idx(x,z); return H[q] if q is not None else -20
def bl(x,z): q=idx(x,z); return BL[q] if q is not None else 1
def slope(x,z): return max(abs(h(x+5,z)-h(x-5,z)),abs(h(x,z+5)-h(x,z-5)))/10
t2w=lambda lx,lz:(-640-lz, -90+lx)
def trect(lx0,lx1,lz0,lz1):
  a=t2w(lx0,lz0); b=t2w(lx1,lz1); return (min(a[0],b[0]),max(a[0],b[0]),min(a[1],b[1]),max(a[1],b[1]))
REG=json.load(open('registry.json'))
COL={'jungle_ruins':('1','#1f7a3a'),'smugglers_cave':('2','#6b2fa3'),'skull_lookout':('3','#b0461a'),'lagoon':('4','#1d6fb8'),'pirate_camp':('5','#c47a00')}
AREAS=[(COL[a['id']][0],a['name'].upper(),a['rect'],COL[a['id']][1],a.get('props',[])) for a in REG['areas'] if a['id'] in COL]
ISL=[('6'+'abcde'[i],c[0],c[1],c[2]) for i,c in enumerate([a for a in REG['areas'] if a['id']=='islets'][0]['circles'])]
EXCL=[(e['owner']+': '+e['id']+('' if e['known'] else ' (assumed)'),e['rect']) for e in REG['exclude'] if 'rect' in e]
CAVE_MOUTH=[e for e in REG['exclude'] if e['id']=='cave_mouth'][0]['circle']
DIGS=[s for s in REG['spots'] if s['active'] and s['id']!='cave']
CAVE=[s for s in REG['spots'] if s['id']=='cave'][0]
NEW=[{'id':s['id'],'area':s['area'],'pos':(s['x'],s['z'])} for s in REG['spots'] if not s['active']]
# ---- render ----
im=Image.open('sheet.png').convert('RGBA'); W,Hh=im.size
ov=Image.new('RGBA',im.size,(0,0,0,0)); dr=ImageDraw.Draw(ov)
P=lambda x,z:((x-x0)*k,(z-z0)*k)
def F(n):
  for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
    try: return ImageFont.truetype(f,n)
    except: pass
  return ImageFont.load_default()
f14,f18,f24,f30=F(14),F(18),F(24),F(30)
# local grid (town-local): vertical lines = lz const, horizontal = lx const
for lz in range(-1400,401,100):
  X=P(-640-lz,0)[0]
  if 0<X<W: dr.line([(X,0),(X,Hh)],fill=(40,60,120,70),width=1); dr.text((X+3,Hh-40),f'lz {lz}',fill=(30,40,110,220),font=f14)
for lx in range(-700,901,100):
  Z=P(0,lx-90)[1]
  if 0<Z<Hh: dr.line([(0,Z),(W,Z)],fill=(40,60,120,70),width=1); dr.text((6,Z+3),f'lx {lx}',fill=(30,40,110,220),font=f14)
def hexa(c,a): c=c.lstrip('#'); return (int(c[0:2],16),int(c[2:4],16),int(c[4:6],16),a)
for name,r in EXCL:
  a=P(r[0],r[2]); b=P(r[1],r[3]); dr.rectangle([a,b],fill=(200,20,20,70),outline=(150,0,0,230),width=3)
  for t in range(int(a[0])-int(b[1]-a[1]),int(b[0]),14): dr.line([(max(a[0],t),a[1]+max(0,a[0]-t)),(min(b[0],t+(b[1]-a[1])),min(b[1],a[1]+(min(b[0],t+(b[1]-a[1]))-t)))],fill=(150,0,0,110),width=2)
cx,cz,cr=CAVE_MOUTH; a=P(cx-cr,cz-cr); b=P(cx+cr,cz+cr); dr.ellipse([a,b],fill=(200,20,20,80),outline=(150,0,0,230),width=3)
for num,name,r,c,props in AREAS:
  a=P(r[0],r[2]); b=P(r[1],r[3]); dr.rounded_rectangle([a,b],radius=18,fill=hexa(c,45),outline=hexa(c,255),width=5)
  dr.ellipse([a[0]+8,a[1]+8,a[0]+52,a[1]+52],fill=hexa(c,255)); dr.text((a[0]+30,a[1]+30),num,fill='white',font=f30,anchor='mm')
  for pr in props:
    pa=P(pr['rect'][0],pr['rect'][2]); pb=P(pr['rect'][1],pr['rect'][3]); dr.rectangle([pa,pb],fill=hexa(c,150),outline=(60,30,0,255),width=2)
    dr.text(((pa[0]+pb[0])/2,pb[1]+3),pr['id'],fill=(60,30,0,255),font=f14,anchor='ma',stroke_width=2,stroke_fill=(245,232,200,255))
  if num=='5': tx,ty,an=a[0],b[1]+8,'la'
  elif num=='3': tx,ty,an=b[0],b[1]+8,'ra'
  else: tx,ty,an=a[0]+60,a[1]+14,'la'
  dr.text((tx,ty),name,fill=hexa(c,255),font=f24,stroke_width=3,stroke_fill=(245,232,200,255),anchor=an)
def h(x,z):
  i=round((x-B['x0'])/S); j=round((z-B['z0'])/S); return H[j*nx+i] if 0<=i<nx and 0<=j<nz else -20
for (ix,iz,ir) in [(-150,-770,40)]:
  c0=P(ix-34,iz-34); c1=P(ix+34,iz+34); dr.ellipse([c0,c1],fill=(176,180,150,255))
  for xx in range(ix-ir,ix+ir+1,2):
    for zz in range(iz-ir,iz+ir+1,2):
      if h(xx,zz)>0.4: a0=P(xx,zz); dr.rectangle([a0[0]-1.2,a0[1]-1.2,a0[0]+1.2,a0[1]+1.2],fill=(218,192,138,255))
  for xx in range(ix-ir,ix+ir+1,2):
    for zz in range(iz-ir,iz+ir+1,2):
      if h(xx,zz)>0.4 and min(h(xx+2,zz),h(xx-2,zz),h(xx,zz+2),h(xx,zz-2))<=0.4: a0=P(xx,zz); dr.ellipse([a0[0]-2.2,a0[1]-2.2,a0[0]+2.2,a0[1]+2.2],fill=(50,30,15,255))
for num,x,z,r in ISL:
  a=P(x-r,z-r); b=P(x+r,z+r); dr.ellipse([a,b],fill=hexa('#0f8f8f',50),outline=hexa('#0f8f8f',255),width=5)
  dr.text((b[0]+6,a[1]),num,fill=hexa('#0f6f6f',255),font=f24,stroke_width=3,stroke_fill=(245,232,200,255))
dr.text(P(-560,300),'6  HIDDEN ISLETS (6a-6e)',fill=hexa('#0f6f6f',255),font=f24,stroke_width=3,stroke_fill=(245,232,200,255))
def X(x,z,col,s=11,w=4):
  a,b=P(x,z); dr.line([(a-s,b-s),(a+s,b+s)],fill=col,width=w); dr.line([(a-s,b+s),(a+s,b-s)],fill=col,width=w)
for q in DIGS:
  X(q['x'],q['z'],(200,0,0,255)); a,b=P(q['x'],q['z']); dr.text((a+12,b-22),q['id'],fill=(160,0,0,255),font=f18,stroke_width=3,stroke_fill=(245,232,200,255))
X(CAVE['x'],CAVE['z'],(200,0,0,255)); a,b=P(CAVE['x'],CAVE['z']); dr.text((a-12,b-24),'cave (legendary, Skull Peak)',fill=(160,0,0,255),font=f18,stroke_width=3,stroke_fill=(245,232,200,255),anchor='ra')
for n in NEW:
  if not n['pos']: continue
  X(*n['pos'],(10,70,200,255),s=9,w=3); a,b=P(*n['pos']); dr.text((a+10,b+4),n['id'],fill=(10,60,170,255),font=f14,stroke_width=2,stroke_fill=(245,232,200,255))
# legend
lg=[((200,0,0,255),'existing dig spot (dig1-6) / legendary cave'),((10,70,200,255),'PROPOSED new dig spot (dig7+), auto-snapped to walkable ground'),((150,0,0,230),'exclusion zone (other owners) - hatched'),((30,40,110,220),'grid = town-local lx / lz, 100 m')]
bx,by=14,40; dr.rectangle([bx,by,bx+620,by+170],fill=(245,232,200,235),outline=(60,40,20,255),width=2)
dr.text((bx+12,by+8),'ISLAND REWORK PLAN v1 (draft) - north up',fill=(60,30,10,255),font=f18)
for i,(c,t) in enumerate(lg): dr.rectangle([bx+14,by+42+i*30,bx+34,by+58+i*30],fill=c); dr.text((bx+44,by+40+i*30),t,fill=(40,25,10,255),font=f14)
out=Image.alpha_composite(im,ov).convert('RGB'); out.save('/workspace/pfp-island-plan/plan_map.png'); print(out.size)
