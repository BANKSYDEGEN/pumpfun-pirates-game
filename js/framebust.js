// [security L] clickjacking guard. GitHub Pages can't send X-Frame-Options / CSP frame-ancestors headers (and
// frame-ancestors is ignored in a <meta> CSP), so the live domains refuse to run inside a stranger's iframe here.
// Only on the live hosts: the itch.io / Newgrounds / CrazyGames builds are MEANT to be framed by their portals,
// and local dev / test pages are left alone. A frame from another *.pumpfunpirates.com page is allowed.
(function () {
  var host = location.hostname;
  if (!/(^|\.)pumpfunpirates\.com$/i.test(host) && !/^banksydegen\.github\.io$/i.test(host)) return;
  var framed; try { framed = window.top !== window.self; } catch (e) { framed = true; }
  if (!framed) return;
  var parent = '';
  try { parent = (location.ancestorOrigins && location.ancestorOrigins.length) ? location.ancestorOrigins[location.ancestorOrigins.length - 1] : document.referrer; } catch (e) {}
  var ph = ''; try { ph = parent ? new URL(parent).hostname : ''; } catch (e) {}
  if (/(^|\.)pumpfunpirates\.com$/i.test(ph)) return;
  // hide everything first (works even when a sandboxed frame blocks top navigation), then try to break out
  document.documentElement.style.setProperty('display', 'none', 'important');
  try { window.top.location.href = location.href; } catch (e) {}
})();
