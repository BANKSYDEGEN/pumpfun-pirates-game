import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { joinOp, JOIN_GATE_ACTION, JOIN_OPS, joinGateAction } from "./joinGate.ts";

Deno.test("joinOp: only poll / beat / leave, default poll", () => {
  assertEquals(JOIN_GATE_ACTION, "join_gate");
  assertEquals([...JOIN_OPS].sort(), ["beat", "leave", "poll"]);
  assertEquals(joinOp("poll"), "poll");
  assertEquals(joinOp("beat"), "beat");
  assertEquals(joinOp("leave"), "leave");
  assertEquals(joinOp(""), "poll");
  assertEquals(joinOp("DROP"), "poll");
  assertEquals(joinOp(null), "poll");
});

Deno.test("joinGateAction: 401 without identity; owner flag and op forwarded; 429 on rate limit; 500 on rpc error", async () => {
  const json = (s: number, o: unknown) => new Response(JSON.stringify(o), { status: s });
  const noWho = await joinGateAction({ db: {}, whoAmI: async () => null, json }, { op: "poll" });
  assertEquals(noWho.status, 401);

  let saw: { name: string; args: Record<string, unknown> } | null = null;
  const dbOk = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === "pvp_rl_hit") return { data: true };
      saw = { name, args };
      return { data: { ok: true, state: "wait", cap: 120, in_world: 120, queue: 2, pos: 2, ahead: 1 } };
    },
  };
  const r = await joinGateAction({ db: dbOk, whoAmI: async () => ({ pid: "p1", owner: false }), json }, { op: "poll" });
  assertEquals(r.status, 200);
  const body = await r.json();
  assertEquals(body.state, "wait");
  assertEquals(body.pos, 2);
  assertEquals(body.cap, 120);
  assertEquals(body.owner, false);
  assertEquals(saw?.name, "pvp_join_gate");
  assertEquals(saw?.args, { p_pid: "p1", p_op: "poll", p_owner: false });

  const ownerDb = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === "pvp_rl_hit") return { data: true };
      assertEquals(args.p_owner, true);
      assertEquals(args.p_op, "beat");
      return { data: { ok: true, state: "enter", cap: 120, in_world: 121, pos: 0 } };
    },
  };
  const o = await joinGateAction({ db: ownerDb, whoAmI: async () => ({ pid: "banksy", owner: true }), json }, { op: "beat" });
  assertEquals((await o.json()).state, "enter");

  const rl = { rpc: async () => ({ data: false }) };
  assertEquals((await joinGateAction({ db: rl, whoAmI: async () => ({ pid: "p1" }), json }, {})).status, 429);

  const bad = { rpc: async (name: string) => name === "pvp_rl_hit" ? { data: true } : { error: { message: "boom" } } };
  assertEquals((await joinGateAction({ db: bad, whoAmI: async () => ({ pid: "p1" }), json }, {})).status, 500);
});
