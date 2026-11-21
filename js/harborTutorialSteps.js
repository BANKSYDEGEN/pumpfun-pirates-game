// Caption copy + card CSS for the first-run harbor cutscene. No 3D imports (preview page can load this alone).
import { binds, keyName } from './keybinds.js';
import { SHOP_NAMES, SHOP_PROMPTS } from './inventory/shopSpots.js';
import { BACKPACK_CAP } from './inventory/backpackCap.js';

export const HARBOR_TUT_KEY = 'pfp_harbor_tut_off';

const k = (id) => (binds(id) || []).filter(Boolean).map(keyName).join(' / ') || '—';
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const chip = (code) => `<kbd>${esc(code)}</kbd>`;

export const HARBOR_TUT_CSS = `
#harbor-tut{position:fixed;inset:0;z-index:80;pointer-events:none;font-family:'Just Another Hand',cursive;color:#fff}
#harbor-tut.on{display:block}
#harbor-tut:not(.on){display:none}
#harbor-tut .ht-card{pointer-events:auto;position:absolute;left:50%;bottom:max(18px,env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:min(520px,94vw);background:rgba(22,22,22,.94);border:3px solid var(--gold,#ffcd77);border-radius:16px;padding:12px 16px 12px;box-shadow:0 10px 40px #000}
#harbor-tut h2{margin:0 0 2px;font-size:34px;letter-spacing:.06em;color:var(--gold,#ffcd77);line-height:1}
#harbor-tut .ht-kicker{font-size:16px;color:rgba(255,205,119,.8);letter-spacing:.08em;margin:0 0 6px}
#harbor-tut .ht-body{margin:0 0 8px;font-size:22px;line-height:1.12;color:#fff}
#harbor-tut .ht-body b{color:var(--gold,#ffcd77);font-weight:normal}
#harbor-tut .ht-body kbd{display:inline-block;min-width:1.3em;padding:0 6px;margin:0 1px;border-radius:8px;border:2px solid var(--gold,#ffcd77);background:#1a0f07;color:var(--gold,#ffcd77);font:20px 'Just Another Hand',cursive;line-height:1.15;text-align:center}
#harbor-tut .ht-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#harbor-tut .ht-bar{flex:1;height:6px;border-radius:99px;background:rgba(255,205,119,.18);overflow:hidden;min-width:80px}
#harbor-tut .ht-bar i{display:block;height:100%;width:0;background:var(--gold,#ffcd77);border-radius:99px}
#harbor-tut button{font:22px 'Just Another Hand',cursive;letter-spacing:.05em;padding:4px 16px 2px;min-height:40px;border-radius:12px;border:2px solid var(--gold,#ffcd77);background:#3a240f;color:var(--gold,#ffcd77);cursor:pointer}
#harbor-tut button.ht-next{background:#7a4a10;color:#fff}
#harbor-tut button:focus-visible{outline:3px solid #ffcd77;outline-offset:2px}
html.pfp-harbor-tut #dk-acts,html.pfp-harbor-tut #joy,html.pfp-harbor-tut #hint,html.pfp-harbor-tut #btn-emote{visibility:hidden!important}
@media (max-height:520px) and (orientation:landscape){
  #harbor-tut .ht-card{width:min(680px,94vw);padding:8px 14px}
  #harbor-tut h2{font-size:28px}#harbor-tut .ht-body{font-size:18px;margin-bottom:6px}
}
@media (max-width:640px){
  #harbor-tut h2{font-size:28px}#harbor-tut .ht-body{font-size:19px}
}
`;

