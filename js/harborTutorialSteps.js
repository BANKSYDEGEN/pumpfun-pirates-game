// Caption copy + card CSS for the first-run harbor cutscene. No 3D imports (preview page can load this alone).
import { binds, keyName } from './keybinds.js';
import { SHOP_NAMES } from './inventory/shopSpots.js';
import { padGlyph, padActive, CONSOLE } from './gamepad.js';

export const HARBOR_TUT_KEY = 'pfp_harbor_tut_off';

const k = (id) => {
  const code = (binds(id) || []).filter(Boolean)[0];
  if (!code) return '—';
  const n = keyName(code);
  if (/^(LSHIFT|RSHIFT|SHIFTLEFT|SHIFTRIGHT)$/i.test(n) || /^Shift/.test(code)) return 'SHIFT';
  return n;
};
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const chip = (code) => `<kbd>${esc(code)}</kbd>`;

export const HARBOR_TUT_CSS = `
#harbor-tut{position:fixed;inset:0;z-index:80;pointer-events:none;font-family:'Just Another Hand',cursive;color:#fff}
#harbor-tut.on{display:block}
#harbor-tut:not(.on){display:none}
#harbor-tut .ht-card{pointer-events:auto;position:absolute;left:50%;bottom:max(18px,env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:min(560px,94vw);background:rgba(22,22,22,.94);border:3px solid var(--gold,#ffcd77);border-radius:16px;padding:10px 16px 12px;box-shadow:0 10px 40px #000}
#harbor-tut h2{margin:0 0 2px;font-size:34px;letter-spacing:.06em;color:var(--gold,#ffcd77);line-height:1}
#harbor-tut .ht-kicker{font-size:16px;color:rgba(255,205,119,.8);letter-spacing:.08em;margin:0 0 4px}
#harbor-tut .ht-body{margin:0 0 8px;font-size:24px;line-height:1.15;color:#fff}
#harbor-tut .ht-body b{color:var(--gold,#ffcd77);font-weight:normal}
#harbor-tut .ht-body kbd,#harbor-tut .ht-ctl kbd{display:inline-block;min-width:1.3em;padding:1px 7px 0;margin:0 1px;border-radius:8px;border:2px solid var(--gold,#ffcd77);background:#1a0f07;color:var(--gold,#ffcd77);font:20px 'Just Another Hand',cursive;line-height:1.15;text-align:center}
#harbor-tut .ht-controls{display:flex;flex-wrap:wrap;gap:7px 14px;justify-content:center;margin:2px 0 8px}
#harbor-tut .ht-ctl{display:flex;align-items:center;gap:6px;font-size:22px;line-height:1.1;color:#fff}
#harbor-tut .ht-ctl kbd.ht-wide{min-width:0;padding:1px 8px 0}
#harbor-tut .ht-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#harbor-tut .ht-bar{flex:1;height:6px;border-radius:99px;background:rgba(255,205,119,.18);overflow:hidden;min-width:80px}
#harbor-tut .ht-bar i{display:block;height:100%;width:0;background:var(--gold,#ffcd77);border-radius:99px}
#harbor-tut button{font:22px 'Just Another Hand',cursive;letter-spacing:.05em;padding:4px 16px 2px;min-height:40px;border-radius:12px;border:2px solid var(--gold,#ffcd77);background:#3a240f;color:var(--gold,#ffcd77);cursor:pointer}
#harbor-tut button.ht-next{background:#7a4a10;color:#fff}
#harbor-tut button:focus-visible{outline:3px solid #ffcd77;outline-offset:2px}
html.pfp-harbor-tut #dk-acts,html.pfp-harbor-tut #joy,html.pfp-harbor-tut #hint,html.pfp-harbor-tut #btn-emote{visibility:hidden!important}
@media (max-height:520px) and (orientation:landscape){
  #harbor-tut .ht-card{width:min(720px,94vw);padding:8px 14px}
  #harbor-tut h2{font-size:28px}#harbor-tut .ht-body{font-size:20px;margin-bottom:6px}
  #harbor-tut .ht-ctl{font-size:18px}
}
@media (max-width:640px){
  #harbor-tut h2{font-size:28px}#harbor-tut .ht-body{font-size:20px}
  #harbor-tut .ht-ctl{font-size:19px;gap:5px}
}
`;

function ctl(keys, label) {
  const ks = Array.isArray(keys) ? keys : [keys];
  return `<span class="ht-ctl">${ks.map((c) => `<kbd${String(c).length > 3 ? ' class="ht-wide"' : ''}>${esc(c)}</kbd>`).join('')}<span class="ht-lab">${esc(label)}</span></span>`;
}

/** Active tutorial input: 'pad' | 'touch' | 'pc'. `force` overrides for previews / shots. */
export function harborTutDevice(force, touch = false) {
  if (force === 'pad' || force === 'touch' || force === 'pc') return force;
  try { if (CONSOLE || padActive()) return 'pad'; } catch {}
  if (touch) return 'touch';
  try { if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return 'touch'; } catch {}
  return 'pc';
}

