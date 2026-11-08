// Presentation-only: baked artwork loads only when an item is displayed (never precached).
const IMG = new URL('../../assets/items/', import.meta.url).href;
const THUMBS = new URL('../../assets/pirates/thumbs/', import.meta.url).href;
const MAP_TIER = { common: 'common', uncommon: 'common', rare: 'rare', epic: 'rare', legendary: 'legendary' };
const PARROT = new Set(['parrot_green', 'parrot_red', 'parrot_blue', 'parrot_cockatoo', 'parrot_black', 'parrot_gold', 'parrot_diamond']);
export const treatArt = `${IMG}parrot_treat.webp`;
export function itemImg(key, info) {
  if (!info) return '';
  if (info.iconImage) return info.iconImage;
  const p = String(key).split(':');
  if (info.kind === 'fish') return `${IMG}fish_${p[1]}.webp`;
  if (info.kind === 'valuable' || info.kind === 'gunacc' || info.kind === 'part') return `${IMG}val_${p[1]}.webp`;
  if (info.kind === 'island') return `${IMG}isl_${p[1]}.webp`;
  if (info.kind === 'parrot') return `${IMG}${PARROT.has(info.color) ? info.color : 'parrot_green'}.webp`;
  if (info.kind === 'weapon') return `${IMG}wpn_${info.slot}_${info.base}${info.rarity === 'legendary' ? '_legendary' : ''}.webp`;
  if (info.kind === 'map') return `${IMG}map_${MAP_TIER[info.rarity] || 'common'}.webp`;
  if (info.kind === 'dup') return `${THUMBS}${info.slot}_${info.id}.png`;
  return '';
}
