import { cleanGear, fitEquipped, cleanProfile, SHOP_ITEMS, GEAR_SLOTS } from "/workspace/timothy-crewpets/supabase/functions/pvp/lib.ts";
const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) Deno.exitCode = 1; };
const old = cleanProfile({ gold: 100, gear: { hat: "tricorn", outfit: "coat" } });
ok(old.gear!.hat === "tricorn" && old.gear!.crewhat === "bandana" && old.gear!.crewoutfit === "tank", "old save: player gear kept, crew = uniform");
const p1 = fitEquipped(cleanProfile({ gear: { hat: "tricorn", crewhat: "crown" } }), new Set(["gear:hat:tricorn"]), false);
ok(p1.gear!.hat === "tricorn" && p1.gear!.crewhat === "bandana", "owning player tricorn does not let crew wear crown/tricorn");
const p2 = fitEquipped(cleanProfile({ gear: { hat: "tricorn", crewhat: "tricorn" } }), new Set(["gear:crewhat:tricorn"]), false);
ok(p2.gear!.hat === "none" && p2.gear!.crewhat === "tricorn", "owning crew tricorn does not give the player tricorn");
const p3 = fitEquipped(cleanProfile({ gear: { crewhat: "crown_imperial", crewoutfit: "suit" } }), new Set(), true);
ok(p3.gear!.crewhat === "crown_imperial" && p3.gear!.crewoutfit === "suit", "owner wears every crew item");
for (const [k, v] of Object.entries(SHOP_ITEMS)) if (k.startsWith("gear:crew")) { const [, s, id] = k.split(":"); const base = SHOP_ITEMS[`gear:${s === "crewhat" ? "hat" : "outfit"}:${id}`]; ok(!!base && base.price === v.price, `${k} ${v.price} = player price`); ok(/^(skin:[a-z0-9_]{2,24}|gear:[a-z]{2,10}:[a-z0-9_]{2,24})$/.test(k), `${k} fits pvp_owned check`); ok(GEAR_SLOTS[s].includes(id), `${k} in GEAR_SLOTS`); }
