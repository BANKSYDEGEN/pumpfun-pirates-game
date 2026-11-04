# build.py -- who lod item : Raul's SHOP ITEMS 2 (v5 per body + LOD) -> assets/pirates/items/v5/<item>_<who>_<lod>.glb
# blender -b -P build.py -- male hi beard_forked
import bpy,sys,os,math,json,numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0,'/workspace/raul_polish_work'); from lib import reset,imp
sys.path.insert(0,'/workspace/raul_shop_items_2_work'); import geo; from geo import *
who,lod,item=sys.argv[-3:]; HI=lod=='hi'; RES=1.0 if HI else 0.42
WT='/workspace/raul-shop2-fixes'; OUT=f'{WT}/assets/pirates/items/v5'   # [Raul shop2 fixes] work copy: only the Low beards are rebuilt with it; OUT=f'{WT}/assets/pirates/items/v5'
reset(); objs=imp(f'{WT}/assets/pirates/pirate_{who}_v5_{lod}.glb')
arm=[o for o in objs if o.type=='ARMATURE'][0]; arm.data.pose_position='REST'; bpy.context.view_layer.update()
body=[o for o in objs if o.type=='MESH' and 'body' in o.name][0]
def world(o): return np.array([o.matrix_world@v.co for v in o.data.vertices])
BV=world(body); BF=[list(p.vertices) for p in body.data.polygons]; TI=np.array([a.value for a in body.data.attributes['_TINT'].data]) if '_TINT' in body.data.attributes else np.zeros(len(BV))
base=imp(f'{WT}/assets/pirates/items/v5/cloth_base_{who}_{lod}.glb'); bm_=[o for o in base if o.type=='MESH'][0]; CV=world(bm_); CF=[list(p.vertices) for p in bm_.data.polygons]
for o in base:
  if o.type=='ARMATURE': bpy.data.objects.remove(o)
EYE=world([o for o in objs if o.name.startswith('v5_face_eyes')][0])
allV=np.vstack([BV,CV]); allF=BF+[[i+len(BV) for i in f] for f in CF]
BVH=BVHTree.FromPolygons([Vector(v) for v in allV],allF)
BVHB=BVHTree.FromPolygons([Vector(v) for v in BV],BF)
def ray(o,d,t=BVH):
  h=t.ray_cast(Vector(o),Vector(d)/Vector(d).length,5.0); return None if h[0] is None else np.array(h[0])
def bone(n): b=arm.data.bones[n]; return np.array(arm.matrix_world@b.head_local)
HEAD=bone('head'); F=who=='female'
eye_z0=float(EYE[:,2].min()); eye_z1=float(EYE[:,2].max()); MOUTH_Z=eye_z0-0.055
yc=float(HEAD[1])
def face_y(x,z):  # front surface (min y) at x,z
  h=ray([x,-2,z],[0,1,0]); return float(h[1]) if h is not None else None
def radial(th,z,c=(0,yc)):   # outer surface distance from the head axis at angle th (0 = front, + = character left)
  d=np.array([math.sin(th),-math.cos(th),0]); o=np.array([c[0],c[1],z])+d*1.2; h=ray(o,-d)
  return None if h is None else float(np.linalg.norm((h-np.array([c[0],c[1],z]))[:2]))
# ears: skin verts at the sides of the head
sk=(TI==0); side=(np.abs(BV[:,0])>0.19)&(BV[:,2]>eye_z0-0.12)&(BV[:,2]<eye_z1+0.06)&(np.abs(BV[:,1]-yc)<0.1)&sk
EARS={}
for sx in (1,-1):
  m=side&(np.sign(BV[:,0])==sx); P=BV[m]
  if len(P)<5: P=BV[(np.sign(BV[:,0])==sx)&(np.abs(BV[:,0])>0.17)&(np.abs(BV[:,2]-eye_z0)<0.08)]
  xo=P[:,0].max() if sx>0 else P[:,0].min(); ey=float(np.median(P[:,1])); lz=float(np.percentile(P[:,2],8))
  EARS[sx]=np.array([xo,ey,lz])
