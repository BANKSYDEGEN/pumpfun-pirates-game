// PUMPFUN PIRATES · how-to-play card
// Shown after SET SAIL, before wave 1 (game paused). Skippable, "Don't show again" is kept in localStorage.
// Reopen any time with the "?" in the shop header or HOW TO PLAY in the pause menu.
const KEY = 'pfp_tutorial_off';
const $ = (id) => document.getElementById(id);
let ctx = null, prev = null;

const STEPS = [
  ['💣', 'Sink <b>rug ships</b> to loot <b class="gold">gold</b>.'],
  ['🧰', 'Tap the <b class="gold">SHOP</b> chest to pause and buy upgrades. Your ship grows with every tier.'],
  ['🔧', 'Low on hull? Hit <b class="gold">REPAIR HULL</b> in the shop to buy health with gold. Stay out of fire for 20 s and your hull slowly repairs.'],
  ['<span class="tut-crate">✚</span>', 'About <b>1 in 3 sinks</b> drops a <b class="green">health crate</b>, and every <b class="red">boss</b> always does. Sail over it to heal. Your hull also refills at the start of each wave.'],
];

const CSS = `
#tutorial { z-index: 30; align-items: center; }
#tutorial .panel { width: min(440px, 94vw); padding: 14px 18px 12px; }
#tutorial h1 { font-size: 46px; margin: 0 0 6px; }
.tut-steps { list-style: none; margin: 0; padding: 0; text-align: left; display: grid; gap: 8px; }
.tut-steps li { display: grid; grid-template-columns: 42px 1fr; align-items: center; gap: 10px; font-size: 23px; line-height: 1.02; color: #fff;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,205,119,0.18); border-radius: 14px; padding: 7px 10px; }
.tut-steps .ic { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; font-size: 22px; font-family: system-ui, sans-serif;
  background: rgba(22,22,22,0.9); border: 2px solid var(--gold); }
.tut-steps .n { color: var(--gold); margin-right: 4px; }
.tut-steps b { font-weight: normal; }
.tut-steps .green, .tut-crate { color: #4ee37a; }
.tut-crate { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 6px; background: #f4efe4; color: #fa0d0d; font-weight: 900; font-size: 20px; line-height: 1; border: 2px solid #6a4024; }
#tutorial .tut-actions { display: flex; flex-direction: column; align-items: center; gap: 2px; margin-top: 8px; }
#tutorial button.big { font-size: 34px; padding: 4px 30px; margin: 6px 0 6px; }
.tut-check { display: inline-flex; align-items: center; gap: 8px; font-size: 21px; color: rgba(255,255,255,0.75); cursor: pointer; }
.tut-check input { width: 20px; height: 20px; accent-color: #fa0d0d; }
#tut-arrow { position: fixed; z-index: 31; pointer-events: none; display: none; flex-direction: column; align-items: center; color: var(--gold); font-size: 22px; transform: translateX(-50%); }
#tut-arrow svg { filter: drop-shadow(0 2px 0 #161616) drop-shadow(0 0 8px rgba(255,205,119,0.7)); animation: tut-bob 0.9s ease-in-out infinite alternate; }
#tut-arrow span { text-shadow: 0 2px 0 #161616; margin-top: -2px; }
#tut-ring { position: fixed; z-index: 31; pointer-events: none; display: none; border-radius: 50%; border: 3px solid var(--gold); box-shadow: 0 0 0 4px rgba(22,22,22,0.6), 0 0 18px rgba(255,205,119,0.9); animation: tut-pulse 1s ease-in-out infinite; }
@keyframes tut-bob { from { transform: translateY(0); } to { transform: translateY(-7px); } }
@keyframes tut-pulse { 50% { transform: scale(1.12); } }
button.icon.tut-help { width: 38px; height: 38px; font-size: 20px; color: var(--gold); flex: none; }
@media (max-height: 700px) { .tut-steps li { font-size: 20px; padding: 5px 8px; } #tutorial h1 { font-size: 38px; } #tutorial button.big { font-size: 30px; } }
/* landscape phones: the 4 steps in two columns so the card + checkbox fit without scrolling */
@media (max-height: 520px) and (orientation: landscape) { #tutorial .panel { width: min(760px, 94vw); padding: 8px 14px 8px; } #tutorial h1 { font-size: 32px; margin: 0 0 4px; } .tut-steps { grid-template-columns: 1fr 1fr; gap: 6px; } .tut-steps li { font-size: 18px; padding: 4px 8px; } #tutorial button.big { font-size: 26px; padding: 2px 26px; margin: 6px 4px 2px; } }
@media (max-height: 360px) and (orientation: landscape) { .tut-steps li { font-size: 16px; grid-template-columns: 34px 1fr; } .tut-steps .ic { width: 34px; height: 34px; font-size: 18px; } }
`;

