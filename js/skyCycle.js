// [v343] BANKSY t1812u–t1814u: shared-clock Caribbean day/night sky cycle.
// Every pirate in Harbor sees the same sunrise / sunny day / sunset / starry night (Date.now() UTC, no net messages).
// Override: ?sky=sunny|sunrise|sunset|night|storm|auto  OR  sky.setPhase(...) / window.__pfpSkyPhase

export const SKY_CYCLE_S = 1200; // 20-minute full day

const PHASE_ALIAS = {
  auto: null, sunny: 0.50, noon: 0.50, day: 0.50,
  sunrise: 0.26, dawn: 0.20, sunset: 0.74, dusk: 0.80,
  night: 0.92, midnight: 0.0, storm: 'storm', // [v345] 0.92 keeps moon mid-sky (not zenith-only)
};

let forcedPhase = null; // number 0..1 OR 'storm' OR null (auto clock)
let forcedStorm = null; // number 0..1 OR null

function readQuery() {
  try {
    if (typeof location === 'undefined') return null;
    const q = new URLSearchParams(location.search).get('sky');
    if (!q) return null;
    const key = String(q).toLowerCase();
    if (key in PHASE_ALIAS) return PHASE_ALIAS[key];
    const n = Number(q);
    return Number.isFinite(n) ? ((n % 1) + 1) % 1 : null;
  } catch { return null; }
}

function readWindow() {
  try {
    if (typeof window === 'undefined') return null;
    const w = window.__pfpSkyPhase;
    if (w == null || w === '' || w === 'auto') return null;
    if (typeof w === 'number' && Number.isFinite(w)) return ((w % 1) + 1) % 1;
    const key = String(w).toLowerCase();
    if (key in PHASE_ALIAS) return PHASE_ALIAS[key];
    const n = Number(w);
    return Number.isFinite(n) ? ((n % 1) + 1) % 1 : null;
  } catch { return null; }
}

/** Deterministic shared-clock phase in [0,1). phase 0 = midnight, 0.25 ≈ sunrise, 0.5 = noon, 0.75 ≈ sunset. */
export function skyPhase(nowMs = Date.now()) {
  const ov = forcedPhase != null ? forcedPhase : (readWindow() ?? readQuery());
  if (ov === 'storm') return 0.5; // noon colors under storm override; storm factor handled separately
  if (typeof ov === 'number' && Number.isFinite(ov)) return ((ov % 1) + 1) % 1;
  return (((nowMs / 1000) / SKY_CYCLE_S) % 1 + 1) % 1;
}

export function setPhase(p) {
  if (p == null || p === 'auto') { forcedPhase = null; forcedStorm = null; return; }
  if (typeof p === 'string') {
    const key = p.toLowerCase();
    if (key === 'storm') { forcedPhase = 'storm'; forcedStorm = 1; return; }
    if (key in PHASE_ALIAS) { forcedPhase = PHASE_ALIAS[key]; forcedStorm = null; return; }
  }
  const n = Number(p);
  if (Number.isFinite(n)) { forcedPhase = ((n % 1) + 1) % 1; forcedStorm = null; }
}

export function clearPhase() { forcedPhase = null; forcedStorm = null; }

export function isStormForced() {
  if (forcedStorm != null) return forcedStorm;
  try {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('sky') : null;
    if (String(q || '').toLowerCase() === 'storm') return 1;
    if (typeof window !== 'undefined' && String(window.__pfpSkyPhase || '').toLowerCase() === 'storm') return 1;
  } catch {}
  return null;
}

/** Named visual bucket for tests / UI. */
export function phaseName(phase) {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.12 || p >= 0.88) return 'night';
  if (p < 0.30) return 'sunrise';
  if (p < 0.62) return 'sunny';
  if (p < 0.88) return 'sunset';
  return 'night';
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }

/** Sun elevation in [-1,1]: 0 at sunrise/sunset, +1 noon, -1 midnight. */
export function sunElevation(phase) {
  return Math.sin((phase - 0.25) * Math.PI * 2);
}

