// [Timothy] PUMPFUN PIRATES · ISLAND SHOP catalog. Data only. [v102 live] Timothy's proposed prices as-is (BANKSY tunes later);
// goals = BANKSY's three only (COMMODORE 100 boss kills, FIRE K/D 10 + 50 kills, DIAMOND 5,000 kills). Item ids are STABLE.
// soon: true = no model on the v4 pirate yet: shown as COMING SOON, never sold (the server catalog doesn't list it either).
// Battle Royale only: Waves is separate and unchanged (its skins still unlock every 5 waves, its shop stays upgrades-only).
// The server copy (supabase/functions/pvp/lib.ts SHOP_*) must mirror every price / goal here; the server's copy is the one
// that counts (the client list only draws the shop). Prices are in shared BR profile gold; see shop/PLAN.md for the economy.
//
// Goals make an item PURCHASABLE, never free. goal = { all: [ { stat, need, label, fmt? } ] }, stat names = profile.stats
// keys, plus 'kd' (kills / max(1, deaths)). proposed: true = a goal Timothy proposes; BANKSY has not picked it yet.

export const SHOP_VERSION = 4; // [v105] gear on sale, parrot ladder // [v103] BANKSY: skin prices raised ("they will have to work for them")

// ---------- ship skins (ids = the live BR skin ids; looks unchanged) ----------
export const SKIN_ITEMS = [
  { id: 'classic',   name: 'DEFAULT',         price: 0 },
  { id: 'blood',     name: 'CRIMSON SAILS',   price: 5000 },
  { id: 'seagreen',  name: 'SEA GREEN',       price: 8000 },
  { id: 'midnight',  name: 'BLACK PEARL',     price: 12000 },
  { id: 'coral',     name: 'CORAL REEF',      price: 18000 },
  { id: 'storm',     name: 'STORM RIDER',     price: 25000 },
  { id: 'kraken',    name: 'KRAKEN INK',      price: 40000 },
  { id: 'commodore', name: 'COMMODORE',       price: 50000, goal: { all: [{ stat: 'bossKills', need: 100, label: 'Harbor boss kills' }] } },
  { id: 'golden',    name: 'GOLDEN GALLEON',  price: 75000 },
  { id: 'ghost',     name: 'GHOST SHIP',      price: 100000 },
  { id: 'admiral',   name: 'ADMIRAL WHITE',   price: 125000 },
  { id: 'flaming',   name: 'FLAMING SHIP',    price: 150000, goal: { tag: 'FIRE', all: [{ stat: 'kd', need: 10, label: 'K/D', fmt: 'kd' }, { stat: 'kills', need: 50, label: 'kills' }] } },
  { id: 'diamond',   name: 'DIAMOND SHIP',    price: 250000, goal: { all: [{ stat: 'kills', need: 5000, label: 'BR kills', modes: true }] } }, // Solo + Squads both count
];

