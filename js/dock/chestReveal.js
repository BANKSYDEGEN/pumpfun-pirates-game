// [v152] CHEST ITEMS reveal (BANKSY: "add accessories weapons clothes for character or crew as options for treasure hunt chests").
// The SERVER picks what a dug chest holds (supabase/functions/pvp/chest.ts + migration 035); this only SHOWS it:
//   gold only        -> TREASURE! +gold (the chest pops open, coins)
//   item for you     -> CHEST: CAPTAIN'S HAT!  · FOR YOU       + the item card + WEAR IT
//   item for crew    -> CHEST: CAPTAIN'S HAT!  · FOR YOUR CREW + the item card + DRESS CREW
//   duplicate        -> CHEST: TRICORN!        · ALREADY YOURS · +200 GOLD instead
// Tap anywhere (or wait) to close. Never during a fight: the dig itself only happens on foot on the island.
import * as CAT from '../shopCatalog.js';
const FONT = "'Just Another Hand', cursive";
const TIER = { common: ['COMMON CHEST', '#e8cf95'], rare: ['RARE CHEST', '#7fd0ff'], legendary: ['LEGENDARY CHEST', '#ffcd3c'] };
const SLOT = { hat: 'HAT', outfit: 'CLOTHES', eyes: 'EYEWEAR', hook: 'HOOK', leg: 'PEG LEG', face: 'FACE PAINT', parrot: 'PET', ears: 'EARRINGS', teeth: 'GOLD TEETH', boots: 'BOOTS', cape: 'CAPE', sword: 'SWORD', musket: 'MUSKET', crewhat: 'CREW HAT', crewoutfit: 'CREW CLOTHES' };
// weapons: the WEAPON STORE catalog (timothy/battle-areas WEAPON_ITEMS) when it is in this build, else these names (same ids)
const WEAPON_NAMES = { 'sword:cutlass': 'CUTLASS', 'sword:rapier': 'RAPIER', 'sword:bone': 'BONE SKULL BLADE', 'musket:navy': 'NAVY MUSKET', 'musket:blunder': 'BLUNDERBUSS', 'musket:dragoon': 'BRASS DRAGOON' };
export function chestItemInfo(key, crew = false) { // key = 'slot:id' ('crewhat:bicorne', 'sword:rapier')
  const [slot, id] = String(key).split(':'), base = slot === 'crewhat' ? 'hat' : slot === 'crewoutfit' ? 'outfit' : slot;
  const all = [...(CAT.GEAR_ITEMS || []), ...(CAT.CREW_ITEMS || []), ...(CAT.WEAPON_ITEMS || [])];
  const it = all.find(g => g.slot === slot && g.id === id) || all.find(g => g.slot === base && g.id === id);
  const label = (it && it.label) || WEAPON_NAMES[`${base}:${id}`] || String(id || '').replace(/_/g, ' ').toUpperCase();
  const weapon = base === 'sword' || base === 'musket';
  return { slot, base, id, label: label.replace(/^CREW /, ''), kind: SLOT[slot] || 'ITEM', crew: crew || slot.startsWith('crew'), weapon,
    thumb: weapon ? `assets/pirates/thumbs/weapon_${base}_${id}.png` : `assets/pirates/thumbs/${base}_${id}.png`, icon: CHEST_SVG };
}
const CHEST_SVG = `<svg viewBox="0 0 120 100" width="1em" height="0.83em"><path d="M10 44 Q60 4 110 44 Z" fill="#8a5527" stroke="#3a1f0a" stroke-width="4"/><rect x="10" y="44" width="100" height="48" rx="4" fill="#a0652e" stroke="#3a1f0a" stroke-width="4"/><rect x="10" y="40" width="100" height="10" fill="#ffcd3c" stroke="#5a2d00" stroke-width="3"/><rect x="24" y="44" width="10" height="48" fill="#ffcd3c" stroke="#5a2d00" stroke-width="2"/><rect x="86" y="44" width="10" height="48" fill="#ffcd3c" stroke="#5a2d00" stroke-width="2"/><rect x="52" y="48" width="16" height="20" rx="3" fill="#ffd76a" stroke="#5a2d00" stroke-width="3"/><circle cx="60" cy="58" r="3" fill="#3a1f0a"/><circle cx="40" cy="30" r="5" fill="#ffd76a"/><circle cx="62" cy="22" r="6" fill="#ffe89a"/><circle cx="82" cy="30" r="5" fill="#ffd76a"/></svg>`;
const CSS = `
#ch-reveal{position:fixed;inset:0;z-index:41;display:none;align-items:center;justify-content:center;flex-direction:column;pointer-events:auto;background:radial-gradient(circle at 50% 46%,rgba(40,22,4,.35),rgba(0,0,0,.55) 70%);cursor:pointer}
#ch-reveal.on{display:flex}
#ch-reveal .ch-rays{position:absolute;left:50%;top:44%;width:150vmax;height:150vmax;margin:-75vmax 0 0 -75vmax;background:repeating-conic-gradient(from 0deg,rgba(255,214,110,.17) 0deg 7deg,rgba(255,214,110,0) 7deg 20deg);-webkit-mask:radial-gradient(circle,#000 0,rgba(0,0,0,.6) 18%,transparent 46%);mask:radial-gradient(circle,#000 0,rgba(0,0,0,.6) 18%,transparent 46%);animation:chSpin 14s linear infinite,chFade .5s ease-out both;pointer-events:none}
#ch-reveal.t-rare .ch-rays{background:repeating-conic-gradient(from 0deg,rgba(127,208,255,.18) 0deg 7deg,rgba(127,208,255,0) 7deg 20deg)}
#ch-reveal .ch-head{position:relative;font:clamp(34px,8vw,66px)/1 ${FONT};color:#ffd76a;letter-spacing:.04em;text-align:center;padding:0 12px;text-shadow:0 3px 0 #5a2d00,0 0 18px rgba(255,190,60,.8),0 4px 12px #000;animation:chPop .55s cubic-bezier(.2,1.6,.4,1) both}
#ch-reveal .ch-tier{position:relative;font:clamp(20px,4.4vw,28px)/1 ${FONT};letter-spacing:.08em;margin:2px 0 8px;text-shadow:0 2px 4px #000;animation:chFade .4s ease-out .2s both}
#ch-reveal .ch-card{position:relative;width:min(70vw,300px);border-radius:18px;padding:12px 12px 10px;background:linear-gradient(#f3e2b6,#dcc08a);border:4px solid #6b3f16;box-shadow:0 0 0 3px #ffcd77,0 10px 30px rgba(0,0,0,.7),inset 0 0 22px rgba(110,66,22,.45);text-align:center;animation:chCard .7s cubic-bezier(.2,1.5,.4,1) .25s both}
#ch-reveal .ch-art{position:relative;height:min(30vh,190px);display:flex;align-items:center;justify-content:center;border-radius:12px;background:radial-gradient(circle,#fff6d6,#e6cf98 70%);overflow:hidden}
#ch-reveal .ch-art img{max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 4px 6px rgba(0,0,0,.45))}
#ch-reveal .ch-art .ch-ico{font-size:min(16vh,96px)}
#ch-reveal .ch-name{font:clamp(28px,6.4vw,40px)/1 ${FONT};color:#3a1f0a;margin-top:8px}
#ch-reveal .ch-kind{font:18px/1 ${FONT};color:#7a4a1a;letter-spacing:.08em}
#ch-reveal .ch-for{position:absolute;top:-14px;left:50%;transform:translateX(-50%) rotate(-3deg);white-space:nowrap;font:22px/1 ${FONT};letter-spacing:.06em;padding:5px 14px 2px;border-radius:9px;background:#fa0d0d;color:#fff;border:2px solid #ffcd77;box-shadow:0 3px 8px rgba(0,0,0,.5)}
#ch-reveal .ch-for.crew{background:#6a4fb3}
#ch-reveal .ch-for.dup{background:#4a4a4a}
#ch-reveal .ch-gold{position:relative;margin-top:10px;font:clamp(26px,6vw,38px)/1 ${FONT};color:#ffd76a;text-shadow:0 2px 0 #5a2d00,0 3px 8px #000;animation:chFade .5s ease-out .8s both;text-align:center}
#ch-reveal .ch-gold small{display:block;font-size:.6em;color:#f1dfb5}
#ch-reveal .ch-btns{position:relative;display:flex;gap:10px;margin-top:10px;animation:chFade .5s ease-out 1s both}
#ch-reveal .ch-btns button{font:22px ${FONT};letter-spacing:.05em;padding:6px 18px 3px;border-radius:13px;border:3px solid #ffcd77;background:#fa0d0d;color:#fff;cursor:pointer}
#ch-reveal .ch-btns button.ok{background:rgba(22,22,22,.86);color:#ffcd77}
#ch-reveal .ch-chest{position:relative;font-size:min(20vh,120px);animation:chCard .7s cubic-bezier(.2,1.5,.4,1) .2s both;filter:drop-shadow(0 6px 10px rgba(0,0,0,.6))}
#ch-reveal canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#ch-reveal.out{animation:chOut .4s ease-in both}
@keyframes chSpin{to{transform:rotate(360deg)}} @keyframes chFade{from{opacity:0}to{opacity:1}} @keyframes chOut{to{opacity:0}}
@keyframes chPop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes chCard{0%{transform:translateY(40px) scale(.4) rotate(-8deg);opacity:0}100%{transform:none;opacity:1}}
@media (max-height:520px){#ch-reveal .ch-head{font-size:34px} #ch-reveal .ch-tier{margin:0 0 4px;font-size:18px} #ch-reveal .ch-card{width:min(44vh*1.2,240px);padding:8px 8px 6px} #ch-reveal .ch-art{height:24vh} #ch-reveal .ch-name{font-size:26px;margin-top:4px} #ch-reveal .ch-gold{margin-top:4px;font-size:24px} #ch-reveal .ch-btns{margin-top:4px} #ch-reveal .ch-btns button{font-size:19px;padding:3px 12px 1px} #ch-reveal .ch-chest{font-size:24vh}}
`;
export function createChestReveal({ sfx = null, low = false, onWear = null, canWear = () => true } = {}) {
  let el = null, t = 0, raf = 0;
  function build() { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    el = document.createElement('div'); el.id = 'ch-reveal'; document.body.appendChild(el);
    for (const ev of ['touchstart', 'mousedown']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    el.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; e.preventDefault(); e.stopPropagation(); hide(); }); }
  // r = the map_dig answer: { gold, dig_gold, tier, holder, loot: { item: 'slot:id', crew, dup, dup_gold } | null }
  function show(r, ms = 6500) {
    if (!el) build(); clearTimeout(t); cancelAnimationFrame(raf);
    const [tn, tc] = TIER[r.tier] || TIER.common, L = r.loot, gold = (r.gold | 0), dig = (r.dig_gold ?? r.gold) | 0, x2 = r.holder ? ' · x2 HOLDER' : '';
    let html = `<canvas></canvas><div class="ch-rays"></div>`;
    if (L && L.item) {
      const I = chestItemInfo(L.item, L.crew), who = L.dup ? 'ALREADY YOURS' : I.crew ? 'FOR YOUR CREW' : 'FOR YOU';
      html += `<div class="ch-head">CHEST: ${I.label}!</div><div class="ch-tier" style="color:${tc}">${tn}</div>` +
        `<div class="ch-card"><div class="ch-for${L.dup ? ' dup' : I.crew ? ' crew' : ''}">${who}</div><div class="ch-art"><img alt="" src="${I.thumb}"></div>` +
        `<div class="ch-name">${I.label}</div><div class="ch-kind">${I.kind}${I.weapon ? ' · cosmetic' : ''}</div></div>` +
        `<div class="ch-gold">+${gold.toLocaleString()} GOLD<small>${L.dup ? `treasure ${dig.toLocaleString()} + ${(L.dup_gold | 0).toLocaleString()} for the spare ${I.kind.toLowerCase()}` : 'treasure gold'}${x2}</small></div>` +
        `<div class="ch-btns">${!L.dup && onWear && canWear(L.item) ? `<button type="button" class="wear">${I.crew ? 'DRESS CREW' : 'WEAR IT'}</button>` : ''}<button type="button" class="ok">NICE!</button></div>`;
    } else {
      html += `<div class="ch-head">TREASURE!</div><div class="ch-tier" style="color:${tc}">${tn}</div><div class="ch-chest">${CHEST_SVG}</div>` +
        `<div class="ch-gold">+${gold.toLocaleString()} GOLD<small>${x2 ? x2.slice(3) : 'dug up from the sand'}</small></div><div class="ch-btns"><button type="button" class="ok">NICE!</button></div>`;
    }
    el.className = ''; void el.offsetWidth; el.innerHTML = html; el.classList.add('on', 't-' + (r.tier || 'common'));
    const img = el.querySelector('.ch-art img');
    if (img && L) img.onerror = () => { const sp = document.createElement('span'); sp.className = 'ch-ico'; sp.innerHTML = CHEST_SVG; img.replaceWith(sp); };
    el.querySelector('.ok')?.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); hide(); });
    el.querySelector('.wear')?.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { onWear?.(L.item); } catch (er) { console.warn('[chest] wear', er); } hide(); });
    sparkle(el.querySelector('canvas'));
    try { (L && !L.dup ? sfx?.treasureMap : sfx?.coin)?.(); } catch { /* audio off */ }
    t = setTimeout(hide, ms);
  }
  function hide(now = false) { if (!el || !el.classList.contains('on')) return; clearTimeout(t);
    const fin = () => { el.classList.remove('on', 'out'); el.innerHTML = ''; cancelAnimationFrame(raf); };
    if (now) fin(); else { el.classList.add('out'); t = setTimeout(fin, 420); } }
  function sparkle(fc) { if (!fc) return; const dpr = Math.min(2, devicePixelRatio || 1), W = fc.width = Math.round(innerWidth * dpr), H = fc.height = Math.round(innerHeight * dpr), c = fc.getContext('2d');
    const ps = [], cx = W / 2, cy = H * 0.45, t0 = performance.now(), COL = ['#fff3b0', '#ffd76a', '#ffcd3c', '#ffffff', '#ffb347'], N = low ? 60 : 120;
    for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, v = (220 + Math.random() * 480) * dpr; ps.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 140 * dpr, life: 0, max: 1 + Math.random(), s: (2 + Math.random() * 3) * dpr, col: COL[i % COL.length] }); }
    let last = t0; const step = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; c.clearRect(0, 0, W, H);
      for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; p.life += dt; if (p.life > p.max) { ps.splice(i, 1); continue; } p.vx *= 0.985; p.vy = p.vy * 0.985 + 300 * dpr * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        c.globalAlpha = Math.max(0, 1 - p.life / p.max); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 7); c.fill(); }
      c.globalAlpha = 1; if (ps.length && el.classList.contains('on')) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); }
  return { show, hide, get isOn() { return !!el && el.classList.contains('on'); } };
}
