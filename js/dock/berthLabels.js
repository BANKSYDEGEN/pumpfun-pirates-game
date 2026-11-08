// Presentation only: keep dk/server/save IDs unchanged. Cannon Hill is the B10 end.
export const BERTH_LABEL_COUNT = 10;
export function berthDisplayNumber(berth, total = BERTH_LABEL_COUNT) {
 const id = typeof berth === 'string' ? berth : berth?.id, m = /^B([1-9]\d*)$/.exec(id || '');
 return m && +m[1] <= total ? total + 1 - +m[1] : Infinity;
}
export function berthLabel(berth, total = BERTH_LABEL_COUNT) {
 const n = berthDisplayNumber(berth, total), id = typeof berth === 'string' ? berth : berth?.id;
 return Number.isFinite(n) ? 'B' + n : id || '';
}
