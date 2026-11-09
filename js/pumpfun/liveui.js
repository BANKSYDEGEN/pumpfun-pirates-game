// Freshness is the source timestamp, never the redraw time. No synthetic feed rows.
// hq-data-v2 (BANKSY t2448u): "updated X min ago" on every board, and a board whose source time is older than STALE_MS is
// labelled STALE so an old snapshot is never shown as if it were live. No source time at all = "Feed offline".
export const STALE_MS = 5 * 60000;
export const agoText = (at, now = Date.now()) => { const s = Math.max(0, Math.floor((now - at) / 1000)); if (s < 60) return s + 's'; const m = Math.floor(s / 60); if (m < 60) return m + ' min'; const h = Math.floor(m / 60); return h < 48 ? h + ' h' : Math.floor(h / 24) + ' d'; };
export const isStale = (at, now = Date.now(), staleMs = STALE_MS) => !at || now - at > staleMs;
export const ageLabel = (at, now = Date.now(), staleMs = STALE_MS) => !at ? 'Feed offline' : (isStale(at, now, staleMs) ? 'STALE · updated ' : 'updated ') + agoText(at, now) + ' ago';
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
// prefix: event boards (e.g. 'last buy ') where a quiet market is not staleness; they show the event age, never STALE.
export function liveTag(g, at, now, x, y, size = 18, align = 'left', prefix = '') {
 const old = !prefix && isStale(at, now), s = prefix ? (at ? prefix + agoText(at, now) + ' ago' : prefix.trim() + ' —') : ageLabel(at, now);
 g.save();g.font = '700 ' + size + 'px system-ui,sans-serif';g.textAlign=align;g.textBaseline='middle';g.fillStyle=old?'#ffb347':'#e2d2ae';g.fillText(s,x,y);g.restore();
}
