// [Timothy] PUMPFUN PIRATES · ISLAND SHOP catalog. Data only. [v102 live] Timothy's proposed prices as-is (BANKSY tunes later);
// goals = BANKSY's: COMMODORE 100 boss kills, GHOST 100 kills, FIRE 200 kills, GOLDEN = PRESTIGE 1 (free), DIAMOND = PRESTIGE 2 (free) ([prestige]). Item ids are STABLE.
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
  { id: 'blood',     name: 'CRIMSON SAILS',   price: 1000 },
  { id: 'seagreen',  name: 'SEA GREEN',       price: 1600 },
  { id: 'midnight',  name: 'BLACK PEARL',     price: 2400 },
  { id: 'admiral',   name: 'ADMIRAL WHITE',   price: 3000 },    // [admiral-price] BANKSY 10:21 AM: 125,000 -> 15,000; [skin-prices] 10:55 AM: every gold skin /10; 11:06 AM: /5
  { id: 'coral',     name: 'CORAL REEF',      price: 3600 },
  { id: 'storm',     name: 'STORM RIDER',     price: 5000 },
  { id: 'kraken',    name: 'KRAKEN INK',      price: 8000 },
  { id: 'commodore', name: 'COMMODORE',       price: 50000, goal: { all: [{ stat: 'bossKills', need: 100, label: 'Commodore kills' }] } },
  // [prestige] BANKSY: GOLDEN GALLEON = PRESTIGE 1, DIAMOND = PRESTIGE 2 (were the 1,000 / 5,000 kill tiers), GIVEN FREE on reaching
  // that prestige (grant: 'prestige', price 0; the server adds them to pvp_owned). GHOST SHIP 100 kills, FIRE 200 kills (no K/D).
  // Mirror: supabase/functions/pvp/lib.ts SHOP_ITEMS.
  { id: 'golden',    name: 'GOLDEN GALLEON',  price: 0, grant: 'prestige', goal: { tag: 'PRESTIGE 1', all: [{ stat: 'prestige', need: 1, label: 'Prestige', fmt: 'prestige' }] } },
  { id: 'ghost',     name: 'GHOST SHIP',      price: 100000, goal: { all: [{ stat: 'kills', need: 100, label: 'BR kills' }] } },
  { id: 'flaming',   name: 'FLAMING SHIP',    price: 150000, goal: { tag: 'FIRE', all: [{ stat: 'kills', need: 200, label: 'BR kills' }] } }, // [prestige] BANKSY: 200 PvP kills only (no K/D)
  { id: 'diamond',   name: 'DIAMOND SHIP',    price: 0, grant: 'prestige', goal: { tag: 'PRESTIGE 2', all: [{ stat: 'prestige', need: 2, label: 'Prestige', fmt: 'prestige' }] } },
];

// ---------- pirate gear (pfp_captain_v1 parts: { id, label, glb, tint }). PROVISIONAL ids: Raul's GLBs wait on BANKSY approving
// the pirate bases, so glb is null (placeholder / tinted parts) and an id may still change before the shop ships. ----------
// Free and never sold: skin tone, hair (short / long / beard / bald), face 'plain'. New pirates start outfit 'shirtless',
// hat 'none', face 'plain', parrot 'none', hook 'none'.
// [Timothy] COLOURS: clothes (tank / t-shirt / coat) follow your equipped SHIP SKIN (tint 'skin'). Hats take a FREE player-picked
// hatColor (0 = the hat's own default, 1..12 = js/pirateGear.js HAT_SWATCHES; picker: js/gearColorPicker.js openGearColorPicker;
// kept on this device in pfp_captain_v1, sent to other players in 'gr'). Card art: js/gearThumbs.js gearThumb(slot, id).
// ONE gear system (js/pirateGear.js applyGear): glb 'raul:<id>' = drawn with Raul's model (js/pirateItems.js), the rest with Timothy's.
export const CAPTAIN_DEFAULTS = { v: 1, outfit: 'shirtless', hat: 'none', face: 'plain', hair: 'short', parrot: 'none', hook: 'none', leg: 'none', beard: 'none', ears: 'none', teeth: 'none', boots: 'none', cape: 'none', flag: 'none', figure: 'none' };
export const GEAR_SLOTS = [['hat', 'HATS'], ['outfit', 'CLOTHES'], ['eyes', 'EYEWEAR'], ['parrot', 'PARROTS'], ['hook', 'HOOKS'], ['leg', 'PEG LEGS'], ['face', 'FACE PAINT'],
  ['beard', 'BEARDS'], ['ears', 'EARRINGS'], ['teeth', 'GOLD TEETH'], ['boots', 'BOOTS'], ['cape', 'CAPES'], ['flag', 'SHIP FLAGS'], ['figure', 'FIGUREHEADS']];   // [Raul shop items 2]