function build() {
  const st = document.createElement('style'); st.id = 'tutorial-css'; st.textContent = CSS; document.head.appendChild(st);
  const ov = document.createElement('div'); ov.id = 'tutorial'; ov.className = 'overlay hidden';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'How to play');
  ov.innerHTML = `<div class="panel">
    <h1>HOW TO PLAY</h1>
    <ol class="tut-steps">${STEPS.map(([ic, txt], i) => `<li><span class="ic">${ic}</span><span><span class="n">${i + 1}.</span>${txt}</span></li>`).join('')}</ol>
    <div class="tut-actions">
      <button id="tut-go" class="big">GOT IT, SET SAIL</button>
      <label class="tut-check"><input type="checkbox" id="tut-off"> Don't show again</label>
    </div></div>`;
  document.body.appendChild(ov);
  const arrow = document.createElement('div'); arrow.id = 'tut-arrow';
  arrow.innerHTML = `<svg width="34" height="40" viewBox="0 0 34 40" aria-hidden="true"><path d="M17 2 L32 20 H22 V38 H12 V20 H2 Z" fill="#ffcd77" stroke="#161616" stroke-width="2.5" stroke-linejoin="round"/></svg><span>SHOP</span>`;
  const ring = document.createElement('div'); ring.id = 'tut-ring';
  document.body.append(arrow, ring);
  $('tut-go').onclick = close;
  $('tut-off').checked = isOff();
  $('tut-off').onchange = (e) => { try { e.target.checked ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch {} };
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  addEventListener('keydown', (e) => {
    if (ov.classList.contains('hidden')) return;
    if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  }, true);
  addEventListener('resize', place);
  // reopen: "?" in the shop header, HOW TO PLAY in the pause menu
  const head = document.querySelector('#shop .shop-head');
  if (head) { const b = document.createElement('button'); b.className = 'icon tut-help'; b.id = 'btn-tut-shop'; b.title = 'How to play'; b.setAttribute('aria-label', 'How to play'); b.textContent = '?'; b.onclick = () => show(); head.appendChild(b); }
  const quit = $('btn-quit');
  if (quit) { const b = document.createElement('button'); b.className = 'ghost'; b.id = 'btn-tut-pause'; b.textContent = 'HOW TO PLAY'; b.onclick = () => show(); quit.before(b); }
}

function place() {
  const arrow = $('tut-arrow'), ring = $('tut-ring'), btn = $('btn-shop');
  const on = !$('tutorial').classList.contains('hidden') && btn && btn.offsetParent !== null && $('shop').classList.contains('hidden');
  arrow.style.display = ring.style.display = on ? 'flex' : 'none';
  if (!on) return;
  const r = btn.getBoundingClientRect(), pad = 5;
  Object.assign(ring.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
  arrow.style.left = `${r.left + r.width / 2}px`; arrow.style.top = `${r.bottom + 8}px`;
}

export function isOff() { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } }
export function isOpen() { return !!$('tutorial') && !$('tutorial').classList.contains('hidden'); }
// open the card on top of play / shop / pause; the game stays frozen (state 'tutorial') until it is closed
export function show() {
  if (!ctx || isOpen()) return;
  prev = ctx.game.state;
  if (['playing', 'shop', 'paused'].includes(prev)) ctx.game.state = 'tutorial'; // freezes the game + shop/pause keys
  $('tut-off').checked = isOff();
  $('tutorial').classList.remove('hidden');
  place(); requestAnimationFrame(place);
}
export function close() {
  if (!isOpen()) return;
  $('tutorial').classList.add('hidden'); place();
  if (ctx.game.state === 'tutorial') ctx.game.state = prev || 'playing';
  prev = null;
}
// call right after a new run starts
export function maybeShowTutorial() { if (!isOff()) show(); }
export function initTutorial(c) { ctx = c; build(); window.PFP_TUT = { show, close, isOpen, isOff, KEY }; }
