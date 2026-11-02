// [Timothy] PUMPFUN PIRATES · ISLAND SHOP catalog. Data only. [v102 live] Timothy's proposed prices as-is (BANKSY tunes later);
// goals = BANKSY's three only (COMMODORE 100 boss kills, FIRE K/D 10 + 50 kills, DIAMOND 5,000 kills). Item ids are STABLE.
// soon: true = no model on the v4 pirate yet: shown as COMING SOON, never sold (the server catalog doesn't list it either).
// Battle Royale only: Waves is separate and unchanged (its skins still unlock every 5 waves, its shop stays upgrades-only).
// The server copy (supabase/functions/pvp/lib.ts SHOP_*) must mirror every price / goal here; the server's copy is the one
// that counts (the client list only draws the shop). Prices are in shared BR profile gold; see shop/PLAN.md for the economy.
//
// Goals make an item PURCHASABLE, never free. goal = { all: [ { stat, need, label, fmt? } ] }, stat names = profile.stats
// keys, plus 'kd' (kills / max(1, deaths)). proposed: true = a goal Timothy proposes; BANKSY has not picked it yet.

export const SHOP_VERSION = 3; // [v103] BANKSY: skin prices raised ("they will have to work for them")

// ---------- ship skins (ids = the live BR skin ids; looks unchanged) ----------
export const SKIN_ITEMS = [
  { id: 'classic',   name: 'DEFAULT',         price: 0 },
  { id: 'blood',     name: 'CRIMSON SAILS',   price: 5000 },
  { id: 'seagreen',  name: 'SEA GREEN',       price: 8000 },
  { id: 'midnight',  name: 'BLACK PEARL',     price: 12000 },
  { id: 'coral',     name: 'CORAL REEF',      price: 18000 },
  { id: 'storm',     name: 'STORM RIDER',     price: 25000 },
  { id: 'kraken',    name: 'KRAKEN INK',      price: 40000 },
  { id: 'commodore', name: 'COMMODORE',       price: 50000, goal: { all: [{ stat: 'bossKills', need: 100, label: 'harbor boss kills' }] } },
  { id: 'golden',    name: 'GOLDEN GALLEON',  price: 75000 },
  { id: 'ghost',     name: 'GHOST SHIP',      price: 100000 },
  { id: 'admiral',   name: 'ADMIRAL WHITE',   price: 125000 },
  { id: 'flaming',   name: 'FLAMING SHIP',    price: 150000, goal: { all: [{ stat: 'kd', need: 10, label: 'K/D', fmt: 'kd' }, { stat: 'kills', need: 50, label: 'kills' }] } },
  { id: 'diamond',   name: 'DIAMOND SHIP',    price: 250000, goal: { all: [{ stat: 'kills', need: 5000, label: 'BR kills (Solo + Squads)' }] } },
];