/** Caption copy for each shot, already ordered by berth-first story + island camera path. `touch` picks on-screen control wording. */
export function harborTutSteps(touch = false) {
  const inv = k('inventory'), map = k('map'), sprint = k('sprint'), jump = k('jump');
  const walk = touch
    ? `Left <b>joystick</b> to walk (push it to the edge to sprint). <b>JUMP</b> to jump. Drag to look, pinch to zoom.`
    : `Walk with ${chip('W')}${chip('A')}${chip('S')}${chip('D')} or the arrows. Hold ${chip(sprint)} to sprint, ${chip(jump)} to jump. Drag the mouse to look, wheel to zoom.`;
  const keys = touch
    ? `The <b>action</b> button interacts. <b>INVENTORY</b> is your bag, tap the radar (or ${chip(map)}) for the map, and <b>💬</b> is quick chat.`
    : `${chip('E')} interacts. ${chip(inv)} opens inventory, ${chip(map)} the island map, ${chip('T')} quick chat.`;
  const berth = touch
    ? `At your berth: <b>GO ASHORE</b>, <b>SET SAIL</b>, and <b>ENTER HULL</b>.`
    : `At your berth: ${chip('E')} go ashore, ${chip('W')} set sail, ${chip('H')} enter the hull.`;
  const bag = touch
    ? `Tap <b>INVENTORY</b> for your bag. Equip from the grid. Your backpack holds <b>${BACKPACK_CAP} slots</b>.`
    : `Press ${chip(inv)} (or the bag button) for your inventory grid. Equip from here. Your backpack holds <b>${BACKPACK_CAP} slots</b>.`;
  const canoe = touch
    ? `Sail out, drop <b>anchor</b> away from the dock, then <b>GO TO ISLAND · CANOE</b>. Use the joystick to paddle, <b>action</b> to land, and <b>BOARD SHIP</b> to return.`
    : `Sail out, drop anchor away from the dock, then ${chip('E')} <b>GO TO ISLAND · CANOE</b>. ${chip('W')}${chip('A')}${chip('S')}${chip('D')} paddle, ${chip('E')} to land, ${chip('E')} or ${chip('Q')} to <b>BOARD SHIP</b>.`;
  return [
    { id: 'controls', title: 'CONTROLS', body: `${walk} ${keys} ${berth}` },
    { id: 'hull_clothes', title: 'YOUR CLOTHES', body: `Press ${chip('H')} at the berth, then ${chip('E')} <b>CHANGE CLOTHES</b> at the aft sea chest. That's your Changing Room — body, skin, hair, eyes and owned outfits, all free.` },
    { id: 'hull_crew', title: "YOUR CREW'S CLOTHES", body: `In the same quarters, ${chip('E')} <b>DRESS CREW</b> at the mannequin opens the Crew Room. Outfit your crew in clothes you already own — yours stay put.` },
    { id: 'inventory', title: 'INVENTORY', body: bag },
    { id: 'fish', title: SHOP_NAMES.fish, body: `Sell fish here. Walk in and press ${chip('E')} <b>${SHOP_PROMPTS.fish}</b>, or sell from inventory while you are in the shop. Fish badge on the map (${chip(map)}).` },
    { id: 'market', title: SHOP_NAMES.market, body: `Trade with other pirates here. ${chip('E')} <b>${SHOP_PROMPTS.market}</b>, or <b>LIST</b> an item from inventory in the hall. Scales badge on the map (${chip(map)}).` },
    { id: 'pumpfun', title: 'PUMP.FUN HQ', body: `Walk in from the plaza. Inside are the live token boards and squad boards.` },
    { id: 'antiques', title: SHOP_NAMES.antiques, body: `Sell treasure, maps and valuables here. ${chip('E')} <b>${SHOP_PROMPTS.antiques}</b>, or sell from inventory at this shop. Chest badge on the map (${chip(map)}).` },
    { id: 'squads', title: 'SQUADS & FRIENDS', body: `This is the <b>Squad Hall</b> — walk in to join a squad. Add friends from <b>Friends</b> in Settings, or use <b>Join a friend</b> on the server picker.` },
    { id: 'coliseum', title: 'BLOODSTONE COLOSSEUM', body: `The dirt floor is PvP. The skirt and track around it are a safe zone.` },
    { id: 'cabins', title: 'CABINS', body: `These cottages can be yours. Press ${chip('E')} at the door to go inside — there's a wardrobe here too.` },
    { id: 'fishing', title: "GRANDPA GILL'S DOCK", body: `Press ${chip('E')} <b>CAST</b> at the lagoon dock to fish, or ${chip('E')} <b>GRANDPA GILL</b> to talk to him.` },
    { id: 'treasure', title: 'TREASURE MAPS', body: `Maps drop when you sink the Commodore or score a Battle Royale kill. Follow the X and press ${chip('E')} <b>DIG</b>.` },
    { id: 'canoe', title: 'CANOES', body: canoe },
  ];
}

export const HARBOR_TUT_IDS = () => harborTutSteps(false).map((s) => s.id);

/** Headless / preview: mount one caption card without running the game. */
export function mountHarborTutPreview(root, { step: n = 0, touch = false } = {}) {
  if (typeof document !== 'undefined' && !document.getElementById('harbor-tut-css')) {
    const st = document.createElement('style'); st.id = 'harbor-tut-css'; st.textContent = HARBOR_TUT_CSS; document.head.appendChild(st);
  }
  const list = harborTutSteps(!!touch); const s = list[Math.max(0, Math.min(list.length - 1, n | 0))];
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
