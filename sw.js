// PUMPFUN PIRATES service worker: caches the app shell + pinned three.js CDN modules for offline play.
// Bump VERSION whenever you change any file so phones pick up the update.
const VERSION = 'pfp-v100';
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./css/style.css",
  "./js/main.js",
  "./js/island/coast.js", // [Emerly] main.js + pvp.js import the coast flag (pure data)
  // [v100] ships v2 kit, v4 pirates, the coast harbor town, docking + on foot
  "./js/captainSlot.js",
  "./js/shipKit.js",
  "./js/pirateGLB.js",
  "./js/pirates.js",
  "./js/dock/index.js",
  "./js/dock/docking.js",
  "./js/dock/layout.js",
  "./js/dock/safe.js",
  "./js/dock/world.js",
  "./js/onfoot/net.js",
  "./js/onfoot/pirate.js",
  "./js/onfoot/walker.js",
  "./js/island/art.js",
  "./js/island/bake.js",
  "./js/island/foot.js",
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
  "./assets/island/town_kit.glb",
  "./assets/island/town_kit.webp.glb",
  "./assets/island/town_kit_low.glb",
  "./assets/island/town_kit_low.webp.glb",
  "./assets/island/nature_kit.glb",
  "./assets/island/nature_kit.webp.glb",
  "./assets/island/nature_kit_low.glb",
  "./assets/island/nature_kit_low.webp.glb",
];
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.165.0/';
const CDN_FILES = [
  CDN + 'build/three.module.js',
  CDN + 'build/three.core.js',
  CDN + 'examples/jsm/controls/OrbitControls.js',
  CDN + 'examples/jsm/utils/BufferGeometryUtils.js',
  CDN + 'examples/jsm/geometries/RoundedBoxGeometry.js',
  CDN + 'examples/jsm/loaders/GLTFLoader.js', // [v100] ship kit, island kits, v4 pirates
  CDN + 'examples/jsm/loaders/DRACOLoader.js',
  CDN + 'examples/jsm/loaders/KTX2Loader.js',
  CDN + 'examples/jsm/libs/meshopt_decoder.module.js',
  CDN + 'examples/jsm/utils/SkeletonUtils.js',
];
// high-quality post-processing modules: cached when a desktop/high-tier device fetches them (see fetch handler)

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    // CDN files are best effort (three.core.js only exists in newer builds)
    await Promise.all(CDN_FILES.map(u => c.add(new Request(u, { mode: 'cors' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
    caches.open(VERSION).then(c => { for (const u of ASSETS) c.match(u).then(hit => hit || c.add(u).catch(() => {})); }); // [v100] background, best effort
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // never cache leaderboard / API traffic
  if (url.hostname.endsWith('supabase.co') || url.pathname.includes('/rest/v1/')) return;
  const isCDN = url.href.startsWith(CDN);
  const isSame = url.origin === self.location.origin;
  if (!isCDN && !isSame) return;
  if (isCDN) {
    // pinned version => cache-first forever
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  // same-origin: network-first (fresh when online), cache fallback offline
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => { // revalidate (cheap 304s): never mix an old cached file with new ones after an update
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
});