// ---------- pirate gear (pfp_captain_v1 parts: { id, label, glb, tint }). PROVISIONAL ids: Raul's GLBs wait on BANKSY approving
// the pirate bases, so glb is null (placeholder / tinted parts) and an id may still change before the shop ships. ----------
// Free and never sold: skin tone, hair (short / long / beard / bald), face 'plain'. New pirates start outfit 'shirtless',
// hat 'none', face 'plain', parrot 'none', hook 'none'.
export const CAPTAIN_DEFAULTS = { v: 1, outfit: 'shirtless', hat: 'none', face: 'plain', hair: 'short', parrot: 'none', hook: 'none' };
export const GEAR_SLOTS = [['hat', 'HATS'], ['outfit', 'CLOTHES'], ['eyes', 'EYEWEAR'], ['parrot', 'PARROTS'], ['hook', 'HOOKS'], ['map', 'MAPS']];
export const GEAR_ITEMS = [
  { slot: 'hat', id: 'none', label: 'NO HAT', price: 0, glb: null, tint: null, free: true },
  { slot: 'hat', id: 'bandana', label: 'BANDANA', price: 150, soon: true, glb: null, tint: { cloth: 'coat' } },
  { slot: 'hat', id: 'tricorn', label: 'TRICORN', price: 400, soon: true, glb: null, tint: { band: 'accent' } },
  { slot: 'hat', id: 'bicorne', label: "CAPTAIN'S HAT", price: 1200, soon: true, glb: null, tint: { band: 'accent' } },
  { slot: 'outfit', id: 'shirtless', label: 'SHIRTLESS', price: 0, glb: null, tint: null, free: true },
  { slot: 'outfit', id: 'tank', label: 'TANK', price: 150, soon: true, glb: null, tint: { cloth: 'coat' } },
  { slot: 'outfit', id: 'tshirt', label: 'T-SHIRT', price: 300, soon: true, glb: null, tint: { cloth: 'coat' } },
  { slot: 'outfit', id: 'coat', label: 'RED COAT', price: 1000, soon: true, glb: null, tint: { cloth: 'coat', trim: 'accent' } },
  { slot: 'eyes', id: 'plain', label: 'NONE', price: 0, glb: null, tint: null, free: true }, // = face 'plain' (free)
  { slot: 'eyes', id: 'eyepatch', label: 'EYE PATCH', price: 200, soon: true, glb: null, tint: null },
  { slot: 'eyes', id: 'sunglasses', label: 'SHADES', price: 500, soon: true, glb: null, tint: { frame: 'accent' } },
  { slot: 'eyes', id: 'laser', label: 'LASER EYES', price: 3000, soon: true, glb: null, tint: null },
  { slot: 'parrot', id: 'none', label: 'NO PARROT', price: 0, glb: null, tint: null, free: true },
  { slot: 'parrot', id: 'parrot_green', label: 'GREEN PARROT', price: 800, soon: true, glb: null, tint: { body: '#4ee37a' } },
  { slot: 'parrot', id: 'parrot_red', label: 'RED MACAW', price: 1200, soon: true, glb: null, tint: { body: '#fa0d0d' } },
  { slot: 'parrot', id: 'parrot_gold', label: 'GOLDEN PARROT', price: 5000, soon: true, glb: null, tint: { body: '#ffcd77' } },
  { slot: 'hook', id: 'none', label: 'NO HOOK', price: 0, glb: null, tint: null, free: true },
  { slot: 'hook', id: 'hook_iron', label: 'IRON HOOK', price: 500, soon: true, glb: null, tint: { metal: '#9aa3ad' } },
  { slot: 'hook', id: 'hook_gold', label: 'GOLD HOOK', price: 2500, soon: true, glb: null, tint: { metal: '#ffcd77' } },
  // treasure maps (PROPOSAL, island only): one-use, each marks one of Raul's dig sites (js/island/foot.js DIGS ids dig1..dig3)
  { slot: 'map', id: 'map_dig1', label: 'MAP · DIG SITE 1', price: 300, soon: true, glb: null, tint: null, use: 'once', dig: 'dig1', proposed: true },
  { slot: 'map', id: 'map_dig2', label: 'MAP · DIG SITE 2', price: 300, soon: true, glb: null, tint: null, use: 'once', dig: 'dig2', proposed: true },
  { slot: 'map', id: 'map_dig3', label: 'MAP · DIG SITE 3', price: 300, soon: true, glb: null, tint: null, use: 'once', dig: 'dig3', proposed: true },
];
export const gearKey = (it) => `${it.slot}:${it.id}`; // owned gear is stored as 'slot:id' (ids repeat across slots: 'none')

// ---------- vendors (Raul's INTERACT ids in js/island/foot.js) ----------
export const VENDORS = {
  shop:       { name: 'SHOP', sub: 'Dock Town · Main Street', tabs: ['skins', 'gear'], slots: ['hat', 'outfit', 'eyes', 'parrot', 'hook'], awning: null },
  stall_red:  { name: 'RED STALL', sub: 'The Tailor · market square', tabs: ['gear'], slots: ['hat', 'outfit', 'eyes'], awning: '#d8322f' },
  stall_blue: { name: 'BLUE STALL', sub: 'Curios · market square', tabs: ['gear'], slots: ['parrot', 'hook', 'map'], awning: '#2a6df4' },
  // [v103] harbor plaza shops (replace the old HARBOR MARKET stalls)
  clothes:    { name: 'CLOTHES SHOP', sub: 'Harbor plaza · pirate gear', tabs: ['gear'], slots: ['hat', 'outfit', 'eyes', 'parrot', 'hook'], awning: '#d8322f' },
  ships:      { name: 'SHIP SKINS + UPGRADES', sub: 'Harbor plaza · skins for gold', tabs: ['skins'], slots: [], awning: '#2a6df4', upgrades: true },
};

// ---------- goal progress ----------
export const statValue = (stats, k) => k === 'kd' ? (stats.kills || 0) / Math.max(1, stats.deaths || 0) : Math.max(0, Math.floor(stats[k] || 0));
export function goalProgress(goal, stats = {}) {
  if (!goal) return null;
  const rows = goal.all.map(g => { const have = statValue(stats, g.stat); return { ...g, have, done: have >= g.need, frac: Math.min(1, have / g.need) }; });
  return { rows, done: rows.every(r => r.done), proposed: !!goal.proposed };
}
const fmtN = (n) => Math.floor(n).toLocaleString('en-US');
export const fmtGoalRow = (r) => r.fmt === 'kd' ? `K/D ${r.have.toFixed(1)}/${r.need}` : `${fmtN(Math.min(r.have, r.need))}/${fmtN(r.need)} ${r.label}`;
export const fmtGold = (n) => `${fmtN(n)}g`;