LM=dict(mouth_z=MOUTH_Z,eye_z0=eye_z0,head=HEAD.tolist(),ears={k:v.round(4).tolist() for k,v in EARS.items()})
COL=lambda h: lin(h)
parts=[]; skin=None   # skin: None = rigid head (plain mesh), else {bone: mask}
LOB=(not HI) and item in ('beard_forked','beard_black')   # [Raul shop2 fixes] phone budget for the two big beards (was 3.7k / 5.6k tris)
if LOB: RES=0.3
seg=lambda n: max(4 if LOB else 6,int(round(n*RES)))
# ---------------------------------------------------------------- BEARDS (hair colour = key 1 / key 2 darker)
def wrap(z_top_c,z_top_s,z_bot_c,z_bot_s,thmax,thick,col,nu=22,nv=10,push=0.0):
  # a fitted shell over the jaw: angle th in [-thmax,thmax], rows from the top line to the bottom line (center vs side heights)
  nu=seg(nu); nv=seg(nv); G=np.zeros((nu,nv,3)); last=None
  for i in range(nu):
    th=-thmax+2*thmax*i/(nu-1); s=abs(th)/thmax; ztop=z_top_c+(z_top_s-z_top_c)*s**1.5; zbot=z_bot_c+(z_bot_s-z_bot_c)*s**2
    for j in range(nv):
      z=ztop+(zbot-ztop)*j/(nv-1); r=radial(th,max(z,zbot_lim))
      if r is None: r=last or 0.2
      last=r; bulge=thick*(0.6+0.4*math.sin(math.pi*j/(nv-1)))*(1-0.35*s)
      rr=r+bulge+push; G[i,j]=[math.sin(th)*rr,yc-math.cos(th)*rr,z]
  return sheet_solid(G,thick*0.9+0.01,col,outward=[0,yc,(z_top_c+z_bot_c)/2])
zbot_lim=0
def braid(top,bot,r0,r1,col,col2,beads=(),bead_col=None,n=9,wob=0.012):
  if LOB: n=6   # fewer, longer lobes
  P=[];R=[];C=[]
  for k in range(n):
    t=k/(n-1); p=np.array(top)*(1-t)+np.array(bot)*t; P.append(p); R.append(r0*(1-t)+r1*t)
  P=np.array(P); out=[]
  for k in range(n-1):   # chunky braid = a stack of squashed lobes, alternating colour
    c=(P[k]+P[k+1])/2; d=P[k+1]-P[k]; L=np.linalg.norm(d); ax=d/L; R_=R[k]
    Rm=np.eye(3); z=np.array([0,0,1.]); v=np.cross(z,ax)
    if np.linalg.norm(v)>1e-6: Rm=rot(v,math.acos(np.clip(np.dot(z,ax),-1,1)))
    out.append(ellipsoid(c+np.array([wob*(1 if k%2 else -1),0,0]),[R_*1.05,R_*0.9,L*(0.66 if LOB else 0.62)],col if k%2 else col2,seg(10),seg(6),Rm))
  for b in beads:
    k=int(b*(n-1)); p=P[k]; out.append(torus(p,R[k]*0.95,R[k]*0.35,P[min(k+1,n-1)]-P[max(k-1,0)],bead_col,seg(14),seg(6)))
  return out
def moustache(col,y_off=0.0,size=1.0):
  out=[]
  for sx in (1,-1):
    P=[];R=[]
    for k in range(9):
      t=k/8; x=sx*(0.008+0.12*size*t); z=MOUTH_Z+0.022-0.02*math.sin(math.pi*t*0.9)+0.06*size*max(0,t-0.62)**1.6*6
      fy=face_y(x*0.9,MOUTH_Z+0.02) or (yc-0.24)
      y=fy-0.016-0.03*math.sin(math.pi*min(1,t*1.1))*0.4+0.02*t+y_off
      if t>0.75: x=sx*(0.008+0.12*size*0.75+0.02*(t-0.75)/0.25); y-=0.0
      P.append([x,y,z]); R.append(0.022*size*(1-0.75*t)+0.004)
    out.append(tube(P,R,col,seg(10)))
  return out
