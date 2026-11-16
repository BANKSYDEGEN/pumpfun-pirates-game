// Bound render-target allocations independently of CSS size / Windows display scaling.
// This affects resolution and AA only: never island geometry, locked NFT traits or gameplay.
// [sharp] t2514u: cap is 2× on every tier (was 1.5 on non-ULTRA). The pixel budget is QHD
// so a Retina laptop / 720p window can stay sharp; adaptive resolution drops it if FPS < 50.
export const PIXEL_BUDGET = { standard: 2560 * 1440, ultra: 3840 * 2160 };
export function renderPixelRatio(width, height, wanted = 1, ultra = false) {
  const w = Math.max(1, Number(width) || 1), h = Math.max(1, Number(height) || 1);
  const ratio = Math.max(0.1, Number(wanted) || 1);
  const pixels = ultra ? PIXEL_BUDGET.ultra : PIXEL_BUDGET.standard;
  return Math.min(ratio, 2, Math.sqrt(pixels / (w * h)));
}
export const sceneSamples = (ultra = false) => ultra ? 4 : 2;
