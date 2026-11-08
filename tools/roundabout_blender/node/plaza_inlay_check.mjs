// Geometry-only regression, no network or production data.
globalThis.fetch = undefined;
const root = new URL('../../../', import.meta.url).href;
const THREE = await import('three');
const {seatPlazaInlay,RB2} = await import(root+'js/island/areas/hillRound.js');
const {M} = await import(root+'js/island/kit.js');
const [x,z]=RB2.c,[x0,x1,z0,z1]=RB2.plaza;
const geos=[seatPlazaInlay(new THREE.CylinderGeometry(14,14,.02,56),M(x,RB2.y+.005,z))];
for(let i=0;i<64;i++){const a=(i+.5)/64*Math.PI*2;geos.push(seatPlazaInlay(new THREE.BoxGeometry(.5,.03,1.45),M(x+Math.sin(a)*14.1,RB2.y+.01,z+Math.cos(a)*14.1,a+Math.PI/2)));}
let escaped=0,badNormals=0,maxY=-Infinity;
for(const g of geos){const p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<p.count;i++){
 if(p.getX(i)<x0+.019||p.getX(i)>x1-.019||p.getZ(i)<z0+.019||p.getZ(i)>z1-.019)escaped++;
 maxY=Math.max(maxY,p.getY(i));if(!Number.isFinite(n.getX(i)+n.getY(i)+n.getZ(i))||Math.hypot(n.getX(i),n.getY(i),n.getZ(i))<.5)badNormals++;
}}
console.log(JSON.stringify({escaped,badNormals,maxY,ceiling:RB2.y+.035}));
