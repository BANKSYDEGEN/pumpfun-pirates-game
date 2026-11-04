// [v212] BANKSY 1:23 PM "number the buildings in those areas for me": writes assets/island/building_numbers.json ONCE (stable numbers:
// an existing file is never renumbered; new buildings would be appended). Town-local lx / lz (js/island/coast.js) + foot-frame x / z.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { RENTABLE_SHOPS, MAIN_ST_SHOPS } from '../js/island/hillShops.js';
const OUT = new URL('../assets/island/building_numbers.json', import.meta.url);
if (existsSync(OUT) && !process.argv.includes('--force')) { console.log('kept (stable):', OUT.pathname); process.exit(0); }
const t2w = (lx, lz) => [+(-640 - lz).toFixed(2), +(-90 + lx).toFixed(2)];   // coast.js T = {x:-640, z:-90, yaw:-PI/2}
const src = readFileSync(new URL('../js/island/plazaTown.js', import.meta.url), 'utf8');
const SF = [...src.matchAll(/\{ id: '(shop_\w+)', name: '([^']+)'[^}]*?lx: (-?[\d.]+), w: ([\d.]+)/g)].map(m => ({ id: m[1], name: m[2], lx: +m[3], w: +m[4] }));
const B = []; const add = (o) => { const [x, z] = t2w(o.lx, o.lz); B.push({ n: B.length + 1, ...o, x, z }); };
const use = { shop_clothes: 'CLOTHES SHOP', shop_pets: 'PET STORE', shop_ships: 'SHIP SHOP (skins)', shop_upgrades: 'UPGRADE SHOP', shop_crew: 'CREW SHOP' };
const plaza = [...SF.map(s => ({ id: s.id, lx: s.lx, w: s.w, use: use[s.id] })),
  { id: 'hall_w', lx: -25, w: 16, use: 'TOKEN HALL 1 ($SUNK $AHOY $PUMP boards)' }, { id: 'hall_e', lx: 47, w: 18, use: 'TOKEN HALL 2 ($HQ $RETARDIO, trending row)' },
  { id: 'exchange', lx: 62, w: 6, use: 'TOKEN EXCHANGE counter' }, { id: 'tavern', lx: 70, w: 8, use: 'TAVERN (no shop)' },
  { id: 'house_e', lx: 77.9, w: 7, use: 'EMPTY stone house (no shop, no door prompt)' }, { id: 'tower', lx: 86, w: 9, use: 'HARBOR TOWER' }].sort((a, b) => a.lx - b.lx);
for (const p of plaza) add({ ...p, area: 'dock plaza', kind: 'building', lz: -36, d: 12 });
const STALL_USE = { 34: 'MARKETPLACE (v212)', 50: 'FISH STAND (v212)' };
for (const lx of [-50, -42, -34, -26, -18, 26, 34, 50]) add({ id: 'stall_' + lx, area: 'dock plaza', kind: 'stand', lx, lz: -17, w: 3.4, d: 2.2, use: STALL_USE[lx] || 'EMPTY market stand (decor, no prompt)' });
const H = [...RENTABLE_SHOPS, ...MAIN_ST_SHOPS].sort((a, b) => (a.lx > 6) - (b.lx > 6) || b.lz - a.lz);
const HUSE = { rent_1: 'ANTIQUES (v212)', rent_big: 'SQUAD HALL', sword_shop: 'SWORD SHOP', musket_shop: 'MUSKET SHOP' };
for (const s of H) add({ id: s.id, area: 'hill street', kind: 'building', lot: s.lot, lx: s.lx, lz: s.lz, w: s.d, d: s.w, door: s.door, use: HUSE[s.id] || 'EMPTY shop (rentable, no prompt)' });
writeFileSync(OUT, JSON.stringify({ note: 'stable building numbers (BANKSY 1:23 PM); lx/lz town-local, x/z foot frame; w along lx, d along lz', buildings: B }, null, 1) + '\n');
console.log('wrote', B.length);
