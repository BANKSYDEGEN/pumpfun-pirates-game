// deno test supabase/functions/   (no network, no database)
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { trustedIp, siwsMessage, siwsFacts, allowedOrigin, parseTopic, mintJwt, seatNetOk, relayTicket } from "./security.ts";
import { saveProblem, cleanProfile, CAPS, SEED_GOLD_CAP, goalMet, SHOP_ITEMS } from "./lib.ts";
import { buildMessage, messageFor } from "../pirate/lib.ts";

Deno.test("trustedIp never uses the client-typed first x-forwarded-for hop", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  assertEquals(trustedIp(h({ "x-forwarded-for": "6.6.6.6, 10.0.0.1, 203.0.113.9" })), "203.0.113.9");
  assertEquals(trustedIp(h({ "x-forwarded-for": "6.6.6.6", "cf-connecting-ip": "198.51.100.7" })), "198.51.100.7");
  assertEquals(trustedIp(h({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "198.51.100.8" })), "198.51.100.8");
  assertEquals(trustedIp(h({ "x-forwarded-for": "6.6.6.6", "fly-client-ip": "192.0.2.4" }), "fly-client-ip"), "192.0.2.4");
  assertEquals(trustedIp(h({})), "unknown");
});

Deno.test("SIWS message names the page; facts round-trip; strangers get no origin", () => {
  const m = siwsMessage({ origin: "https://game.pumpfunpirates.com", wallet: "W".repeat(44), nonce: "ab".repeat(16), issuedAt: "2026-11-02T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z", statement: "line one\nline two" });
  assert(m.startsWith("game.pumpfunpirates.com wants you to sign in with your Solana account:\n"));
  assert(m.includes("\nURI: https://game.pumpfunpirates.com\n") && m.includes("\nChain ID: mainnet\n") && m.includes("line one line two"));
  const f = siwsFacts(m)!; assertEquals(f.host, "game.pumpfunpirates.com"); assertEquals(f.uri, "https://game.pumpfunpirates.com");
  assertEquals(siwsFacts("PUMPFUN PIRATES PvP save\nwallet: x\nnonce: y"), null); // the old domain-less message is refused
  const allowed = ["https://game.pumpfunpirates.com", "http://localhost:8787"];
  assertEquals(allowedOrigin("https://game.pumpfunpirates.com", allowed), "https://game.pumpfunpirates.com");
  assertEquals(allowedOrigin("https://game-pumpfunpirates.com", allowed), null);
  assertEquals(allowedOrigin(null, allowed), null);
});

Deno.test("pirate: no plain fallback, message bound to the verifying page", () => {
  const exp = new Date(Date.now() + 60_000).toISOString();
  const m = buildMessage("game.pumpfunpirates.com", "W".repeat(44), "n".repeat(32), new Date().toISOString(), exp);
  assert(messageFor(m, "https://game.pumpfunpirates.com"));
  assertFalse(messageFor(m, "https://evil.example"));
  assertFalse(messageFor(m, null));
  assertFalse(messageFor(buildMessage("game.pumpfunpirates.com", "W".repeat(44), "n".repeat(32), "2020-01-01T00:00:00Z", "2020-01-01T00:05:00Z"), "https://game.pumpfunpirates.com"));
});

Deno.test("parseTopic: arenas, harbor copies (+ both claim rooms), parties, junk", () => {
  assertEquals(parseTopic("pfp-pvp-v1-1")?.claimRooms, ["pfp-pvp-v1-1"]);
  assertEquals(parseTopic("pfp-pvp-v1sq-1")?.live, true);
  assertEquals(parseTopic("pfp-pvp-qa107x-1")?.live, false);
  const h = parseTopic("pfp-harbor-3")!; assertEquals(h.kind, "harbor"); assertEquals(h.prefix, "pfp-harbor"); assertEquals(h.claimRooms, ["pfp-pvp-v1-3", "pfp-pvp-v1sq-3"]);
  assertEquals(parseTopic("pfp-harbor-qa1-2")?.claimRooms, ["pfp-pvp-qa1-2", "pfp-pvp-qa1sq-2"]);
  assertEquals(parseTopic("pfp-party-ab12c")?.kind, "party");
  for (const bad of ["realtime:pfp-pvp-v1-1", "pfp-pvp-v1", "pfp-pvp-v1-1;drop", "pfp-party-AB", "x".repeat(80), 5, null]) assertEquals(parseTopic(bad), null);
});

Deno.test("seat must belong to the network id", () => {
  assert(seatNetOk("mh0abcd1234zzabcdefgh", "mh0abcd1234zz"));
  assertFalse(seatNetOk("otherid12345abcdefgh", "mh0abcd1234zz"));
  assertFalse(seatNetOk("mh0abcd1234zz", "mh0abcd1234zz")); // the bare public id is not a seat
  assertFalse(seatNetOk("mh0abcd1234zzabcdefgh", "MH0ABCD"));
});

