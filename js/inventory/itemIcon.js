// Optional real item artwork; text-only controls keep the catalog's emoji.
import { itemImg } from './itemArt.js';
import { escHtml } from '../safe.js';
export function itemIconHtml(info = {}, fallback = '❔', key = '') {
  const emoji = info.icon || fallback;
  const image = info.iconImage || (key ? itemImg(key, info) : '');
  if (!image) return escHtml(emoji);
  const onerror = `this.replaceWith(document.createTextNode(${JSON.stringify(emoji)}))`;
  return `<img src="${escHtml(image)}" alt="" width="32" height="32" style="object-fit:contain;vertical-align:middle" loading="lazy" decoding="async" onerror="${escHtml(onerror)}">`;
}