if item.startswith('beard_'):
  H1=KEY1; H2=KEY2
  zb_side=EARS[1][2]+0.02
  chin_y=(face_y(0,MOUTH_Z) or yc-0.24)
  if item=='beard_moustache':   # CAPTAIN'S MOUSTACHE: a big curled handlebar + a small chin tuft
    parts+=moustache(H1,size=1.0)
    parts.append(ellipsoid([0,chin_y+0.002,MOUTH_Z-0.075],[0.03,0.022,0.04],H2,seg(12),seg(8)))
  elif item=='beard_forked':    # FORKED BEARD: jaw wrap + two braids with gold rings
    zbot_lim=MOUTH_Z-0.16
    parts.append(wrap(MOUTH_Z-0.005,eye_z0+0.02,MOUTH_Z-0.13,zb_side-0.04,1.75,0.022,H1))
    parts+=moustache(H2,size=0.75,y_off=-0.012)
    cy=chin_y-0.035
    for sx in (1,-1):
      parts+=braid([sx*0.035,cy,MOUTH_Z-0.11],[sx*0.075,cy-0.05,MOUTH_Z-0.31],0.03,0.016,H1,H2,beads=(0.55,0.95),bead_col=COL('#f2c230'))
  elif item=='beard_black':     # BLACKBEARD: big black beard to the chest, three braids with red ribbons (fixed colours)
    zbot_lim=MOUTH_Z-0.18
    B1=COL('#1d1a1c'); B2=COL('#34303a'); RED=COL('#d8262c')
    parts.append(wrap(MOUTH_Z+0.01,eye_z0+0.03,MOUTH_Z-0.15,zb_side-0.05,1.85,0.03,B1))
    parts+=moustache(B2,size=0.95,y_off=-0.02)
    cy=chin_y-0.04
    for sx,len_ in ((0,0.36),(1,0.3),(-1,0.3)):
      parts+=braid([sx*0.055,cy,MOUTH_Z-0.12],[sx*0.08,cy-0.07,MOUTH_Z-0.12-len_],0.034,0.018,B1,B2)
      e=np.array([sx*0.08,cy-0.07,MOUTH_Z-0.12-len_*0.86]); parts.append(torus(e,0.02,0.008,[0,0,1],RED,seg(12),seg(6)))
      for s2 in (1,-1): parts.append(ellipsoid(e+np.array([s2*0.03,-0.01,-0.012]),[0.026,0.008,0.014],RED,seg(8),seg(5),rot([0,1,0],s2*0.5)))
# ---------------------------------------------------------------- EARRINGS (rigid on head)
GOLD=COL('#f2c230'); GOLDD=COL('#c88a16'); SILV=COL('#d9dde3'); BONE=COL('#f3eee0')
def ear_anchor(sx,dz=0.0):
  e=EARS[sx].copy(); e[2]+=dz
  h=ray([sx*1.0,e[1],e[2]],[-sx,0,0]); x=h[0] if h is not None else e[0]
  # the hoop hangs below the lobe: keep it clear of the hair / neck surface below too
  for z in (e[2]-0.02,e[2]-0.045):
    h2=ray([sx*1.0,e[1],z],[-sx,0,0]); 
    if h2 is not None and sx*h2[0]>sx*x: x=h2[0]
  return np.array([x+sx*0.012,e[1],e[2]])
if item.startswith('earring_'):
  for sx in (1,-1):
    a=ear_anchor(sx)
    if item=='earring_hoop':
      parts.append(torus(a+np.array([0,0,-0.026]),0.026,0.0065,[1,0,0],GOLD,seg(22),seg(8)))
    elif item=='earring_double':
      parts.append(torus(a+np.array([0,0,-0.03]),0.03,0.0065,[1,0,0],GOLD,seg(22),seg(8)))
      b=ear_anchor(sx,0.035); parts.append(torus(b+np.array([sx*0.002,0,-0.016]),0.016,0.005,[1,0,0],GOLD,seg(18),seg(7)))
      parts.append(ellipsoid(a+np.array([sx*0.002,0,-0.062]),[0.009,0.009,0.009],COL('#d8262c'),seg(10),seg(6)))
    elif item=='earring_skull':
      parts.append(torus(a+np.array([0,0,-0.012]),0.012,0.004,[1,0,0],SILV,seg(14),seg(6)))
      s=a+np.array([sx*0.004,0,-0.046])
      parts.append(ellipsoid(s,[0.017,0.019,0.019],BONE,seg(14),seg(9)))
      parts.append(ellipsoid(s+np.array([0,-0.004,-0.017]),[0.011,0.012,0.008],BONE,seg(10),seg(6)))
      for e2 in (1,-1):   # eye sockets on the face of the charm (it faces out to the side)
        parts.append(ellipsoid(s+np.array([sx*0.016,-0.007*e2,0.002]),[0.003,0.005,0.006],INK,seg(8),seg(5),outline=False))
