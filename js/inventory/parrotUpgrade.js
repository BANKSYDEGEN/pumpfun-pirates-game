// UI estimates only: the existing parrot_treat RPC owns charges, XP and unlocks.
export const PARROT_UNLOCKS = [[1, 'RED'], [2, 'BLUE'], [4, 'WHITE'], [6, 'BLACK'], [8, 'GOLD'], [10, 'DIAMOND']];
export function parrotUpgradeState(xp, gold) {
  xp = Math.max(0, Math.min(10000, Number(xp) || 0));
  const lv = Math.min(10, Math.floor(Math.sqrt(xp / 100))), cost = lv >= 10 ? 0 : 250 * (lv + 1) ** 2;
  return { xp, lv, cost, max: lv >= 10, can: lv < 10 && Number.isFinite(gold) && gold >= cost,
    remaining: lv >= 10 ? 0 : (lv + 1) ** 2 * 100 - xp };
}
export function parrotUpgradeFeedback(beforeXp, r) {
  const before = parrotUpgradeState(beforeXp, 0), after = parrotUpgradeState(r.xp, 0);
  const unlocked = PARROT_UNLOCKS.filter(([lv]) => lv > before.lv && lv <= after.lv).map(([, name]) => name);
  return `${after.lv > before.lv ? 'PARROT LEVEL UP' : 'PARROT TREAT'} · LV ${after.lv} · ${after.xp.toLocaleString()} XP${unlocked.length ? '<br>NEW COLOR UNLOCKED · ' + unlocked.join(', ') : ''}`;
}
