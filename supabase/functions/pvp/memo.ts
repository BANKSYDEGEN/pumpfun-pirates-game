// [cache-queue] BANKSY t2486u "Do 4 and 5 rn" (capacity review fix 4): per-isolate TTL memo for SHARED reads (the same answer for
// every player: the kills board, the island Wanted / Coliseum board, the public island terrain). Many players inside one TTL = one
// DB read; concurrent misses share one in-flight read; a failed read is never cached (the next call retries). Real rows only.
export type Memo<T> = { get(key: string, load: () => Promise<T>): Promise<T>; drop(key?: string): void; size(): number };
export function ttlMemo<T>(ttlMs: number, { clock = () => Date.now(), max = 32 } = {}): Memo<T> {
  const hit = new Map<string, { at: number; v: T }>(), flying = new Map<string, Promise<T>>();
  return {
    async get(key, load) {
      const h = hit.get(key); if (h && clock() - h.at < ttlMs) return h.v;
      const f = flying.get(key); if (f) return f;
      const p = (async () => { const v = await load(); if (hit.size >= max) hit.delete(hit.keys().next().value as string); hit.set(key, { at: clock(), v }); return v; })()
        .finally(() => flying.delete(key));
      flying.set(key, p); return p;
    },
    drop(key) { if (key == null) hit.clear(); else hit.delete(key); },
    size: () => hit.size,
  };
}
// short content tag for "has it changed?" checks (terrain_get `have`): first 32 hex of SHA-256
export async function etagOf(s: string) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].slice(0, 16).map((x) => x.toString(16).padStart(2, "0")).join(""); }
export const BOARD_TTL_MS = 30_000, ISLAND_BOARD_TTL_MS = 5_000, TERRAIN_TTL_MS = 30_000;
// the public (non-owner) island terrain answer: body + its etag. terrain_put and admin world writes drop it in their isolate;
// other isolates pick a change up within TERRAIN_TTL_MS.
export type TerrainPub = { body: string; etag: string; rev: number };
export const terrainMemo = ttlMemo<TerrainPub>(TERRAIN_TTL_MS, { max: 1 });
