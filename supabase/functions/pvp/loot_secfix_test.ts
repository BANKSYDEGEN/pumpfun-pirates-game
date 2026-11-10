// [security H1/H2 2026-11-09] loot-claim rules (pure) + the real find spots
import { assert, assertEquals } from "jsr:@std/assert@1";
import { lootClaimProblem, KILLER_FIRST_S } from "./loot.ts";
import { findSpotOk } from "./inventory.ts";

const NOW = Date.parse("2026-11-10T02:00:00Z");
const ago = (s: number) => new Date(NOW - s * 1000).toISOString();
const bag = (o: any = {}) => ({ x: 100, z: -200, room: "island", sea: false, manual: false, victim_id: "dev:v", killer_id: "Killer", created_at: ago(30), zone: "Harbor #1", ...o });
const pres = (o: any = {}) => ({ room: "Harbor #1", mode: "foot", x: 105, z: -205, updated_at: ago(5), ...o });
const P = (o: any) => lootClaimProblem({ now: NOW, pid: "dev:me", owner: false, isKiller: false, pres: pres(), seatAt: null, ...o, bag: bag(o.bag) });

Deno.test("H1: a nearby pirate in the same harbor can claim", () => { assertEquals(P({}), null); });
Deno.test("H1: remote claim (far away) refused", () => { assert(P({ pres: pres({ x: 2000, z: 2000 }) })); });
Deno.test("H1: distance allowance grows with heartbeat age (walked since the last beat)", () => {
  assertEquals(P({ pres: pres({ x: 100 + 250, updated_at: ago(25) }) }), null);   // 30 + 12*25 = 330 m
  assert(P({ pres: pres({ x: 100 + 400, updated_at: ago(25) }) }));
});
Deno.test("H1: another harbor refused", () => { assert(P({ pres: pres({ room: "Harbor #2" }) })); });
Deno.test("H1: no heartbeat and no match seat = refused (API script)", () => { assert(P({ pres: null })); assert(P({ pres: pres({ updated_at: ago(600) }) })); });
Deno.test("H1: no heartbeat but a recent match seat = allowed (proxy)", () => { assertEquals(P({ pres: null, seatAt: ago(600) }), null); assert(P({ pres: null, seatAt: ago(3 * 3600) })); });
Deno.test("H1: hull / cottage / just-switched mode in the same harbor = allowed (no comparable position)", () => {
  assertEquals(P({ pres: pres({ mode: "hull", x: 9999 }) }), null); assertEquals(P({ pres: pres({ mode: "sea", x: 9999 }) }), null);
});
Deno.test("H1: sea crates use the ship position and a wider allowance", () => {
  assertEquals(P({ bag: { sea: true, room: "sea" }, pres: pres({ mode: "sea", x: 100 + 200, updated_at: ago(5) }) }), null);
  assert(P({ bag: { sea: true, room: "sea" }, pres: pres({ mode: "sea", x: 100 + 2000, updated_at: ago(5) }) }));
});
Deno.test("H1: killer-first window", () => {
  const fresh = { bag: { created_at: ago(3) } };
  const r = P(fresh); assert(r && (r as any).left_s === KILLER_FIRST_S - 3);
  assertEquals(P({ ...fresh, isKiller: true }), null);
  assertEquals(lootClaimProblem({ now: NOW, pid: "dev:v", owner: false, isKiller: false, pres: pres(), bag: bag({ created_at: ago(3) }) }), null, "victim");
  assertEquals(P({ bag: { created_at: ago(11) } }), null, "after 10 s anyone nearby");
  assertEquals(P({ bag: { created_at: ago(3), killer_id: null } }), null, "no killer = no window");
  assertEquals(P({ bag: { created_at: ago(3), manual: true } }), null, "manual drops have no window");
});
Deno.test("H1: owner skips every check", () => { assertEquals(P({ owner: true, pres: null, bag: { created_at: ago(1) } }), null); });
Deno.test("H1: legacy bag without zone still works", () => { assertEquals(P({ bag: { zone: null }, pres: pres({ room: "Harbor #2" }) }), null); });

Deno.test("H2: only the 7 shard + 6 pearl spots", () => {
  for (let i = 0; i < 7; i++) assert(findSpotOk("val:idol_shard", "jungle_shard_" + i));
  for (const s of ["jungle_shard_7", "jungle_shard_10", "jungle_shard_99", "lagoon_p1"]) assert(!findSpotOk("val:idol_shard", s));
  for (const s of ["lagoon_p_grotto", "lagoon_p1", "lagoon_p2", "lagoon_p3", "lagoon_p4", "lagoon_p5"]) assert(findSpotOk("val:river_pearl", s));
  for (const s of ["lagoon_p0", "lagoon_p6", "lagoon_p9", "jungle_shard_0"]) assert(!findSpotOk("val:river_pearl", s));
  assert(!findSpotOk("val:ruby", "jungle_shard_0"));
});
