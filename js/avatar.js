// [v78] top-left player card picture. BATTLE ROYALE: rank #N (all-time kills) shows PUMPFUN PIRATES NFT #N (collection of 333,
// local 128px thumbnails in assets/nft). Rank > 333, unranked, a burnt/missing NFT or any image that fails to load shows the
// PUMPFUN PIRATES skull instead, so there's never a broken-image icon.
import { devHook } from './env.js'; // [security L] console/test hook: local dev servers only
export const NFT_MAX = 333;
export const LOGO = 'assets/skull_transparent.png';
// NFT numbers known to be burnt (fill in when the list is known); they show the skull.
export const BURNT = new Set([]);
export const nftSrc = (n) => (Number.isInteger(n) && n >= 1 && n <= NFT_MAX && !BURNT.has(n) ? `assets/nft/${n}.jpg` : null);
export function setAvatar(img, src) {
  if (!img) return;
  const logo = () => { img.onerror = null; img.classList.add('av-logo'); if (!img.src.endsWith(LOGO)) img.src = LOGO; };
  if (!src) return logo();
  img.classList.remove('av-logo'); img.onerror = logo;
  if (!img.src.endsWith(src)) img.src = src;
}
devHook('PFP_AVATAR', { setAvatar, nftSrc, BURNT, LOGO });