# ---------------------------------------------------------------- GOLD TEETH (rigid on head; a toothy grin sticker on the mouth)
if item in ('tooth_gold','grill_gold','grill_diamond'):
  W_=0.055 if F else 0.06; zc=MOUTH_Z-(0.004 if F else 0.0); off=0.006 if HI else 0.009
  nu=seg(18); nv=seg(7); G=np.zeros((nu,nv,3)); C=np.zeros((nu,nv,3))
  WHITE=COL('#fbf8ef'); LIP=COL('#5a1a1f')
  ICE=[COL('#e8f7ff'),COL('#9fd6f2'),COL('#ffffff')]
  for i in range(nu):
    u=-1+2*i/(nu-1); x=u*W_
    top=zc+0.012-0.006*u*u; bot=zc-0.026+0.016*u*u   # a wide grin: flat top, round bottom
    for j in range(nv):
      v=j/(nv-1); z=top+(bot-top)*v; fy=face_y(x,z)
      if fy is None: fy=yc-0.25
      bump=0.004*math.sin(math.pi*v)*(1-0.5*u*u)
      G[i,j]=[x,fy-off-bump,z]
      tooth=int((u+1)/2*8)   # 8 teeth across
      rim=(j==0 or j==nv-1 or i==0 or i==nu-1)
      upper=v<0.55
      if rim: c=LIP
      elif item=='tooth_gold': c=GOLD if (upper and tooth==5) else WHITE
      elif item=='grill_gold': c=GOLD if (tooth%2==0) else GOLDD
      else: c=ICE[(tooth+j)%3]
      if not rim and not upper and j==nv-2: c=LIP if item=='tooth_gold' else c
      C[i,j]=c
  p=sheet_solid(G,0.004,C.reshape(-1,3),outward=[0,yc,zc]); p.C=np.vstack([C.reshape(-1,3),C.reshape(-1,3)]); parts.append(p)
  if item=='grill_diamond':
    for k in (-0.6,0.1,0.55): parts.append(ellipsoid([k*W_,(face_y(k*W_,zc) or yc-0.25)-off-0.006,zc+0.002],[0.005,0.004,0.005],COL('#ffffff'),seg(6),seg(4),outline=False))
# ---------------------------------------------------------------- BOOTS (skinned: shin.L / shin.R)
if item.startswith('boots_'):
  skin={}
  BR=COL('#5a3420'); BRD=COL('#3a2014'); BLK=COL('#1f1b1d'); TAN=COL('#c99a5b'); SOLE=COL('#2a1a12')
  top_z={'boots_buckle':0.17,'boots_cavalier':0.205,'boots_gold':0.17}[item]
  for sx in (1,-1):
    cx=sx*0.09; nu=seg(26); nv=seg(9); G=np.zeros((nu,nv,3)); C=np.zeros((nu,nv,3))
    for i in range(nu):
      th=2*math.pi*i/nu
      for j in range(nv):
        z=0.004+(top_z-0.004)*j/(nv-1); d=np.array([math.sin(th),-math.cos(th),0])
        o=np.array([cx,-0.03,z]); h=ray(o+d*0.6,-d); r=np.linalg.norm((h-o)[:2]) if h is not None else 0.08
        r+=0.013 if HI else 0.017
        G[i,j]=o+d*r; front=math.cos(th)>0.3
        c={'boots_buckle':BR,'boots_cavalier':BLK,'boots_gold':BLK}[item]
        if j==0: c=SOLE
        if item=='boots_gold' and front and z<0.06: c=GOLD
        if item=='boots_gold' and math.cos(th)<-0.6 and z<0.05: c=GOLD
        C[i,j]=c
    # close the ring (wrap) by duplicating the first column
    G=np.concatenate([G,G[:1]],0); C=np.concatenate([C,C[:1]],0)
    p=sheet_solid(G,0.01,C.reshape(-1,3),outward=[cx,-0.03,0.1]); p.C=np.vstack([C.reshape(-1,3)]*2); parts.append(p)
    # sole slab under the foot
    top=G[:,0,:]; ctr=top.mean(0)
    parts.append(ellipsoid([ctr[0],ctr[1],0.006],[np.ptp(top[:,0])/2+0.004,np.ptp(top[:,1])/2+0.004,0.012],SOLE,seg(18),seg(6),e=0.6))
    ztop=top_z; ring=G[:,-1,:]; rc=ring.mean(0); rr=np.mean(np.linalg.norm((ring-rc)[:,:2],axis=1))
    if item=='boots_cavalier':   # wide folded cuff
      parts.append(torus([rc[0],rc[1],ztop-0.012],rr+0.016,0.022,[0,0,1],TAN,seg(22),seg(8)))
      parts.append(torus([rc[0],rc[1],ztop+0.006],rr+0.022,0.012,[0,0,1],COL('#a57a42'),seg(22),seg(6)))
    else:
      parts.append(torus([rc[0],rc[1],ztop-0.004],rr+0.004,0.009,[0,0,1],BRD if item=='boots_buckle' else COL('#34303a'),seg(20),seg(6)))
    if item=='boots_buckle':  # big square gold buckle on the front strap
      fh=ray([cx,-1,0.075],[0,1,0]); fy=fh[1] if fh is not None else -0.15
      parts.append(torus([cx,fy-0.016,0.075],0.03,0.009,[0,0,1],BRD,seg(18),seg(6)))
      parts.append(ellipsoid([cx,fy-0.03,0.085],[0.026,0.008,0.02],GOLD,seg(12),seg(6),e=0.35))
      parts.append(ellipsoid([cx,fy-0.035,0.085],[0.014,0.006,0.009],BRD,seg(10),seg(5),e=0.35,outline=False))
    if item=='boots_gold':    # gold buckle band at the top
      fh=ray([cx,-1,top_z-0.03],[0,1,0]); fy=fh[1] if fh is not None else -0.1
      parts.append(ellipsoid([cx,fy-0.012,top_z-0.03],[0.022,0.008,0.016],GOLD,seg(12),seg(6),e=0.4))
    skin[f'shin.{"L" if sx>0 else "R"}']=sx
