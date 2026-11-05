// [gold-hud] BANKSY 2026-11-05 2:25-2:27 PM: stats under the captain card + Hide HUD / Show HUD.
//   &goldhud=0 = the old centred upper-middle KILLS/DEATHS/GOLD/K-D (SCORE/WAVE/GOLD/SUNK) bar.
//   Hide HUD (H while playing; spectate keeps its own H): hides player card, minimap, inventory, chat, top-right icons,
//   controls / hotbar / stick. Shops, prompts, dialogs, kill / death screens and alerts stay. Choice in localStorage.
const LS = 'pfp_hud_hide';
const GOLDHUD_LEGACY = typeof location !== 'undefined' && /[?&]goldhud=0(?:&|$)/.test(location.search);
// [hud-no-title] BANKSY 3:14 PM: no PUMPFUN PIRATES wordmark in the in-game HUD, captain card flush top-left; &hudtitle=1 = old title
if (typeof document !== 'undefined' && !/[?&]hudtitle=1(?:&|$)/.test(location.search)) document.documentElement.classList.add('hud-notitle');
export const goldhudLegacy = () => GOLDHUD_LEGACY;
export function hudHidden() { try { return localStorage.getItem(LS) === '1'; } catch { return false; } }
export function setHudHidden(on) {
  const v = !!on; try { v ? localStorage.setItem(LS, '1') : localStorage.removeItem(LS); } catch {}
  applyHudHide(); return v;
}
export function toggleHudHidden() { return setHudHidden(!hudHidden()); }
export function applyHudHide() {
  const on = hudHidden();
  document.documentElement.classList.toggle('hud-hide', on);
  const b = document.getElementById('btn-showhud');
  if (b) b.classList.toggle('hidden', !on);
}
export function applyGoldHud() {
  document.documentElement.classList.toggle('goldhud-legacy', GOLDHUD_LEGACY);
}
export function wireHudHide({ isSpectating, isTyping } = {}) {
  applyGoldHud(); applyHudHide();
  document.getElementById('btn-showhud')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setHudHidden(false); });
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyH' || e.repeat) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (isTyping?.()) return;
    if (isSpectating?.()) return; // [pvp] spectate owns H for its own HUD hide
    e.preventDefault(); toggleHudHidden();
  });
  // Settings: Hide HUD toggle (pause panel)
  const box = document.getElementById('hud-hide-pause');
  if (box) {
    box.innerHTML = '<span class="label">HUD <small class="muted">H</small></span><span class="gfx-seg" role="radiogroup" aria-label="HUD visibility"></span>';
    const seg = box.querySelector('.gfx-seg');
    const paint = () => {
      const on = hudHidden();
      seg.innerHTML = `<button type="button" data-h="0" role="radio" aria-checked="${!on}" class="${!on ? 'on' : ''}">SHOW</button><button type="button" data-h="1" role="radio" aria-checked="${on}" class="${on ? 'on' : ''}">HIDE</button>`;
    };
    paint();
    seg.addEventListener('click', (e) => { const b = e.target.closest('button[data-h]'); if (!b) return; setHudHidden(b.dataset.h === '1'); paint(); });
  }
}
