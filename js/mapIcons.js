// [v153] BANKSY: "upgrade mini map icons for shops" + MINIMAP STYLE (settings: COLORED default / PAPER).
// [minimap-themes] BANKSY 2026-11-04 10:34 AM: "Do the mini map upgrades, better icons and different themes".
//   One round badge per place, drawn as vector glyphs (no emoji: same look on every phone + desktop, crisp at any size):
//   bold dark outline, the place's colour, a white glyph. Keyed by the interact / landmark id (plaza STOREFRONTS, hill street
//   shops, js/mapLandmarks.js), so a new shop shows up as soon as an interact point with that id exists. Unknown shops: a gold '$'.
//   THEMES (the MINIMAP setting, saved per device under the same key as v153): COLORED (default), PAPER (the MAPS parchment),
//   NIGHT, GOLD (parchment-gold), BLUEPRINT, TREASURE MAP (BANKSY 11:57: the paper treasure-map chart). Old saved values keep working: 'paper' stays PAPER, anything unknown = COLORED.
//   BANKSY 11:57 "I want the color dots for shops changed": every badge is a LIGHT disc with a dark outline + a pictogram in the shop's colour (no solid colour dots).
export const MAP_STYLE_KEY = 'pfp_minimap_style';
export const THEMES = {
  colored: { label: 'COLORED', sea: '#174f70', ring: 'rgba(255,205,119,.55)', ringW: 2, nBg: 'rgba(22,22,22,.75)', nFg: '#ffcd77', badge: 'colored', ink: '#161616', me: '#fff', x: '#ff3b3b', paint: null },
  paper: { label: 'PAPER', sea: '#cdbf96', ring: '#3b2410', ringW: 3, nBg: 'rgba(59,36,16,.85)', nFg: '#f3e3b5', badge: 'paper', ink: '#3b2410', me: '#fff8e6', x: '#b5150d',
    paint: (r, g, b) => { const l = (0.3 * r + 0.59 * g + 0.11 * b) / 255; return [128 + 110 * l, 112 + 98 * l, 78 + 72 * l]; } }, // [minimap-themes] plain sepia paper (the chart art moved to TREASURE MAP)
  treasure: { label: 'TREASURE MAP', sea: '#d9c08a', ring: '#5a2d0c', ringW: 4, nBg: 'rgba(90,45,12,.92)', nFg: '#f6e2b0', badge: 'paper', ink: '#3b2410', me: '#fff8e6', x: '#b5150d', paint: null, sheet: true, burn: true }, // BANKSY 11:57: the MAPS parchment chart itself
  night: { label: 'NIGHT', sea: '#07111d', ring: 'rgba(120,200,255,.6)', ringW: 2, nBg: 'rgba(4,10,20,.85)', nFg: '#9fd8ff', badge: 'night', ink: '#050a12', me: '#e8f6ff', x: '#ff5a4e',
    paint: (r, g, b) => { const l = 0.3 * r + 0.59 * g + 0.11 * b; return [r * 0.28 + l * 0.06, g * 0.3 + l * 0.08, b * 0.34 + l * 0.16 + 14]; } },
  gold: { label: 'GOLD', sea: '#5b3f14', ring: '#ffcd3c', ringW: 3, nBg: 'rgba(60,34,6,.9)', nFg: '#ffd863', badge: 'gold', ink: '#3a2205', me: '#fff4cf', x: '#c0170e',
    paint: (r, g, b) => { const l = (0.3 * r + 0.59 * g + 0.11 * b) / 255; return [70 + 185 * l, 46 + 160 * l, 12 + 80 * l]; } },
  blueprint: { label: 'BLUEPRINT', sea: '#0b3772', ring: 'rgba(225,240,255,.85)', ringW: 2, nBg: 'rgba(6,30,66,.9)', nFg: '#e6f2ff', badge: 'line', ink: '#e6f2ff', me: '#ffffff', x: '#ffd84a',
    paint: (r, g, b) => { const l = (0.3 * r + 0.59 * g + 0.11 * b) / 255; return [16 + 60 * l, 66 + 90 * l, 138 + 100 * l]; } },
};
export const THEME_IDS = Object.keys(THEMES);
export const getMapStyle = () => { try { const v = localStorage.getItem(MAP_STYLE_KEY); return v && THEMES[v] ? v : 'colored'; } catch { return 'colored'; } };
export const setMapStyle = (s) => { try { THEMES[s] && s !== 'colored' ? localStorage.setItem(MAP_STYLE_KEY, s) : localStorage.removeItem(MAP_STYLE_KEY); } catch {} };
export const mapTheme = () => THEMES[getMapStyle()];
const INK = '#3b2410', PAPER = '#f3e3b5';
// glyphs: unit space (badge radius = 1), drawn with the current fill / stroke
const poly = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); };
const sabre = (c, w = 0.16) => { c.lineCap = 'round'; c.lineWidth = w; c.beginPath(); c.moveTo(0.04, -0.72); c.quadraticCurveTo(0.14, -0.2, 0, 0.3); c.stroke();
  c.lineWidth = w * 0.9; c.beginPath(); c.moveTo(-0.24, 0.32); c.lineTo(0.24, 0.32); c.stroke(); c.lineWidth = w * 0.8; c.beginPath(); c.moveTo(0, 0.36); c.lineTo(0, 0.64); c.stroke(); };