function controlsBody(input) {
  if (input === 'touch') {
    return `<div class="ht-controls">${[
      ctl('JOYSTICK', 'Walk'),
      ctl('JOYSTICK', 'Sprint'),
      ctl('JUMP', 'Jump'),
      ctl('ACTION', 'Interact'),
      ctl('INVENTORY', 'Bag'),
      ctl('RADAR', 'Map'),
      ctl('HULL', 'Hull'),
      ctl('DRAG', 'Look'),
    ].join('')}</div>`;
  }
  if (input === 'pad') {
    const g = (b) => { try { return padGlyph(b); } catch { return b; } };
    return `<div class="ht-controls">${[
      ctl('L-STICK', 'Walk'),
      ctl('R-STICK', 'Look'),
      ctl(g('A'), 'Hull'),
      ctl(g('Y'), 'Ashore'),
      ctl(g('X'), 'Sail'),
      ctl(g('B'), 'Bag'),
      ctl(g('TOUCHPAD') === 'TOUCHPAD' ? g('START') : g('TOUCHPAD'), 'Map'),
      ctl('L3', 'Sprint'),
    ].join('')}</div>`;
  }
  const sprint = k('sprint'), jump = k('jump'), inv = k('inventory'), map = k('map');
  return `<div class="ht-controls">${[
    ctl(['W', 'A', 'S', 'D'], 'Walk'),
    ctl(sprint, 'Sprint'),
    ctl(jump, 'Jump'),
    ctl('E', 'Interact'),
    ctl(inv, 'Bag'),
    ctl(map, 'Map'),
    ctl('H', 'Hull'),
    ctl('MOUSE', 'Look'),
  ].join('')}</div>`;
}

/** Short title + one tiny line (or a row of control icons). `input` is 'pc' | 'touch' | 'pad'. */
export function harborTutSteps(input = 'pc') {
  const mode = input === true ? 'touch' : input === false ? 'pc' : (input || 'pc');
  return [
    { id: 'controls', title: 'CONTROLS', body: controlsBody(mode) },
    { id: 'hull_clothes', title: 'YOUR CLOTHES', body: 'Change clothes at the chest.' },
    { id: 'hull_crew', title: "YOUR CREW'S CLOTHES", body: 'Dress your crew here.' },
    { id: 'inventory', title: 'INVENTORY', body: 'Open your bag to equip.' },
    { id: 'fish', title: SHOP_NAMES.fish, body: 'Sell fish here.' },
    { id: 'market', title: SHOP_NAMES.market, body: 'Trade with other pirates.' },
    { id: 'pumpfun', title: 'PUMP.FUN HQ', body: 'Live token and squad boards.' },
    { id: 'antiques', title: SHOP_NAMES.antiques, body: 'Sell treasure and maps.' },
    { id: 'squads', title: 'SQUADS & FRIENDS', body: 'Join a squad, add friends.' },
    { id: 'coliseum', title: 'BLOODSTONE COLOSSEUM', body: 'PvP on the dirt floor.' },
    { id: 'cabins', title: 'CABINS', body: 'Walk in and make it yours.' },
    { id: 'fishing', title: "GRANDPA GILL'S DOCK", body: 'Cast here to fish.' },
    { id: 'treasure', title: 'TREASURE MAPS', body: 'Follow the X and dig.' },
    { id: 'canoe', title: 'CANOES', body: 'Anchor offshore, then canoe.' },
  ];
}

export const HARBOR_TUT_IDS = () => harborTutSteps('pc').map((s) => s.id);

/** Headless / preview: mount one caption card without running the game. */
export function mountHarborTutPreview(root, { step: n = 0, touch = false, input } = {}) {
  if (typeof document !== 'undefined' && !document.getElementById('harbor-tut-css')) {
    const st = document.createElement('style'); st.id = 'harbor-tut-css'; st.textContent = HARBOR_TUT_CSS; document.head.appendChild(st);
  }
  const mode = harborTutDevice(input, touch);
  const list = harborTutSteps(mode); const s = list[Math.max(0, Math.min(list.length - 1, n | 0))];
  root.innerHTML = `<div id="harbor-tut" class="on"><div class="ht-card">
    <div class="ht-kicker">HARBOR TUTORIAL · ${(n | 0) + 1} / ${list.length}</div>
    <h2>${esc(s.title)}</h2>
    <div class="ht-body">${s.body}</div>
    <div class="ht-row">
      <div class="ht-bar"><i style="width:${((n + 1) / list.length) * 100}%"></i></div>
      <button type="button" tabindex="-1">SKIP</button>
      <button type="button" class="ht-next" tabindex="-1">${(n | 0) === list.length - 1 ? 'DONE' : 'NEXT'}</button>
    </div></div></div>`;
  return s;
}
