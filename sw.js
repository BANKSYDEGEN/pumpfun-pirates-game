// PUMPFUN PIRATES service worker: caches the app shell + pinned three.js CDN modules for offline play.
// Bump VERSION whenever you change any file so phones pick up the update.
const VERSION = 'pfp-v65';
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./css/style.css",
  "./js/main.js",
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
  "./js/skinLooks.js",
  "./js/pvp.js",
  "./js/pvpSave.js",
  "./js/pvpSkins.js",
  "./js/pvpBoard.js",
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
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.165.0/';
const CDN_FILES = [
  CDN + 'build/three.module.js',
  CDN + 'build/three.core.js',
  CDN + 'examples/jsm/controls/OrbitControls.js',
  CDN + 'examples/jsm/utils/BufferGeometryUtils.js',
  CDN + 'examples/jsm/geometries/RoundedBoxGeometry.js',
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
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
});
