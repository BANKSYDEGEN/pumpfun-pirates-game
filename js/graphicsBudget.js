// Bound render-target allocations independently of CSS size / Windows display scaling.
// This affects resolution and AA only: never island geometry, locked NFT traits or gameplay.
export function renderPixelRatio(width, height, wanted = 1, ultra = false) {
  const w = Math.max(1, Number(width) || 1), h = Math.max(1, Number(height) || 1);
  const ratio = Math.max(0.1, Number(wanted) || 1);
  const pixels = ultra ? 3840 * 2160 : 1920 * 1080;
  return Math.min(ratio, ultra ? 2 : 1.5, Math.sqrt(pixels / (w * h)));
}
export const sceneSamples = (ultra = false) => ultra ? 4 : 2;
