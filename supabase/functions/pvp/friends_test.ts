// [v356 friends] deno test supabase/functions/pvp/friends_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { cleanAt, friendView, friendAction, FRIEND_ACTIONS } from "./friends.ts";

const json = (status: number, body: unknown) => ({ status, body }) as any;
function fakeDb(opts: { rl?: boolean; op?: (a: any) => any } = {}) {
  const calls: any[] = [];
  return { calls, rpc: (fn: string, args: any) => { calls.push([fn, args]); if (fn === "pvp_rl_hit") return Promise.resolve({ data: opts.rl ?? true });
    if (fn === "pvp_friend_seen") return Promise.resolve({ data: null }); return Promise.resolve({ data: opts.op ? opts.op(args) : { ok: true } }); } };
}
const who = (pid: string | null) => async () => (pid ? { pid } : null);

Deno.test("friends: cleanAt keeps only known places; harbor prefix/copy validated", () => {
  assertEquals(cleanAt(null), null);
  assertEquals(cleanAt({ w: "moon" }), null);
  assertEquals(cleanAt({ w: "off" }), { w: "off", prefix: null, copy: null, mode: null });
  assertEquals(cleanAt({ w: "harbor", prefix: "pfp-harbor", copy: 3 }), { w: "harbor", prefix: "pfp-harbor", copy: 3, mode: null });
  assertEquals(cleanAt({ w: "harbor", prefix: "PFP-HARBOR-K7P9Q", copy: 1 })?.prefix, "pfp-harbor-k7p9q");
  assertEquals(cleanAt({ w: "harbor", prefix: "evil'; drop", copy: 999 }), { w: "harbor", prefix: "pfp-harbor", copy: 0, mode: null });
  assertEquals(cleanAt({ w: "arena", mode: "squads", prefix: "pfp-harbor", copy: 2 }), { w: "arena", prefix: null, copy: null, mode: "squads" });
});
Deno.test("friends: friendView shapes a row (full / own code / offline hides where)", () => {
  assertEquals(friendView({ n: "Anne", on: true, w: "harbor", prefix: "pfp-harbor", copy: 2, room_n: 3 }), { n: "Anne", on: true, w: "harbor", copy: 2, code: "", room_n: 3, cap: 8, full: false });
  assertEquals(friendView({ n: "Bo", on: true, w: "harbor", prefix: "pfp-harbor-k7p9q", copy: 1, room_n: 8 })?.full, true);
  assertEquals(friendView({ n: "Bo", on: true, w: "harbor", prefix: "pfp-harbor-k7p9q", copy: 1, room_n: 1 })?.code, "K7P9Q");
  assertEquals(friendView({ n: "Cal", on: false, w: "harbor", prefix: "pfp-harbor", copy: 2 }), { n: "Cal", on: false, w: "off" });
  assertEquals(friendView({ n: "Dee", on: true, w: "arena", mode: "solo" }), { n: "Dee", on: true, w: "arena", mode: "solo" });
  assertEquals(friendView({ n: "<>", on: true, w: "arena" }), null);
});
Deno.test("friends: no identity -> 401; rate limited -> 429; identity is never client-typed", async () => {
  assertEquals((await friendAction({ db: fakeDb(), whoAmI: who(null), json }, "fr_list", {}) as any).status, 401);
  assertEquals((await friendAction({ db: fakeDb({ rl: false }), whoAmI: who("dev:me"), json }, "fr_request", { name: "Anne" }) as any).status, 429);
  const db = fakeDb({ op: () => ({ ok: true, state: "sent", name: "Anne" }) });
  const r: any = await friendAction({ db, whoAmI: who("dev:me"), json }, "fr_request", { name: "Anne", p_player: "dev:victim", pid: "dev:victim" });
  assertEquals(r.body, { ok: true, state: "sent", name: "Anne" });
  const call = db.calls.find((c: any) => c[0] === "pvp_friend_op");
  assertEquals(call[1].p_player, "dev:me"); assertEquals(call[1].p_op, "request"); assertEquals(call[1].p_name, "Anne");
});
Deno.test("friends: fr_list writes my presence then returns friends only (no ids)", async () => {
  const db = fakeDb({ op: () => ({ ok: true, me: "Me", friends: [{ n: "Anne", on: true, w: "harbor", prefix: "pfp-harbor", copy: 1, room_n: 2, id: "dev:x" }], incoming: ["Bo"], outgoing: [] }) });
  const r: any = await friendAction({ db, whoAmI: who("dev:me"), json }, "fr_list", { at: { w: "harbor", prefix: "pfp-harbor", copy: 1 } });
  assertEquals(db.calls[1], ["pvp_friend_seen", { p_player: "dev:me", p_w: "harbor", p_prefix: "pfp-harbor", p_copy: 1, p_mode: null }]);
  assertEquals(r.body, { ok: true, me: "Me", friends: [{ n: "Anne", on: true, w: "harbor", copy: 1, code: "", room_n: 2, cap: 8, full: false }], incoming: ["Bo"], outgoing: [] });
});
Deno.test("friends: respond passes accept only when true; empty name refused", async () => {
  const db = fakeDb({ op: (a) => ({ ok: true, state: a.p_accept ? "friends" : "declined", name: "Bo" }) });
  assertEquals((await friendAction({ db, whoAmI: who("dev:me"), json }, "fr_respond", { name: "Bo", accept: "yes" }) as any).body.state, "declined");
  assertEquals((await friendAction({ db, whoAmI: who("dev:me"), json }, "fr_respond", { name: "Bo", accept: true }) as any).body.state, "friends");
  assertEquals((await friendAction({ db, whoAmI: who("dev:me"), json }, "fr_remove", { name: "" }) as any).status, 400);
  assertEquals(FRIEND_ACTIONS.length, 6);
});
Deno.test("friends: a pirate with no board row claims their free display name once (never a rename)", async () => {
  const calls: any[] = []; let listed = 0;
  const db: any = { calls, rpc: (fn: string, args: any) => { calls.push([fn, args]); if (fn === "pvp_rl_hit") return Promise.resolve({ data: true }); if (fn === "pvp_name_free") return Promise.resolve({ data: args.p_name === "FreeName" });
      if (fn === "pvp_friend_op") { listed++; return Promise.resolve({ data: { ok: true, me: listed > 1 && calls.some((c) => c[0] === "insert") ? "FreeName" : "", friends: [], incoming: [], outgoing: [] } }); } return Promise.resolve({ data: null }); },
    from: (t: string) => ({ insert: (row: any) => { calls.push(["insert", t, row.id, row.name]); return Promise.resolve({ error: null }); } }) };
  const r: any = await friendAction({ db, whoAmI: async () => ({ pid: "dev:0123456789abcdef01234567", raw: "dev:0123456789abcdef01234567", wallet: null }), json }, "fr_list", { name: "FreeName" });
  assertEquals(r.body.me, "FreeName"); assertEquals(calls.filter((c) => c[0] === "insert"), [["insert", "pvp_players", "dev:0123456789abcdef01234567", "FreeName"]]);
  const r2: any = await friendAction({ db: { ...db, rpc: (fn: string, a: any) => fn === "pvp_friend_op" ? Promise.resolve({ data: { ok: true, me: "", friends: [], incoming: [], outgoing: [] } }) : db.rpc(fn, a) }, whoAmI: async () => ({ pid: "dev:0123456789abcdef01234567" }), json }, "fr_list", { name: "Taken" });
  assertEquals(r2.body.me, ""); // name not free: nothing inserted
});
