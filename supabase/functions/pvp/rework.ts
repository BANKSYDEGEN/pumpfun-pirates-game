// [v335] PUMPFUN PIRATES owner-only 🚩 REWORK flags (BANKSY t1779u / t1781u): Build Mode keeps them in pvp_terrain.pieces under '!rw_*'
// ids. Only the owner ever receives them (terrain_get strips them for everyone else) and terrain_put keeps their string fields.
export const RW_PREFIX = "!rw_";
export const RW_COLORS = ["red", "blue", "green", "gold", "purple", "orange", "cyan", "white"] as const;
export const RW_MAX_R = 160, RW_MAX_FLAGS = 300;
export const isReworkId = (id: string) => typeof id === "string" && id.startsWith(RW_PREFIX);
const num = (x: unknown, lim: number) => Math.max(-lim, Math.min(lim, Math.round((Number(x) || 0) * 100) / 100));
const str = (x: unknown, n: number) => String(x ?? "").replace(/[\u0000-\u001f<>]/g, "").slice(0, n);
/** one sanitized flag record, or null when the id / record is not a valid flag */
export function cleanRework(id: string, v: any): Record<string, number | string> | null {
  if (!/^!rw_[a-z0-9]{4,24}$/.test(id) || !v || typeof v !== "object" || !v.rework) return null;
  const color = (RW_COLORS as readonly string[]).includes(v.color) ? v.color : "red";
  return { rework: 1, num: Math.max(1, Math.min(9999, Math.round(Number(v.num) || 1))), x: num(v.x, 1500), y: num(v.y, 300), z: num(v.z, 1500), lx: num(v.lx, 3000), lz: num(v.lz, 3000),
    r: Math.max(0, Math.min(RW_MAX_R, Math.round(Number(v.r) || 0))), note: str(v.note, 140), part: str(v.part, 60), partId: str(v.partId, 160), at: Math.max(0, Math.round(Number(v.at) || 0)), color };
}
/** what a non-owner may see: every piece except the flags */
export function stripRework(pieces: Record<string, any> | null | undefined): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [id, v] of Object.entries(pieces || {})) if (!isReworkId(id) && !(v && typeof v === "object" && v.rework)) out[id] = v;
  return out;
}
