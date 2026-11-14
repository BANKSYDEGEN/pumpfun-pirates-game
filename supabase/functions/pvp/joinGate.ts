// [join-queue] BANKSY t2505u: extend the v577 SEAS ARE CROWDED gate with a single
// world_cap, a place in line, and an owner (BANKSY) bypass. SQL: pvp_join_gate.
export const JOIN_GATE_ACTION = "join_gate";
export const JOIN_OPS = new Set(["poll", "beat", "leave"]);

export function joinOp(raw: unknown): "poll" | "beat" | "leave" {
  const op = String(raw || "poll");
  return (JOIN_OPS.has(op) ? op : "poll") as "poll" | "beat" | "leave";
}

export async function joinGateAction(
  c: { db: any; whoAmI: (b: Record<string, unknown>) => Promise<{ pid: string; owner?: boolean } | null>; json: (s: number, o: unknown) => Response },
  b: Record<string, unknown>,
): Promise<Response> {
  const { db, json } = c;
  const who = await c.whoAmI(b);
  if (!who) return json(401, { error: "no identity" });
  const op = joinOp(b.op);
  const { data: okRate } = await db.rpc("pvp_rl_hit", { p_key: "join_gate:" + who.pid, p_window_s: 60, p_max: 20 });
  if (okRate === false) return json(429, { ok: false, why: "slow down" });
  const { data, error } = await db.rpc("pvp_join_gate", { p_pid: who.pid, p_op: op, p_owner: !!who.owner });
  if (error) return json(500, { error: "join gate busy" });
  const body = (data && typeof data === "object") ? data as Record<string, unknown> : { ok: false };
  return json(200, { ...body, ok: body.ok !== false, owner: !!who.owner });
}
