// Helius enhanced-webhook receiver for $AHOY / $SUNK trades. Authenticated by a shared secret in the Authorization header
// (Helius authHeader). Writes only parsed buy/sell rows for our two mints into the private helius_trades table.
import { parseTrades } from './parse.js';
const MAX = 512 * 1024;
const enc = new TextEncoder();
function same(a: string, b: string) { const x = enc.encode(a), y = enc.encode(b); let d = x.length ^ y.length; for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0); return d === 0 && x.length > 0; }
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
let hits: number[] = [];
Deno.serve(async req => {
  if (req.method !== 'POST') return json(405, { ok: false });
  const secret = Deno.env.get('HELIUS_WEBHOOK_SECRET') || '';
  if (!secret || !same(req.headers.get('authorization') || '', secret)) return json(401, { ok: false });
  const now = Date.now(); hits = hits.filter(t => now - t < 60000); if (hits.length > 600) return json(429, { ok: false }); hits.push(now);
  if (!/json/i.test(req.headers.get('content-type') || '')) return json(415, { ok: false });
  const len = Number(req.headers.get('content-length') || 0); if (len > MAX) return json(413, { ok: false });
  const buf = new Uint8Array(await req.arrayBuffer()); if (buf.length > MAX) return json(413, { ok: false });
  let body: unknown; try { body = JSON.parse(new TextDecoder().decode(buf)); } catch { return json(400, { ok: false }); }
  const txs = Array.isArray(body) ? body.slice(0, 100) : [];
  const rows = txs.flatMap(t => parseTrades(t));
  if (!rows.length) return json(200, { ok: true, stored: 0 });
  const k = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const r = await fetch(Deno.env.get('SUPABASE_URL') + '/rest/v1/helius_trades?on_conflict=signature', { method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json', apikey: k, Authorization: 'Bearer ' + k, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows) });
  if (!r.ok) return json(500, { ok: false });
  return json(200, { ok: true, stored: rows.length });
});
