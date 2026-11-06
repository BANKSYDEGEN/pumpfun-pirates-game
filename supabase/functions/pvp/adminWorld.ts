// [v346] PUMPFUN PIRATES · BANKSY t1819u "time and weather control in admin menu" + t1820u "add remove or move collisions".
// Owner-written, EVERY-player-read world overrides kept in pvp_terrain.pieces (no SQL migration):
//   '!env'        { mode: 'auto' | 'hold' | 'run', phase 0..1, t (epoch ms the RUN clock started), storm null | 0..1, bolt n, bt (epoch ms) }
//   '!col_<id>'   a blocker:   { s: 'box', x, z, w, d, yaw, y0, y1 } | { s: 'cyl', x, z, r, y0, y1 }     (foot frame, metres)
//   '!noc_<id>'   a PASS ZONE (same shapes): inside [y0, y1] nothing blocks (obstacles, slopes, rails, sea limit)
//   '!cmod_<ob>'  a built-in obstacle moved / resized / turned: { s, x, z, w, d, yaw | r }
//   '!cdel_<ob>'  a built-in obstacle removed: { d: 1 }
// Pure + erasable TS (node 24 imports it in tests/v346AdminSkyAndCollisions.test.mjs).
export const ENV_ID = "!env";
export const COL_RE = /^!col_[a-z0-9]{4,24}$/, NOC_RE = /^!noc_[a-z0-9]{4,24}$/, OB_ID_RE = /^ob_[bc]_[0-9a-z-]{1,8}_[0-9a-z-]{1,8}(_\d{1,3})?$/;
export const CMOD_RE = /^!cmod_ob_[bc]_[0-9a-z-]{1,8}_[0-9a-z-]{1,8}(_\d{1,3})?$/, CDEL_RE = /^!cdel_ob_[bc]_[0-9a-z-]{1,8}_[0-9a-z-]{1,8}(_\d{1,3})?$/;
export const WORLD_MAX = 600; // custom + edited colliders in all
export const isWorldId = (id: string) => typeof id === "string" && (id === ENV_ID || COL_RE.test(id) || NOC_RE.test(id) || CMOD_RE.test(id) || CDEL_RE.test(id));
const fin = (v: unknown, lo: number, hi: number, dflt: number, dp = 2) => { const n = Number(v); if (!Number.isFinite(n)) return dflt; const k = 10 ** dp; return Math.max(lo, Math.min(hi, Math.round(n * k) / k)); };

/** the owner's sky + weather, or null = nothing stored (everyone on the default clock) */
export function cleanEnv(v: any, now = Date.now()): Record<string, any> | null {
  if (!v || typeof v !== "object") return null;
  const mode = v.mode === "hold" || v.mode === "run" ? v.mode : "auto";
  const storm = v.storm === null || v.storm === undefined || v.storm === "auto" ? null : fin(v.storm, 0, 1, 0, 3);
  const phase = ((fin(v.phase, -10, 10, 0.5, 4) % 1) + 1) % 1;
  const t = Math.round(fin(v.t, now - 7 * 864e5, now + 60000, now, 0));
  const bolt = Math.max(0, Math.min(1e9, Math.floor(Number(v.bolt) || 0))), bt = Math.round(fin(v.bt, 0, now + 60000, 0, 0));
  return { mode, phase: Math.round(phase * 10000) / 10000, t, storm, bolt, bt };
}
/** one collider record (custom blocker / pass zone / moved built-in), or null when it isn't valid */
export function cleanShape(v: any, withY = true): Record<string, any> | null {
  if (!v || typeof v !== "object") return null;
  const s = v.s === "cyl" ? "cyl" : v.s === "box" ? "box" : null; if (!s) return null;
  const o: Record<string, any> = { s, x: fin(v.x, -1500, 1500, NaN), z: fin(v.z, -1500, 1500, NaN) };
  if (!Number.isFinite(o.x) || !Number.isFinite(o.z)) return null;
  if (s === "cyl") o.r = fin(v.r, 0.2, 60, 2); else { o.w = fin(v.w, 0.2, 120, 4); o.d = fin(v.d, 0.2, 120, 1.2); o.yaw = fin(v.yaw, -7, 7, 0, 3); }
  if (withY) { const y0 = fin(v.y0, -60, 400, 0), y1 = fin(v.y1, -60, 400, y0 + 4); o.y0 = Math.min(y0, y1); o.y1 = Math.max(y0, y1, Math.min(y0, y1) + 0.2); }
  return o;
}
/** sanitize one world piece by id; null = drop it */
export function cleanWorld(id: string, v: any, now = Date.now()): Record<string, any> | null {
  if (id === ENV_ID) return cleanEnv(v, now);
  if (COL_RE.test(id) || NOC_RE.test(id)) return cleanShape(v, true);
  if (CMOD_RE.test(id)) return cleanShape(v, false);
  if (CDEL_RE.test(id)) return v && typeof v === "object" && v.d ? { d: 1 } : null;
  return null;
}
/** the world pieces out of a full pieces object (what admin_world_get hands every pirate) */
export function worldOf(pieces: Record<string, any> | null | undefined) {
  const out: Record<string, any> = {};
  for (const [id, v] of Object.entries(pieces || {})) if (isWorldId(id) && v && typeof v === "object") out[id] = v;
  return out;
}
/** merge an owner change set { id: record | null } into the stored pieces; returns { pieces, n } or { error } */
export function mergeWorld(cur: Record<string, any> | null | undefined, set: any, now = Date.now()): { pieces?: Record<string, any>; n?: number; error?: string } {
  if (!set || typeof set !== "object" || Array.isArray(set)) return { error: "bad set" };
  const ents = Object.entries(set); if (ents.length > 200) return { error: "too many changes" };
  const pieces: Record<string, any> = { ...(cur || {}) }; let n = 0;
  for (const [id, v] of ents) { if (!isWorldId(id)) return { error: "bad id" };
    if (v === null) { delete pieces[id]; n++; continue; }
    const c = cleanWorld(id, v, now); if (!c) return { error: "bad record" }; pieces[id] = c; n++; }
  if (Object.keys(pieces).filter((k) => k !== ENV_ID && isWorldId(k)).length > WORLD_MAX) return { error: "too many colliders" };
  return { pieces, n };
}
