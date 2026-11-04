// [Timothy] PUMPFUN PIRATES · musket aim (PC point and click, phone over the shoulder), the pure numbers (no three.js, node-tested: tests/tps.test.mjs).
// js/onfoot/tps.js does the camera, input + HUD; this file only holds the tuning and the maths it uses.
export const TPS = {
  side: 0.95, up: 0.5, dist: 3.4, distAds: 2.5, head: 1.55,        // phone over-the-shoulder camera (m): right of / above the head, behind it
  zoom: 1.5,                                                            // ADS 1.5x (phone: camera.zoom, PC: a view offset toward the cursor; the FOV untouched for main.js resize + the sprint push)
  adsMove: 0.5,                                                         // ADS: half walk speed, no sprint
  pitch: [-1.05, 1.0],                                                  // look down / up (rad)
  sensTouch: 0.0062, adsSens: 0.62,                                     // phone look: rad per px at 100 %, x0.62 while aiming
  spread: { hip: 1.3, ads: 0.35, move: 2.2, air: 2.4, kick: 1.6, rec: 7 }, // crosshair bloom in degrees + how fast it settles (per s)
  recoil: { kick: 0.055, rec: 9 },                                      // phone camera kick (rad up) per shot + recovery (per s)
  assist: { cone: 4.5, k: 0.42 },                                       // phone only: look slows to 42 % inside a 4.5 deg cone round a target
  range: 60,                                                            // the musket's reach (ARENA.musket.range): the aim ray goes this far
};
export const SENS_KEY = 'pfp_aim_sens';
// the kill switch: &tps=0 (or ?tps=0) in the URL = the old camera + aim
export const tpsOn = (search = '') => !/[?&]tps=0(&|$)/.test(String(search));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// saved sensitivity (percent, 20 - 300, default 100) -> multiplier
export function sensLoad(store) { let v = 100; try { v = +(store?.getItem(SENS_KEY) ?? 100); } catch {} return clamp(Number.isFinite(v) && v > 0 ? v : 100, 20, 300) / 100; }
export function sensSave(store, mult) { const p = Math.round(clamp(mult * 100, 20, 300)); try { store?.setItem(SENS_KEY, String(p)); } catch {} return p / 100; }
// target bloom (deg): moving opens it, ADS / standing still closes it
export function spreadTarget({ speed = 0, walk = 4.2, air = false, ads = 0 }) { const S = TPS.spread, m = clamp(speed / walk, 0, 1.6) / 1.6;
  const hip = S.hip + S.move * m + (air ? S.air : 0); return hip + (S.ads + S.move * 0.25 * m + (air ? S.air * 0.5 : 0) - hip) * clamp(ads, 0, 1); }
// the part of the bloom that really moves the ball: none standing still / aiming, only the extra from moving or jumping
export function spreadReal(spreadDeg, ads = 0) { const still = TPS.spread.hip + (TPS.spread.ads - TPS.spread.hip) * clamp(ads, 0, 1); return Math.max(0, spreadDeg - still); }
// eased step of a value toward a target (rate per second)
export const approach = (v, to, rate, dt) => v + (to - v) * Math.min(1, dt * rate);
// camera basis from yaw / pitch (the walker's camYaw convention: yaw 0 looks along +z)
export function aimDir(yaw, pitch) { const c = Math.cos(pitch); return [Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c]; }
export function rightOf(yaw) { return [-Math.cos(yaw), 0, Math.sin(yaw)]; }
// where the camera wants to be: head + shoulder offset (side = +1 right / -1 left, eased) - dir * dist
export function shoulderCam(px, py, pz, yaw, pitch, side, ads) { const d = aimDir(yaw, pitch), r = rightOf(yaw), dist = TPS.dist + (TPS.distAds - TPS.dist) * ads, hy = py + TPS.head + TPS.up;
  return [px + r[0] * TPS.side * side - d[0] * dist, hy - d[1] * dist, pz + r[2] * TPS.side * side - d[2] * dist]; }
// the yaw to fire along so the ball's line (it starts at your feet x, z) crosses the aim point
export const yawTo = (x, z, ax, az) => Math.atan2(ax - x, az - z);
// angle (deg) between a direction and the line from o to p
export function angleTo(o, dir, p) { const v = [p[0] - o[0], p[1] - o[1], p[2] - o[2]], l = Math.hypot(...v) || 1; return Math.acos(clamp((v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2]) / l, -1, 1)) * 180 / Math.PI; }
// ray (o + t dir) vs a sphere (c, r): nearest t >= 0 or -1
export function raySphere(o, d, c, r) { const ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2], b = ox * d[0] + oy * d[1] + oz * d[2], cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc;
  if (h < 0) return -1; const s = Math.sqrt(h), t0 = -b - s, t1 = -b + s; return t0 >= 0 ? t0 : t1 >= 0 ? t1 : -1; }
// ray vs an upright cylinder (x, z, radius, y0..y1): nearest t >= 0 or -1
export function rayCyl(o, d, cx, cz, r, y0, y1) { const ox = o[0] - cx, oz = o[2] - cz, a = d[0] * d[0] + d[2] * d[2]; if (a < 1e-9) return -1;
  const b = ox * d[0] + oz * d[2], c = ox * ox + oz * oz - r * r, h = b * b - a * c; if (h < 0) return -1; const s = Math.sqrt(h);
  for (const t of [(-b - s) / a, (-b + s) / a]) { if (t < 0) continue; const y = o[1] + d[1] * t; if (y >= y0 && y <= y1) return t; } return -1; }
// crosshair gap in CSS px for a bloom angle (deg) at a vertical FOV (deg) + zoom
export function spreadPx(deg, fovDeg, zoom, viewH) { const half = Math.atan(Math.tan(fovDeg * Math.PI / 360) / Math.max(0.01, zoom)); return Math.tan(deg * Math.PI / 180) / Math.tan(half) * viewH / 2; }
// PC zoom toward the cursor: the window [x, y, w, h] of a full W x H frame, zoomed z x, that keeps the anchor (ax, ay) on the same screen spot
export const zoomWindow = (ax, ay, W, H, z) => [ax - ax / z, ay - ay / z, W / z, H / z];
