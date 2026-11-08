// [pets R1] BANKSY: pet names + leveling (walk XP / gold treats) + two-sided server-side pet trades (migration 058, pvp_pet_op).
// Identity = index.ts whoAmI; the client only names WHICH pet. Ownership, gold and the swap are all checked inside one SQL transaction.
import { cleanName } from "./online.ts";
import { acctBump } from "./accounts.ts";
export const PET_ACTIONS = ["pet_list", "pet_name", "pet_walk", "pet_treat", "pet_offer", "pet_cancel", "pet_respond", "parrot_list", "parrot_name", "parrot_treat", "parrot_color", "parrot_equip", "parrot_walk", "pilly_list", "pilly_buy", "pilly_out", "pilly_name", "pilly_walk", "pilly_treat"] as const; // [Pilly] migration 067
const PET_RE = /^pet_[a-z0-9_]{2,20}$/;
export const petName = (n: unknown) => String(n ?? "").replace(/[<>&"'`\\\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 16);
export const PET_SELL_PER_LV = 0.01;
export async function petLevel(db: any, pid: string, pet: unknown) {
  if (typeof pet === "string" && pet.startsWith("parrot_")) {
    const { data } = await db.rpc("pvp_parrot_op", { p_player: pid, p_op: "list" });
    return data?.parrots?.find((p: any) => p.id === data.equipped && p.color === pet)?.lv || 0;
  }
  if (typeof pet !== "string" || !PET_RE.test(pet)) return 0;
  try { const { data } = await db.from("pvp_pets").select("xp").eq("player_id", pid).eq("pet", pet).maybeSingle(); return Math.min(10, Math.floor(Math.sqrt(Math.max(0, Number(data?.xp) || 0) / 100))); } catch { return 0; }
}
export async function petAction(c: { db: any; whoAmI: (b: Record<string, unknown>) => Promise<{ pid: string; raw?: string; wallet?: string | null; owner?: boolean } | null>; json: (s: number, o: unknown) => Response }, action: string, b: Record<string, unknown>) {
  const { db, json } = c; const who = await c.whoAmI(b); if (!who) return json(401, { error: "no identity" });
  if (action.startsWith("pilly_")) { // [Pilly] migration 067: the companion slot (independent of the parrot slot)
    const op = action.slice(6);
    if (op !== "walk" && op !== "list") { const { data: okRate } = await db.rpc("pvp_rl_hit", { p_key: "pilly:" + who.pid, p_window_s: 60, p_max: 40 }); if (okRate === false) return json(429, { ok: false, why: "slow down" }); }
    const { data, error } = await db.rpc("pvp_pilly_op", { p_player: who.pid, p_op: op, p_name: op === "name" ? petName(b.name) : null, p_out: op === "out" && typeof b.out === "boolean" ? b.out : null });
    if (!error && data?.ok && (op === "treat" || op === "buy") && !who.wallet && !who.owner) await acctBump(db, who.raw, -(op === "buy" ? (data.price || 0) : (data.cost || 0)));
    return json(200, error ? { ok: false, why: "busy, try again" } : data || { ok: false });
  }
  if (action.startsWith("parrot_")) {
    const op = action.slice(7), id = typeof b.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(b.id) ? b.id : null;
    if (!["list", "walk"].includes(op) && !id) return json(400, { ok: false, why: "pick a parrot" });
    const { data: rate, error: rateError } = await db.rpc("pvp_rl_hit", { p_key: "parrot:" + who.pid, p_window_s: 60, p_max: 40 });
    if (rateError || !rate) return json(429, { ok: false, why: "slow down" });
    const { data, error } = await db.rpc("pvp_parrot_op", { p_player: who.pid, p_op: op, p_id: id, p_name: petName(b.name), p_color: typeof b.color === "string" ? b.color : null });
    if (!error && data?.ok && op === "treat" && data.cost && !who.wallet && !who.owner) await acctBump(db, who.raw, -data.cost);
    return json(200, error ? { ok: false, why: "busy, try again" } : data || { ok: false });
  }
  const pet = typeof b.pet === "string" && PET_RE.test(b.pet) ? b.pet : null;
  const op: Record<string, string> = { pet_list: "list", pet_name: "name", pet_walk: "walk", pet_treat: "treat", pet_offer: "offer", pet_cancel: "cancel", pet_respond: "respond" };
  if (["pet_name", "pet_walk", "pet_treat", "pet_offer"].includes(action) && !pet) return json(400, { ok: false, why: "pick a pet" });
  if (action !== "pet_walk") { const { data: okRate } = await db.rpc("pvp_rl_hit", { p_key: "pet:" + who.pid, p_window_s: 60, p_max: 40 }); if (okRate === false) return json(429, { ok: false, why: "slow down" }); }
  const args: Record<string, unknown> = { p_player: who.pid, p_op: op[action], p_pet: pet };
  if (action === "pet_name") args.p_name = petName(b.name);
  if (action === "pet_offer") { args.p_name = cleanName(b.to); args.p_price = Math.max(0, Math.min(10000000, Math.floor(Number(b.price) || 0))); }
  if (action === "pet_cancel" || action === "pet_respond") { const id = Math.floor(Number(b.offer)); if (!(id > 0)) return json(400, { ok: false, why: "bad offer" }); args.p_offer = id; }
  if (action === "pet_respond") args.p_accept = b.accept === true;
  const { data, error } = await db.rpc("pvp_pet_op", args);
  if (error) { console.warn("pet op", error.message); return json(200, { ok: false, why: "busy, try again" }); }
  return json(200, data || { ok: false });
}
