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
  addEventListener('error', function (e) { if (e instanceof ErrorEvent && !booted()) setTimeout(fail, 400); }, true);
  addEventListener('unhandledrejection', function () { if (!booted()) setTimeout(fail, 400); });
  setTimeout(function () { if (!booted()) fail(); }, 30000);
})();
if (navigator.standalone === true || (/iPhone|iPad|iPod/.test(navigator.userAgent) && matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches)) document.documentElement.classList.add('ios-pwa');
