// [gold-item] Edge helpers for balance ↔ house / gift gold moves (migration 068).
import { GOLD_ITEM, GOLD_CAP, isGoldItem } from "./invCatalog.ts";

export { GOLD_ITEM, GOLD_CAP, isGoldItem };

export const goldQty = (q: unknown) => {
  const n = Math.floor(Number(q));
  return Number.isFinite(n) && n >= 1 && n <= GOLD_CAP ? n : 0;
};

export const reqOf = (r: unknown) =>
  typeof r === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(r) ? r : "";

export function newReq(prefix: string) {
  const a = crypto.getRandomValues(new Uint8Array(18));
  return (prefix + [...a].map((x) => x.toString(16).padStart(2, "0")).join("")).slice(0, 64);
}