export const GEAR_ITEMS = [
  // [v105] Timothy's gear renders (js/pirateGear.js GEAR_RENDERS): sold for gold. Clothes take your ship skin's colours; hats get a
  // free colour pick (gear.hatColor, a HAT_SWATCHES index). soon: true = in the catalog, not buyable yet (renders in a later build).
  { slot: 'hat', id: 'none', label: 'NO HAT', price: 0, glb: null, tint: null, free: true },
  { slot: 'hat', id: 'bandana', label: 'BANDANA', price: 150, glb: 'gear', tint: { hatColor: true } },
  { slot: 'hat', id: 'tricorn', label: 'TRICORN', price: 400, glb: 'raul:hat_tricorn', tint: { hatColor: true } },   // [Raul] model (better in game), hat colour = the felt
  { slot: 'hat', id: 'bicorne', label: "CAPTAIN'S HAT", price: 1200, glb: 'gear', tint: { hatColor: true } },
  { slot: 'hat', id: 'crown', label: 'PIRATE KING CROWN', price: 15000, glb: 'raul:crown', tint: { hair: true } },   // [Raul] model (de13179); [v109b] velvet = the wearer's HAIR colour (BANKSY), gold rim + gems fixed. soon: server SHOP_ITEMS first (the owner wears it now)
  { slot: 'hat', id: 'crown_imperial', label: 'IMPERIAL CROWN', price: 25000, glb: 'raul:crown_imperial', tint: null },   // [v143] BANKSY: Raul's Imperial State Crown, its own item next to the Pirate King Crown (fancier: priced above it)
  { slot: 'hat', id: 'helmet_hq', label: 'HQ HELMET', price: 800, glb: 'raul:helmet_hq', tint: { hatColor: true } },   // [v144] BANKSY: Raul's olive HQ helmet; [Raul gear colours] + the free hat colour (DEFAULT = his olive; shell repainted, stencil + skull readable)
  { slot: 'hat', id: 'mask_luchador', label: 'LUCHADOR MASK', price: 1500, glb: 'raul:mask_luchador', tint: { hatColor: true } },   // [Raul gear colours] + the free hat colour = the hood (DEFAULT = his gold; flames + trim auto-contrast)   // [Raul wrestler] BANKSY "libre mask": gold hood, red flames + white trim, skull on the brow (own colours). v5 bodies only
  { slot: 'outfit', id: 'shirtless', label: 'SHIRTLESS', price: 0, glb: null, tint: null, free: true },
  { slot: 'outfit', id: 'tank', label: 'TANK', price: 150, glb: 'gear', tint: { skin: true } },
  { slot: 'outfit', id: 'tshirt', label: 'T-SHIRT', price: 300, glb: 'gear', tint: { skin: true } },
  { slot: 'outfit', id: 'coat', label: 'COAT', price: 1000, glb: 'gear', tint: { skin: true } },
  { slot: 'outfit', id: 'shirt', label: 'PIRATE SHIRT', price: 300, glb: 'raul:shirt', tint: { skin: true } },          // [Raul] model; body = the ship skin's light colour
  { slot: 'outfit', id: 'suit', label: "CAPTAIN'S COAT", price: 3000, glb: 'raul:suit', tint: { skin: true } },        // [Raul] model; coat + trim = the ship skin's colours
  { slot: 'outfit', id: 'singlet', label: 'WRESTLING SINGLET', price: 600, glb: 'raul:cloth_singlet', tint: { skin: true } },   // [Raul wrestler] one-piece singlet in the clothes colour (default red), gold side stripes. v5 bodies only
  { slot: 'eyes', id: 'plain', label: 'NONE', price: 0, glb: null, tint: null, free: true }, // = face 'plain' (free)
  { slot: 'eyes', id: 'eyepatch', label: 'EYE PATCH', price: 200, glb: 'gear', tint: null },
  { slot: 'eyes', id: 'sunglasses', label: 'SHADES', price: 500, glb: 'gear', tint: null },
  { slot: 'eyes', id: 'laser', label: 'VR GOGGLES', price: 3000, glb: 'gear', tint: null },   // [v121] BANKSY: laser eyes removed, VR GOGGLES in their place (same id + price: owners keep it)
  { slot: 'parrot', id: 'none', label: 'NO PARROT', price: 0, glb: null, tint: null, free: true },
  { slot: 'parrot', id: 'parrot_green', label: 'GREEN PARROT', price: 2000, glb: 'gear', tint: { body: '#3fd16a' } },
  { slot: 'parrot', id: 'parrot_red', label: 'RED MACAW', price: 5000, glb: 'gear', tint: { body: '#e8231d' } },
  { slot: 'parrot', id: 'parrot_blue', label: 'BLUE MACAW', price: 8000, glb: 'gear', tint: { body: '#1e74e8' } },
  { slot: 'parrot', id: 'parrot_cockatoo', label: 'COCKATOO', price: 12000, glb: 'gear', tint: { body: '#f6f4ee' } },
  { slot: 'parrot', id: 'parrot_black', label: 'BLACK PARROT', price: 20000, glb: 'gear', tint: { body: '#1a1a1e' }, goal: { all: [{ stat: 'kills', need: 1000, label: 'BR kills (Solo + Squads)' }] } },
  { slot: 'parrot', id: 'parrot_gold', label: 'GOLDEN PARROT', price: 50000, glb: 'gear', tint: { body: '#ffcd77' }, goal: { all: [{ stat: 'bossKills', need: 50, label: 'Commodore kills' }] } },
  { slot: 'parrot', id: 'parrot_diamond', label: 'DIAMOND PARROT', price: 100000, glb: 'gear', tint: { body: '#bfe8ff' }, goal: { all: [{ stat: 'kills', need: 5000, label: 'BR kills (Solo + Squads)' }] } },
  { slot: 'hook', id: 'none', label: 'NO HOOK', price: 0, glb: null, tint: null, free: true },
  { slot: 'hook', id: 'hook_iron', label: 'IRON HOOK', price: 500, glb: 'raul:hook_l|hook_r', tint: { metal: '#9aa3ad' }, side: 'hookSide' },   // [Raul] model, LEFT / RIGHT = free pick (hookSide)
  { slot: 'hook', id: 'hook_gold', label: 'GOLD HOOK', price: 2500, glb: 'raul:hook_l|hook_r', tint: { metal: '#ffcd77' }, side: 'hookSide' },   // [Raul] model, LEFT / RIGHT = free pick (hookSide)
  // [Timothy x Raul] PEG LEG: new 'leg' slot (synced in 'gr', validated like the others). ON SALE (BANKSY). LEFT / RIGHT = free pick (legSide)
  { slot: 'leg', id: 'none', label: 'BOTH LEGS', price: 0, glb: null, tint: null, free: true },
  { slot: 'leg', id: 'peg', label: 'PEG LEG', price: 1000, glb: 'raul:peg_l|peg_r', tint: null, side: 'legSide' },
  // [v145] FACE PAINT: own slot (worn with any eyewear). v5 bodies only
  { slot: 'face', id: 'none', label: 'NO PAINT', price: 0, glb: null, tint: null, free: true },
  { slot: 'face', id: 'facepaint_retardio', label: 'RETARDIO FACE PAINT', price: 350, glb: 'raul:facepaint_retardio', tint: null },
  // [Raul shop items 2] BANKSY "Do new shop items" (Nov 3): v5 models (js/pirateItems.js), flag + figurehead = your SHIP (js/shipGear.js).
  // PRICES ARE PROPOSED (proposed: true): Raul's suggestion, BANKSY OKs them. [shop-boosts] SKILL BOOSTS now (js/boosts.js, scaled by price). The pets ride the parrot slot (one shoulder pet).
  { slot: 'beard', id: 'none', label: 'NO BEARD', price: 0, glb: null, tint: null, free: true },
  { slot: 'ears', id: 'none', label: 'NO EARRINGS', price: 0, glb: null, tint: null, free: true },
  { slot: 'teeth', id: 'none', label: 'NO GOLD TEETH', price: 0, glb: null, tint: null, free: true },
  { slot: 'boots', id: 'none', label: 'BASE BOOTS', price: 0, glb: null, tint: null, free: true },
  { slot: 'cape', id: 'none', label: 'NO CAPE', price: 0, glb: null, tint: null, free: true },
  { slot: 'flag', id: 'none', label: 'SKIN FLAG', price: 0, glb: null, tint: null, free: true },
  { slot: 'figure', id: 'none', label: 'SKIN FIGUREHEAD', price: 0, glb: null, tint: null, free: true },
  { slot: 'beard', id: 'beard_moustache', label: 'CAPTAIN\'S MOUSTACHE', price: 400, glb: 'raul:beard_moustache', tint: { hair: true }, proposed: true, maleOnly: true },
  { slot: 'beard', id: 'beard_forked', label: 'FORKED BEARD', price: 900, glb: 'raul:beard_forked', tint: { hair: true }, proposed: true, maleOnly: true },
  { slot: 'beard', id: 'beard_black', label: 'BLACKBEARD', price: 2500, glb: 'raul:beard_black', tint: null, proposed: true, maleOnly: true },
  { slot: 'ears', id: 'earring_hoop', label: 'GOLD HOOPS', price: 250, glb: 'raul:earring_hoop', tint: null, proposed: true },
  { slot: 'ears', id: 'earring_double', label: 'DOUBLE HOOPS', price: 600, glb: 'raul:earring_double', tint: null, proposed: true },
  { slot: 'ears', id: 'earring_skull', label: 'SKULL EARRINGS', price: 1200, glb: 'raul:earring_skull', tint: null, proposed: true },
  { slot: 'teeth', id: 'tooth_gold', label: 'GOLD TOOTH', price: 300, glb: 'raul:tooth_gold', tint: null, proposed: true },
  { slot: 'teeth', id: 'grill_gold', label: 'GOLD GRILL', price: 1500, glb: 'raul:grill_gold', tint: null, proposed: true },
  { slot: 'teeth', id: 'grill_diamond', label: 'DIAMOND GRILL', price: 6000, glb: 'raul:grill_diamond', tint: null, proposed: true },
  { slot: 'boots', id: 'boots_buckle', label: 'BUCKLE BOOTS', price: 350, glb: 'raul:boots_buckle', tint: null, proposed: true },
  { slot: 'boots', id: 'boots_cavalier', label: 'CAVALIER BOOTS', price: 1000, glb: 'raul:boots_cavalier', tint: null, proposed: true },
  { slot: 'boots', id: 'boots_gold', label: 'GOLD-TOE BOOTS', price: 3000, glb: 'raul:boots_gold', tint: null, proposed: true },
  { slot: 'cape', id: 'cape_tattered', label: 'TATTERED CAPE', price: 800, glb: 'raul:cape_tattered', tint: null, proposed: true },
  { slot: 'cape', id: 'cape_captain', label: 'CAPTAIN\'S CAPE', price: 2000, glb: 'raul:cape_captain', tint: { skin: true }, proposed: true },
  { slot: 'cape', id: 'cape_royal', label: 'ROYAL CAPE', price: 8000, glb: 'raul:cape_royal', tint: null, proposed: true },
  { slot: 'parrot', id: 'pet_cat', label: 'SHIP\'S CAT', price: 3000, glb: 'raul:pet_cat', tint: null, proposed: true },
  { slot: 'parrot', id: 'pet_monkey', label: 'SHOULDER MONKEY', price: 4000, glb: 'raul:pet_monkey', tint: null, proposed: true },
  { slot: 'parrot', id: 'pet_cat_black', label: 'BLACK CAT', price: 6000, glb: 'raul:pet_cat_black', tint: null, proposed: true },
  // [Raul items redo 2] BANKSY 10:53 AM: three big ground pets (follow you ashore like the crew, sit on deck at sea). PROPOSED prices.
  { slot: 'parrot', id: 'pet_chimp', label: 'CHIMP', price: 5000, glb: 'raul:pet_chimp', tint: null, proposed: true },
  { slot: 'parrot', id: 'pet_gorilla', label: 'GORILLA', price: 8000, glb: 'raul:pet_gorilla', tint: null, proposed: true },
  { slot: 'parrot', id: 'pet_tiger', label: 'TIGER', price: 12000, glb: 'raul:pet_tiger', tint: null, proposed: true },   // [Raul items redo 2] BANKSY 11:39 AM "Also add a tiger pet" (price PROPOSED)
  { slot: 'parrot', id: 'pet_gorilla_white', label: 'WHITE GORILLA', price: 15000, glb: 'raul:pet_gorilla_white', tint: null, proposed: true },
  { slot: 'leg', id: 'peg_gold', label: 'GILDED SKULL PEG', price: 30000, glb: 'raul:peg_gold', tint: null, proposed: true, side: 'legSide' },
  { slot: 'leg', id: 'peg_kraken', label: 'KRAKEN BONE PEG', price: 45000, glb: 'raul:peg_kraken', tint: null, proposed: true, side: 'legSide' },
  { slot: 'leg', id: 'peg_ghost', label: 'GHOST BONE PEG', price: 60000, glb: 'raul:peg_ghost', tint: null, proposed: true, side: 'legSide' },   // [Raul pegs 2] price OK'd by BANKSY 12:19 AM "Ghost Bone Peg at 60,000" (top of the peg ladder: 1k / 30k / 45k / 60k)
  { slot: 'flag', id: 'flag_cutlass', label: 'CROSSED CUTLASSES FLAG', price: 1000, glb: null, tint: null, proposed: true, ship: true },
  { slot: 'flag', id: 'flag_red', label: 'BLOOD RED FLAG', price: 2500, glb: null, tint: null, proposed: true, ship: true },
  { slot: 'flag', id: 'flag_gold', label: 'GOLDEN SKULL FLAG', price: 7500, glb: null, tint: null, proposed: true, ship: true },
  { slot: 'figure', id: 'fig_mermaid', label: 'MERMAID FIGUREHEAD', price: 5000, glb: null, tint: null, proposed: true, ship: true },
  { slot: 'figure', id: 'fig_kraken', label: 'KRAKEN FIGUREHEAD', price: 9000, glb: null, tint: null, proposed: true, ship: true },
  { slot: 'figure', id: 'fig_lion', label: 'GOLDEN LION FIGUREHEAD', price: 15000, glb: null, tint: null, proposed: true, ship: true },
  // treasure maps are not sold: they DROP (harbor bosses, BR kills / wins) and are used on the island (js/treasure.js, v105)
];
// [v105] free hat colour pick (BANKSY): gear.hatColor = 0 (the hat's own colour) or 1..12 = this list. Mirrors Timothy's
// js/pirateGear.js HAT_SWATCHES (APPEND-ONLY, the index goes over the network).
export const HAT_SWATCHES = [['RED', '#c8302c'], ['GOLD', '#e9b949'], ['NAVY', '#1b2f6b'], ['BLUE', '#2a6df4'], ['GREEN', '#2fbf5a'], ['TEAL', '#2ec4a0'],
  ['PURPLE', '#7a3fb0'], ['PINK', '#ff5fa2'], ['ORANGE', '#ff7a1a'], ['WHITE', '#f4f1e8'], ['BLACK', '#1c1c20'], ['BROWN', '#8a5a32']];
