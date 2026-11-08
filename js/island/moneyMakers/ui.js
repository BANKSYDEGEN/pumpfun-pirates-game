import { formatGoldAmount } from '../../goldFormat.js';
// [v349 money-makers] the pirate-styled panels (parchment modal, tabs, rows) + the HUD bits (crate banner, O2 bar, horde wave pill).
// One modal (#mm-modal) reused by every money-maker; phone-friendly (full-width under 600 px, 44 px tap targets, safe areas).
const CSS = `
#mm-modal{position:fixed;inset:0;z-index:64;display:none;align-items:center;justify-content:center;background:rgba(10,8,4,.55);font-family:'Just Another Hand',cursive}
#mm-modal.on{display:flex}
#mm-card{position:relative;width:min(560px,94vw);max-height:min(86vh,760px);overflow:auto;background:#f1e2bd;background-image:radial-gradient(ellipse at 50% 0%,rgba(255,255,255,.35),transparent 60%),radial-gradient(ellipse at 50% 120%,rgba(90,50,25,.28),transparent 60%);
  border:4px solid #5a3219;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.6),inset 0 0 0 3px #c9a66b;color:#3a1c08;padding:14px 16px 16px;-webkit-overflow-scrolling:touch}
#mm-card h2{margin:0 36px 2px 0;font:400 40px/1 'Just Another Hand',cursive;color:#7b1515;letter-spacing:.5px;text-shadow:0 1px 0 #fff6}
#mm-card .mm-sub{font-size:21px;color:#6b4a24;margin-bottom:8px}
#mm-x{position:absolute;right:10px;top:8px;width:44px;height:44px;border-radius:50%;border:3px solid #5a3219;background:#ffcd77;color:#3a1c08;font:26px/1 'Just Another Hand',cursive;cursor:pointer}
.mm-tabs{display:flex;gap:6px;margin:4px 0 10px;flex-wrap:wrap}
.mm-tabs button{flex:1 1 auto;min-height:44px;font:23px 'Just Another Hand',cursive;border:3px solid #5a3219;border-radius:10px;background:#e8d3a3;color:#3a1c08;cursor:pointer;padding:4px 10px 0}
.mm-tabs button.on{background:#7b1515;color:#ffcd77}
.mm-row{display:flex;align-items:center;gap:10px;padding:8px 10px;margin:6px 0;border:2px solid #b8935a;border-radius:10px;background:rgba(255,250,235,.55);font-size:22px}
.mm-row .ic{font-size:30px;width:38px;text-align:center;flex:none}
.mm-row .tx{flex:1 1 auto;min-width:0;line-height:1.05}
.mm-row .tx small{display:block;font-size:18px;color:#6b4a24}
.mm-row .g{color:#8a5a00;font-size:26px;white-space:nowrap}
.mm-bar{height:10px;border-radius:6px;background:#d8c39a;overflow:hidden;margin-top:3px;border:1px solid #9a7a4a}.mm-bar i{display:block;height:100%;background:linear-gradient(90deg,#3f8a2a,#8acb4a)}
.mm-btn{min-height:44px;min-width:92px;font:23px 'Just Another Hand',cursive;border:3px solid #161616;border-radius:10px;background:#ffcd77;color:#161616;cursor:pointer;padding:4px 12px 0;flex:none}
.mm-btn.red{background:#b3121a;color:#ffe9b0;border-color:#3a0808}.mm-btn.grn{background:#3f8a2a;color:#f6ffe8;border-color:#1a3a10}
.mm-btn:disabled{opacity:.45;cursor:default}
.mm-inline{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
.mm-inline input,.mm-inline select{min-height:44px;font:22px 'Just Another Hand',cursive;border:3px solid #5a3219;border-radius:10px;background:#fffaf0;color:#3a1c08;padding:2px 10px;flex:1 1 120px;min-width:0}
.mm-chip{display:inline-block;padding:2px 10px;border-radius:999px;border:2px solid #5a3219;background:#e8d3a3;font-size:19px;margin:2px}
.mm-note{font-size:19px;color:#6b4a24;margin:6px 2px}
.mm-prac{background:#25302a;color:#cdeac0;border-radius:10px;padding:6px 10px;font-size:19px;margin:4px 0 8px}
.mm-vs{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:24px}.mm-vs .r{color:#b3121a}.mm-vs .b{color:#1d4f9a}
#mm-hud{position:fixed;left:50%;top:calc(var(--safe-t,0px) + 64px);transform:translateX(-50%);z-index:9;display:none;max-width:min(92vw,560px);text-align:center;pointer-events:none;
  font:24px/1.05 'Just Another Hand',cursive;color:#ffcd77;background:rgba(22,22,22,.82);border:2px solid #ffcd77;border-radius:12px;padding:6px 14px 3px;text-shadow:0 1px 2px #000}
#mm-hud.on{display:block}
#mm-hud small{display:block;font-size:19px;color:#f1e2bd}
#mm-o2{position:fixed;left:50%;bottom:calc(var(--safe-b,0px) + 150px);transform:translateX(-50%);z-index:12;display:none;width:min(420px,86vw);font:22px 'Just Another Hand',cursive;color:#fff;text-align:center;text-shadow:0 1px 2px #000}
#mm-o2.on{display:block}
#mm-o2 .bar{height:18px;border-radius:9px;border:2px solid #dff7ff;background:rgba(10,30,50,.6);overflow:hidden;margin:3px 0 6px}#mm-o2 .bar i{display:block;height:100%;background:linear-gradient(90deg,#2a8dff,#7fe0ff);transition:width .08s linear}
#mm-o2 .pry i{background:linear-gradient(90deg,#c98a2a,#ffd27a)}
#mm-o2 button{pointer-events:auto;min-height:56px;min-width:180px;font:26px 'Just Another Hand',cursive;border:3px solid #161616;border-radius:14px;background:#ffcd77;color:#161616;touch-action:none}
@media (max-width:600px){#mm-card{width:100vw;max-height:calc(100vh - var(--safe-t,0px) - 10px);border-radius:14px 14px 0 0;align-self:flex-end;padding:12px 12px calc(var(--safe-b,0px) + 14px)}#mm-card h2{font-size:34px}.mm-row{font-size:20px}.mm-row .g{font-size:22px}}
`;
export function createMMUi({ onClose } = {}) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const modal = document.createElement('div'); modal.id = 'mm-modal'; modal.innerHTML = '<div id="mm-card" role="dialog" aria-modal="true"><button id="mm-x" aria-label="close">✕</button><div id="mm-body"></div></div>'; document.body.appendChild(modal);
  const hud = document.createElement('div'); hud.id = 'mm-hud'; document.body.appendChild(hud);
  const o2 = document.createElement('div'); o2.id = 'mm-o2'; o2.innerHTML = '<div class="t">O₂</div><div class="bar"><i></i></div><div class="t2">PRYING</div><div class="bar pry"><i></i></div><button>HOLD · PRY</button>'; document.body.appendChild(o2);
  const body = modal.querySelector('#mm-body');
  let cur = null;
  const close = () => { if (!modal.classList.contains('on')) return; modal.classList.remove('on'); const c = cur; cur = null; try { c?.onClose?.(); onClose?.(); } catch {} };
  modal.querySelector('#mm-x').onclick = (e) => { e.stopPropagation(); close(); };
  modal.addEventListener('pointerdown', (e) => { if (e.target === modal) close(); e.stopPropagation(); });
  modal.addEventListener('keydown', (e) => e.stopPropagation());
  function open(view) { cur = view; modal.classList.add('on'); draw(); }
  function draw() { if (!cur) return; body.innerHTML = cur.html(); body.querySelectorAll('[data-a]').forEach(b => { b.onclick = (e) => { e.stopPropagation(); cur?.act?.(b.dataset.a, b, body); }; }); cur.after?.(body); }
  let hudSig = '';
  function setHud(html) { if (html === hudSig) return; hudSig = html; hud.innerHTML = html || ''; hud.classList.toggle('on', !!html); }
  return {
    open, close, draw, setHud, get isOpen() { return modal.classList.contains('on'); }, get view() { return cur; }, modal, body,
    o2: { el: o2, show(on) { o2.classList.toggle('on', !!on); }, set(o, pry, t2) { o2.querySelector('.bar i').style.width = Math.max(0, Math.min(100, o)) + '%'; o2.querySelector('.pry i').style.width = Math.max(0, Math.min(100, pry * 100)) + '%'; if (t2) o2.querySelector('.t2').textContent = t2; }, btn: o2.querySelector('button') },
  };
}
export const esc = (s) => String(s ?? '').replace(/[<>&"'`\\]/g, '').slice(0, 24);
export const gfmt = (n) => `${formatGoldAmount((n | 0))}g`;