Deno.test("realtime JWT is a valid HS256 token with the channel binding", async () => {
  const secret = "test-only-secret-0123456789abcdef";
  const t = await mintJwt(secret, { role: "authenticated", aud: "authenticated", exp: 2_000_000_000, pfp_topic: "pfp-pvp-v1-1", pfp_net: "abc123" });
  const [h, b, s] = t.split(".");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const unb64u = (x: string) => { const t = x.replace(/-/g, "+").replace(/_/g, "/"); return atob(t + "=".repeat((4 - t.length % 4) % 4)); };
  const sig = Uint8Array.from(unb64u(s), (c) => c.charCodeAt(0));
  assert(await crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(`${h}.${b}`)));
  const claims = JSON.parse(unb64u(b));
  assertEquals(claims.pfp_topic, "pfp-pvp-v1-1"); assertEquals(claims.role, "authenticated");
  const rt = await relayTicket(secret, "abc123", "pfp-pvp-v1", 60); assertEquals(rt.split(".").length, 4);
});

Deno.test("H3 caps: real paces pass, the old 10k/min farm does not", () => {
  const p0 = cleanProfile({ gold: 1000 });
  const after = (gold: number, extra: Record<string, unknown> = {}) => cleanProfile({ gold, ...extra });
  assertEquals(saveProblem(p0, after(1000 + 1900 * 3), 3), null);                 // best real pace, 3 min
  assertEquals(saveProblem(p0, after(1000 + 1680), 0.1), null);                    // one holder boss pile right away
  assert(saveProblem(p0, after(1000 + 10000 * 3), 3) !== null);                    // the old cap is now refused (retried later)
  assertEquals(CAPS.bossPerMin, 0.5); assertEquals(SEED_GOLD_CAP, 5000);
  assertEquals(saveProblem(p0, after(1000, { stats: { bossKills: 2 + 2 } }), 4), null);  // a boss every ~1 min is still fine
  assert(saveProblem(p0, after(1000, { stats: { bossKills: 2 + 10 } }), 4) !== null);
});

Deno.test("goals: kills come from the caller (shop_buy / shopView pass the confirmed board)", () => {
  const diamond = SHOP_ITEMS["skin:diamond"].goal;
  assertFalse(goalMet(diamond, { kills: 4999, deaths: 0, botKills: 0, harborKills: 0, bossKills: 0 }));
  assert(goalMet(diamond, { kills: 5000, deaths: 0, botKills: 0, harborKills: 0, bossKills: 0 }));
});

// [Emerly] ITEM SKILL BOOSTS (lib.ts boostsFor)
import { boostsFor, BOOSTS, BOOST_CAPS, BOOST_COMBAT_CAP } from "./lib.ts";
Deno.test("boosts: unowned gear gives nothing, owned gives its boost, the owner is still capped", () => {
  const gear = { hat: "crown_imperial", parrot: "parrot_diamond", hook: "hook_gold" };
  const none = boostsFor(gear, new Set(), false); assertEquals(none.reload, 0); assertEquals(none.goldFind, 0); assertEquals(none.combat, 0);
  const own = boostsFor(gear, new Set(["gear:hat:crown_imperial", "gear:parrot:parrot_diamond"]), false);
  assertEquals(own.reload, 0.06); assertEquals(own.goldFind, 0.10); assertEquals(own.dmg, 0); // hook not owned
  const all = boostsFor({ hat: "crown_imperial", outfit: "suit", eyes: "laser", hook: "hook_gold", leg: "peg", face: "facepaint_retardio", crewhat: "crown_imperial", crewoutfit: "suit", parrot: "parrot_diamond" }, new Set(), true);
  for (const [k, cap] of Object.entries(BOOST_CAPS)) assert(all[k] <= cap + 1e-9, k);
  assert(all.combat <= BOOST_COMBAT_CAP + 1e-9); assertEquals(all.speed <= BOOST_CAPS.speed, true);
});
Deno.test("boosts: junk gear + unknown ids are ignored; weapons wait for their gear slots", () => {
  assertEquals(boostsFor({ hat: "crown_imperial'; drop", sword: "blade_gold" }, new Set(["gear:sword:blade_gold"]), false).combat, 0);
  assertEquals(Object.keys(BOOSTS["sword:blade_gold"]), ["swordHit"]); assertEquals(Object.keys(BOOSTS["musket:blunder_gold"]), ["musketHit"]); // their own hit rate, never ship stats
  assertEquals(BOOST_CAPS.dmg, 0.04); assertEquals(BOOST_CAPS.range, 0.05);
});
Deno.test("boosts: PET gold find widens the save pace by its share only", () => {
  const cur = cleanProfile({ gold: 0 }), next = cleanProfile({ gold: CAPS.valueBase + CAPS.valuePerMin * 10 + 2000 });
  assert(saveProblem(cur, next, 10) !== null); assertEquals(saveProblem(cur, next, 10, 0.10), null);
  const over = cleanProfile({ gold: CAPS.valueBase + CAPS.valuePerMin * 1.1 * 10 + 50 }); // just past the 10% widening
  assert(saveProblem(cur, over, 10, 0.10) !== null); assert(saveProblem(cur, over, 10, 5) !== null); // a bigger goldFind is clamped to 10%
  assertEquals(saveProblem(cur, cleanProfile({ gold: 100 }), 1), null); // default unchanged
});
