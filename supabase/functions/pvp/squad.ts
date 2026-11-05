// [squad-hall] BANKSY 9:35 PM: cross-world squad invites (name-based, reuses party codes from js/pvp.js).
// Table: pvp_squad_invites (migration 041). Display names only leave the server.
import { cleanName } from "./online.ts";

export const SQUAD_ACTIONS = ["squad_invite", "squad_invites", "squad_invite_ack"] as const;
export const INVITE_TTL_S = 90, INVITE_MAX_PENDING = 8;

const codeOk = (c: unknown) => /^[A-Z0-9]{5}$/.test(String(c || "").toUpperCase());

export async function squadAction(db: any, pid: string, myName: string, action: string, b: any) {
  const me = cleanName(myName); if (!me) return { ok: false, why: "rename first" };
  if (action === "squad_invite") {
    const { data: ok } = await db.rpc("pvp_rl_hit", { p_key: "sqinv:" + pid, p_window_s: 20, p_max: 6 }); if (ok === false) return { ok: false, why: "slow down" };
    const to = cleanName(b?.to), code = String(b?.code || "").toUpperCase();
    if (!to || to.toLowerCase() === me.toLowerCase()) return { ok: false, why: "pick another pirate" };
    if (!codeOk(code)) return { ok: false, why: "bad party code" };
    const world = String(b?.world || "").replace(/[<>&"'`]/g, "").slice(0, 40);
    // target must be a registered unique name (same rule as gifts)
    const { data: reg } = await db.from("pvp_players").select("name").eq("name", to).limit(2);
    if (!reg || reg.length !== 1) return { ok: false, why: "pirate not found" };
    await db.from("pvp_squad_invites").delete().lt("created", new Date(Date.now() - INVITE_TTL_S * 1000).toISOString());
    const { count } = await db.from("pvp_squad_invites").select("id", { count: "exact", head: true }).eq("to_name", to);
    if ((count || 0) >= INVITE_MAX_PENDING) return { ok: false, why: "their invite box is full" };
    const { error } = await db.from("pvp_squad_invites").upsert(
      { from_name: me, to_name: to, code, world, created: new Date().toISOString() },
      { onConflict: "from_name,to_name" },
    );
    if (error) return { ok: false, why: "invite failed" };
    return { ok: true };
  }
  if (action === "squad_invites") {
    const { data: ok } = await db.rpc("pvp_rl_hit", { p_key: "sqpoll:" + pid, p_window_s: 8, p_max: 6 }); if (ok === false) return { ok: false, why: "slow down" };
    const since = new Date(Date.now() - INVITE_TTL_S * 1000).toISOString();
    const { data } = await db.from("pvp_squad_invites").select("from_name, code, world, created").eq("to_name", me).gt("created", since).order("created", { ascending: false }).limit(INVITE_MAX_PENDING);
    const invites = (data || []).map((r: any) => ({ from: cleanName(r.from_name), code: String(r.code || "").toUpperCase().slice(0, 5), world: String(r.world || "").slice(0, 40) })).filter((r: any) => r.from && codeOk(r.code));
    return { ok: true, invites };
  }
  if (action === "squad_invite_ack") {
    const from = cleanName(b?.from), code = String(b?.code || "").toUpperCase();
    if (!from || !codeOk(code)) return { ok: false, why: "bad invite" };
    await db.from("pvp_squad_invites").delete().eq("to_name", me).eq("from_name", from).eq("code", code);
    return { ok: true, accepted: !!b?.ok };
  }
  return { ok: false, why: "unknown" };
}