export const gearKey = (it) => `${it.slot}:${it.id}`; // owned gear is stored as 'slot:id' (ids repeat across slots: 'none')

// ---------- [Timothy] CREW SHOP: crew versions of the REAL hats + clothes (js/crewLoadout.js). No new art: each draws with the
// player item of the same id (base slot). PRICING RULE: a crew item costs EXACTLY what the player version costs (1:1, BANKSY:
// expensive + grindy; one buy dresses the whole crew). The crew uniform (bandana + tank) is free. Server: lib.ts SHOP_ITEMS
// 'gear:crewhat:<id>' / 'gear:crewoutfit:<id>' (same prices) + GEAR_SLOTS crewhat / crewoutfit.
export const CREW_SLOT_LABELS = [['crewhat', 'CREW HATS'], ['crewoutfit', 'CREW CLOTHES']];
const CREW_FROM = { crewhat: ['bandana', 'tricorn', 'bicorne', 'crown', 'crown_imperial', 'helmet_hq'], crewoutfit: ['tank', 'tshirt', 'coat', 'shirt', 'suit'] };
const CREW_FREE = { crewhat: 'bandana', crewoutfit: 'tank' };
export const CREW_ITEMS = Object.entries(CREW_FROM).flatMap(([slot, ids]) => ids.map((id) => {
  const base = slot === 'crewhat' ? 'hat' : 'outfit', p = GEAR_ITEMS.find((g) => g.slot === base && g.id === id);
  const free = CREW_FREE[slot] === id;
  return { slot, id, base, crew: true, label: (free ? 'CREW ' : '') + p.label, price: free ? 0 : p.price, glb: p.glb, tint: p.tint, free: free || undefined };
}));
// ---------- [Timothy] WEAPON STORE: cosmetic SWORDS for the SWORD PIT (js/onfoot/battle.js; models js/onfoot/swords.js). BANKSY's
// prices + goals (Nov 3). The RUSTY CUTLASS is free (every pirate's default, GEAR_SLOTS.sword[0]). Cosmetic only: every blade does the
// same damage in the pit, and pit KOs never count towards any goal. Server: lib.ts SHOP_ITEMS 'gear:sword:<id>' + GEAR_SLOTS.sword.
export const SWORD_SLOT = 'sword', SWORD_FREE = 'rusty'; export const MUSKET_FREE = 'rusty';
// ONE PRICE TABLE for the WEAPON STORE (BANKSY, Nov 3: swords + muskets approved). Change a price / goal here AND in lib.ts SHOP_ITEMS.
// [slot, id, label, price, goal]; the first of each slot is the free default. Rows are cheapest first (free at the top); the window keeps
// this order and adds no hand-ordering of its own, so a central price sort (BANKSY: every shop cheapest first) gives the same result. Ids are APPEND-ONLY (js/onfoot/swords.js SWORD_IDS / MUSKET_IDS).
const BOSS25 = { all: [{ stat: 'bossKills', need: 25, label: 'Commodore kills' }] }, PVP2K = { all: [{ stat: 'kills', need: 2000, label: 'PvP kills (Solo + Squads)', modes: true }] };
export const WEAPON_PRICES = [
  ['sword', 'rusty', 'RUSTY CUTLASS', 0], ['sword', 'cutlass', 'CUTLASS', 1500], ['sword', 'rapier', 'RAPIER', 4000], ['sword', 'bone', 'BONE SKULL BLADE', 12000],
  ['sword', 'sabre_gilded', "GILDED CAPTAIN'S SABRE", 25000, BOSS25], ['sword', 'blade_gold', 'LEGENDARY GOLD BLADE', 75000, PVP2K],
  ['musket', 'rusty', 'RUSTY FLINTLOCK', 0], ['musket', 'navy', 'NAVY MUSKET', 2000], ['musket', 'blunder', 'BLUNDERBUSS', 5000], ['musket', 'dragoon', 'BRASS DRAGOON', 12000],
  ['musket', 'bone', 'BONE MUSKET', 25000, BOSS25], ['musket', 'blunder_gold', 'GOLDEN BLUNDERBUSS', 75000, PVP2K],
];
const weaponItem = ([slot, id, label, price, goal]) => ({ slot, id, label, price, glb: null, tint: null, weapon: true, ...(price ? {} : { free: true }), ...(goal ? { goal } : {}) });
export const SWORD_ITEMS = WEAPON_PRICES.filter(r => r[0] === 'sword').map(weaponItem);
export const MUSKET_ITEMS = WEAPON_PRICES.filter(r => r[0] === 'musket').map(weaponItem);
export const WEAPON_ITEMS = [...SWORD_ITEMS, ...MUSKET_ITEMS];
// ---------- [Timothy] PET STORE: rarity per parrot (display only; prices + goals are the GEAR_ITEMS ones, unchanged)
export const PET_RARITY = { none: '', pet_cat: 'UNCOMMON', pet_monkey: 'RARE', pet_cat_black: 'RARE', pet_chimp: 'RARE', pet_gorilla: 'EPIC', pet_tiger: 'EPIC', pet_gorilla_white: 'LEGENDARY', parrot_green: 'COMMON', parrot_red: 'UNCOMMON', parrot_blue: 'UNCOMMON', parrot_cockatoo: 'RARE', parrot_black: 'EPIC', parrot_gold: 'LEGENDARY', parrot_diamond: 'MYTHIC' };