# ---------------------------------------------------------------- CAPES (skinned: spine)
if item.startswith('cape_'):
  skin={'spine':0}
  CL=KEY1 if item=='cape_captain' else (COL('#1b1a20') if item=='cape_tattered' else COL('#9c1424'))
  LIN={'cape_captain':COL('#e9b949'),'cape_tattered':COL('#4a2a2e'),'cape_royal':COL('#f4f1e8')}[item]
  sh_z=float(HEAD[2])+0.0; z0=sh_z+0.02; z1=0.33 if item!='cape_royal' else 0.3
  nu=seg(17); nv=seg(14); G=np.zeros((nu,nv,3))
  for i in range(nu):
    u=-1+2*i/(nu-1)
    for j in range(nv):
      v=j/(nv-1); z=z0+(z1-z0)*v; hw=0.19+0.09*v; x=u*hw
      h=ray([x,1.2,z],[0,-1,0]); by=h[1] if h is not None else 0.12
      # the back profile must not dip in (smooth envelope: max of the rows above)
      y=by+0.045+0.07*v**1.4+0.025*(1-u*u)*v
      if j>0: y=max(y,G[i,j-1,1]-0.01)
      if item=='cape_tattered' and j==nv-1: z+=0.05*(0.5+0.5*math.cos(u*9.0))
      G[i,j]=[x,y,z]
  # top row folds over the shoulders toward the front (half way)
  top=G[:,0,:].copy()
  for i in range(nu):
    x=top[i,0]; h=ray([x,top[i,1]-0.08,1.5],[0,0,-1],BVHB); tz=h[2] if h is not None else z0
    G[i,0]=[x,top[i,1]-0.08,max(z0,tz+0.02)]
  p=sheet_solid(G,0.012,CL,outward=[0,0,0.6]); 
  # inside face = the lining colour
  n=nu*nv; p.C=np.vstack([np.tile(CL,(n,1)),np.tile(LIN,(n,1))]); parts.append(p)
  # collar round the back of the neck + gold clasps
  nc=np.array([0,yc+0.02,z0+0.01])
  if item=='cape_royal':
    parts.append(torus(nc,0.17,0.04,[0,0,1],COL('#f6f2e8'),seg(24),seg(8),arc=math.pi*1.05,a0=-0.02))
    for k in range(5): a=0.25+k*0.65; parts.append(ellipsoid(nc+np.array([math.cos(a)*0.17,math.sin(a)*0.17,0.03]),[0.008,0.008,0.012],INK,seg(6),seg(4),outline=False))
  else:
    parts.append(torus(nc,0.16,0.022,[0,0,1],CL,seg(24),seg(8),arc=math.pi*1.05,a0=-0.02))
  for sx in (1,-1): parts.append(ellipsoid([sx*0.16,yc-0.02,z0+0.0],[0.022,0.012,0.022],GOLD,seg(12),seg(6)))
  if item=='cape_captain': 
    for i in range(nu): pass
