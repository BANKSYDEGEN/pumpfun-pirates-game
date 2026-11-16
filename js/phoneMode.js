// [phone-mode] BANKSY t2514u "Want smooth fast with sharp graphics": AUTO on iPhone /
// low-mem mobile stays sharp (high-DPI up to 2×, native textures / UI). Smoothness and
// crash safety come from cheaper shadows, draw distance, LOD, particles / water, no MSAA
// at high DPR, and a brief adaptive dip if FPS falls below ~50. A saved or ?quality=
// override still wins. Adaptive resolution is used on every device (PC stays maxed when it can).
export function wantPhoneMode({
  ua = '',
  deviceMemory,
  isMobile = false,
  isConsole = false,
  maxTouchPoints = 0,
} = {}) {
  if (isConsole) return false;
  const iphone = /iPhone|iPod/i.test(ua);
  // iPadOS 13+ often reports as Macintosh with a touch screen; same Safari WebKit crash class.
  const ipad = /iPad/i.test(ua) || (/\bMacintosh\b/i.test(ua) && maxTouchPoints > 1);
  const lowMem = !!isMobile && deviceMemory != null && Number(deviceMemory) > 0 && Number(deviceMemory) <= 4;
  return !!(iphone || (isMobile && ipad) || lowMem);
}

// High-DPI cap: keep Retina sharpness (up to 2×). Never the old 1× framebuffer.
export function phonePixelCap(dpr = 1, max = 2) {
  const d = Math.max(0.1, Number(dpr) || 1);
  const cap = Math.max(1, Number(max) || 2);
  return Math.min(d, cap);
}

// Shared flags main.js sets at boot so island / kit loaders can keep native textures
// while still using a cheaper draw / LOD budget on phone AUTO.
export const gfxFlags = { phoneMode: false, nativeTex: false, lodBias: 1 };

export function adaptPlan(pr0, { minFps = 50 } = {}) {
  const p = Math.max(0.1, Number(pr0) || 1);
  const steps = [2, 1.75, 1.5, 1.25].filter((s) => s <= p + 0.001);
  if (steps.every((s) => Math.abs(s - p) > 0.01) && p > 1) steps.unshift(+p.toFixed(3));
  steps.sort((a, b) => b - a);
  if (!steps.length) steps.push(p < 1 ? +p.toFixed(3) : 1.25);
  return {
    on: true,
    steps,
    min: minFps,
    upFps: 55,
    downWindows: 2,
    upWindows: 3,
    upWaitMs: 4000,
    warmMs: 8000,
    windowMs: 2000,
  };
}
