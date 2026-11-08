// Freshness is the source timestamp, never the redraw time. No synthetic feed rows.
export const ageLabel = (at, now = Date.now()) => at ? 'updated ' + Math.max(0, Math.floor((now - at) / 1000)) + 's ago' : 'Feed offline';
const signature = r => JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => !['updated','stale','observedAt','seenAt'].includes(k)).sort(([a],[b]) => a.localeCompare(b))));
export function markRows(state, key, rows, now) {
 const old = new Map((state[key] || []).map(r => [r.mint, signature(r)]));
 state.flashes ||= {}; const flashes = state.flashes[key] ||= {};
 for (const r of rows) if (old.get(r.mint) !== signature(r)) flashes[r.mint] = now + 2500;
 for (const [mint, until] of Object.entries(flashes)) if (until < now) delete flashes[mint];
}
export function rowFlash(g, state, key, mint, x, y, w, h, now) {
 const left = (state.flashes?.[key]?.[mint] || 0) - now;
 if (left <= 0) return;
 g.save(); g.fillStyle = 'rgba(63,210,127,' + (.26 * Math.min(1, left / 1000)) + ')'; g.fillRect(x,y,w,h); g.restore();
}
export function liveTag(g, at, now, x, y, size = 18, align = 'left') {
 g.save();g.font = '700 ' + size + 'px system-ui,sans-serif';g.textAlign=align;g.textBaseline='middle';g.fillStyle='#e2d2ae';g.fillText(ageLabel(at,now),x,y);g.restore();
}