# ---------------------------------------------------------------- PETS (skinned: spine, left shoulder like the parrot)
if item.startswith('pet_'):
  skin={'spine':0}
  # shoulder top, outside the head on the character's left
  sxp=0.30 if not F else 0.30
  h=ray([sxp,0.0,1.6],[0,0,-1],BVHB); sz=float(h[2]) if h is not None else 0.8
  hh=ray([1.0,0.0,sz+0.12],[-1,0,0],BVHB); hx=float(hh[0]) if hh is not None else 0.25
  base=np.array([0.29,0.03,float(HEAD[2])-0.01])   # v2: on the trapezius beside the head (the idle pose drops the arms: the A-pose shoulder top is not under it)
  LM['pet_base']=base.round(4).tolist()
  if item=='pet_monkey':
    FUR=COL('#7a4a2a'); FURD=COL('#5a3420'); FACE=COL('#f0c9a0')
    b=base+np.array([0.02,0,0.085])
    parts.append(ellipsoid(b,[0.055,0.05,0.07],FUR,seg(14),seg(9)))
    hd=b+np.array([0.0,-0.02,0.095]); parts.append(ellipsoid(hd,[0.058,0.052,0.052],FUR,seg(16),seg(10)))
    parts.append(ellipsoid(hd+np.array([0,-0.034,-0.008]),[0.042,0.03,0.034],FACE,seg(14),seg(8)))
    for sx in (1,-1):
      parts.append(ellipsoid(hd+np.array([sx*0.06,0.0,0.01]),[0.012,0.022,0.024],FACE,seg(10),seg(6)))
      parts.append(ellipsoid(hd+np.array([sx*0.017,-0.062,0.006]),[0.009,0.006,0.011],INK,seg(8),seg(5),outline=False))
      parts.append(tube([b+np.array([sx*0.04,-0.02,0.03]),b+np.array([sx*0.05,-0.05,-0.02]),b+np.array([sx*0.03,-0.06,-0.07])],[0.016,0.014,0.013],FUR,seg(8)))
      parts.append(tube([b+np.array([sx*0.035,0,-0.05]),b+np.array([sx*0.05,-0.05,-0.075]),b+np.array([sx*0.045,-0.07,-0.1])],[0.02,0.017,0.015],FURD,seg(8)))
    parts.append(ellipsoid(hd+np.array([0,-0.063,-0.022]),[0.012,0.004,0.004],INK,seg(8),seg(4),outline=False))
    T=[b+np.array([0,0.05,-0.04]),b+np.array([0.02,0.1,-0.1]),b+np.array([0.02,0.12,-0.2]),b+np.array([-0.01,0.09,-0.26]),b+np.array([-0.03,0.06,-0.23])]
    parts.append(tube(T,[0.013,0.012,0.011,0.01,0.009],FURD,seg(8)))
    parts.append(torus(hd+np.array([0,0,0.05]),0.035,0.012,[0,0,1],COL('#d8262c'),seg(14),seg(6)))  # a little red fez band
    parts.append(ellipsoid(hd+np.array([0,0,0.068]),[0.03,0.03,0.022],COL('#d8262c'),seg(12),seg(6)))
  else:
    black=item=='pet_cat_black'
    FUR=COL('#26232a') if black else COL('#e08a3a'); FURD=COL('#141216') if black else COL('#b8621f'); EYE_=COL('#f2c230') if black else COL('#3f8f3a')
    b=base+np.array([0.0,0.0,0.05])
    parts.append(ellipsoid(b,[0.06,0.11,0.048],FUR,seg(16),seg(9)))  # lying along the shoulder, front to back
    if not black:
      for k in range(3): parts.append(ellipsoid(b+np.array([0,0.04-k*0.035,0.04]),[0.05,0.01,0.012],FURD,seg(10),seg(5),outline=False))
    hd=b+np.array([0,-0.11,0.04]); parts.append(ellipsoid(hd,[0.058,0.05,0.05],FUR,seg(16),seg(10)))
    parts.append(ellipsoid(hd+np.array([0,-0.04,-0.016]),[0.026,0.018,0.018],COL('#f4f1e8') if not black else COL('#3a3640'),seg(10),seg(6)))
    for sx in (1,-1):
      ear=hd+np.array([sx*0.032,0.005,0.045])
      parts.append(ellipsoid(ear,[0.018,0.01,0.026],FUR,seg(8),seg(5),rot([0,1,0],-sx*0.35),e=0.8))
      parts.append(ellipsoid(hd+np.array([sx*0.021,-0.046,0.008]),[0.009,0.006,0.01],EYE_,seg(8),seg(5),outline=False))
      parts.append(ellipsoid(hd+np.array([sx*0.021,-0.051,0.008]),[0.003,0.002,0.008],INK,seg(6),seg(4),outline=False))
      parts.append(tube([b+np.array([sx*0.04,-0.08,-0.01]),b+np.array([sx*0.05,-0.1,-0.06]),b+np.array([sx*0.045,-0.11,-0.09])],[0.015,0.013,0.013],FUR,seg(8)))
    parts.append(ellipsoid(hd+np.array([0,-0.06,0.0]),[0.007,0.004,0.005],COL('#e05a8a'),seg(6),seg(4),outline=False))
    T=[b+np.array([0,0.1,0]),b+np.array([0.03,0.14,-0.05]),b+np.array([0.03,0.15,-0.13]),b+np.array([0.0,0.13,-0.19])]
    parts.append(tube(T,[0.016,0.014,0.013,0.012],FUR,seg(8)))
    parts.append(torus(hd+np.array([0,0.005,-0.045]),0.038,0.008,[0,0.3,1],COL('#d8262c'),seg(16),seg(6)))  # red collar + gold bell
    parts.append(ellipsoid(hd+np.array([0,-0.034,-0.06]),[0.011,0.011,0.011],GOLD,seg(8),seg(6)))

