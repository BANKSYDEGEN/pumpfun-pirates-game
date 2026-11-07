// [pets R1] BANKSY: name your pets, level them up (walk XP while they follow you + gold treats), and trade them to another pirate.
// Server = migration 058 / supabase/functions/pvp/pets.ts: the client only says which pet; ownership, gold + swaps are checked there.
const PET_LABEL = { pet_cat: 'Cat', pet_cat_black: 'Black Cat', pet_monkey: 'Monkey', pet_chimp: 'Chimp', pet_gorilla: 'Gorilla', pet_gorilla_white: 'White Gorilla', pet_tiger: 'Tiger' };
const PET_ICON = { pet_cat: '🐈', pet_cat_black: '🐈‍⬛', pet_monkey: '🐒', pet_chimp: '🐵', pet_gorilla: '🦍', pet_gorilla_white: '🦍', pet_tiger: '🐅' };
const esc = (s) => String(s ?? '').replace(/[&<>"'`]/g, (c) => `&#${c.charCodeAt(0)};`);
export const petLv = (xp) => Math.min(10, Math.floor(Math.sqrt(Math.max(0, +xp || 0) / 100)));
export const treatCost = (lv) => 250 * (lv + 1) * (lv + 1);
const lvXp = (lv) => lv * lv * 100;
const CSS = `
#pet-panel{position:fixed;inset:0;z-index:75;display:flex;align-items:center;justify-content:center;background:#0008}
#pet-panel[hidden]{display:none}
#pet-panel .pp-box{width:min(460px,94vw);max-height:86vh;display:flex;flex-direction:column;background:rgba(12,20,28,.97);border:2px solid #c9a24a;border-radius:12px;color:#fff;font:600 13px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px #000a}
#pet-panel .pp-h{display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid #c9a24a66;color:#ffcd77;font-size:15px;letter-spacing:.05em}
#pet-panel .pp-h b{flex:1}#pet-panel .pp-x{background:none;border:0;color:#fff;font-size:18px;cursor:pointer}
#pet-panel .pp-list{overflow-y:auto;padding:8px 12px}
#pet-panel .pp-sec{color:#ffcd77;font-size:11px;letter-spacing:.08em;margin:10px 0 4px}
#pet-panel .pp-card{border:1px solid #ffffff22;border-radius:9px;padding:9px 10px;margin-bottom:8px;background:#ffffff08}
#pet-panel .pp-card.on{border-color:#2fd866}
#pet-panel .pp-top{display:flex;align-items:center;gap:8px}#pet-panel .pp-ic{font-size:26px}
#pet-panel .pp-nm{flex:1;min-width:0}#pet-panel .pp-nm b{font-size:15px}#pet-panel .pp-nm small{display:block;opacity:.7;font-size:11px}
#pet-panel .pp-lv{font:800 13px system-ui;color:#ffd76a;white-space:nowrap}
#pet-panel .pp-bar{height:6px;border-radius:3px;background:#ffffff1a;margin:7px 0;overflow:hidden}#pet-panel .pp-bar i{display:block;height:100%;background:linear-gradient(90deg,#c9a24a,#ffd76a)}
#pet-panel .pp-row{display:flex;gap:6px;margin-top:6px}
#pet-panel input{flex:1;min-width:0;background:#0b141c;border:1px solid #c9a24a88;border-radius:6px;color:#fff;padding:6px 8px;font:600 13px system-ui}
#pet-panel button.b{min-height:32px;border-radius:7px;border:1px solid #c9a24a99;background:#1d2b38;color:#fff;font:700 12px system-ui;cursor:pointer;padding:4px 10px;white-space:nowrap}
#pet-panel button.b.go{background:#1f6b3a;border-color:#2fd866}#pet-panel button.b.no{background:#5a1d1d;border-color:#e05555}
#pet-panel button.b:disabled{opacity:.45;cursor:default}
#pet-panel .pp-empty{opacity:.7;text-align:center;padding:18px 6px}
#pet-panel .pp-foot{padding:8px 14px;border-top:1px solid #c9a24a66;font-size:11px;opacity:.8}
`;
export function createPetsPanel(ctx) {
  // ctx: { call(action, body) -> Promise<json>, equipped() -> pet id, out() -> bool (pet following you), toast(html, ms), gold(json) }
  let el = null, data = { pets: [], incoming: [], outgoing: [], owner: false }, busy = false, trade = '', walkT = 0;
  const toast = (m, ms = 2000) => { try { ctx.toast?.(m, ms); } catch {} };
  const call = async (a, b = {}) => { try { return (await ctx.call(a, b)) || { ok: false }; } catch { return { ok: false, why: 'offline' }; } };
  function ensure() {
    if (el || typeof document === 'undefined') return;
    if (!document.getElementById('pet-css')) { const s = document.createElement('style'); s.id = 'pet-css'; s.textContent = CSS; document.head.appendChild(s); }
    el = document.createElement('div'); el.id = 'pet-panel'; el.hidden = true;
    el.innerHTML = `<div class="pp-box" role="dialog" aria-label="Pets"><div class="pp-h"><b>🐾 MY PETS</b><button type="button" class="pp-x" aria-label="Close pets">✕</button></div><div class="pp-list"></div><div class="pp-foot">Pets earn XP while they follow you on the island. Treats level them faster. Every level adds +1% to your pet's sell bonus.</div></div>`;
    document.body.appendChild(el);
    for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'wheel', 'keydown', 'keyup']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
    el.querySelector('.pp-x').onclick = (e) => { e.stopPropagation(); close(); };
    el.querySelector('.pp-list').addEventListener('click', onClick);
  }
  async function load() { const r = await call('pet_list'); if (r?.ok) { data = { pets: r.pets || [], incoming: r.incoming || [], outgoing: r.outgoing || [], owner: !!r.owner }; } draw(); return r; }
  function draw() {
    if (!el || el.hidden) return;
    const L = el.querySelector('.pp-list'), eq = ctx.equipped?.() || '';
    let h = '';
    if (data.incoming.length) h += `<div class="pp-sec">PET OFFERS FOR YOU</div>` + data.incoming.map((o) => `<div class="pp-card"><div class="pp-top"><span class="pp-ic">${PET_ICON[o.pet] || '🐾'}</span><div class="pp-nm"><b>${esc(PET_LABEL[o.pet] || o.pet)}</b><small>from ${esc(o.from)} for ${(o.price | 0).toLocaleString()} gold</small></div></div><div class="pp-row"><button class="b go" data-a="acc" data-id="${o.id | 0}">ACCEPT</button><button class="b no" data-a="dec" data-id="${o.id | 0}">DECLINE</button></div></div>`).join('');
    const pets = [...data.pets]; if (eq && PET_LABEL[eq] && !pets.some((p) => p.pet === eq)) pets.unshift({ pet: eq, name: null, xp: 0, lv: 0 });
    h += `<div class="pp-sec">YOUR PETS</div>`;
    if (!pets.length) h += `<div class="pp-empty">No pets yet. Buy one at the pet shop and it will show up here.</div>`;
    for (const p of pets) {
      if (!PET_LABEL[p.pet]) continue;
      const lv = petLv(p.xp), max = lv >= 10, a = lvXp(lv), z = lvXp(lv + 1), pc = max ? 100 : Math.round(((p.xp - a) / (z - a)) * 100), off = data.outgoing.find((o) => o.pet === p.pet);
      h += `<div class="pp-card${p.pet === eq ? ' on' : ''}"><div class="pp-top"><span class="pp-ic">${PET_ICON[p.pet]}</span><div class="pp-nm"><b>${esc(p.name || PET_LABEL[p.pet])}</b><small>${esc(PET_LABEL[p.pet])}${p.pet === eq ? ' · out with you' : ''}</small></div><span class="pp-lv">LV ${lv}${max ? ' MAX' : ''}</span></div>` +
        `<div class="pp-bar"><i style="width:${Math.max(0, Math.min(100, pc))}%"></i></div>` +
        `<div class="pp-row"><small>Parrot names & upgrades have moved to your ship hull cage.</small>` +
        (data.owner ? '' : off ? `<button class="b no" data-a="cancel" data-id="${off.id | 0}">CANCEL OFFER TO ${esc(off.to)}</button>` : `<button class="b" data-a="trade" data-pet="${p.pet}">🤝 TRADE</button>`) + `</div>` +
        (trade === p.pet && !off ? `<div class="pp-row"><input data-to="${p.pet}" maxlength="20" placeholder="Pirate name"><input data-price="${p.pet}" type="number" min="0" step="1" placeholder="Gold" style="max-width:90px"><button class="b go" data-a="offer" data-pet="${p.pet}">OFFER</button></div>` : '') + `</div>`;
    }
    L.innerHTML = h;
  }
  async function onClick(e) {
    const b = e.target.closest('button[data-a]'); if (!b || b.disabled || busy) return; e.stopPropagation();
    const a = b.dataset.a, pet = b.dataset.pet, id = +b.dataset.id || 0, q = (s) => el.querySelector(s);
    if (a === 'trade') { trade = trade === pet ? '' : pet; draw(); return; }
    busy = true; b.disabled = true; let r = null;
    if (a === 'offer') { const to = q(`input[data-to="${pet}"]`)?.value || '', price = Math.max(0, Math.floor(+q(`input[data-price="${pet}"]`)?.value || 0)); r = await call('pet_offer', { pet, to, price }); if (r.ok) { trade = ''; toast(`🤝 Offer sent to <b>${esc(to)}</b>`, 1800); } }
    else if (a === 'cancel') { r = await call('pet_cancel', { offer: id }); }
    else if (a === 'acc' || a === 'dec') { r = await call('pet_respond', { offer: id, accept: a === 'acc' }); if (r.ok && r.state === 'done') { ctx.gold?.(r); toast('🐾 The pet is yours! Equip it from your inventory.', 2600); } }
    if (r && !r.ok) toast(esc(r.why || r.error || 'try again'), 2000);
    busy = false; await load();
  }
  function open() { ensure(); if (!el) return; el.hidden = false; draw(); load(); }
  function close() { if (el) el.hidden = true; trade = ''; }
  async function tick(dt) { // walk XP: one server call a minute while your pet follows you (the server rate-limits it too)
    walkT += dt; if (walkT < 60) return; walkT = 0;
    const pet = ctx.equipped?.(); if (!PET_LABEL[pet] || !ctx.out?.() || (typeof document !== 'undefined' && document.hidden)) return;
    const r = await call('pet_walk', { pet }); if (r?.ok && r.lv > (data.pets.find((p) => p.pet === pet)?.lv ?? r.lv)) toast(`🐾 Your pet reached <b>LV ${r.lv | 0}</b>!`, 2400);
    if (r?.ok) { const p = data.pets.find((x) => x.pet === pet); if (p) { p.xp = r.xp; p.lv = r.lv; } else data.pets.push({ pet, name: null, xp: r.xp, lv: r.lv }); }
  }
  return { open, close, tick, load, get isOpen() { return !!el && !el.hidden; } };
}
