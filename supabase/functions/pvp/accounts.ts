// PUMPFUN PIRATES · [v106] PLAYER ACCOUNTS (migration 027). No sign-up: the pirate's unique in-game NAME is the account.
//   acct_set     the device that owns the name (or a logged-in device) sets the FIRST password; returns a session token
//   acct_login   name + password on another device: this device now plays as that pirate (pvp_main -> the account id)
//   acct_sync    a logged-in device's save: only what changed since this device's last sync is added (two devices never
//                overwrite each other), same pace caps as every save; also keeps the session alive (sliding expiry)
//   acct_change  current + new password; every OTHER device is logged out
//   acct_logout  this device stops being that pirate
// Passwords: bcrypt (cost 10) here only, never stored or logged in plain text. Sessions: random 32-byte token, only its SHA-256
// is stored (pvp_acct_devices.token_hash), bound to this device's key. Errors are generic; attempts are rate-limited per name
// and per (hashed) IP.
import bcrypt from "npm:bcryptjs@2.4.3";
import { cleanProfile, fitEquipped, CAPS, OWNER_MAIN, stalePrestige, type Profile } from "./lib.ts";

export const ACCT_TTL_MS = 60 * 24 * 3600 * 1000; // 60 days, renewed by every sync
// [security M3] new passwords need 10+ characters (login still accepts an existing 8-9 character password)
const PW_MIN = 10, PW_MAX = 72, BCRYPT_COST = 10;
// [security M3] the OWNER pirate (BANKSYDEGEN, every skin / 2x gold) never logs in with a password: it plays on its own pinned
// devices (pvp_alias). A guessable or phished password would otherwise hand the owner perks to anyone. Escape hatch for a
// planned owner login: set the function secret OWNER_PASSWORD_LOGIN=1 (then unset it again).
const OWNER_PW_LOGIN = Deno.env.get("OWNER_PASSWORD_LOGIN") === "1";
const WIN_MS = 15 * 60 * 1000, NAME_FAILS = 8, IP_FAILS = 25, IP_SETS = 12;
// a real bcrypt hash (of a random string) so an unknown name costs the same time as a wrong password
const DUMMY_HASH = "$2a$10$5qhnQhRuI4DpBINyxzsxnuxrWrAhxoQYfCuDTxwKA04hKkhh.m4c2";
const STAT_KEYS = ["kills", "deaths", "botKills", "harborKills", "bossKills", "batteryHits"] as const; // [cliff gold] + paid cliff-gun hits

