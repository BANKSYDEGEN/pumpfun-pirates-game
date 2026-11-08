// Display only: never put formatted text in saves, requests, prices or input values.
const goldNumbers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
export function formatGoldAmount(value) {
  const n = Number(value);
  return goldNumbers.format(Number.isFinite(n) ? Math.trunc(n) : 0);
}