/** Unit sun direction (y up). Azimuth sweeps E→S→W across the day. */
export function sunDir(phase, out = { x: 0, y: 1, z: 0 }) {
  const elev = sunElevation(phase);
  const az = (phase - 0.25) * Math.PI * 2; // 0 at sunrise → +X (east-ish), noon → +Z
  const cosE = Math.sqrt(Math.max(0, 1 - elev * elev));
  out.x = Math.sin(az) * cosE;
  out.y = elev;
  out.z = Math.cos(az) * cosE;
  const len = Math.hypot(out.x, out.y, out.z) || 1;
  out.x /= len; out.y /= len; out.z /= len;
  return out;
}

/** Moon opposite the sun arc (visible when sun is below horizon). */
export function moonDir(phase, out = { x: 0, y: 1, z: 0 }) {
  sunDir((phase + 0.5) % 1, out);
  // [v345] pitch moon into camera-friendly elevation (~0.35..0.55) so sailing players actually see it
  if (out.y > 0.55) {
    const flat = Math.hypot(out.x, out.z) || 1e-6;
    const ty = 0.45;
    const s = Math.sqrt(Math.max(1e-6, 1 - ty * ty)) / flat;
    out.x *= s; out.z *= s; out.y = ty;
  } else if (out.y > 0 && out.y < 0.28) {
    const flat = Math.hypot(out.x, out.z) || 1e-6;
    const ty = 0.35;
    const s = Math.sqrt(Math.max(1e-6, 1 - ty * ty)) / flat;
    out.x *= s; out.z *= s; out.y = ty;
  }
  const len = Math.hypot(out.x, out.y, out.z) || 1;
  out.x /= len; out.y /= len; out.z /= len;
  return out;
}

function col(r, g, b) { return { r, g, b }; }
function mixC(a, b, t) { return col(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t)); }

/**
 * Evaluate full lighting / sky state for a phase + storm factor.
 * storm 0 = fair weather day/night; storm 1 = full tempest (stars off, dark sky).
 */
