// [v122] TREASURE MAPS in the harbor (server: supabase/migrations/026 + pvp maps_state / map_dig). Maps drop server-side from boss kills
// (common) and confirmed BR kills (rare; legendary = the cave). A MAPS button lists your undug maps; the selected one draws a fuzzy dig
// area on the radar (islandMap.js st.dig); the matching dig site (or the cave) asks the server, which checks the spot + rate limits and
// credits the gold (pvp.js adds the same gold to your save in the same tick; logged-in devices send mirror: true).
const TIER = { common: ['COMMON MAP', '#e8cf95'], rare: ['RARE MAP', '#7fd0ff'], legendary: ['LEGENDARY MAP', '#ffcd3c'] };
const WHY = {
  'too soon': 'THE INK IS STILL WET<br><small>a new map can be dug 30 s after it drops</small>',
  'slow down': 'CATCH YOUR BREATH<br><small>20 s between digs</small>',
  'daily dig limit': '25 DIGS TODAY<br><small>the sand is yours again tomorrow</small>',
  'wrong spot': 'NOTHING HERE<br><small>this map points somewhere else · check the radar</small>',
  'already dug': 'ALREADY DUG UP', 'not your map': 'THAT MAP IS GONE',
};
const SRC = { boss: 'from a boss', kill: 'from a battle kill', streak: 'from a 3-kill streak' };
const spotName = (s) => s === 'cave' ? 'TREASURE CAVE' : 'DIG SITE ' + String(s).replace(/\D/g, '');
const CSS = `
#tm-btn{position:fixed;right:calc(var(--safe-r,0px) + 14px);top:calc(var(--safe-t,0px) + 172px);z-index:8;display:none;font:22px 'Just Another Hand',cursive;letter-spacing:.04em;padding:5px 12px 2px;border-radius:12px;border:2px solid #ffcd77;background:rgba(22,22,22,.86);color:#ffcd77;cursor:pointer}
#tm-btn b{color:#fff;margin-left:4px}
#tm-panel{position:fixed;right:calc(var(--safe-r,0px) + 14px);top:calc(var(--safe-t,0px) + 212px);z-index:9;display:none;width:min(320px,calc(100vw - 28px));max-height:min(60vh,420px);overflow:auto;background:rgba(22,22,22,.94);border:2px solid #ffcd77;border-radius:14px;padding:10px 12px;color:#fff;font:20px 'Just Another Hand',cursive}
#tm-panel h3{margin:0 0 6px;font-size:28px;color:#ffcd77;font-weight:normal;display:flex;justify-content:space-between;align-items:center}
#tm-panel h3 button{font:20px 'Just Another Hand',cursive;background:none;border:0;color:#ffcd77;cursor:pointer}
#tm-panel .tm-m{display:flex;align-items:center;gap:8px;padding:6px 8px;margin:4px 0;border-radius:10px;border:2px solid #444;cursor:pointer}
#tm-panel .tm-m.sel{border-color:#ffcd77;background:rgba(255,205,119,.12)}
#tm-panel .tm-m i{font-style:normal;font-size:24px} #tm-panel .tm-m div{flex:1;line-height:1.05} #tm-panel .tm-m small{color:#bbb}
#tm-panel .tm-r{color:#bbb;font-size:18px;margin-top:6px} #tm-panel .tm-r b{color:#ffcd3c;font-weight:normal}
`;
export function createTreasure({ world, toast, pvp, isOn }) {
  const spots = new Map(world.footInteract.filter(q => q.kind === 'dig' || q.id === 'cave').map(q => [q.id, q]));
  let maps = [], recent = [], sel = null, busy = false, lastAt = 0, wasOn = false, loading = false;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const btn = document.createElement('button'); btn.id = 'tm-btn'; document.body.appendChild(btn);
  const panel = document.createElement('div'); panel.id = 'tm-panel'; document.body.appendChild(panel);
  for (const e of [btn, panel]) for (const ev of ['pointerdown', 'touchstart', 'mousedown']) e.addEventListener(ev, (x) => x.stopPropagation(), { passive: true });
  btn.addEventListener('click', (e) => { e.stopPropagation(); panel.style.display === 'block' ? close() : open(); });
  panel.addEventListener('click', (e) => { e.stopPropagation(); const b = e.target.closest('[data-id],[data-x]'); if (!b) return;
    if (b.dataset.x !== undefined) { close(); return; } sel = maps.find(m => m.id === b.dataset.id) || sel; render(); toast(`${spotName(sel.spot)}<br><small>dig inside the gold circle on your radar</small>`, 2200); });
  const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
  function target() { // a fuzzy area round the spot (offset seeded by the map id, so it never moves), harbor coords for the radar
    if (!sel) return null; const q = spots.get(sel.spot); if (!q) return null; const h = hash(sel.id), a = h * Math.PI * 2, d = 6 + ((h * 7919) % 1) * 14;
    return { x: q.x + Math.cos(a) * d, z: q.z + Math.sin(a) * d, r: 28 }; }
  function render() {
    btn.innerHTML = `🗺 MAPS<b>${maps.length}</b>`;
    const rows = maps.map(m => { const [tn, tc] = TIER[m.tier] || TIER.common;
      return `<div class="tm-m${sel && sel.id === m.id ? ' sel' : ''}" data-id="${m.id}"><i style="color:${tc}">✕</i><div><span style="color:${tc}">${tn}</span><br><small>${spotName(m.spot)} · ${SRC[m.source] || 'found'}</small></div>${sel && sel.id === m.id ? '<small>ON RADAR</small>' : ''}</div>`; }).join('');
    const rec = recent.length ? `<div class="tm-r">last finds: ${recent.slice(0, 3).map(r => `<b>+${(r.gold | 0).toLocaleString()}</b>`).join(' · ')}</div>` : '';
    panel.innerHTML = `<h3>TREASURE MAPS <button data-x>✕</button></h3>${rows || '<div class="tm-r">no maps yet · sink bosses + win battle kills</div>'}${rec}`;
  }
  const open = () => { render(); panel.style.display = 'block'; }, close = () => { panel.style.display = 'none'; };
  async function refresh() {
    const pv = pvp(); if (!pv?.maps || loading) return; loading = true;
    try { const r = await pv.maps.state(); if (!r || !r.ok) return;
      maps = (r.maps || []).filter(m => spots.has(m.spot)); recent = r.recent || [];
      if (sel && !maps.some(m => m.id === sel.id)) sel = null; if (!sel && maps.length) sel = maps[0];
      if ((r.new | 0) > 0) toast(`NEW TREASURE MAP${r.new > 1 ? 'S' : ''}!<br><small>tap MAPS · the radar shows where to dig</small>`, 2800);
      render(); } finally { loading = false; } }
  function tick() { const o = !!isOn(), now = performance.now();
    if (o && (!wasOn || now - lastAt > 90000)) { lastAt = now; refresh(); }
    wasOn = o; btn.style.display = o && maps.length ? 'block' : 'none'; if (!o || !maps.length) close(); }
  const mapFor = (id) => (sel && sel.spot === id) ? sel : maps.find(m => m.spot === id);
  const label = (q) => mapFor(q.id) ? (q.id === 'cave' ? 'DIG FOR THE LEGENDARY CHEST' : 'DIG · TREASURE MAP') : null;
  async function dig(q, t) { // true = handled (else the caller falls back to its old prompt)
    const pv = pvp(); if (!pv?.maps) { if (q.kind === 'dig') world.activate(q, t); return true; }
    const m = mapFor(q.id);
    if (!m) { if (q.id === 'cave') return false;
      toast(maps.length ? 'NO MAP FOR THIS SITE<br><small>your map points somewhere else · check the radar</small>' : 'NO TREASURE MAP<br><small>maps drop from boss kills + battle kills</small>', 2400); return true; }
    if (busy) return true; busy = true; toast('DIGGING…', 1400);
    try { const r = await pv.maps.dig(m.id, q.id);
      if (r && r.ok) {
        if (q.kind === 'dig') { world.activate(q, t); q.used = true; setTimeout(() => world.rearm(q), 9000); }
        maps = maps.filter(x => x.id !== m.id); recent = [{ tier: r.tier, gold: r.gold }, ...recent]; if (sel && sel.id === m.id) sel = maps[0] || null;
        toast(`TREASURE! +${(r.gold | 0).toLocaleString()} GOLD<br><small>${(TIER[r.tier] || TIER.common)[0]}${r.holder ? ' · x2 HOLDER' : ''}</small>`, 3200); render();
      } else { toast(WHY[r?.error] || 'THE DIG FAILED<br><small>check your connection and try again</small>', 2600); if (r?.error === 'already dug' || r?.error === 'not your map') refresh(); }
    } finally { busy = false; }
    return true; }
  render();
  return { tick, refresh, dig, label, target, get maps() { return maps; }, get sel() { return sel; }, open, close };
}
