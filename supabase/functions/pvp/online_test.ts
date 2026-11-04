// [give-dropdown] deno test supabase/functions/pvp/online_test.ts : the GIVE picker's online list
import { assertEquals } from "jsr:@std/assert@1";
import { onlineNames, giftable, cleanName, onlineAction } from "./online.ts";
const NOW = Date.parse("2026-11-04T22:00:00Z"), ago = (s: number) => new Date(NOW - s * 1000).toISOString();
Deno.test("online: harbor + arena merged, fresh only, harbor wins, PIRATE + blanks dropped, names cleaned", () => {
  const l = onlineNames([{ name: "Blackbeard", seen: ago(3) }, { name: "PIRATE", seen: ago(1) }, { name: "old", seen: ago(90) }, { name: "<b>Anne</b>", seen: ago(2) }],
    [{ name: "blackbeard", seen: ago(1) }, { name: "Calico", seen: ago(5) }, { name: "", seen: ago(1) }], NOW);
  assertEquals(l, [{ n: "Blackbeard", w: "harbor" }, { n: "bAnne/b", w: "harbor" }, { n: "Calico", w: "arena" }]);
  assertEquals(cleanName("  Jack\u0000 Sparrow the Magnificent  "), "Jack Sparrow the Mag");
});
Deno.test("online: only names one registered pirate holds, A-Z", () => {
  const l = [{ n: "zed", w: "arena" }, { n: "Anne", w: "harbor" }, { n: "Twin", w: "harbor" }, { n: "ghost", w: "arena" }];
  assertEquals(giftable(l, [{ name: "zed" }, { name: "Anne" }, { name: "Twin" }, { name: "Twin" }]), [{ n: "Anne", w: "harbor" }, { n: "zed", w: "arena" }]);
});
Deno.test("online action: rate limited, names only (no ids / seats / times)", async () => {
  const q = (rows: unknown[]) => { const o: any = { select: () => o, gt: () => o, in: () => o, limit: () => Promise.resolve({ data: rows }) }; return o; };
  const db = (rl: boolean) => ({ rpc: () => Promise.resolve({ data: rl }), from: (t: string) => q(t === "pvp_harbor_seats" ? [{ name: "Anne", seen: new Date().toISOString(), seat: "s1" }] : t === "pvp_seats" ? [{ name: "Bo", seen: new Date().toISOString() }] : [{ name: "Anne" }, { name: "Bo" }]) });
  assertEquals(await onlineAction(db(true), "dev:x"), { ok: true, players: [{ n: "Anne", w: "harbor" }, { n: "Bo", w: "arena" }] });
  assertEquals(await onlineAction(db(false), "dev:x"), { ok: false, why: "slow down" });
});
