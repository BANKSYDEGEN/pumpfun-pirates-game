// hq-data-v2 last-good store (private table hq_board_last_good). Written ONLY with real, non-empty rows from a successful
// source read; failures never overwrite it. Read when the live cache is missing/expired so boards show old data marked stale.
const url = () => Deno.env.get('SUPABASE_URL') + '/rest/v1/hq_board_last_good';
const hdr = () => { const k = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; return { 'Content-Type': 'application/json', apikey: k, Authorization: 'Bearer ' + k }; };
export const LAST_GOOD_MAX_AGE = 7 * 86400000; // older than a week is not worth showing even as "last good"
export type Good = { key: string; rows: unknown; status?: string | null; source: string; at: number };
const empty = (r: unknown) => r == null || (Array.isArray(r) && !r.length) || (typeof r === 'object' && !Array.isArray(r) && !Object.keys(r as object).length);
export async function saveGood(list: Good[]) {
  const body = list.filter(g => !empty(g.rows) && Number.isFinite(g.at) && g.at > 0 && /^(board|pumpfeed|chain):[a-z0-9_:]{2,64}$/.test(g.key))
    .map(g => ({ key: g.key, rows: g.rows, status: g.status ? String(g.status).slice(0, 120) : null, source: String(g.source).slice(0, 80), source_at: new Date(g.at).toISOString(), saved_at: new Date().toISOString() }));
  if (!body.length) return 0;
  const r = await fetch(url() + '?on_conflict=key', { method: 'POST', headers: { ...hdr(), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body), signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw Error('last good write unavailable');
  return body.length;
}
export async function readGood(prefix: string): Promise<Record<string, Good>> {
  const q = new URLSearchParams({ select: 'key,rows,status,source,source_at', key: 'like.' + prefix + '*' });
  const r = await fetch(url() + '?' + q, { headers: hdr(), signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw Error('last good unavailable');
  const out: Record<string, Good> = {};
  for (const x of await r.json()) { const at = Date.parse(x.source_at); if (Number.isFinite(at) && Date.now() - at < LAST_GOOD_MAX_AGE) out[x.key] = { key: x.key, rows: x.rows, status: x.status, source: x.source, at }; }
  return out;
}
