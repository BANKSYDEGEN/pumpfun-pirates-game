// [squad-hall] deno test supabase/functions/pvp/squad_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { squadAction } from "./squad.ts";

function mockDb({ rl = true, reg = [{ name: "Anne" }], pending = 0, invites = [] as any[] } = {}) {
  const rows = { invites: [...invites] };
  return {
    rpc: (_: string, __: any) => Promise.resolve({ data: rl }),
    from: (t: string) => {
      const api: any = {
        select: (_cols?: string, opts?: any) => {
          if (opts?.count === "exact" && opts?.head) return { eq: () => Promise.resolve({ count: pending }) };
          api._sel = true; return api;
        },
        eq: () => api,
        gt: () => api,
        order: () => api,
        limit: () => {
          if (t === "pvp_players") return Promise.resolve({ data: reg });
          if (t === "pvp_squad_invites") return Promise.resolve({ data: rows.invites });
          return Promise.resolve({ data: [] });
        },
        maybeSingle: () => Promise.resolve({ data: reg[0] || null }),
        delete: () => { api._del = true; return { lt: () => Promise.resolve({}), eq: () => ({ eq: () => ({ eq: () => Promise.resolve({}) }), }) }; },
        upsert: (row: any) => { rows.invites.push({ from_name: row.from_name, to_name: row.to_name, code: row.code, world: row.world, created: row.created }); return Promise.resolve({ error: null }); },
        lt: () => Promise.resolve({}),
      };
      // chain delete().eq().eq().eq()
      const del = () => {
        const c: any = { eq: () => c, lt: () => Promise.resolve({}) };
        c.then = undefined;
        // make final eq resolve
        let n = 0;
        c.eq = () => { n++; return n >= 3 ? Promise.resolve({}) : c; };
        return c;
      };
      api.delete = del;
      return api;
    },
  };
}

Deno.test("squad_invite: rate limit + validation + ok", async () => {
  assertEquals(await squadAction(mockDb({ rl: false }), "dev:1", "Bo", "squad_invite", { to: "Anne", code: "ABC12" }), { ok: false, why: "slow down" });
  assertEquals(await squadAction(mockDb(), "dev:1", "Bo", "squad_invite", { to: "Bo", code: "ABC12" }), { ok: false, why: "pick another pirate" });
  assertEquals(await squadAction(mockDb(), "dev:1", "Bo", "squad_invite", { to: "Anne", code: "bad" }), { ok: false, why: "bad party code" });
  assertEquals(await squadAction(mockDb({ reg: [] }), "dev:1", "Bo", "squad_invite", { to: "Anne", code: "ABC12" }), { ok: false, why: "pirate not found" });
  assertEquals(await squadAction(mockDb(), "dev:1", "Bo", "squad_invite", { to: "Anne", code: "ABC12", world: "Harbor 2" }), { ok: true });
});

Deno.test("squad_invites + ack", async () => {
  const invites = [{ from_name: "Bo", code: "ABC12", world: "Harbor 2", created: new Date().toISOString() }];
  const db = mockDb({ invites });
  const r = await squadAction(db, "dev:2", "Anne", "squad_invites", {});
  assertEquals(r.ok, true);
  assertEquals(r.invites, [{ from: "Bo", code: "ABC12", world: "Harbor 2" }]);
  assertEquals(await squadAction(db, "dev:2", "Anne", "squad_invite_ack", { from: "Bo", code: "ABC12", ok: true }), { ok: true, accepted: true });
});
