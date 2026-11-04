// [security M4] was an inline <script> in index.html; external so the page CSP can forbid inline scripts.
// Classic (non-module) script: runs before the modules, exactly as before.
// game portals (itch.io / Newgrounds iframes): offline, crypto-free build, see js/portal.js
if (/(^|\.)(itch\.zone|ungrounded\.net|crazygames\.com)$/.test(location.hostname)) document.documentElement.classList.add('portal');
// iOS 27 home-screen web apps draw a system blur over the top of the page unless a solid fixed bar sits at the very top.
// [boot failsafe] an update can briefly mix old + new files (browser cache), and a start-up error used to leave
// "Hoisting the sails…" up forever. If start-up fails or takes over 30 s: clear the offline cache and reload (twice max),
// then show a RELOAD button instead of hanging.
(function () {
  var KEY = 'pfp_boot_retry', booted = function () { var l = document.getElementById('loading'); return !!l && l.classList.contains('hidden'); };
  var fail = function () {
    if (booted() || window.__pfpBootFail) return; window.__pfpBootFail = 1;
    var n = 0; try { n = +(sessionStorage.getItem(KEY) || 0); sessionStorage.setItem(KEY, n + 1); } catch (e) {}
    var go = function () { location.reload(); };
    if (n < 2) { var w = window.caches ? caches.keys().then(function (k) { return Promise.all(k.map(function (x) { return caches.delete(x); })); }) : Promise.resolve(); w.then(go, go); return; }
    var p = document.querySelector('#loading .panel'); if (p) { p.innerHTML = '<h1>Ship needs a refresh</h1><p>Could not load the latest version.</p><button class="big" type="button" id="boot-reload">RELOAD</button>';
      var b = document.getElementById('boot-reload'); if (b) b.addEventListener('click', function () { try { sessionStorage.removeItem(KEY); } catch (e) {} location.reload(); }); }
  };
  // [Emerly gamepad] no WebGL at all (the PlayStation 5's hidden browser, some TV / kiosk browsers): say so instead of the reload loop.
  // [webgl-card] BANKSY 4:52 PM saw this card on a desktop PC. On a PC, getContext() also returns null for a moment while the GPU process
  // restarts, and Chrome blocks 3D for a site for the rest of the session after a GPU reset it blames on it. So: try webgl2 then webgl1
  // (default attributes, never failIfMajorPerformanceCaveat), log the browser's own reason, retry for ~3 s before giving up, and on a
  // PC offer RELOAD + "restart the browser" instead of a dead card. Only consoles get the console text.
  var glWhy = '', glTry = function () { var c = document.createElement('canvas'), g = null;
    c.addEventListener('webglcontextcreationerror', function (e) { glWhy = (e && e.statusMessage) || glWhy; }, false);
    try { g = c.getContext('webgl2'); } catch (e) { glWhy = String(e && e.message || e); }
    if (!g) try { g = c.getContext('webgl') || c.getContext('experimental-webgl'); } catch (e) { glWhy = String(e && e.message || e); }
    if (!g) return false; var x = g.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); return true; };
  var glCard = function () { window.__pfpBootFail = 1; var show = function () {
    var p = document.querySelector('#loading .panel'), ua = navigator.userAgent, ps = /PlayStation/.test(ua), xb = /\bXbox\b/.test(ua);
    console.error('[boot] WebGL could not be created (webgl2 + webgl1 tried, ~3 s of retries):', glWhy || '(the browser gave no reason)', '| UA:', ua);
    if (!p) return;
    p.innerHTML = '<h1>This browser can\'t run the 3D sea</h1><p>' + (ps ? 'The PlayStation browser has no WebGL (3D graphics), so PUMPFUN PIRATES can\'t start here. Play on a PC, Mac, phone or the Xbox Edge browser: your DualSense works there (USB or Bluetooth).'
      : xb ? 'Turn on hardware acceleration in Edge settings, then reload.'
      : 'The browser would not start 3D graphics (WebGL). If the game ran here before, the graphics driver probably reset and the browser paused 3D for this site: close every browser window and reopen it, then reload. Otherwise turn on hardware acceleration (Chrome / Edge: Settings, System).')
      + (glWhy ? '</p><p><small>' + String(glWhy).replace(/[<>&]/g, '') + '</small>' : '') + '</p>' + (ps ? '' : '<button class="big" type="button" id="boot-reload">RELOAD</button>');
    var b = document.getElementById('boot-reload'); if (b) b.addEventListener('click', function () { location.reload(); }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show(); };
  if (!/[?&]pad=0(&|$)/.test(location.search) && !glTry()) { window.__pfpBootFail = 1;   // hold the reload failsafe while we retry
    var tries = 0, again = function () { if (glTry()) { console.warn('[boot] WebGL came back after', tries, 'retries (GPU process restart):', glWhy); try { sessionStorage.removeItem(KEY); } catch (e) {} location.reload(); return; }
      if (++tries < 6) setTimeout(again, 500); else glCard(); };
    setTimeout(again, 500); }
  addEventListener('error', function (e) { if (e instanceof ErrorEvent && !booted()) setTimeout(fail, 400); }, true);
  addEventListener('unhandledrejection', function () { if (!booted()) setTimeout(fail, 400); });
  setTimeout(function () { if (!booted()) fail(); }, 30000);
})();
if (navigator.standalone === true || (/iPhone|iPad|iPod/.test(navigator.userAgent) && matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches)) document.documentElement.classList.add('ios-pwa');
