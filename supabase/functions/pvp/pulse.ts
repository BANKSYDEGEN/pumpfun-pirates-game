// [scale-free] One invocation for the background polls (fr_list + squad_invites + optional
// admin_register_net + due walk XP). Each sub-action keeps its own rate limit and response shape.
import { friendAction } from "./friends.ts";
import { squadAction } from "./squad.ts";
import { adminAction } from "./admin.ts";
import { petAction } from "./pets.ts";

export const PULSE_ACTION = "pulse";
const WALK_ACTIONS = new Set(["pet_walk", "parrot_walk", "pilly_walk"]);

export function pulseWalks(raw: unknown): { action: string; pet?: string; id?: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { action: string; pet?: string; id?: string }[] = [];
  for (const w of raw) {
    if (!w || typeof w !== "object") continue;
    const action = String((w as { action?: unknown }).action || "");
    if (action === "pet_walk") {
      const pet = (w as { pet?: unknown }).pet;
      if (typeof pet === "string" && pet) out.push({ action, pet });
    } else if (WALK_ACTIONS.has(action)) out.push({ action });
  }
  return out.slice(0, 3);
}

async function bodyOf(res: Response): Promise<Record<string, unknown>> {
  try { const j = await res.json(); return (j && typeof j === "object") ? j as Record<string, unknown> : { ok: false }; }
  catch { return { ok: false }; }
}

export async function pulseAction(
  c: { db: any; whoAmI: (b: Record<string, unknown>) => Promise<{ pid: string; raw?: string; wallet?: string | null; owner?: boolean } | null>; json: (s: number, o: unknown) => Response },
  b: Record<string, unknown>,
): Promise<Response> {
  const { db, json } = c;
  const who = await c.whoAmI(b);
  if (!who) return json(401, { error: "no identity" });
  const { data: okRate } = await db.rpc("pvp_rl_hit", { p_key: "pulse:" + who.pid, p_window_s: 60, p_max: 20 });
  if (okRate === false) return json(429, { ok: false, why: "slow down" });
  // [join-queue] refresh the in-world lease so occupancy stays accurate (ignore errors if the RPC is not deployed yet)
  try { await db.rpc("pvp_join_gate", { p_pid: who.pid, p_op: "beat", p_owner: !!who.owner }); } catch { /* old DB */ }

  const walksIn = pulseWalks(b.walks);
  let fr: Record<string, unknown> | null = null;
  let invites: Record<string, unknown> | null = null;
  let admin: Record<string, unknown> | null = null;
  const walks: Record<string, unknown> = {};

  const jobs: Promise<void>[] = [
    friendAction(c, "fr_list", b).then(async (r) => { fr = await bodyOf(r); }),
    (async () => {
      const { data: me } = await db.from("pvp_players").select("name").eq("id", who.pid).maybeSingle();
      invites = await squadAction(db, who.pid, me?.name || "", "squad_invites", b);
    })(),
  ];
  if (typeof b.net_id === "string" && b.net_id) {
    jobs.push(adminAction(c, "admin_register_net", b).then(async (r) => { admin = await bodyOf(r); }));
  }
  for (const w of walksIn) {
    jobs.push(petAction(c, w.action, { ...b, ...w }).then(async (r) => { walks[w.action] = await bodyOf(r); }));
  }
  await Promise.all(jobs);
  return json(200, { ok: true, fr, invites, admin, walks });
}