# ---------------------------------------------------------------- SPECIAL PEG LEGS (skinned: shin.L / shin.R; same seat as Raul's peg: knee cup + shaft to the floor)
# Separate parts (cup, cushion, shaft, ornament, tip) so a later peg fit fix can re-seat them: FIT params -> tools/peg_fit_<who>_<lod>.json
if item.startswith(('peg_gold_','peg_kraken_')):
  sd=item[-1]; sx=1 if sd=='l' else -1; bnm=f'shin.{sd.upper()}'; skin={bnm:0}
  kz=float(bone(bnm)[2]); X=sx*BV[:,0]; mk=(X>0)&(X<0.3)&(np.abs(BV[:,2]-kz)<0.03)
  kx=float((X[mk].min()+X[mk].max())/2); ky=float((BV[mk,1].min()+BV[mk,1].max())/2); kw=float(max(np.ptp(X[mk]),np.ptp(BV[mk,1])))
  FIT=dict(knee=[sx*kx,ky,kz],knee_width=kw,cup_r=kw*0.56,cup_z=kz-0.005,shaft_top=kz-0.05,tip=[sx*kx,ky,0.0],hide_below_z=kz-0.01)
  json.dump(FIT,open(f'/workspace/brand/v5_models/raul_shop_items_2/tools/peg_fit_{item}_{who}_{lod}.json','w'),indent=1)
  K=np.array(FIT['knee']); cr=FIT['cup_r']; cz=FIT['cup_z']; T0=np.array([K[0],K[1],FIT['shaft_top']]); TIP=np.array(FIT['tip'])
  if item.startswith('peg_gold'):
    G1=COL('#f2c230'); G2=COL('#c88a16'); RUBY=COL('#d8162c'); VEL=COL('#7a1424')
    parts.append(ellipsoid([K[0],K[1],cz],[cr,cr,0.05],G1,seg(18),seg(9),e=0.85))                          # gilded knee cup
    parts.append(torus([K[0],K[1],cz+0.035],cr*0.96,0.012,[0,0,1],G2,seg(22),seg(6)))                       # rim band
    parts.append(ellipsoid([K[0],K[1],cz+0.045],[cr*0.86,cr*0.86,0.02],VEL,seg(16),seg(6)))                 # velvet cushion
    P=[T0+(TIP+np.array([0,0,0.02])-T0)*t for t in np.linspace(0,1,7)]; parts.append(tube(P,np.linspace(0.034,0.02,7),G1,seg(12)))   # shaft
    for t in (0.18,0.62,0.92): q=T0+(TIP-T0)*t; parts.append(torus(q,0.034-0.014*t,0.007,[0,0,1],G2,seg(16),seg(6)))
    sk=T0+(TIP-T0)*0.4+np.array([0,-0.03,0])                                                                # carved gold skull, ruby eyes
    parts.append(ellipsoid(sk,[0.032,0.028,0.034],G1,seg(14),seg(9))); parts.append(ellipsoid(sk+np.array([0,-0.008,-0.03]),[0.02,0.018,0.012],G2,seg(10),seg(6)))
    for e2 in (1,-1): parts.append(ellipsoid(sk+np.array([e2*0.012,-0.026,0.004]),[0.008,0.004,0.008],RUBY,seg(8),seg(5),outline=False))
    parts.append(ellipsoid([K[0],K[1]-cr*0.95,cz+0.005],[0.016,0.01,0.02],RUBY,seg(10),seg(6),e=0.6))      # gem on the cup front
    parts.append(ellipsoid([TIP[0],TIP[1],0.012],[0.026,0.026,0.012],G2,seg(12),seg(5)))                   # gold foot cap
  else:
    BN=COL('#efe6cf'); BND=COL('#c9b892'); KR=COL('#7a3fb0'); KRD=COL('#4e2478'); SUCK=COL('#f0c6d8')
    parts.append(ellipsoid([K[0],K[1],cz],[cr,cr,0.05],BND,seg(18),seg(9),e=0.85))                         # bone knee cup
    parts.append(torus([K[0],K[1],cz+0.035],cr*0.96,0.012,[0,0,1],KRD,seg(22),seg(6)))
    P=[T0+(TIP+np.array([0,0,0.03])-T0)*t for t in np.linspace(0,1,7)]; parts.append(tube(P,np.array([0.03,0.024,0.022,0.022,0.024,0.026,0.03]),BN,seg(12)))  # bone shaft (knobby ends)
    for z_ in (TIP[2]+0.035,): 
      for e2 in (1,-1): parts.append(ellipsoid([TIP[0]+e2*0.018,TIP[1],z_],[0.022,0.024,0.022],BN,seg(10),seg(6)))
    sp=[]; L=np.linalg.norm(T0-TIP)                                                                          # kraken tentacle spiralling down the bone
    for k in range(26):
      t=k/25; q=T0+(TIP-T0)*t; a=t*math.pi*4.2; r=0.036
      sp.append(q+np.array([math.cos(a)*r,math.sin(a)*r,0]))
    sp+= [TIP+np.array([0.05*sx,-0.045,0.02]),TIP+np.array([0.065*sx,-0.07,0.05])]
    rad=np.r_[np.linspace(0.02,0.012,26),[0.009,0.006]]; parts.append(tube(sp,rad,KR,seg(10)))
    for k in range(2,26,3): parts.append(ellipsoid(sp[k]+(sp[k]-(T0+(TIP-T0)*(k/25)))*0.42,[0.007,0.007,0.007],SUCK,seg(6),seg(4),outline=False))
  LM['peg_fit']=FIT
