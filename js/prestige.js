// [prestige] PUMPFUN PIRATES · PRESTIGE (BANKSY: "Add ability to prestige when max out ship", "prestige 1 unlock golden gallon and
// prestige 2 unlock diamond", "Add prestige emblem to player top left section"). Battle Royale only.
// Max every ship upgrade -> PRESTIGE (UPGRADE SHOP button + confirm): the prestige level goes up by one and ONLY the ship upgrades go
// back to base. Gold, skins, gear, kills and the boards are kept. The level lives on the server (supabase/functions/pvp `prestige`,
// migration 031); PRESTIGE 1 GIVES the GOLDEN GALLEON free, PRESTIGE 2 the DIAMOND SHIP (js/shopCatalog.js goals, server pvp_owned grant).
// This file = the look only: the emblem (P1 gold, P2 diamond, P3+ diamond with a gold rim + the number) and the reward text.
import { NEW_SHIP_TABLE } from './newShipsTable.js'; // [Emerly] P3..P7: the five new hulls (BANKSY 8:37 PM "Just make them prestige 3 on")
export const PRESTIGE_REWARDS = { 1: { skin: 'golden', name: 'GOLDEN GALLEON' }, 2: { skin: 'diamond', name: 'DIAMOND SHIP' },
  ...Object.fromEntries(NEW_SHIP_TABLE.map(r => [r.prestige, { skin: r.id, name: r.name }])) };
// [prestige] BANKSY: the reward skin is GIVEN free (owned from that level on). Mirror: supabase/functions/pvp/lib.ts PRESTIGE_SKINS
export const PRESTIGE_GRANT_LV = Object.fromEntries(Object.entries(PRESTIGE_REWARDS).map(([lv, r]) => [r.skin, +lv]));
export const rewardFor = (lv) => PRESTIGE_REWARDS[lv] || null;
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// level 0 = '' (no emblem). size in CSS px.
export function emblemSvg(level, size = 24) {
  const lv = Math.max(0, Math.min(100, level | 0)); if (!lv) return '';
  const id = `pe${lv}_${Math.random().toString(36).slice(2, 7)}`, gold = lv === 1, rim = lv >= 3 ? '#ffcd77' : gold ? '#5a3a12' : '#1d4a66';
  const fill = gold ? `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c8"/><stop offset="0.45" stop-color="#ffcd77"/><stop offset="1" stop-color="#b8862e"/></linearGradient>`
    : `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.4" stop-color="#bfe8ff"/><stop offset="1" stop-color="#4aa6dc"/></linearGradient>`;
  // gold = a shield with a star; diamond = a cut gem with facets
  const shape = gold
    ? `<path d="M16 2 L28 6 V15 C28 23 22 28 16 30 C10 28 4 23 4 15 V6 Z" fill="url(#${id})" stroke="${rim}" stroke-width="2" stroke-linejoin="round"/><path d="M16 6.5 L17.6 10 L21.4 10.3 L18.5 12.7 L19.4 16.4 L16 14.4 L12.6 16.4 L13.5 12.7 L10.6 10.3 L14.4 10 Z" fill="#fff6dc" opacity="0.9"/>`
    : `<path d="M8 4 H24 L30 12 L16 30 L2 12 Z" fill="url(#${id})" stroke="${rim}" stroke-width="2" stroke-linejoin="round"/><path d="M2 12 H30 M8 4 L12 12 L16 30 L20 12 L24 4 M12 12 L16 4 L20 12" fill="none" stroke="#ffffff" stroke-opacity="0.75" stroke-width="1"/>`;
  const num = `<text x="16" y="${gold ? 26 : 24.5}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${lv > 9 ? 9 : 11}" fill="#161616" stroke="#ffffff" stroke-width="2.4" paint-order="stroke">${lv}</text>`;
  return `<svg class="prest-svg" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true"><defs>${fill}</defs>${shape}${num}</svg>`;
}
export const emblemLabel = (lv) => lv > 0 ? `PRESTIGE ${lv}` : '';
// the badge used in panels: emblem + 'PRESTIGE N'
export const badgeHtml = (lv, size = 22) => lv > 0 ? `<span class="prest-badge p${Math.min(3, lv)}" title="${esc(emblemLabel(lv))}">${emblemSvg(lv, size)}<b>${esc(emblemLabel(lv))}</b></span>` : '';
