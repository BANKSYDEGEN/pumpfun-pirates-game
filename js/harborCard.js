// [v339] PLAY & SERVERS hub (BANKSY t1793u/t1795u): one sleek top HUD pill launches the full #pvp-harbor
// card as a popup modal (Battle Royale / Storm Hunt / Spectate / Switch Server). The sprawling multi-row
// card is no longer always on screen. Desktop + mobile share the same hub.
const KEY = 'pfp_hhub';
export function initHarborCard() {
  const card = document.getElementById('pvp-harbor'); if (!card) return;
  card.classList.add('hb-hub');
  // launcher pill
  let hub = document.getElementById('hb-hub-btn');
  if (!hub) {
    hub = document.createElement('button'); hub.id = 'hb-hub-btn'; hub.type = 'button';
    hub.className = 'hb-hub-btn'; hub.setAttribute('aria-label', 'Play and servers');
    hub.innerHTML = '<span class="hb-ico">⚔</span><span class="hb-lab">PLAY · HARBOR</span><span class="hb-chip" hidden></span>';
    (document.getElementById('hud') || document.body).appendChild(hub);
  }
  // Keep the launcher in the radar column so it follows every radar size.
  const radar = document.getElementById('radar');
  if (radar) radar.insertAdjacentElement('afterend', hub);
  // modal chrome (header + close) once
  if (!card.querySelector('.hb-hub-head')) {
    const head = document.createElement('div'); head.className = 'hb-hub-head';
    head.innerHTML = '<b>⚔ PLAY &amp; SERVERS</b><button type="button" class="hb-hub-x" aria-label="Close">✕</button>';
    card.prepend(head);
  }
  // harbor server strip (holds / hosts #srv-btn when the picker mounts into .ph-btns)
  if (!card.querySelector('.hb-srv')) {
    const srv = document.createElement('div'); srv.className = 'hb-srv';
    srv.innerHTML = '<span class="hb-srv-lab">⚓ HARBOR SERVER</span><span class="hb-srv-name" id="hb-srv-name">HARBOR #1</span>';
    const btns = card.querySelector('.ph-btns');
    if (btns) card.insertBefore(srv, btns); else card.appendChild(srv);
  }
  const fold = card.querySelector('.ph-fold'); if (fold) fold.hidden = true; // old phone fold handle unused
  card.classList.remove('ph-compact');

  const open = () => { card.classList.add('hb-modal-open'); card.classList.remove('hidden'); document.documentElement.classList.add('hb-hub-open'); };
  const close = () => { card.classList.remove('hb-modal-open'); document.documentElement.classList.remove('hb-hub-open'); };
  const toggle = () => { if (card.classList.contains('hb-modal-open')) close(); else open(); };

  hub.onclick = (e) => { e.preventDefault(); e.stopPropagation(); toggle(); };
  card.querySelector('.hb-hub-x')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); close(); });
  // click outside (backdrop via ::before) closes
  card.addEventListener('pointerdown', (e) => { if (e.target === card && card.classList.contains('hb-modal-open')) close(); });

  // live label: "⚔ PLAY · HARBOR #1" / "⚔ QUEUED" / player count
  const lab = hub.querySelector('.hb-lab'), chip = hub.querySelector('.hb-chip'), nameEl = () => document.getElementById('hb-srv-name');
  const paint = (info = {}) => {
    const label = info.label || info.serverLabel || 'HARBOR';
    const n = info.n | info.pirates | 0, queued = !!info.queued;
    if (lab) lab.textContent = queued ? 'QUEUED' : `PLAY · ${label}`;
    if (chip) { if (queued) { chip.hidden = false; chip.textContent = info.pos ? `#${info.pos}` : '…'; } else if (n > 0) { chip.hidden = false; chip.textContent = `${n}`; } else chip.hidden = true; }
    const nm = nameEl(); if (nm) nm.textContent = label + (n > 0 ? ` · ${n} pirates` : '');
    hub.classList.toggle('queued', queued);
    hub.title = queued ? 'In Battle Royale queue — tap to manage' : `Play & Servers · ${label}`;
  };
  // [v340] BANKSY t1804u: on mobile the pill is a ship-only control — hide it (and close the modal) the moment you go on foot
  const isMobile = () => document.documentElement.classList.contains('dk-touch') || matchMedia('(pointer: coarse), (hover: none)').matches;
  const FOOT = ['pfp-onfoot', 'pfp-inhull', 'pfp-inhouse', 'pfp-canoe'];
  let wasFoot = false;
  const syncFoot = () => { const h = document.documentElement, foot = isMobile() && FOOT.some(c => h.classList.contains(c));
    h.classList.toggle('hb-mobile-foot', foot);
    if (foot && !wasFoot && card.classList.contains('hb-modal-open') && !h.classList.contains('dk-board')) close();
    wasFoot = foot; };
  syncFoot();
  try { new MutationObserver(syncFoot).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); } catch {}
  paint();
  addEventListener('pfp-harbor-hub', (e) => paint(e.detail || {}));
  // expose for pvp.js
  try { window.__pfpHarborHub = { open, close, toggle, paint }; } catch {}
}