type Ctx = {
  db: any; ip: string;
  devId: (b: Record<string, unknown>) => Promise<string | null>;
  sha256: (s: string) => Promise<string>;
  newToken: () => string;
  whoAmI: (b: Record<string, unknown>) => Promise<{ raw: string; pid: string; wallet: string | null; owner: boolean } | null>;
  sessionWallet: (t: unknown) => Promise<string | null>;
  devSync: (who: { pid: string; owner: boolean }, b: Record<string, unknown>) => Promise<any>;
  devProfile: (r: any) => Profile; devCols: (p: Profile) => Record<string, unknown>;
  shopView: (who: { pid: string; owner: boolean }, gold: number, stats: Profile["stats"], rev: number, extra?: Record<string, unknown>) => Promise<any>;
  ownedSet: (pid: string) => Promise<Set<string>>;
  upgValue: (lv: Record<string, number>) => number;
  prestigeOf: (pid: string) => Promise<number>; // [prestige]
};
type Out = { status: number; body: unknown };
const out = (status: number, body: unknown): Out => ({ status, body });
export const cleanName = (s: unknown) => String(s ?? "").replace(/[\u0000-\u001f\u007f<>&"`\\]/g, "").trim().slice(0, 20);
const lc = (s: string) => s.trim().toLowerCase();
const goodPw = (p: unknown): p is string => typeof p === "string" && p.length >= PW_MIN && p.length <= PW_MAX && new TextEncoder().encode(p).length <= PW_MAX;
const PW_RULE = `Password: ${PW_MIN}-${PW_MAX} characters.`;

async function attempts(ctx: Ctx, col: "name_lc" | "ip_hash", v: string, kinds: string[], okToo = false) {
  let q = ctx.db.from("pvp_acct_attempts").select("id", { count: "exact", head: true }).eq(col, v).in("kind", kinds).gt("created_at", new Date(Date.now() - WIN_MS).toISOString());
  if (!okToo) q = q.eq("ok", false);
  const { count } = await q; return count ?? 0;
}
const note = (ctx: Ctx, kind: string, name_lc: string | null, ok: boolean) =>
  ctx.db.from("pvp_acct_attempts").insert({ kind, name_lc, ip_hash: ctx.ip, ok }).then(() => {}, () => {});
const tooMany = () => out(429, { error: "Too many tries. Wait a few minutes and try again." });

// the device's live login (token must belong to THIS device key), or null
export async function acctDevice(ctx: Ctx, b: Record<string, unknown>) {
  const dev = await ctx.devId(b); if (!dev || typeof b.acct !== "string" || b.acct.length < 20 || b.acct.length > 100) return null;
  const { data } = await ctx.db.from("pvp_acct_devices").select("*").eq("token_hash", await ctx.sha256(b.acct)).maybeSingle();
  return data && data.dev === dev && Date.parse(data.expires_at) > Date.now() ? data : null;
}
// is this raw device id a logged-in account device (any token)?
export async function isAcctDevice(db: any, raw: string) {
  const { data } = await db.from("pvp_acct_devices").select("main, expires_at").eq("dev", raw).maybeSingle();
  return !!data && Date.parse(data.expires_at) > Date.now();
}
// mirror a server-side gold change made by this device (shop buy -, Waves payout +, treasure dig +) on its `last`
export async function acctBump(db: any, raw: string | null | undefined, gold: number) {
  if (!raw || !raw.startsWith("dev:") || !gold) return;
  const { error } = await db.rpc("pvp_acct_bump", { p_dev: raw, p_gold: Math.round(gold) }); if (error) console.warn("acct bump", error.message);
}
export async function nameHasAccount(db: any, name: string, pid: string | null) {
  const n = lc(cleanName(name)); if (!n) return false;
  const { data } = await db.from("pvp_accounts").select("main, name").ilike("name", n.replace(/[%_\\]/g, (c) => "\\" + c)).limit(5);
  return (data ?? []).some((r: any) => lc(r.name) === n && r.main !== pid);
}
async function accountByName(db: any, name: string) {
  const n = lc(name); if (!n) return null;
  const { data } = await db.from("pvp_accounts").select("*").ilike("name", n.replace(/[%_\\]/g, (c) => "\\" + c)).limit(5);
  return (data ?? []).find((r: any) => lc(r.name) === n) ?? null;
}
const snap = (p: Profile) => ({ gold: p.gold, stats: { ...p.stats } });
async function accountState(ctx: Ctx, main: string) { // the account's server save (device-save copy; the owner keeps its group pot)
  if (main === OWNER_MAIN) {
    const { data: g } = await ctx.db.from("pvp_group_saves").select("gold, upgrades").eq("main", main).maybeSingle();
    return cleanProfile({ gold: 0, levels: g?.upgrades ?? {} }); // gold 0: the client's first group sync brings the shared pot
  }
  const { data: r } = await ctx.db.from("pvp_dev_profiles").select("*").eq("id", main).maybeSingle();
  return r ? ctx.devProfile(r) : cleanProfile(null);
}
async function issue(ctx: Ctx, dev: string, main: string, p: Profile) {
  const token = ctx.newToken(), exp = new Date(Date.now() + ACCT_TTL_MS).toISOString();
  const row = { dev, main, token_hash: await ctx.sha256(token), expires_at: exp, last: snap(p), last_at: new Date().toISOString() };
  const { error } = await ctx.db.from("pvp_acct_devices").upsert(row, { onConflict: "dev" }); if (error) throw error;
  return { token, expires_at: exp };
}
async function loginView(ctx: Ctx, main: string, name: string, p: Profile, s: { token: string; expires_at: string }, extra: Record<string, unknown> = {}) {
  const owner = main === OWNER_MAIN, who = { pid: main, owner };
  const view = await ctx.shopView(who, p.gold, p.stats, 0);
  fitEquipped(p, owner ? new Set() : await ctx.ownedSet(main), owner);
  return { ...view, ok: true, name, owner, token: s.token, expires_at: s.expires_at,
    profile: { gold: p.gold, levels: p.levels, skins: { equipped: p.skins.equipped, owned: view.owned.skins }, gear: p.gear, gearOwned: view.owned.gear, stats: p.stats }, ...extra };
}

export async function acctAction(ctx: Ctx, action: string, b: Record<string, unknown>): Promise<Out | null> {
  switch (action) {
    case "acct_set": {
      if (await attempts(ctx, "ip_hash", ctx.ip, ["set"], true) >= IP_SETS) return tooMany();
      if (!goodPw(b.pw)) return out(400, { error: PW_RULE });
      const who = await ctx.whoAmI({ dk: b.dk }); if (!who) return out(401, { error: "no device" });
      if (who.owner && !OWNER_PW_LOGIN) return out(403, { error: "The owner pirate plays on its own devices only (no password)." }); // [security M3]
      const name = cleanName(b.name); if (!name) return out(400, { error: "Pick a pirate name first." });
      await note(ctx, "set", lc(name), true);
      const { data: mine } = await ctx.db.from("pvp_accounts").select("main").eq("main", who.pid).maybeSingle();
      if (mine) return out(409, { error: "This pirate already has a password. Use CHANGE PASSWORD." });
      if (!who.pid.startsWith("dev:")) return out(400, { error: "no device" });
      const sw = typeof b.token === "string" ? await ctx.sessionWallet(b.token) : null;
      const { data: free, error: fe } = await ctx.db.rpc("pvp_name_free", { p_name: name, p_player: who.raw, p_wallet: sw }); if (fe) throw fe;
      if (free !== true || await nameHasAccount(ctx.db, name, who.pid)) return out(409, { error: "That name belongs to another pirate.", taken: true });
      // the name on the board: rename the main row (the owner's pinned name stays), or claim it with a fresh row
      const { data: rn, error: re } = await ctx.db.rpc("pvp_rename", { p_player: who.pid, p_name: name }); if (re) throw re;
      if (!rn?.ok) return out(409, { error: "That name belongs to another pirate.", taken: true });
      let final = String(rn.name || name);
      if (!rn.rows) { const { data: pr } = await ctx.db.from("pvp_players").select("name").eq("id", who.pid).maybeSingle();
        if (pr) final = pr.name; else { const { data: ins, error: ie } = await ctx.db.from("pvp_players").insert({ id: who.pid, name, updated_at: new Date().toISOString() }).select("name").single(); if (ie) throw ie; final = ins.name; } }
      if (lc(final) !== lc(name) && !who.owner) return out(409, { error: "That name belongs to another pirate.", taken: true });
      // the server save exists (the shop / sync need it): the device save seeds it like a first dev_sync
      if (!who.owner) { const { data: dp } = await ctx.db.from("pvp_dev_profiles").select("id").eq("id", who.pid).maybeSingle();
        if (!dp) { const r = await ctx.devSync(who, { profile: b.profile, rev: 0 }); if (!r?.ok) return out(409, { error: "Try again in a moment." }); } }
      const pw_hash = await bcrypt.hash(b.pw, BCRYPT_COST);
      const { error: ae } = await ctx.db.from("pvp_accounts").insert({ main: who.pid, name: final, pw_hash });
      if (ae) { if ((ae as any).code === "23505") return out(409, { error: "That name belongs to another pirate.", taken: true }); throw ae; }
      // this device becomes a logged-in device. Not the owner: it moves to a NEW device key (newdk), so the old key (whose hash
      // IS the account id) is retired and a password change can log out every other device, this first one included.
      const nd = !who.owner && typeof b.newdk === "string" && b.newdk !== b.dk ? await ctx.devId({ dk: b.newdk }) : null;
      if (nd) { const { data: taken } = await ctx.db.from("pvp_acct_devices").select("dev").eq("dev", nd).maybeSingle(); if (taken) return out(400, { error: "bad device" }); }
      const p = await accountState(ctx, who.pid), s = await issue(ctx, nd || who.raw, who.pid, p);
      return out(200, await loginView(ctx, who.pid, final, p, s, { rotated: !!nd }));
    }
    case "acct_login": {
      const name = cleanName(b.name), n = lc(name), pw = typeof b.pw === "string" ? b.pw : "";
      if (!name || !pw || pw.length > 200) return out(401, { error: "Wrong name or password." });
      if (await attempts(ctx, "name_lc", n, ["login", "change"]) >= NAME_FAILS || await attempts(ctx, "ip_hash", ctx.ip, ["login", "change"]) >= IP_FAILS) { await note(ctx, "login", n, false); return tooMany(); }
      const dev = await ctx.devId(b); if (!dev) return out(400, { error: "no device" });
      const a = await accountByName(ctx.db, name);
      if (a && a.main === OWNER_MAIN && !OWNER_PW_LOGIN) { await note(ctx, "login", n, false); return out(401, { error: "Wrong name or password." }); } // [security M3] never even compared
      const ok = await bcrypt.compare(pw, a?.pw_hash ?? DUMMY_HASH) && !!a;
      await note(ctx, "login", n, ok);
      if (!ok) return out(401, { error: "Wrong name or password." });
      const { data: al } = await ctx.db.from("pvp_alias").select("main").eq("dev", dev).maybeSingle();
      if (al && al.main !== a.main) return out(409, { error: "This device can't switch pirates." });
      const p = await accountState(ctx, a.main), s = await issue(ctx, dev, a.main, p);
      return out(200, await loginView(ctx, a.main, a.name, p, s));
    }
    case "acct_logout": {
      const d = await acctDevice(ctx, b); if (d) await ctx.db.from("pvp_acct_devices").delete().eq("dev", d.dev).eq("token_hash", d.token_hash);
      return out(200, { ok: true });
    }
    case "acct_change": {
      const d = await acctDevice(ctx, b); if (!d) return out(401, { error: "Logged out. Log in again." });
      const { data: a } = await ctx.db.from("pvp_accounts").select("*").eq("main", d.main).maybeSingle(); if (!a) return out(401, { error: "Logged out. Log in again." });
      const n = lc(a.name);
      if (await attempts(ctx, "name_lc", n, ["login", "change"]) >= NAME_FAILS || await attempts(ctx, "ip_hash", ctx.ip, ["login", "change"]) >= IP_FAILS) return tooMany();
      if (!goodPw(b.pw)) return out(400, { error: PW_RULE });
      const ok = typeof b.old === "string" && b.old.length <= 200 && await bcrypt.compare(b.old, a.pw_hash);
      await note(ctx, "change", n, ok);
      if (!ok) return out(401, { error: "Current password is wrong." });
      const pw_hash = await bcrypt.hash(b.pw, BCRYPT_COST);
      const { error } = await ctx.db.from("pvp_accounts").update({ pw_hash, pw_set_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("main", d.main); if (error) throw error;
      const { data: gone } = await ctx.db.from("pvp_acct_devices").delete().eq("main", d.main).neq("dev", d.dev).select("dev");
      return out(200, { ok: true, logged_out: (gone ?? []).length });
    }
    case "acct_sync": {
      const d = await acctDevice(ctx, b); if (!d) return out(401, { error: "Logged out. Log in again." });
      const { data: a } = await ctx.db.from("pvp_accounts").select("name").eq("main", d.main).maybeSingle();
      const exp = new Date(Date.now() + ACCT_TTL_MS).toISOString(), owner = d.main === OWNER_MAIN;
      if (owner || !b.profile) { await ctx.db.from("pvp_acct_devices").update({ expires_at: exp }).eq("dev", d.dev); return out(200, { ok: true, owner, name: a?.name, expires_at: exp }); }
      const R = cleanProfile(b.profile), L = { gold: Math.floor(Number(d.last?.gold) || 0), stats: d.last?.stats ?? {} } as { gold: number; stats: Record<string, number> };
      const m = Math.max(0.25, Math.min(60, (Date.now() - Date.parse(d.last_at)) / 60000));
      const who = { pid: d.main, owner: false };
      if (stalePrestige(R.prestige, await ctx.prestigeOf(d.main))) for (const k of Object.keys(R.levels)) R.levels[k] = 0; // [prestige] this device hasn't seen the latest prestige: its old levels can't come back through the max merge
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: row } = await ctx.db.from("pvp_dev_profiles").select("*").eq("id", d.main).maybeSingle();
        if (!row) return out(409, { error: "no save yet" });
        const cur = ctx.devProfile(row), next = cleanProfile(cur);
        // upgrades: the higher level of each (a level bought on either device counts once)
        for (const k of Object.keys(next.levels)) next.levels[k] = Math.max(cur.levels[k] | 0, R.levels[k] | 0);
        // stats: only what THIS device added since its last sync, at the same pace caps as every save (the rest is dropped)
        const kc = CAPS.killsBase + CAPS.killsPerMin * m, cap: Record<string, number> = { kills: kc, deaths: CAPS.deathsBase + CAPS.deathsPerMin * m, botKills: kc, harborKills: kc, bossKills: CAPS.bossBase + CAPS.bossPerMin * m, batteryHits: CAPS.batteryBase + CAPS.batteryPerMin * m };
        for (const k of STAT_KEYS) next.stats[k] = (cur.stats[k] ?? 0) + Math.max(0, Math.min(Math.floor(cap[k]), (R.stats[k] ?? 0) - Math.floor(Number(L.stats[k]) || 0)));
        // gold: this device's change since its last sync (spends count too). Value gained (gold + new upgrades) above the pace
        // allowance waits (pend): the device keeps it and it lands on a later sync, never lost.
        const dGold = R.gold - L.gold, allow = CAPS.valueBase + CAPS.valuePerMin * m + 50 * Math.max(0, (next.stats.batteryHits ?? 0) - (cur.stats.batteryHits ?? 0)); // [cliff gold] 50 g per counted cliff-gun hit (lib BATTERY_GOLD)
        if (ctx.upgValue(next.levels) - ctx.upgValue(cur.levels) + Math.min(0, dGold) > allow) next.levels = { ...cur.levels }; // unpaid upgrades don't land
        const gain = dGold + ctx.upgValue(next.levels) - ctx.upgValue(cur.levels);
        const pend = gain > allow ? Math.min(Math.max(0, dGold), Math.ceil(gain - allow)) : 0;
        next.gold = Math.max(0, Math.min(10_000_000, cur.gold + dGold - pend));
        next.skins.equipped = R.skins.equipped; (next as any).gear = R.gear;
        fitEquipped(next, await ctx.ownedSet(d.main), false);
        const { data: upd, error } = await ctx.db.from("pvp_dev_profiles").update({ ...ctx.devCols(next), updated_at: new Date().toISOString() })
          .eq("id", d.main).eq("gold", row.gold).eq("shop_rev", row.shop_rev).eq("updated_at", row.updated_at).select("id");
        if (error) throw error;
        if (!upd || !upd.length) continue; // another device / a purchase / a payout landed meanwhile: read again
        const { error: le } = await ctx.db.from("pvp_acct_devices").update({ last: snap(next), last_at: new Date().toISOString(), expires_at: exp }).eq("dev", d.dev).eq("token_hash", d.token_hash);
        if (le) throw le;
        return out(200, await ctx.shopView(who, next.gold, next.stats, row.shop_rev, { name: a?.name, expires_at: exp,
          acct: { gold: next.gold, pend, levels: next.levels, stats: next.stats, equipped: { skin: next.skins.equipped, gear: (next as any).gear } } }));
      }
      return out(409, { error: "busy" });
    }
  }
  return null;
}