export function evalSky(phase, storm = 0, nowMs = Date.now()) {
  const p = ((phase % 1) + 1) % 1;
  const st = clamp01(storm);
  const elev = sunElevation(p);
  const name = phaseName(p);
  const sd = sunDir(p);
  const md = moonDir(p);

  // dayAmount: 1 at noon, 0 deep night; twilight softens edges
  const dayAmt = smoothstep(-0.12, 0.35, elev);
  const nightAmt = 1 - smoothstep(-0.05, 0.25, elev);
  const golden = smoothstep(0.05, 0.0, Math.abs(elev) - 0.08) * smoothstep(-0.15, 0.05, elev); // near horizon, sun up
  const sunriseW = name === 'sunrise' ? 1 : (p > 0.14 && p < 0.34 ? smoothstep(0.14, 0.24, p) * smoothstep(0.34, 0.28, p) : 0);
  const sunsetW = name === 'sunset' ? 1 : (p > 0.60 && p < 0.86 ? smoothstep(0.60, 0.72, p) * smoothstep(0.86, 0.78, p) : 0);
  const goldenW = Math.max(sunriseW, sunsetW, golden * 0.85);

  // --- sky palette (linear-ish working space; renderer ACES + sRGB handles display)
  const zenithDay = col(0.22, 0.52, 0.95);      // rich azure-cobalt (ACES-bright)
  const midDay = col(0.42, 0.68, 0.98);         // cerulean
  const horizDay = col(0.48, 0.74, 0.96);       // tropical turquoise-blue haze (not washed white)

  const zenithRise = col(0.10, 0.12, 0.38);     // twilight indigo
  const midRise = col(0.42, 0.22, 0.48);        // violet / plum
  const horizRise = col(1.0, 0.52, 0.28);       // coral / tangerine

  const zenithSet = col(0.08, 0.08, 0.28);
  const midSet = col(0.48, 0.18, 0.42);         // magenta
  const horizSet = col(1.0, 0.42, 0.14);        // molten amber

  const zenithNight = col(0.008, 0.018, 0.055);  // midnight indigo / abyssal sapphire
  const midNight = col(0.03, 0.055, 0.12);
  const horizNight = col(0.06, 0.09, 0.16);

  let zenith = mixC(zenithNight, zenithDay, dayAmt);
  let mid = mixC(midNight, midDay, dayAmt);
  let horiz = mixC(horizNight, horizDay, dayAmt);
  zenith = mixC(zenith, mixC(zenithRise, zenithSet, sunsetW / Math.max(1e-6, sunriseW + sunsetW || 1)), goldenW * 0.85);
  mid = mixC(mid, mixC(midRise, midSet, sunsetW / Math.max(1e-6, sunriseW + sunsetW || 1)), goldenW);
  horiz = mixC(horiz, mixC(horizRise, horizSet, sunsetW / Math.max(1e-6, sunriseW + sunsetW || 1)), Math.min(1, goldenW * 1.15));

  // storm darkens everything toward STORM_FOG-ish
  const stormZen = col(0.012, 0.016, 0.03);
  const stormMid = col(0.05, 0.07, 0.09);
  const stormHoriz = col(0.07, 0.10, 0.13);
  zenith = mixC(zenith, stormZen, st);
  mid = mixC(mid, stormMid, st);
  horiz = mixC(horiz, stormHoriz, st);

  // sun / moon visibility
  const sunVis = clamp01(smoothstep(-0.18, 0.06, elev)) * (1 - st * 0.92);
  const moonVis = clamp01(smoothstep(0.08, -0.05, elev)) * (1 - st);
  const starVis = clamp01(nightAmt * nightAmt) * (1 - st) * (1 - dayAmt * 0.15);

  // light colors
  const sunColDay = col(1.0, 0.92, 0.78);
  const sunColGold = col(1.0, 0.62, 0.28);
  const sunCol = mixC(sunColDay, sunColGold, goldenW);
  const moonCol = col(0.72, 0.82, 0.98);

  // scene lights (readable night!)
  const sunIntensity = lerp(0.0, 2.35, clamp01(elev * 0.55 + 0.55)) * (1 - 0.55 * st) * (sunVis > 0.05 ? 1 : 0);
  // moonlight fill when sun is down — keep playable
  const moonIntensity = lerp(0, 0.72, moonVis) * (1 - st);
  const keyIntensity = Math.max(sunIntensity, moonIntensity * 0.85);
  const keyColor = sunVis > moonVis ? sunCol : moonCol;
  const keyDir = sunVis > 0.15 ? sd : md;

  const hemiSky = mixC(col(0.35, 0.45, 0.7), col(0.55, 0.72, 0.95), dayAmt);
  const hemiSkyN = col(0.18, 0.28, 0.48);
  const hemiGnd = mixC(col(0.08, 0.12, 0.14), col(0.22, 0.28, 0.22), dayAmt);
  const hemiSkyF = mixC(mixC(hemiSkyN, hemiSky, dayAmt), col(0.25, 0.32, 0.4), st);
  const hemiIntensity = lerp(0.55, 1.95, dayAmt) * (1 - 0.35 * st) + moonVis * 0.35;

  // fog / horizon match sky horizon
  const fogDens = (0.0007 + 0.0014 * (1 - dayAmt) + 0.0020 * st); // [v344] very light day fog so blue sky reads

  // cloud warmth (sunlit undersides at golden hour)
  const cloudWarm = goldenW * (1 - st);

  // rain only when storming
  const rainAlpha = st < 0.25 ? 0 : (0.05 + 0.40 * smoothstep(0.25, 1, st));

  return {
    phase: p, name, storm: st, elev, dayAmt, nightAmt, goldenW, sunriseW, sunsetW,
    sunDir: { ...sd }, moonDir: { ...md },
    sunVis, moonVis, starVis, cloudWarm, rainAlpha,
    zenith, mid, horiz,
    sunColor: sunCol, moonColor: moonCol,
    keyDir: { ...keyDir }, keyColor, keyIntensity: keyIntensity || (moonVis > 0.2 ? moonIntensity : 0.15),
    hemiSky: hemiSkyF, hemiGround: hemiGnd, hemiIntensity,
    fogColor: horiz, fogDensity: fogDens,
    exposure: lerp(0.92, 1.28, dayAmt) * (1 - 0.08 * st),
    nowMs,
  };
}

/** Convenience: evaluate from clock (+ optional storm). */
export function evalSkyNow(storm = 0, nowMs = Date.now()) {
  const forced = isStormForced();
  const st = forced != null ? forced : storm;
  return evalSky(skyPhase(nowMs), st, nowMs);
}

export const skyCycle = {
  SKY_CYCLE_S, skyPhase, setPhase, clearPhase, phaseName, sunElevation, sunDir, moonDir,
  evalSky, evalSkyNow, isStormForced,
};

export default skyCycle;
