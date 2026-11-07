import json,struct,numpy as np,copy
from pathlib import Path
class GLB:
 def __init__(self,path):
  self.path=str(path);b=Path(path).read_bytes();n=struct.unpack_from('<I',b,12)[0];self.d=json.loads(b[20:20+n]);off=20+n;self.bin=bytearray(b[off+8:off+8+struct.unpack_from('<I',b,off)[0]])
 def bv(self,i):
  b=self.d['bufferViews'][i];s=b.get('byteOffset',0);return bytes(self.bin[s:s+b['byteLength']])
 def array(self,i):
  a=self.d['accessors'][i];v=self.d['bufferViews'][a['bufferView']];dt={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']];sz={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];stride=v.get('byteStride',np.dtype(dt).itemsize*sz);out=np.ndarray((a['count'],sz),dtype=dt,buffer=self.bin,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(stride,np.dtype(dt).itemsize)).copy();return out[:,0] if sz==1 else out
 def add_bv(self,b):
  while len(self.bin)%4:self.bin.append(0)
  v={'buffer':0,'byteOffset':len(self.bin),'byteLength':len(b)};self.bin.extend(b);self.d.setdefault('bufferViews',[]).append(v);return len(self.d['bufferViews'])-1
 def add_array(self,a,typ,ct=5126,bounds=False):
  a=np.asarray(a,dtype={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[ct]);v=self.add_bv(a.tobytes());q={'bufferView':v,'componentType':ct,'count':len(a),'type':typ}
  if bounds:q.update(min=np.atleast_1d(a.min(0)).tolist(),max=np.atleast_1d(a.max(0)).tolist())
  self.d.setdefault('accessors',[]).append(q);return len(self.d['accessors'])-1
 def save(self,path):
  self.d['buffers']=[{'byteLength':len(self.bin)}];j=json.dumps(self.d,separators=(',',':')).encode();j+=b' '*((-len(j))%4);b=bytes(self.bin);b+=b'\0'*((-len(b))%4);Path(path).write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(b))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(b),0x004e4942)+b)