// ---------- pirate gear (pfp_captain_v1 parts: { id, label, glb, tint }). PROVISIONAL ids: Raul's GLBs wait on BANKSY approving
// the pirate bases, so glb is null (placeholder / tinted parts) and an id may still change before the shop ships. ----------
// Free and never sold: skin tone, hair (short / long / beard / bald), face 'plain'. New pirates start outfit 'shirtless',
// hat 'none', face 'plain', parrot 'none', hook 'none'.
export const CAPTAIN_DEFAULTS = { v: 1, outfit: 'shirtless', hat: 'none', face: 'plain', hair: 'short', parrot: 'none', hook: 'none' };
export const GEAR_SLOTS = [['hat', 'HATS'], ['outfit', 'CLOTHES'], ['eyes', 'EYEWEAR'], ['parrot', 'PARROTS'], ['hook', 'HOOKS']];
export const GEAR_ITEMS = [
  // [v105] Timothy's gear renders (js/pirateGear.js GEAR_RENDERS): sold for gold. Clothes take your ship skin's colours; hats get a
  // free colour pick (gear.hatColor, a HAT_SWATCHES index). soon: true = in the catalog, not buyable yet (renders in a later build).
  { slot: 'hat', id: 'none', label: 'NO HAT', price: 0, glb: null, tint: null, free: true },
  { slot: 'hat', id: 'bandana', label: 'BANDANA', price: 150, glb: 'gear', tint: { hatColor: true } },
  { slot: 'hat', id: 'tricorn', label: 'TRICORN', price: 400, glb: 'gear', tint: { hatColor: true } },
  { slot: 'hat', id: 'bicorne', label: "CAPTAIN'S HAT", price: 1200, glb: 'gear', tint: { hatColor: true } },
  { slot: 'outfit', id: 'shirtless', label: 'SHIRTLESS', price: 0, glb: null, tint: null, free: true },
  { slot: 'outfit', id: 'tank', label: 'TANK', price: 150, glb: 'gear', tint: { skin: true } },
  { slot: 'outfit', id: 'tshirt', label: 'T-SHIRT', price: 300, glb: 'gear', tint: { skin: true } },
  { slot: 'outfit', id: 'coat', label: 'COAT', price: 1000, glb: 'gear', tint: { skin: true } },
  { slot: 'eyes', id: 'plain', label: 'NONE', price: 0, glb: null, tint: null, free: true }, // = face 'plain' (free)
  { slot: 'eyes', id: 'eyepatch', label: 'EYE PATCH', price: 200, glb: 'gear', tint: null },
  { slot: 'eyes', id: 'sunglasses', label: 'SHADES', price: 500, glb: 'gear', tint: null },
  { slot: 'eyes', id: 'laser', label: 'LASER EYES', price: 3000, glb: 'gear', tint: null },
  { slot: 'parrot', id: 'none', label: 'NO PARROT', price: 0, glb: null, tint: null, free: true },
  { slot: 'parrot', id: 'parrot_green', label: 'GREEN PARROT', price: 2000, glb: 'gear', tint: { body: '#3fd16a' } },
  { slot: 'parrot', id: 'parrot_red', label: 'RED MACAW', price: 5000, glb: 'gear', tint: { body: '#e8231d' } },
  { slot: 'parrot', id: 'parrot_blue', label: 'BLUE MACAW', price: 8000, soon: true, glb: 'gear', tint: { body: '#1e74e8' } },
  { slot: 'parrot', id: 'parrot_cockatoo', label: 'COCKATOO', price: 12000, soon: true, glb: 'gear', tint: { body: '#f6f4ee' } },
  { slot: 'parrot', id: 'parrot_black', label: 'BLACK PARROT', price: 20000, soon: true, glb: 'gear', tint: { body: '#1a1a1e' }, goal: { all: [{ stat: 'kills', need: 1000, label: 'BR kills (Solo + Squads)' }] } },
  { slot: 'parrot', id: 'parrot_gold', label: 'GOLDEN PARROT', price: 50000, glb: 'gear', tint: { body: '#ffcd77' }, goal: { all: [{ stat: 'bossKills', need: 50, label: 'harbor boss kills' }] } },
  { slot: 'parrot', id: 'parrot_diamond', label: 'DIAMOND PARROT', price: 100000, soon: true, glb: 'gear', tint: { body: '#bfe8ff' }, goal: { all: [{ stat: 'kills', need: 5000, label: 'BR kills (Solo + Squads)' }] } },
  { slot: 'hook', id: 'none', label: 'NO HOOK', price: 0, glb: null, tint: null, free: true },
  { slot: 'hook', id: 'hook_iron', label: 'IRON HOOK', price: 500, glb: 'gear', tint: { metal: '#9aa3ad' } },
  { slot: 'hook', id: 'hook_gold', label: 'GOLD HOOK', price: 2500, glb: 'gear', tint: { metal: '#ffcd77' } },
  // treasure maps are not sold: they DROP (harbor bosses, BR kills / wins) and are used on the island (js/treasure.js, v105)
];
// [v105] free hat colour pick (BANKSY): gear.hatColor = 0 (the hat's own colour) or 1..12 = this list. Mirrors Timothy's
// js/pirateGear.js HAT_SWATCHES (APPEND-ONLY, the index goes over the network).
export const HAT_SWATCHES = [['RED', '#c8302c'], ['GOLD', '#e9b949'], ['NAVY', '#1b2f6b'], ['BLUE', '#2a6df4'], ['GREEN', '#2fbf5a'], ['TEAL', '#2ec4a0'],
  ['PURPLE', '#7a3fb0'], ['PINK', '#ff5fa2'], ['ORANGE', '#ff7a1a'], ['WHITE', '#f4f1e8'], ['BLACK', '#1c1c20'], ['BROWN', '#8a5a32']];
