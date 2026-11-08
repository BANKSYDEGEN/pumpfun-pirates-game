// Display only: never put formatted text in saves, requests, prices or input values.
const goldNumbers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const formatted = new Map();
const painted = new WeakMap();
export function formatGoldAmount(value) {
  const n = Number(value);
  const v = Number.isFinite(n) ? Math.trunc(n) : 0;
  if (formatted.has(v)) return formatted.get(v);
  const text = goldNumbers.format(v);
  if (formatted.size >= 256) formatted.clear();
  formatted.set(v, text); return text;
}

export function setGoldText(node, value) {
  if (!node) return false;
  const text = formatGoldAmount(value);
  if (painted.get(node) === text) return false;
  node.textContent = text; painted.set(node, text); return true;
}
