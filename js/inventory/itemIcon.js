// Optional real item artwork; text-only controls keep the catalog's emoji.
import { escHtml } from '../safe.js';
export function itemIconHtml(info = {}, fallback = '❔') {
  const emoji = info.icon || fallback;
  if (!info.iconImage) return escHtml(emoji);
  const onerror = `this.replaceWith(document.createTextNode(${JSON.stringify(emoji)}))`;
  return `<img src="${escHtml(info.iconImage)}" alt="" width="32" height="32" style="object-fit:contain;vertical-align:middle" decoding="async" onerror="${escHtml(onerror)}">`;
}