const G = {
  shirt(c) { c.beginPath(); c.moveTo(-0.2, -0.56); c.lineTo(-0.62, -0.36); c.lineTo(-0.5, -0.04); c.lineTo(-0.34, -0.12); c.lineTo(-0.34, 0.58); c.lineTo(0.34, 0.58); c.lineTo(0.34, -0.12);
    c.lineTo(0.5, -0.04); c.lineTo(0.62, -0.36); c.lineTo(0.2, -0.56); c.quadraticCurveTo(0, -0.3, -0.2, -0.56); c.closePath(); c.fill(); },
  parrot(c, acc) { c.beginPath(); c.ellipse(-0.04, 0.12, 0.3, 0.42, 0.25, 0, 7); c.fill(); c.beginPath(); c.arc(0.06, -0.36, 0.27, 0, 7); c.fill();
    poly(c, [[-0.16, 0.42], [-0.36, 0.84], [0.06, 0.5]]); c.fill();
    c.fillStyle = acc; c.beginPath(); c.moveTo(0.26, -0.5); c.quadraticCurveTo(0.66, -0.46, 0.5, -0.1); c.quadraticCurveTo(0.44, -0.3, 0.26, -0.22); c.closePath(); c.fill();
    c.fillStyle = '#161616'; c.beginPath(); c.arc(0.12, -0.4, 0.07, 0, 7); c.fill(); },
  ship(c) { c.beginPath(); c.moveTo(-0.66, 0.24); c.lineTo(0.66, 0.24); c.quadraticCurveTo(0.5, 0.6, 0, 0.6); c.quadraticCurveTo(-0.5, 0.6, -0.66, 0.24); c.fill();
    c.fillRect(-0.04, -0.66, 0.08, 0.92); poly(c, [[0.08, -0.6], [0.5, 0.14], [0.08, 0.14]]); c.fill(); poly(c, [[-0.08, -0.46], [-0.08, 0.14], [-0.44, 0.14]]); c.fill(); },
  upgrade(c) { poly(c, [[0, -0.66], [0.56, -0.06], [0.22, -0.06], [0.22, 0.34], [-0.22, 0.34], [-0.22, -0.06], [-0.56, -0.06]]); c.fill(); c.fillRect(-0.22, 0.44, 0.44, 0.14); },
  crew(c) { for (const [x, y, sc] of [[-0.4, 0.08, 0.78], [0.4, 0.08, 0.78], [0, -0.02, 1]]) { c.beginPath(); c.arc(x, y - 0.26 * sc, 0.18 * sc, 0, 7); c.fill();
      c.beginPath(); c.moveTo(x - 0.3 * sc, y + 0.52 * sc); c.quadraticCurveTo(x - 0.3 * sc, y - 0.02 * sc, x, y - 0.02 * sc); c.quadraticCurveTo(x + 0.3 * sc, y - 0.02 * sc, x + 0.3 * sc, y + 0.52 * sc); c.closePath(); c.fill(); }
    poly(c, [[-0.34, -0.42], [0, -0.66], [0.34, -0.42], [0, -0.48]]); c.fill(); },
  swords(c) { for (const s of [-1, 1]) { c.save(); c.rotate(s * Math.PI / 4); sabre(c); c.restore(); } },
  sabre(c) { c.save(); c.rotate(Math.PI / 5); sabre(c, 0.2); c.restore(); },
  musket(c) { c.save(); c.rotate(-Math.PI / 4); c.fillRect(-0.74, -0.06, 0.96, 0.12);
    poly(c, [[0.16, -0.1], [0.74, -0.14], [0.78, 0.24], [0.5, 0.2], [0.16, 0.08]]); c.fill();
    c.fillRect(0.02, 0.06, 0.06, 0.18); c.fillRect(-0.62, -0.16, 0.06, 0.1); c.restore(); },
  coin(c) { c.font = 'bold 1.2px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 0, 0.06); },
  stall(c) { poly(c, [[-0.66, -0.2], [-0.5, -0.56], [0.5, -0.56], [0.66, -0.2]]); c.fill(); // striped awning
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-0.495 + i * 0.33, -0.2, 0.165, 0, Math.PI); c.fill(); }
    c.fillRect(-0.56, 0.06, 0.1, 0.52); c.fillRect(0.46, 0.06, 0.1, 0.52); c.fillRect(-0.56, 0.2, 1.12, 0.14); },
  bigshop(c, acc, hole) { poly(c, [[-0.62, -0.1], [0, -0.66], [0.62, -0.1]]); c.fill(); c.fillRect(-0.5, -0.1, 1.0, 0.66); // hall + door + coin
    c.save(); c.fillStyle = hole; c.fillRect(-0.16, 0.18, 0.32, 0.38); c.beginPath(); c.arc(0, -0.28, 0.13, 0, 7); c.fill(); c.restore(); },
  dock(c) { c.lineCap = 'round'; c.lineWidth = 0.15; c.beginPath(); c.arc(0, -0.52, 0.13, 0, 7); c.stroke(); // anchor
    c.beginPath(); c.moveTo(0, -0.38); c.lineTo(0, 0.6); c.moveTo(-0.3, -0.2); c.lineTo(0.3, -0.2); c.stroke(); c.beginPath(); c.arc(0, 0.06, 0.54, 0.25 * Math.PI, 0.75 * Math.PI); c.stroke();
    poly(c, [[-0.6, 0.3], [-0.44, 0.5], [-0.3, 0.26]]); c.fill(); poly(c, [[0.6, 0.3], [0.44, 0.5], [0.3, 0.26]]); c.fill(); },
  castle(c, acc, hole) { c.fillRect(-0.6, -0.1, 1.2, 0.66); for (const x of [-0.6, -0.27, 0.06, 0.39]) c.fillRect(x, -0.3, 0.2, 0.22); // wall + crenels
    c.fillRect(-0.2, -0.62, 0.4, 0.6); c.fillRect(-0.24, -0.72, 0.12, 0.14); c.fillRect(0.12, -0.72, 0.12, 0.14);
    c.save(); c.fillStyle = hole; c.beginPath(); c.moveTo(-0.15, 0.56); c.lineTo(-0.15, 0.24); c.arc(0, 0.24, 0.15, Math.PI, 0); c.lineTo(0.15, 0.56); c.closePath(); c.fill(); c.restore(); },
  fort(c) { c.beginPath(); c.arc(0.06, 0.18, 0.3, 0, 7); c.fill(); c.save(); c.rotate(-0.5); c.fillRect(-0.04, -0.1, 0.72, 0.24); c.restore(); // cannon on wheels
    c.fillRect(-0.62, 0.42, 1.24, 0.14); c.beginPath(); c.arc(-0.48, -0.46, 0.13, 0, 7); c.arc(-0.2, -0.56, 0.1, 0, 7); c.fill(); },
  battle(c) { G.swords(c); c.beginPath(); c.arc(0, -0.05, 0.14, 0, 7); c.fill(); },
  ruins(c) { for (let i = 0; i < 4; i++) c.fillRect(-0.6 + i * 0.15, 0.36 - i * 0.24, 1.2 - i * 0.3, 0.18); c.fillRect(-0.5, -0.66, 0.16, 0.5); c.fillRect(0.34, -0.66, 0.16, 0.5); }, // steps + gateway
  idol(c, acc, hole) { c.beginPath(); c.moveTo(-0.4, 0.62); c.lineTo(-0.44, -0.4); c.quadraticCurveTo(0, -0.84, 0.44, -0.4); c.lineTo(0.4, 0.62); c.closePath(); c.fill();
    c.save(); c.fillStyle = hole; c.fillRect(-0.28, -0.3, 0.2, 0.12); c.fillRect(0.08, -0.3, 0.2, 0.12); c.fillRect(-0.2, 0.12, 0.4, 0.1); c.restore(); },
  camp(c, acc) { c.beginPath(); c.moveTo(0, -0.66); c.quadraticCurveTo(0.42, -0.1, 0.24, 0.24); c.quadraticCurveTo(0, 0.36, -0.24, 0.24); c.quadraticCurveTo(-0.42, -0.1, 0, -0.66); c.fill(); // flame + logs
    c.lineCap = 'round'; c.lineWidth = 0.16; c.beginPath(); c.moveTo(-0.56, 0.6); c.lineTo(0.56, 0.36); c.moveTo(0.56, 0.6); c.lineTo(-0.56, 0.36); c.stroke();
    c.fillStyle = acc; c.beginPath(); c.moveTo(0, -0.3); c.quadraticCurveTo(0.18, 0, 0.08, 0.16); c.lineTo(-0.08, 0.16); c.quadraticCurveTo(-0.18, 0, 0, -0.3); c.fill(); },
  paw(c) { c.beginPath(); c.ellipse(0, 0.26, 0.34, 0.28, 0, 0, 7); c.fill(); for (const [x, y] of [[-0.46, -0.12], [-0.18, -0.46], [0.18, -0.46], [0.46, -0.12]]) { c.beginPath(); c.ellipse(x, y, 0.14, 0.18, x * 0.6, 0, 7); c.fill(); } },
  crewhat(c) { c.beginPath(); c.moveTo(-0.72, 0.1); c.quadraticCurveTo(-0.4, -0.62, 0, -0.42); c.quadraticCurveTo(0.4, -0.62, 0.72, 0.1); c.quadraticCurveTo(0, -0.08, -0.72, 0.1); c.fill(); // tricorn + two heads under it
    for (const x of [-0.26, 0.26]) { c.beginPath(); c.arc(x, 0.34, 0.17, 0, 7); c.fill(); } c.fillRect(-0.5, 0.52, 1.0, 0.12); },
  chest(c, acc, hole) { c.beginPath(); c.moveTo(-0.66, -0.06); c.lineTo(-0.66, -0.26); c.quadraticCurveTo(0, -0.74, 0.66, -0.26); c.lineTo(0.66, -0.06); c.closePath(); c.fill(); c.fillRect(-0.66, 0.02, 1.32, 0.56);
    c.save(); c.fillStyle = hole; c.fillRect(-0.66, -0.06, 1.32, 0.08); c.fillRect(-0.12, -0.12, 0.24, 0.3); c.restore(); },
  fish(c, acc, hole) { c.beginPath(); c.ellipse(-0.08, 0, 0.5, 0.3, 0, 0, 7); c.fill(); poly(c, [[0.34, 0], [0.74, -0.36], [0.74, 0.36]]); c.fill();
    c.save(); c.fillStyle = hole; c.beginPath(); c.arc(-0.34, -0.06, 0.07, 0, 7); c.fill(); c.restore(); },
  gem(c, acc, hole) { poly(c, [[-0.6, -0.2], [-0.32, -0.56], [0.32, -0.56], [0.6, -0.2], [0, 0.64]]); c.fill();
    c.save(); c.strokeStyle = hole; c.lineWidth = 0.08; c.beginPath(); c.moveTo(-0.6, -0.2); c.lineTo(0.6, -0.2); c.moveTo(-0.16, -0.56); c.lineTo(-0.24, -0.2); c.lineTo(0, 0.64); c.lineTo(0.24, -0.2); c.lineTo(0.16, -0.56); c.stroke(); c.restore(); },
  scales(c) { c.lineCap = 'round'; c.lineWidth = 0.12; c.beginPath(); c.moveTo(0, -0.62); c.lineTo(0, 0.5); c.moveTo(-0.56, -0.4); c.lineTo(0.56, -0.4); c.stroke(); c.fillRect(-0.3, 0.5, 0.6, 0.12);
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 0.56, -0.4); c.lineTo(s * 0.32, 0.06); c.moveTo(s * 0.56, -0.4); c.lineTo(s * 0.8, 0.06); c.lineWidth = 0.06; c.stroke(); c.beginPath(); c.arc(s * 0.56, 0.06, 0.25, 0, Math.PI); c.fill(); } },
  crown(c) { poly(c, [[-0.62, 0.34], [-0.66, -0.4], [-0.3, -0.06], [0, -0.6], [0.3, -0.06], [0.66, -0.4], [0.62, 0.34]]); c.fill(); c.fillRect(-0.62, 0.42, 1.24, 0.16); },
};
// id -> [glyph, badge colour, glyph colour (colored), accent, map label]
export const SHOP_ICONS = {
  shop_clothes: ['shirt', '#d8322f', '#fff', '#ffc93c', 'CLOTHES'],
  shop_pets: ['paw', '#1f8a5a', '#fff', '#ffb020', 'PET SHOP'],
  shop_ships: ['ship', '#2a6df4', '#fff', '#fff', 'SHIP SHOP'],
  shop_upgrades: ['upgrade', '#ffc93c', '#161616', '#161616', 'UPGRADES'],
  shop_crew: ['crewhat', '#6a4fb3', '#fff', '#fff', 'CREW SHOP'],
  sword_shop: ['swords', '#8b1e1e', '#fff', '#fff', 'SWORD SHOP'],
  musket_shop: ['musket', '#6b4423', '#fff', '#fff', 'MUSKET SHOP'],
  squadhall: ['chest', '#9b5cff', '#fff', '#ffc93c', 'BIG SHOP · SQUAD HALL'],
  fish_stand: ['fish', '#1d7fb8', '#fff', '#fff', 'FISH STAND'],   // the coming plaza shops (post/inventory-fish)
  antiques: ['gem', '#b0267a', '#fff', '#fff', 'ANTIQUES'],
  market: ['scales', '#a77a12', '#fff', '#fff', 'MARKETPLACE'],
  stall: ['stall', '#e0662b', '#fff', '#fff', 'STALL'],
  shop: ['coin', '#ffc93c', '#161616', '#161616', 'SHOP'],
  dock: ['dock', '#2b6f8f', '#fff', '#fff', 'DOCKS'],
  castle: ['castle', '#7d6b55', '#fff', '#fff', 'HILLTOP FORT'],
  fort: ['fort', '#4d5560', '#fff', '#fff', 'CLIFF BATTERY'],
  battle: ['battle', '#c81d1d', '#fff', '#fff', 'BATTLE'],
  ruins: ['ruins', '#5f7d3a', '#fff', '#fff', 'RUIN STEPS'],
  idol: ['idol', '#b8860b', '#fff', '#fff', 'IDOLS'],
  camp: ['camp', '#8a4b1e', '#ffb347', '#ffe9a8', 'CAMP'],
  commodore: ['crown', '#ffcd00', '#7a1010', '#7a1010', 'THE COMMODORE'],
};
SHOP_ICONS.invshop_fish = SHOP_ICONS.fish_stand; SHOP_ICONS.invshop_antiques = SHOP_ICONS.antiques; SHOP_ICONS.invshop_market = SHOP_ICONS.market; // post/inventory-fish triggers (at Timothy's Market Square anchors)
SHOP_ICONS.shop_swords = SHOP_ICONS.sword_shop; SHOP_ICONS.shop_muskets = SHOP_ICONS.musket_shop; // v153 ids
export const shopIcon = (q) => q && (SHOP_ICONS[q.id] || (q.kind === 'stall' ? SHOP_ICONS.stall : q.kind === 'shop' || /^shop_/.test(q.id || '') ? SHOP_ICONS.shop : null));
// a badge at (x, y), radius r (canvas px). style: a THEMES badge ('colored' | 'paper' | 'night' | 'gold' | 'line') or a theme id
export function drawShopIcon(c, ic, x, y, r, style = 'colored') {
  const st = THEMES[style] ? THEMES[style].badge : style, [g, col, fg, acc] = ic;
  const lite = st === 'colored' || st === 'night'; // BANKSY 11:57: no solid colour dots: a light disc, dark outline, the pictogram in the shop's colour
  const fill = st === 'paper' ? PAPER : st === 'gold' ? '#f6dc8c' : st === 'line' ? '#0b3772' : st === 'night' ? '#dfe9f5' : '#fff7e3';
  const edge = st === 'paper' ? INK : st === 'gold' ? '#5a3a08' : st === 'line' ? '#e6f2ff' : '#161616';
  const glyph = st === 'paper' ? INK : st === 'gold' ? '#4a2c06' : st === 'line' ? '#e6f2ff' : (col === '#ffc93c' || col === '#ffcd00' ? '#a8730a' : col);
  c.save(); c.translate(x, y);
  if (st !== 'line') { c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(r * 0.08, r * 0.14, r, 0, 7); c.fill(); }
  if (st === 'night') { c.fillStyle = 'rgba(160,220,255,0.22)'; c.beginPath(); c.arc(0, 0, r * 1.28, 0, 7); c.fill(); }
  c.fillStyle = fill; c.strokeStyle = edge; c.lineWidth = Math.max(1.2, r * 0.15); c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.stroke();
  if (!lite) { c.strokeStyle = col; c.lineWidth = Math.max(1, r * 0.14); c.beginPath(); c.arc(0, 0, r * 0.8, 0, 7); c.stroke(); }
  const sc = r * 0.92; c.scale(sc, sc); c.fillStyle = c.strokeStyle = glyph; (G[g] || G.coin)(c, lite ? (acc === '#fff' ? glyph : acc) : col, fill);
  c.restore();
}
