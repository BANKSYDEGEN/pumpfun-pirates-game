// [Emerly v106] COMPACT PHONE HARBOR CARD (BANKSY: the harbor card covered other ships on phones). On phones / small screens the
// card folds to one row (the JOIN BATTLE / START WAVES button + a ▸ handle); tap ▸ to open the full card (BATTLE | WAVES tab,
// SOLO / SQUADS, party, spectate), ◂ folds it again. The choice is remembered (pfp_hcard: 'open' | 'fold'). Desktop: unchanged.
const KEY = 'pfp_hcard';
export function initHarborCard() {
  const card = document.getElementById('pvp-harbor'); if (!card || card.querySelector('.ph-fold')) return;
  const small = () => matchMedia('(max-height: 480px), (max-width: 600px)').matches;
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'ph-fold ghost'; btn.setAttribute('aria-label', 'Show / hide the harbor card');
  card.prepend(btn);
  let pref = null; try { pref = localStorage.getItem(KEY); } catch {}
  const apply = () => { const fold = small() && pref !== 'open'; card.classList.toggle('ph-compact', fold); btn.textContent = fold ? '▸' : '◂'; btn.hidden = !small(); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); pref = card.classList.contains('ph-compact') ? 'open' : 'fold'; try { localStorage.setItem(KEY, pref); } catch {} apply(); });
  addEventListener('resize', apply); apply();
}