// ---------- vendors (Raul's INTERACT ids in js/island/foot.js) ----------
export const VENDORS = {
  shop:       { name: 'SHOP', sub: 'Dock Town · Main Street', tabs: ['skins', 'gear'], slots: ['hat', 'outfit', 'eyes', 'parrot', 'hook', 'leg', 'face', 'beard', 'ears', 'teeth', 'boots', 'cape', 'flag', 'figure'], awning: null },
  stall_red:  { name: 'RED STALL', sub: 'The Tailor · market square', tabs: ['gear'], slots: ['hat', 'outfit', 'eyes', 'face', 'boots', 'cape'], awning: '#d8322f' },   // [shop-boosts] BANKSY: no parrots / pets here (PET STORE, SHOP, BLUE STALL still sell them; owned + equipped ones keep working)
  stall_blue: { name: 'BLUE STALL', sub: 'Curios · market square', tabs: ['gear'], slots: ['parrot', 'hook', 'leg', 'beard', 'ears', 'teeth', 'flag', 'figure'], awning: '#2a6df4' },
  // [v103] harbor plaza shops (replace the old HARBOR MARKET stalls)
  clothes:    { name: 'CLOTHES SHOP', sub: 'Harbor plaza · pirate gear', tabs: ['gear'], slots: ['hat', 'outfit', 'eyes', 'hook', 'leg', 'face', 'beard', 'ears', 'teeth', 'boots', 'cape'], awning: '#d8322f' },
  pets:       { name: 'PET STORE', sub: 'Harbor plaza · parrots, cats, monkeys + more', tabs: ['gear'], slots: ['parrot'], awning: '#1f8a5a', pets: true },   // [Timothy] plaza PET STORE counter
  crew:       { name: 'CREW SHOP', sub: 'Harbor plaza · outfits for your crew', tabs: ['gear'], slots: ['crewhat', 'crewoutfit'], awning: '#6a4fb3', crew: true },   // [Timothy] plaza CREW SHOP counter
  weapons:    { name: 'WEAPON STORE', sub: 'Swords for the SWORD PIT · muskets for the MUSKET RANGE · cosmetic only', tabs: ['swords', 'muskets'], slots: ['sword', 'musket'], awning: '#8a5a2b', weapons: true },   // [Timothy] window.openWeaponStore(); the SWORD SHOP + MUSKET SHOP doors on Main Street (battleAreas.js MAIN_ST_SHOPS) open it with their own title
  ships:      { name: 'SHIP SKINS', sub: 'Harbor plaza · skins for gold', tabs: ['skins'], slots: [], awning: '#2a6df4', upgrades: false }, // [Timothy] BANKSY: skins and upgrades are separate shops (upgrades = the UPGRADE SHOP storefront, open: 'upgrades')
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
export const fmtGoalRow = (r) => r.fmt === 'prestige' ? `PRESTIGE ${fmtN(Math.min(r.have, r.need))}/${fmtN(r.need)}` : r.fmt === 'kd' ? `K/D ${kd1(r.have)} / ${r.need}` : `${r.label} ${fmtN(Math.min(r.have, r.need))}/${fmtN(r.need)}`;
export const fmtGoal = (g) => g.rows.map(fmtGoalRow).join(' · ');
export const fmtGold = (n) => `${fmtN(n)}g`;
// [v157] BANKSY: "keep shops sorted by price". Every shop list goes through this: free/default first, then gold price
// ascending (kill-gated items sort by their gold price too), ties by name. Returns a new array; prices, ids, ownership untouched.
export const byPrice = (price = (x) => x.price, name = (x) => x.name || x.label || '') => (a, b) =>
  ((+price(a) || 0) - (+price(b) || 0)) || String(name(a)).localeCompare(String(name(b)));
export const sortByPrice = (list, price, name) => [...list].sort(byPrice(price, name));
