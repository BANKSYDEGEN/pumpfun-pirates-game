// [scale-afk] BANKSY t2512u "Do 2 3 4": after WORLD_AFK_S seconds idle, return to the title
// screen with a friendly note and drop the world_cap lease (js/joinQueue.js cancelJoin in toTitle).
// Menus and shops pause the timer; the owner (BANKSY) is exempt. One config value.
import { WORLD_AFK_S } from './config.js';

export { WORLD_AFK_S };

// Visible UI that means the pirate is busy, not AFK. Overlays + html open-classes used around the island.
export const MENU_IDS = ['pause', 'gameover', 'shop', 'pvp-menu', 'ctl-ov', 'casino-ui', 'inv-panel', 'fr-panel', 'pet-panel', 'iv-pick', 'iv-pick-ok', 'waves-skins', 'waves-entry'];
export const MENU_HTML_RE = /(?:^|\s)(shop-open|acct-open|isle-map-open|dk-skins-open|hb-hub-open|tm-map-open|pfp-chat-open|dk-board|pfp-harbor-tut)(?:\s|$)/;

export function inMenuOrShop(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return false;
  if (MENU_HTML_RE.test(doc.documentElement?.className || '')) return true;
  for (const id of MENU_IDS) {
    const el = doc.getElementById(id);
    if (!el) continue;
    if (el.classList.contains('hidden') || el.hidden) continue;
    if (id === 'casino-ui' && !el.classList.contains('on')) continue;
    return true;
  }
  return false;
}

export const AFK_NOTE = "You were away for a bit, so your spot was freed for another pirate. Press ENTER GAME when you're ready.";

export function showWorldAfkNote(msg, doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return;
  const el = doc.getElementById('title-afk');
  if (!el) return;
  const text = String(msg || '');
  el.textContent = text;
  el.hidden = !text;
}

export function clearWorldAfkNote(doc = typeof document !== 'undefined' ? document : null) {
  showWorldAfkNote('', doc);
}

export function createWorldAfk({
  clock = () => performance.now(),
  idleS = WORLD_AFK_S,
  isOwner = () => false,
  inUi = () => false,
  onKick = () => {},
  hidden = () => typeof document !== 'undefined' && document.hidden,
} = {}) {
  let last = clock(), pauseAt = 0, kicked = false, started = false;
  function touch() { last = clock(); pauseAt = 0; kicked = false; }
  function tick() {
    if (!started || kicked) return false;
    if (isOwner()) { last = clock(); pauseAt = 0; return false; }
    const now = clock();
    if (inUi()) { if (!pauseAt) pauseAt = now; return false; }
    if (pauseAt) { last += now - pauseAt; pauseAt = 0; }
    if (now - last >= idleS * 1000) { kicked = true; last = now; onKick(); return true; }
    return false;
  }
  function start() { started = true; touch(); }
  function stop() { started = false; kicked = false; pauseAt = 0; }
  return { touch, tick, start, stop, last: () => last, get kicked() { return kicked; }, hidden };
}
