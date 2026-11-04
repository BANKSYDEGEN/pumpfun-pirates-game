// PUMPFUN PIRATES service worker: caches the app shell + pinned three.js CDN modules for offline play.
// Bump VERSION whenever you change any file so phones pick up the update.
const VERSION = 'pfp-v176'; // [v176] load fix (no cache copy while activating), no SAFE HARBOR pill, moored ships ride higher
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./css/style.css",
  "./css/islandShop.css",
  "./css/account.css",
  "./js/main.js",
  "./js/island/coast.js", // [Emerly] main.js + pvp.js import the coast flag (pure data)
  // [v100] ships v2 kit, v4 pirates, the coast harbor town, docking + on foot
  "./js/captainSlot.js",
  "./js/shipKit.js",
  "./js/pirateGLB.js",
  "./js/pirates.js",
  "./js/pirateGear.js", // [Timothy] island-shop gear on the v4 pirate
  "./js/gearColorPicker.js", // [Timothy] SKIN & HAIR + CLOTHES COLOUR pickers (island shop)
  "./js/gearThumbs.js", // [Timothy] real 3D gear card art (island shop)
  "./js/gearRecolor.js", // [v157] Raul: hat-colour repaint for the helmet + mask maps
  "./js/pirateItems.js", // [Raul] pirate items (crown, tricorn, hooks, peg legs, shirt, suit) behind js/pirateGear.js
  "./js/crewV4.js", // [v102] v4 pirates as the ship crew
  "./js/crewLoadout.js", // [Timothy] the crew's own loadout (Crew Shop)
  "./js/crewGear.js", // [v107] the crew wear the captain's hat + clothes
  "./js/harborCard.js", // [v107] compact phone harbor card
  "./js/lighthouseKit.js", // [v108] shared lighthouse kit
  "./assets/tokens/sunk.png", "./assets/tokens/pump.png", "./assets/tokens/ahoy.png", "./assets/tokens/hq.png", "./assets/tokens/retardio.png", // [v108] token billboard logos ([v144] + $HQ / $RETARDIO)
  "./js/onfoot/followers.js", // [v107] 3 crew follow you ashore
  "./js/dock/index.js",
  "./js/dock/docking.js",
  "./js/dock/layout.js",
  "./js/dock/safe.js",
  "./js/dock/world.js",
  "./js/dock/plaza.js",
  "./js/dock/treasure.js", // [v145] treasure maps + the parchment chart / drop reveal
  "./js/dock/treasureMap.js",
  "./js/dock/battery.js", // [Timothy] headland battery guns (game side)
  "./js/uiProfile.js",
  "./js/accountUi.js", // [v106] player accounts
  "./js/onfoot/net.js",
  "./js/onfoot/pirate.js",
  "./js/onfoot/walker.js",
  "./js/onfoot/physics.js", // [v154] Raul: falling + swimming
  "./js/onfoot/swimPose.js", // [Raul swim-anim] tread / crawl / pull-up poses (physics.js, pirate.js)
  "./js/onfoot/battle.js", // [v149] SWORD PIT + MUSKET RANGE
  "./js/onfoot/swords.js",
  "./js/island/battleAreas.js",
  "./js/island/art.js",
  "./js/island/bake.js",
  "./js/island/foot.js",
  "./js/island/digSpots.js", // [v149] dig-spot registry (foot.js + dock/treasure.js import it)
  "./js/island/areas/index.js", "./js/island/areas/common.js", "./js/island/areas/flags.js", "./js/island/areas/lagoon.js", "./js/island/areas/jungle.js", "./js/island/areas/route.js", "./js/island/areas/ropeBridge.js", "./js/island/areas/fort.js", // [v150] island rework areas (lagoon v150, jungle v151)
  "./js/island/plazaTown.js", // [Timothy] ?plaza=2 harbor town blockout (foot.js imports it)
  "./js/island/battery.js", // [Timothy] headland battery: ramp, gun deck, guns (foot.js imports it)
  "./js/island/plazaShops.js", // [Timothy] Blender storefronts + battery loader
  "./js/island/hillStreet.js", // [Timothy] Blender hill street loader
  "./js/island/hillShops.js", // [Timothy] hill street shop data (RENTABLE_SHOPS)
  "./js/island/harbor.js",
  "./js/island/kit.js",
  "./js/island/look.js",
  "./js/island/townkit.js",
  "./js/config.js",
  "./js/tokenChip.js",
  "./js/shareCard.js",
  "./js/portal.js",
  "./js/daily.js",
  "./js/leaderboard.js",
  "./js/rewards.js",
  "./js/wallet.js",
  "./js/pirateAccount.js",
  "./js/upgrades.js",
  "./js/shop.js",
  "./js/escorts.js",
  "./js/enemyTypes.js",
  "./css/shop.css",
  "./js/audio.js",
  "./js/soundProfile.js",
  "./assets/audio/cannon_1.mp3",
  "./assets/audio/cannon_2.mp3",
  "./assets/audio/impact_1.mp3",
  "./assets/audio/impact_2.mp3",
  "./assets/audio/impact_light_1.mp3",
  "./assets/audio/impact_light_2.mp3",
  "./assets/audio/impact_medium_1.mp3",
  "./assets/audio/impact_medium_2.mp3",
  "./assets/audio/impact_heavy_1.mp3",
  "./assets/audio/impact_heavy_2.mp3",
  "./assets/audio/thunder_1.mp3",
  "./assets/audio/thunder_2.mp3",
  "./assets/audio/thunder_3.mp3",
  "./assets/audio/horn_wave.mp3",
  "./assets/audio/horn_boss.mp3",
  "./assets/audio/upgrade_legendary.mp3",
  "./assets/audio/splash_near_1.mp3",
  "./assets/audio/splash_near_2.mp3",
  "./assets/audio/splash_near_3.mp3",
  "./assets/audio/splash_mid.mp3",
  "./assets/audio/splash_far.mp3",
  "./js/ships.js",
  "./js/crew.js",
  "./js/emotes.js",
  "./js/ocean.js",
  "./js/fx.js",
  "./js/wake.js",
  "./js/toon.js",
  "./js/props.js",
  "./js/upgradeVisuals.js",
  "./js/skins.js",
  "./js/skinPreview.js",
  "./js/healthDrops.js",
  "./js/tutorial.js",
  "./js/net.js",
  "./js/transport.js",
  "./js/keybinds.js",
  "./js/avatar.js",
  "./js/controlsUi.js",
  "./js/skinLooks.js",
  "./js/pvp.js",
  "./js/pvpSave.js",
  "./js/pvpSkins.js",
  "./js/islandShop.js",
  "./js/shopCatalog.js",
  "./js/boosts.js", // [Emerly] ITEM SKILL BOOSTS (shop.js, pvp.js, islandShop.js import it)
  "./js/shopGoals.js", // [Timothy] shop goal progress (islandShop.js imports it)
  "./js/prestige.js", // [prestige] emblem + reward text (pvp.js, shop.js, uiProfile.js)
  "./js/modeKills.js", // [Timothy] pvp.js imports it (BR kills by mode, display only)
  "./js/islandMap.js",
  "./js/pvpBoard.js",
  "./js/squads.js",
  "./assets/ships/pvp/unlockSkins.js",
  "./assets/ships/pvp/mobileSkins.js",
  "./assets/ships/pvp/partsOverride.js",
  "./assets/ships/pvp/diamond.js",
  "./assets/ships/pvp/pvpKit.js",
  "./assets/ships/pvp/golden.js",
  "./assets/ships/pvp/ghost.js",
  "./assets/ships/pvp/kraken.js",
  "./assets/ships/pvp/flaming.js",
  "./assets/ships/pvp/tierLooks.js",
  "./assets/ships/pvp/flamingRedesign.js",
  "./assets/JustAnotherHand.ttf",
  "./assets/skull_transparent.png",
  "./assets/pumpfun_pirates_wordmark.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/captains/1.jpg",
  "./assets/captains/10.jpg",
  "./assets/captains/100.jpg",
  "./assets/captains/106.jpg",
  "./assets/captains/11.jpg",
  "./assets/captains/12.jpg",
  "./assets/captains/13.jpg",
  "./assets/captains/15.jpg",
  "./assets/captains/16.jpg",
  "./assets/captains/172.jpg",
  "./assets/captains/224.jpg",
  "./assets/captains/250.jpg",
  "./assets/captains/253.jpg",
  "./assets/captains/307.jpg",
  "./assets/captains/310.jpg",
  "./assets/captains/321.jpg",
  "./assets/captains/325.jpg",
  "./assets/captains/33.jpg",
  "./assets/captains/333.jpg",
  "./assets/captains/74.jpg"
];
// [v100] art (GLBs + kit textures, ~12 MB): fetched in the background after install (never blocks the update); the fetch handler caches whatever a device actually loads
const ASSETS = [
  "./assets/ships/kit/player_kit.glb",
  "./assets/ships/kit/player_kit_lo.glb",
  "./assets/ships/kit/deck_d.jpg",
  "./assets/ships/kit/deck_d_lo.jpg",
  "./assets/ships/kit/deck_n.jpg",
  "./assets/ships/kit/deck_n_lo.jpg",
  "./assets/ships/kit/hull_d.jpg",
  "./assets/ships/kit/hull_d_lo.jpg",
  "./assets/ships/kit/hull_n.jpg",
  "./assets/ships/kit/hull_n_lo.jpg",
  "./assets/ships/kit/sail_d.jpg",
  "./assets/ships/kit/sail_d_lo.jpg",
  "./assets/ships/kit/sail_n.jpg",
  "./assets/ships/kit/sail_n_lo.jpg",
  "./assets/pirates/pirate_male_hi.glb",
  "./assets/pirates/pirate_male_lo.glb",
  "./assets/pirates/pirate_female_hi.glb",
  "./assets/pirates/pirate_female_lo.glb",
  "./assets/pirates/pirate_male_v5_hi.glb",
  "./assets/pirates/pirate_male_v5_lo.glb",
  "./assets/pirates/pirate_female_v5_hi.glb",
  "./assets/pirates/pirate_female_v5_lo.glb",
  "./assets/pirates/skull_decal.png",
  // [Raul] weapon models (js/onfoot/swords.js loadWeaponModels)
  "./assets/pirates/items/v5/weapon_sword_rusty_hi.glb",
  "./assets/pirates/items/v5/weapon_sword_rusty_lo.glb",
  "./assets/pirates/items/v5/weapon_sword_cutlass_hi.glb",
  "./assets/pirates/items/v5/weapon_sword_cutlass_lo.glb",
  "./assets/pirates/items/v5/weapon_sword_rapier_hi.glb",
  "./assets/pirates/items/v5/weapon_sword_rapier_lo.glb",
  "./assets/pirates/items/v5/weapon_sword_bone_hi.glb",
  "./assets/pirates/items/v5/weapon_sword_bone_lo.glb",
  "./assets/pirates/items/v5/weapon_sword_sabre_gilded_hi.glb",
  "./assets/pirates/items/v5/weapon_sword_sabre_gilded_lo.glb",
  "./assets/pirates/items/v5/weapon_sword_blade_gold_hi.glb",
  "./assets/pirates/items/v5/weapon_sword_blade_gold_lo.glb",
  "./assets/pirates/items/v5/weapon_musket_rusty_hi.glb",
  "./assets/pirates/items/v5/weapon_musket_rusty_lo.glb",
  "./assets/pirates/items/v5/weapon_musket_navy_hi.glb",
  "./assets/pirates/items/v5/weapon_musket_navy_lo.glb",
  "./assets/pirates/items/v5/weapon_musket_blunder_hi.glb",
  "./assets/pirates/items/v5/weapon_musket_blunder_lo.glb",
  "./assets/pirates/items/v5/weapon_musket_dragoon_hi.glb",
  "./assets/pirates/items/v5/weapon_musket_dragoon_lo.glb",
  "./assets/pirates/items/v5/weapon_musket_bone_hi.glb",
  "./assets/pirates/items/v5/weapon_musket_bone_lo.glb",
  "./assets/pirates/items/v5/weapon_musket_blunder_gold_hi.glb",
  "./assets/pirates/items/v5/weapon_musket_blunder_gold_lo.glb",
  "./assets/pirates/items/v5/crown_female_hi.glb",
  "./assets/pirates/items/v5/crown_female_lo.glb",
  "./assets/pirates/items/v5/crown_male_hi.glb",
  "./assets/pirates/items/v5/crown_male_lo.glb",
  "./assets/pirates/items/v5/helmet_hq_female_hi.glb",
  "./assets/pirates/items/v5/helmet_hq_female_lo.glb",
  "./assets/pirates/items/v5/helmet_hq_male_hi.glb",
  "./assets/pirates/items/v5/helmet_hq_male_lo.glb",
  "./assets/pirates/items/v5/mask_luchador_female_hi.glb",
  "./assets/pirates/items/v5/mask_luchador_female_lo.glb",
  "./assets/pirates/items/v5/mask_luchador_male_hi.glb",
  "./assets/pirates/items/v5/mask_luchador_male_lo.glb",
  "./assets/pirates/items/v5/cloth_singlet_female_hi.glb",
  "./assets/pirates/items/v5/cloth_singlet_female_lo.glb",
  "./assets/pirates/items/v5/cloth_singlet_male_hi.glb",
  "./assets/pirates/items/v5/cloth_singlet_male_lo.glb",
  "./assets/pirates/items/v5/facepaint_retardio_female_hi.glb",
  "./assets/pirates/items/v5/facepaint_retardio_female_lo.glb",
  "./assets/pirates/items/v5/facepaint_retardio_male_hi.glb",
  "./assets/pirates/items/v5/facepaint_retardio_male_lo.glb",
  "./assets/pirates/items/v5/eyes_eyepatch_female_hi.glb",
  "./assets/pirates/items/v5/eyes_eyepatch_female_lo.glb",
  "./assets/pirates/items/v5/eyes_eyepatch_male_hi.glb",
  "./assets/pirates/items/v5/eyes_eyepatch_male_lo.glb",
  "./assets/pirates/items/v5/eyes_vr_female_hi.glb",
  "./assets/pirates/items/v5/eyes_vr_female_lo.glb",
  "./assets/pirates/items/v5/eyes_vr_male_hi.glb",
  "./assets/pirates/items/v5/eyes_vr_male_lo.glb",
  "./assets/pirates/items/v5/hat_bandana_female_hi.glb",
  "./assets/pirates/items/v5/hat_bandana_female_lo.glb",
  "./assets/pirates/items/v5/hat_bandana_male_hi.glb",
  "./assets/pirates/items/v5/hat_bandana_male_lo.glb",
  "./assets/pirates/items/v5/hat_bicorne_female_hi.glb",
  "./assets/pirates/items/v5/hat_bicorne_female_lo.glb",
  "./assets/pirates/items/v5/hat_bicorne_male_hi.glb",
  "./assets/pirates/items/v5/hat_bicorne_male_lo.glb",
  "./assets/pirates/items/v5/hat_tricorn_female_hi.glb",
  "./assets/pirates/items/v5/hat_tricorn_female_lo.glb",
  "./assets/pirates/items/v5/hat_tricorn_male_hi.glb",
  "./assets/pirates/items/v5/hat_tricorn_male_lo.glb",
  "./assets/pirates/items/v5/hook_l_female_hi.glb",
  "./assets/pirates/items/v5/hook_l_female_lo.glb",
  "./assets/pirates/items/v5/hook_l_male_hi.glb",
  "./assets/pirates/items/v5/hook_l_male_lo.glb",
  "./assets/pirates/items/v5/hook_r_female_hi.glb",
  "./assets/pirates/items/v5/hook_r_female_lo.glb",
  "./assets/pirates/items/v5/hook_r_male_hi.glb",
  "./assets/pirates/items/v5/hook_r_male_lo.glb",
  "./assets/pirates/items/v5/peg_l_female_hi.glb",
  "./assets/pirates/items/v5/peg_l_female_lo.glb",
  "./assets/pirates/items/v5/peg_l_male_hi.glb",
  "./assets/pirates/items/v5/peg_l_male_lo.glb",
  "./assets/pirates/items/v5/peg_r_female_hi.glb",
  "./assets/pirates/items/v5/peg_r_female_lo.glb",
  "./assets/pirates/items/v5/peg_r_male_hi.glb",
  "./assets/pirates/items/v5/peg_r_male_lo.glb",
  "./assets/pirates/gear_hi.glb", // [Timothy] shop gear (hats, eyewear, parrots, hooks)
  "./assets/pirates/gear_lo.glb",
  "./assets/island/town_kit.glb",
  "./assets/island/town_kit.webp.glb",
  "./assets/island/town_kit_low.glb",
  "./assets/island/town_kit_low.webp.glb",
  "./assets/island/plaza_shops.glb",
  "./assets/island/plaza_shops_low.glb",
  // [Timothy hill street] only the phone (_low) models are precached; the High ones (3.7 MB) are cached on first use (network-first handler)
  "./assets/island/hill_street_low.glb",
  "./assets/island/hill_sword_shop_low.glb",
  "./assets/island/hill_musket_shop_low.glb",
  "./assets/island/docks.glb",
  "./assets/island/docks_low.glb",
  "./assets/island/battery.glb",
  "./assets/island/battery_low.glb",
  "./assets/island/nature_kit.glb",
  "./assets/island/nature_kit.webp.glb",
  "./assets/island/nature_kit_low.glb",
  "./assets/island/nature_kit_low.webp.glb",
];
// [security M4] three.js is self-hosted in vendor/ (was jsDelivr, cached forever). Same-origin files are network-first
// below, so a bad copy can never stick; these are only precached for offline play (best effort).
const VENDOR = './vendor/three-0.165.0/';
const VENDOR_FILES = [
  VENDOR + 'build/three.module.js',
  VENDOR + 'examples/jsm/controls/OrbitControls.js',
  VENDOR + 'examples/jsm/utils/BufferGeometryUtils.js',
  VENDOR + 'examples/jsm/geometries/RoundedBoxGeometry.js',
  VENDOR + 'examples/jsm/loaders/GLTFLoader.js',
  VENDOR + 'examples/jsm/loaders/DRACOLoader.js',
  VENDOR + 'examples/jsm/loaders/KTX2Loader.js',
  VENDOR + 'examples/jsm/libs/meshopt_decoder.module.js',
  VENDOR + 'examples/jsm/libs/ktx-parse.module.js',
  VENDOR + 'examples/jsm/libs/zstddec.module.js',
  VENDOR + 'examples/jsm/utils/WorkerPool.js',
  VENDOR + 'examples/jsm/utils/SkeletonUtils.js',
  './js/boot.js', './js/framebust.js', './js/env.js', './js/safe.js',
];
// [v101] the combat sound core (~290 KB) is precached above; voices, the victory stinger and the shanty (~800 KB)
// are cached on first use by the same-origin fetch handler below.
// high-quality post-processing modules: cached when a desktop/high-tier device fetches them (see fetch handler)

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    await Promise.all(VENDOR_FILES.map(u => c.add(u).catch(() => {}))); // best effort
    // [v176] load fix: carry the art over from the previous version's cache HERE (install), not in activate. While a worker is
    // 'activating' the browser holds every page fetch, so the v173 copy-forward (~300 entries, ~20 MB, one by one) stalled the load
    // after each update on phones. Install runs while the old worker still serves the page; copies run in parallel.
    const old = (await caches.keys()).filter(k => k !== VERSION);
    await Promise.all(ASSETS.map(async (u) => { if (await c.match(u)) return; for (const k of old) { const hit = await (await caches.open(k)).match(u); if (hit) { await c.put(u, hit).catch(() => {}); return; } } }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    await self.clients.claim(); // [v176] nothing slow before claim: the page's fetches are never held up
    const c = await caches.open(VERSION);
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    // [mobile-perf] phones only precache the light (_lo / _low) art they actually use (the hi copies were ~2/3 of the 32 MB)
    const phone = new URL(self.location.href).searchParams.get('m') === '1' || /Android|iPhone|iPad|iPod|Mobile/i.test(self.navigator?.userAgent || ''), heavy = (u) => /_hi\.glb$/.test(u) || (/\/island\/[a-z_]+(\.webp)?\.glb$/.test(u) && !/_low/.test(u)) || /\/kit\/[a-z_]+(?<!_lo)\.(glb|jpg)$/.test(u);
    (async () => { for (const u of ASSETS) { if (phone && heavy(u)) continue; if (!(await c.match(u))) await c.add(u).catch(() => {}); } })(); // [v100] background, best effort, one at a time
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // never cache leaderboard / API traffic
  if (url.hostname.endsWith('supabase.co') || url.pathname.includes('/rest/v1/')) return;
  // [security M4] only same-origin files are cached (no third-party script is ever served from the cache)
  if (url.origin !== self.location.origin) return;
  // same-origin: network-first (fresh when online), cache fallback offline
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => { // revalidate (cheap 304s): never mix an old cached file with new ones after an update
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
});
