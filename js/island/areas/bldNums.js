// [v212] BANKSY 1:23 PM "number the buildings in those areas for me": &bldnum=1 floats each building's / stand's number (and its use)
// over the dock plaza + hill street, from assets/island/building_numbers.json (stable: "put Antiques in #7" = that file's n 7). Off by default.
import * as THREE from 'three';
const ON = typeof location !== 'undefined' && new URLSearchParams(location.search).get('bldnum') === '1';
let LIST = [];
const ready = ON && typeof fetch === 'function' ? fetch(new URL('../../../assets/island/building_numbers.json', import.meta.url)).then(r => r.ok ? r.json() : null).then(j => { LIST = j?.buildings || []; }).catch(() => {}) : Promise.resolve();
await ready;
function tag(n, use) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const x = c.getContext('2d');
  x.fillStyle = 'rgba(22,22,22,.85)'; x.beginPath(); x.roundRect(4, 4, 248, 152, 24); x.fill(); x.strokeStyle = '#ffcd77'; x.lineWidth = 6; x.stroke();
  x.fillStyle = '#ffcd77'; x.textAlign = 'center'; x.font = 'bold 96px Georgia, serif'; x.fillText('#' + n, 128, 96);
  x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.fillText(String(use).split(' (')[0].slice(0, 20), 128, 138);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(4.8, 3, 1); s.renderOrder = 999; return s;
}
export default {
  id: 'bld_nums', name: 'Building numbers (&bldnum=1)', rect: [-630, -420, -150, 20],
  terrain: { pads: [], paths: [] },
  register() {},
  build({ H }) { const near = new THREE.Group(); near.name = 'area_bld_nums';
    if (ON && typeof document !== 'undefined') for (const b of LIST) { const s = tag(b.n, b.use); s.position.set(b.x, H(b.x, b.z) + (b.kind === 'stand' ? 5 : 13), b.z); near.add(s); }
    return { near }; },
  label() { return null; }, activate() { return null; },
};
