// [rarity-sort] BANKSY t2145u: SORT: RARITY toggle for the INVENTORY + hull/house storage (display order, remembered per panel)
import { RARITIES } from './catalog.js';
export const SORT_MODES = ['default', 'desc', 'asc'];
export const SORT_LABEL = { default: 'SORT: DEFAULT', desc: 'SORT: RARITY ▼', asc: 'SORT: RARITY ▲' };
const LS = 'pfp_raritysort_';
export function getSort(panel) { try { const v = localStorage.getItem(LS + panel); return SORT_MODES.includes(v) ? v : 'default'; } catch { return 'default'; } }
export function setSort(panel, m) { try { localStorage.setItem(LS + panel, m); } catch { /* private mode */ } return m; }
export const nextSort = (m) => SORT_MODES[(SORT_MODES.indexOf(m) + 1) % SORT_MODES.length];
export function rarityRank(info) { const i = RARITIES.indexOf(info?.rarity); return i < 0 ? 0 : i; }
// rarity (then musket level) first, ties: kind/slot, then name
export function sortByRarity(list, mode, infoOf) {
  if (mode !== 'desc' && mode !== 'asc') return list;
  const d = mode === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => { const A = infoOf(a) || {}, B = infoOf(b) || {};
    return d * (rarityRank(A) - rarityRank(B)) || d * ((A.level || A.lv || 0) - (B.level || B.lv || 0))
      || String(A.kind || '').localeCompare(String(B.kind || '')) || String(A.slot || '').localeCompare(String(B.slot || ''))
      || String(A.name || '').localeCompare(String(B.name || '')); });
}