export const gearKey = (it) => `${it.slot}:${it.id}`; // owned gear is stored as 'slot:id' (ids repeat across slots: 'none')

// ---------- vendors (Raul's INTERACT ids in js/island/foot.js) ----------
export const VENDORS = {
  shop:       { name: 'SHOP', sub: 'Dock Town · Main Street', tabs: ['skins', 'gear'], slots: ['hat', 'outfit', 'eyes', 'parrot', 'hook'], awning: null },
  stall_red:  { name: 'RED STALL', sub: 'The Tailor · market square', tabs: ['gear'], slots: ['hat', 'outfit', 'eyes'], awning: '#d8322f' },
  stall_blue: { name: 'BLUE STALL', sub: 'Curios · market square', tabs: ['gear'], slots: ['parrot', 'hook'], awning: '#2a6df4' },
  // [v103] harbor plaza shops (replace the old HARBOR MARKET stalls)
  clothes:    { name: 'CLOTHES SHOP', sub: 'Harbor plaza · pirate gear', tabs: ['gear'], slots: ['hat', 'outfit', 'eyes', 'parrot', 'hook'], awning: '#d8322f' },
  ships:      { name: 'SHIP SKINS + UPGRADES', sub: 'Harbor plaza · skins for gold', tabs: ['skins'], slots: [], awning: '#2a6df4', upgrades: true },
};

// ---------- goal progress ----------
// [Timothy] LIVE goals = the ones BANKSY picked (COMMODORE, FLAMING "FIRE", DIAMOND), the same three the server enforces
// (supabase/functions/pvp/lib.ts SHOP_ITEMS). `proposed` goals are only drawn with ?shopgoals=proposed (mock preview): the server
// sells those items without a goal, so the shop must not show a lock it won't enforce.
const showProposed = () => { try { return new URLSearchParams(location.search).get('shopgoals') === 'proposed'; } catch { return false; } };
export const liveGoal = (it) => it?.goal && (!it.goal.proposed || showProposed()) ? it.goal : null;
export const statValue = (stats, k) => k === 'kd' ? (stats?.kills || 0) / Math.max(1, stats?.deaths || 0) : Math.max(0, Math.floor(stats?.[k] || 0));
// stats = null / undefined: "no stats yet" (offline, a new pirate): every row reads 0 and `nostats` is set so the UI can say so.
export function goalProgress(goal, stats) {
  if (!goal) return null;
  const nostats = !stats || typeof stats !== 'object';
  const rows = goal.all.map(g => { const have = nostats ? 0 : statValue(stats, g.stat); return { ...g, have, done: !nostats && have >= g.need, frac: Math.max(0, Math.min(1, have / g.need)) }; });
  return { rows, done: rows.every(r => r.done), proposed: !!goal.proposed, nostats, tag: goal.tag || '', frac: Math.min(...rows.map(r => r.frac)) };
}
const fmtN = (n) => Math.floor(n).toLocaleString('en-US');
const kd1 = (x) => (Math.floor(x * 10) / 10).toFixed(1); // floor: 9.96 shows 9.9, never a "10.0" that isn't met yet
// 'Harbor boss kills 37/100' · 'K/D 6.2 / 10' · 'kills 41/50' · 'BR kills 1,234/5,000'
export const fmtGoalRow = (r) => r.fmt === 'kd' ? `K/D ${kd1(r.have)} / ${r.need}` : `${r.label} ${fmtN(Math.min(r.have, r.need))}/${fmtN(r.need)}`;
export const fmtGoal = (g) => g.rows.map(fmtGoalRow).join(' · ');
export const fmtGold = (n) => `${fmtN(n)}g`;
