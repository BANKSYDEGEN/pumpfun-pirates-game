// [Timothy] THE GOLDEN DOUBLOON CASINO (#47, BANKSY via Emerly): static data, pure (no three.js) so the map, the terrain and tests can read it.
// A walk-in pirate casino on Main Street's east row between the SQUAD HALL (#33) and the UPGRADE SHOP (#5). Model: tools/casino_blender/build_casino.py
// -> assets/island/casino_hall.glb (+ _low). Town-local frame (js/island/coast.js): lx along the waterfront (Main Street centre lx 0, the east row's
// building line lx 14), +lz out to sea. Building frame (Blender): x = lz - CZ, y = lx - CX (front = -y = the street). &casino=0 = no casino at all.
// Gold only: every amount reads 100 GOLD / 100g (no currency signs, no tickers, nothing but GOLD).
import { COAST_ON } from './coast.js';

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
export const CASINO_ON = COAST_ON && !(Q && Q.get('casino') === '0');

const CX = 21.25, CZ = -50.4, W = 16.7, D = 14.5;
export const CASINO_Y = 2.72;                 // the walk deck inside (= the plank floor; Main Street outside the arch is 2.69)
export const CASINO_FLAT = 2.69;              // terrain under the hall is lowered to the street level (never raised)
const town = (x, y) => ({ lx: +(CX + y).toFixed(3), lz: +(CZ + x).toFixed(3) });

export const CASINO_HALL = {
  id: 'casino', n: 47, name: 'THE GOLDEN DOUBLOON', label: 'CASINO', storeys: 3,
  lx: CX, lz: CZ, w: W, d: D, ly: -Math.PI / 2,                                   // faces -lx (Main Street), like the Squad Hall
  rect: { lx0: CX - D / 2, lx1: CX + D / 2, lz0: CZ - W / 2, lz1: CZ + W / 2 },     // lx 14 .. 28.5, lz -58.75 .. -42.05
  inner: { lx0: 14.7, lx1: 27.9, lz0: -58.2, lz1: -42.6 },                        // the gaming hall inside the walls
  arch: { lx: 14, lz: CZ, w: 5.0, open: 4.8, h: 4.4 },                            // the open arch (colliders leave 4.8 m clear)
  floorY: CASINO_Y, ceil: 5.4,
  vault: { lx0: 14.7, lx1: 17.95, lz0: -58.2, lz1: -55.95 },                      // the treasure dais (solid): the old slope under that corner
};

// the four stations: table centre (at) + the E point on the players' side (e, 1.6-1.7 m from the table, >= 5.5 m from each other)
export const CASINO_TABLES = [
  { id: 'casino_blackjack', game: 'blackjack', title: 'PIRATE BLACKJACK', label: 'E · PIRATE BLACKJACK', at: town(-5.6, -1.4), e: town(-4.0, -1.4), r: 2.4 },
  { id: 'casino_roulette', game: 'roulette', title: 'BUCCANEER ROULETTE', label: 'E · BUCCANEER ROULETTE', at: town(5.6, -1.4), e: town(4.0, -1.4), r: 2.4 },
  { id: 'casino_dice', game: 'dice', title: "DEAD MAN'S DICE", label: "E · DEAD MAN'S DICE", at: town(-5.7, 4.2), e: town(-4.0, 4.2), r: 2.4 },
  { id: 'casino_slots', game: 'slots', title: 'TREASURE SLOTS', label: 'E · TREASURE SLOTS', at: town(7.3, 4.2), e: town(5.6, 4.2), r: 2.4 },
];
export const CASINO_GAMES = CASINO_TABLES.map(t => t.game);

// Main Street grade in coast mode (js/island/hillStreet.js hallGround): the Squad Hall floor
export const streetGrade = (lz) => 3.0 + Math.max(0, -lz - 50) * 0.11;
// the Squad Hall's north strip: its floor rides this deck (the terrain row lz -60 under it is lowered for the casino's south bay)
export const SQUAD_NORTH_DECK = { lx0: 14.6, lx1: 27.9, lz0: -64, lz1: -59.6 };

// foot.js coastH (after hallGround): flatten the terrain grid under the hall to the street level. The grid points are lx = 14, 18 .. 30
// and lz = -44 .. -56 (step 4); row lz -60 (under the Squad Hall's north wall) is lowered for lx 18 .. 26 (+ 30 a little) so its slope
// never pokes through the casino floor; (14, -60) stays: Main Street keeps its grade (the treasure dais covers that corner inside).
export function casinoGround(lx, lz, h) {
  if (!CASINO_ON) return h;
  if (lx > 13 && lx < 31 && lz > -57 && lz < -43) return Math.min(h, CASINO_FLAT);
  if (lz > -61 && lz < -59) { if (lx > 17 && lx < 27) return Math.min(h, CASINO_FLAT); if (lx > 29 && lx < 31) return Math.min(h, 2.78); }
  return h;
}
// no grass / foliage in the hall (town-local)
export const casinoClear = (lx, lz) => CASINO_ON && lx > CASINO_HALL.rect.lx0 - 0.5 && lx < CASINO_HALL.rect.lx1 + 0.5 && lz > CASINO_HALL.rect.lz0 - 0.5 && lz < CASINO_HALL.rect.lz1 + 0.5;
// js/island/coliseum.js NEW_STORES (&colirent=1 only): a store whose footprint overlaps the casino is not built (like the Squad Hall's squadOverlap)
export const casinoOverlap = (lx0, lx1, lz0, lz1) => { if (!CASINO_ON) return false; const R = CASINO_HALL.rect; return lx0 < R.lx1 && lx1 > R.lx0 && lz0 < R.lz1 && lz1 > R.lz0; };
// A prompt / INTERACT entry → its casino game ('blackjack' | 'roulette' | 'dice' | 'slots'), or null when it is not a casino table.
// js/dock/index.js and js/island/main.js open js/casino/ui.js on that game.
export function casinoInteract(q) {
  const id = typeof q === 'string' ? q : String(q?.id || q?.kind || q?.src?.id || '');
  const m = /^casino_(blackjack|roulette|dice|slots)\b/.exec(id); if (!m) return null;
  const g = typeof q === 'object' ? (q.game || q.src?.game) : null; return CASINO_GAMES.includes(g) ? g : m[1];
}
