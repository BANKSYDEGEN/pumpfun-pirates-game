// PUMPFUN PIRATES service worker: caches the app shell + pinned three.js CDN modules for offline play.
// Bump VERSION whenever you change any file so phones pick up the update.
const VERSION = 'pfp-v577';
// prev: // [v178] Raul's shop items 2 (beards, earrings, gold teeth, boots, capes, pets, special pegs, ship flags + figureheads); [v177] Timothy's shared material library + gate junction; [v176] load fix, no SAFE HARBOR pill, moored ships ride higher
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./css/style.css",
  "./css/islandShop.css",
  "./css/account.css",
  "./js/main.js",
  "./js/preloadList.js", // [v330 perf] generated harbor module list (main.js imports it)
  "./js/island/coast.js", // [Emerly] main.js + pvp.js import the coast flag (pure data)
  // [v100] ships v2 kit, v4 pirates, the coast harbor town, docking + on foot
  "./js/captainSlot.js",
  "./js/shipKit.js",
  "./js/pirateGLB.js",
  "./js/onfoot/locomotion.js",
  "./js/pirates.js",
  "./js/pirateGear.js", // [Timothy] island-shop gear on the v4 pirate
  "./js/gearColorPicker.js", // [Timothy] SKIN & HAIR + CLOTHES COLOUR pickers (island shop)
  "./js/gearThumbs.js", // [Timothy] real 3D gear card art (island shop)
  "./js/gearRecolor.js", // [v157] Raul: hat-colour repaint for the helmet + mask maps
  "./js/shipGear.js", // [Raul shop items 2] shop flag + figurehead on ships
  "./js/bootPeg.js", // [v191] Raul: shop boots x peg legs (boot hide rule + the peg-side drop)
  "./js/petRig.js", "./js/petMotion.js", "./js/onfoot/pets.js", "./js/features.js", "./js/graphicsBudget.js", "./js/onfoot/followPath.js", // [v198] Raul: ground pets that follow you (rig + gait), parrot flight
  "./js/carryWeapons.js", "./js/carryRules.js", // [v202] Raul: the carried sword + back musket
  "./js/pirateItems.js", // [Raul] pirate items (crown, tricorn, hooks, peg legs, shirt, suit) behind js/pirateGear.js
  "./js/crewV4.js", // V7 shared ship crew templates
  "./js/crewNativeV7.js",
  "./js/crewAiPilly.js",
  "./js/crewItemLods.js", // crew-only light native-space V7 garments
  "./js/crewLoadout.js", // [Timothy] the crew's own loadout (Crew Shop)
  "./js/crewGear.js", // [v107] the crew wear the captain's hat + clothes
  "./js/harborCard.js", // [v107] compact phone harbor card
  "./js/lighthouseKit.js", // [v108] shared lighthouse kit
  "./assets/tokens/sunk.png", "./assets/tokens/pump.png", "./assets/tokens/ahoy.png", "./assets/tokens/hq.png", "./assets/tokens/retardio.png", // [v108] token billboard logos ([v144] + $HQ / $RETARDIO)
  "./js/onfoot/followers.js", // [v107] 3 crew follow you ashore
  "./js/dock/index.js", "./js/dock/ladders.js", "./js/hullReach.js",
  "./js/dock/houses.js",
  "./js/dock/shipHull.js",
  "./js/dock/parrotCage.js",
  "./js/parrotsPanel.js",
  "./js/dock/houseStorage.js", // [v324] cottage chest drag-full-stack + split UI
  "./js/adminState.js",
  "./js/adminMenu.js",
  "./js/adminSpawn.js",
  "./js/adminWorld.js",
  "./js/shoreCombat.js",
  "./js/broadsideAim.js",
  "./js/shipCollide.js",
  "./js/inventory/backpackCap.js", "./js/island/safeZones.js", "./js/dock/lootBags.js", "./js/lootCard.js", "./js/dock/safeZoneMarks.js", // [backpack-pvp]
  "./js/serverPicker.js", "./js/kdCounter.js", "./js/onfoot/crewFight.js", "./js/onfoot/stances.js", // [backpack-pvp] server picker · unified K/D · crew-vs-crew fights
  "./js/dock/docking.js",
  "./js/dock/parkPose.js",
  "./js/dock/layout.js",
  "./js/dock/safe.js",
  "./js/dock/world.js",
  "./js/dock/plaza.js",
  "./js/dock/treasure.js", // [v145] treasure maps + the parchment chart / drop reveal
  "./js/inventory/catalog.js", "./js/inventory/ui.js", "./js/inventory/shopSpots.js", "./js/island/areas/invShops.js", "./js/island/areas/bldNums.js", "./assets/island/plaza_shops.json", "./assets/island/building_numbers.json", // [inventory] + [v212] stalls in the plaza, building numbers
  "./js/dock/treasureMap.js",
  "./js/dock/chestReveal.js",
  "./js/dock/battery.js", // [Timothy] headland battery guns (game side)
  "./js/uiProfile.js",
  "./js/accountUi.js", // [v106] player accounts
  "./js/onfoot/net.js",
  "./js/onfoot/pirate.js",
  "./js/onfoot/walker.js",
  "./js/onfoot/physics.js", // [v154] Raul: falling + swimming
  "./js/onfoot/swimPose.js", // [Raul swim-anim] tread / crawl / pull-up poses (physics.js, pirate.js)
  "./js/onfoot/battle.js", "./js/onfoot/swordHand.js", // [v149] SWORD PIT + MUSKET RANGE
  "./js/onfoot/swords.js", "./js/onfoot/gunAccMesh.js", "./js/onfoot/weaponDecor.js", "./js/onfoot/weaponLook.js",
  "./js/onfoot/tps.js", // [v202] musket aim: PC point and click, phone over the shoulder
  "./js/onfoot/tpsMath.js",
  "./js/island/battleAreas.js",
  "./js/island/art.js",
  "./js/island/bake.js",
  "./js/island/foot.js",
  "./js/island/riverWater.js", // [clean-water] AAA river + lagoon + waterfall plunge (&riverfx=0)
  "./js/island/digSpots.js", // [v149] dig-spot registry (foot.js + dock/treasure.js import it)
  "./js/island/areas/index.js", "./js/island/areas/common.js", "./js/island/areas/flags.js", "./js/island/areas/lagoon.js", "./js/island/areas/lagoonArt.js", "./js/island/areas/fishing2.js", "./js/island/areas/fishTune.js", "./js/island/areas/jungle.js", "./js/island/areas/route.js", "./js/island/areas/ropeBridge.js", "./js/island/areas/fort.js", "./js/island/areas/hillRound.js", "./js/island/areas/cottages.js", // [v150] island rework areas (lagoon v150, jungle v151)
  "./js/island/plazaTown.js", // [Timothy] ?plaza=2 harbor town blockout (foot.js imports it)
  "./js/island/battery.js", // [Timothy] headland battery: ramp, gun deck, guns (foot.js imports it)
  "./js/island/plazaShops.js", "./js/island/plazaMannequins.js", "./js/island/casino.js", "./js/island/casinoData.js", "./js/casino/engine.js", "./js/casino/ui.js", "./js/casino/theme.js", // [Timothy] Blender storefronts + battery loader
  "./js/island/hillStreet.js", // [Timothy] Blender hill street loader
  "./js/island/terrainEdit.js", // [v183] owner build mode (terrain tools)
  "./js/island/libTex.js", // [Timothy] shared material library (KTX2 array + triplanar)
  "./js/island/d2Blender.js", // [v185] D2 Jungle Ruins Blender loader
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
  "./js/staticMerge.js", // [perf4] merge static same-material meshes
  "./js/crew.js",
  "./js/emotes.js",
  "./js/ocean.js",
  "./js/skyCycle.js",
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
  "./js/netGate.js",
  "./js/keybinds.js",
  "./js/avatar.js",
  "./js/controlsUi.js",
  "./js/hudDeclutter.js", // [v350] gameplay hint lifecycle
  "./js/gamepad.js", // [v223] controllers + console browsers
  "./js/skinLooks.js",
  "./js/pvp.js",
  "./js/pvpSave.js",
  "./js/pvpSkins.js",
  "./js/islandShop.js",
  "./js/pillyShopCard.js",
  "./js/pillyEntries.js",
  "./js/shopCatalog.js",
  "./js/dock/zipline.js", // [v296] Emerly zipline
  "./js/dock/canoe.js", // [v311] sail-around offshore anchor + canoe + ship recall
  "./js/boosts.js", // [Emerly] ITEM SKILL BOOSTS (shop.js, pvp.js, islandShop.js import it)
  "./js/shopGoals.js", // [Timothy] shop goal progress (islandShop.js imports it)
  "./js/prestige.js", // [prestige] emblem + reward text (pvp.js, shop.js, uiProfile.js)
  "./js/modeKills.js", // [Timothy] pvp.js imports it (BR kills by mode, display only)
  "./js/islandMap.js",
  "./js/islandGeography.js",
  "./js/dock/streetSigns.js", // [v335] no-op stub (3D street signs removed)
  "./js/mapIcons.js",
  "./js/mapLandmarks.js",
  "./js/mapBuildings.js",
  "./js/mapWaypoint.js",
  "./js/dock/buildingWaypoint.js",
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
  "./js/newShipsTable.js", // [Emerly] the one table: which prestige gives each new hull
  "./js/newShips.js", // [Emerly] the five new hulls (pvpSkins.js + pvp.js import it)
  "./assets/ships/pvp/newShips/kit.js",
  "./assets/ships/pvp/newShips/opal.js",
  "./assets/ships/pvp/newShips/leviathan.js",
  "./assets/ships/pvp/newShips/celestial.js",
  "./assets/ships/pvp/newShips/sunKing.js",
  "./assets/ships/pvp/newShips/poseidon.js",
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
  "./assets/ships/gear/figureheads_hi.glb",
  "./assets/ships/gear/figureheads_lo.glb",
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
  "./assets/pirates/pirate_male_v7_crew.glb",
  "./assets/pirates/pirate_female_v7_crew.glb",
  "./assets/pirates/items/v7_crew/cloth_coat_female_lo.glb",
  "./assets/pirates/items/v7_crew/cloth_coat_male_lo.glb",
  "./assets/pirates/items/v7_crew/cloth_shirt_female_lo.glb",
  "./assets/pirates/items/v7_crew/cloth_shirt_male_lo.glb",
  "./assets/pirates/items/v7_crew/cloth_singlet_female_lo.glb",
  "./assets/pirates/items/v7_crew/cloth_singlet_male_lo.glb",
  "./assets/pirates/items/v7_crew/cloth_suit_female_lo.glb",
  "./assets/pirates/items/v7_crew/cloth_suit_male_lo.glb",
  "./assets/pirates/items/v7_crew/cloth_tank_female_lo.glb",
  "./assets/pirates/items/v7_crew/cloth_tank_male_lo.glb",
  "./assets/pirates/items/v7_crew/cloth_tshirt_female_lo.glb",
  "./assets/pirates/items/v7_crew/cloth_tshirt_male_lo.glb",
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
  "./assets/island/casino_hall_low.glb",
  "./assets/island/captains_quarters.glb",
  // [Timothy hill street] only the phone (_low) models are precached; the High ones (3.7 MB) are cached on first use (network-first handler)
  "./assets/island/hill_street_low.glb",
  "./assets/island/hill_sword_shop_low.glb",
  "./assets/island/hill_musket_shop_low.glb",
  "./assets/island/hill_big_shop_low.glb",
  "./assets/island/d2_jungle_low.glb",
  "./assets/island/docks.glb",
  "./assets/island/docks_low.glb",
  "./assets/island/battery.glb",
  "./assets/island/battery_low.glb",
  "./assets/island/tex/lib_lo.ktx2",   // [Timothy] material library, phone set (the desktop lib.ktx2 is cached on first use)
  "./assets/island/nature_kit.glb",
  "./assets/island/nature_kit.webp.glb",
  "./assets/island/nature_kit_low.glb",
  "./assets/island/nature_kit_low.webp.glb",
];
// [security M4] three.js is self-hosted in vendor/ (was jsDelivr, cached forever). Same-origin files are network-first
// below, so a bad copy can never stick; these are only precached for offline play (best effort).
const VENDOR = './vendor/three-0.165.0/';
const VENDOR_FILES = [
  VENDOR + 'build/three.module.min.js', // [perf2] minified (674 KB, was 1.28 MB)
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

// [v339 mobile-stability] BANKSY t1792u: the worker's memory counts against the page's budget on iOS. The install used to run ASSETS.length (~340)
// copies at once, each re-opening every old cache, plus a 110-file addAll burst. Now: old caches opened ONCE, every list walked by a small pool
// (8 at a time), and phones skip the desktop-only art (heavy(): the hi kits, full-size island GLBs incl. captains_quarters.glb, cached on first use).
const isPhone = () => new URL(self.location.href).searchParams.get('m') === '1' || /Android|iPhone|iPad|iPod|Mobile/i.test(self.navigator?.userAgent || '');
const heavy = (u) => /_hi\.glb$/.test(u) || (/\/island\/[a-z_]+(\.webp)?\.glb$/.test(u) && !/_low/.test(u)) || /\/kit\/[a-z_]+(?<!_lo)\.(glb|jpg)$/.test(u) || /captains_quarters\.glb$/.test(u);
async function pool(list, n, fn) { let i = 0; const run = async () => { while (i < list.length) { const u = list[i++]; try { await fn(u); } catch {} } }; await Promise.all(Array.from({ length: Math.min(n, list.length) }, run)); }
const POOL = 8;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    let shellFail = null;
    await pool(SHELL, POOL, async (u) => { try { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw 0; await c.put(u, r); } catch { shellFail = u; } });
    if (shellFail) throw new Error('shell ' + shellFail); // same contract as cache.addAll: a broken shell never installs
    await pool(VENDOR_FILES, POOL, (u) => c.add(u)); // best effort
    // [v176] load fix: carry the art over from the previous version's cache HERE (install), not in activate (activating holds every page fetch).
    const oldCaches = await Promise.all((await caches.keys()).filter(k => k !== VERSION).map(k => caches.open(k)));
    const phone = isPhone();
    if (oldCaches.length) await pool(ASSETS.filter(u => !(phone && heavy(u))), POOL, async (u) => {
      if (await c.match(u)) return;
      for (const oc of oldCaches) { const hit = await oc.match(u); if (hit) { await c.put(u, hit).catch(() => {}); return; } }
    });
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    await self.clients.claim(); // [v176] nothing slow before claim: the page's fetches are never held up
    const c = await caches.open(VERSION);
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    // [mobile-perf] phones only precache the light (_lo / _low) art they actually use (the hi copies were ~2/3 of the 32 MB)
    const phone = isPhone();
    const LP = new URL(self.location.href).searchParams.get('lp') !== '0'; // [v276 load-perf]
    // Default: cache art on demand. Unused legacy/high/low variants no longer compete with play or fill memory.
    // ?lp=0 remains the explicit legacy/offline-prefill opt-in.
    if (LP) return;
    (async () => { if (LP) await new Promise(r => setTimeout(r, 45000)); const net = self.navigator?.connection || {}; if (phone && (net.saveData || /(^|-)2g$|^3g$/.test(net.effectiveType || ''))) return; // [v330 perf] no 33 MB art fill on Save-Data / slow phone links (the fetch handler still caches what you play)
      for (const u of ASSETS) { if (phone && heavy(u)) continue; if (await c.match(u)) continue; try { const r = await fetch(u, { priority: 'low', cache: 'no-cache' }); if (r.ok) await c.put(u, r); } catch {} } })(); // [v100] background, best effort, one at a time // [v330 perf] low fetch priority: never outruns the game's own downloads
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
  // [perf v461] pages, sw.js and Range (media) requests: network-first as before (fresh when online), cache fallback offline
  const live = () => fetch(req, { cache: 'no-cache' }).then(res => { // revalidate (cheap 304s)
    if (res.ok && res.status === 200) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {}); }
    return res;
  });
  if (req.mode === 'navigate' || req.headers.has('range') || /\/sw\.js$/.test(url.pathname) || /[?&]nocache=1(&|$)/.test(url.search)) {
    e.respondWith(live().catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
    return;
  }
  // [perf v461] BANKSY t2169u "optimize load time": every other same-origin file is served straight from THIS version's cache (the cache is
  // keyed by VERSION and refilled from the network on every bump, so a release can never mix old + new files), and revalidated once per
  // worker in the background (low priority) so a file changed without a VERSION bump is still fresh by the next load. The old network-first
  // path waited one round trip per file (~140 of them, chained through the module graph) on every boot, even when nothing had changed.
  e.respondWith(caches.open(VERSION).then(c => c.match(req)).then(hit => {
    if (!hit) return live().catch(() => caches.match(req, { ignoreSearch: true }).then(h => h || caches.match('./index.html')));
    if (!REVAL.has(req.url)) { REVAL.add(req.url); e.waitUntil(new Promise(r => setTimeout(r, 4000)).then(() => fetch(req, { cache: 'no-cache', priority: 'low' })).then(res => {
      if (res.ok && res.status === 200) return caches.open(VERSION).then(c => c.put(req, res)); }).catch(() => {})); }
    return hit;
  }).catch(() => live()));
});
const REVAL = new Set(); // [perf v461] urls revalidated by this worker instance