if not parts: raise SystemExit('unknown item '+item)
m=finish(parts,ink=(0.0035 if HI else 0.006) if not item.startswith(('tooth','grill')) else 0.0,lowlight=not HI and item not in ('beard_moustache','beard_forked','cape_captain'))
# ---- blender mesh
me=bpy.data.meshes.new(f'{item}_{who}_{lod}'); me.from_pydata(m.V.tolist(),[],m.F.tolist()); me.update()
for p_ in me.polygons: p_.use_smooth=True
ca=me.color_attributes.new('Color','FLOAT_COLOR','POINT')
ca.data.foreach_set('color',np.hstack([m.C,np.ones((len(m.C),1))]).astype(np.float32).ravel())
me.color_attributes.active_color=ca
mat=bpy.data.materials.new(item); mat.use_nodes=True; nt=mat.node_tree; vc=nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name='Color'; nt.links.new(vc.outputs[0],nt.nodes['Principled BSDF'].inputs['Base Color']); me.materials.append(mat)
ob=bpy.data.objects.new(me.name,me); bpy.context.scene.collection.objects.link(ob)
if skin:
  ob.parent=arm; md=ob.modifiers.new('Armature','ARMATURE'); md.object=arm
  for bn_,sx in skin.items():
    g=ob.vertex_groups.new(name=bn_); idx=[i for i in range(len(m.V)) if (sx==0 or np.sign(m.V[i,0])==sx)]
    g.add(idx,1.0,'REPLACE')
for o in list(bpy.data.objects):
  if o not in (ob,arm): bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
if skin: arm.select_set(True)
else: bpy.data.objects.remove(arm)
os.makedirs(OUT,exist_ok=True); fn=f'{OUT}/{item}_{who}_{lod}.glb'
bpy.ops.export_scene.gltf(filepath=fn,export_format='GLB',use_selection=True,export_skins=bool(skin),export_animations=False,export_yup=True,export_vertex_color='ACTIVE',export_attributes=False,export_materials='EXPORT')
print('BUILT',item,who,lod,'tris',len(m.F),'verts',len(m.V),'kb',os.path.getsize(fn)//1024,json.dumps(LM))
