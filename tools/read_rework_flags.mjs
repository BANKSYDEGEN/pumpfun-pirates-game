#!/usr/bin/env node
// [v335] PUMPFUN PIRATES: print BANKSY's owner-only 🚩 REWORK flags (Build Mode, PIECES '!rw_*') so a dev knows what to rework where.
// usage:
//   node tools/read_rework_flags.mjs                 # live: pvp_terrain via the Supabase Management API (env SUPABASE_ACCESS_TOKEN, never printed)
//   node tools/read_rework_flags.mjs pieces.json     # offline: a terrain_get / localStorage pfp_terrain_v1 dump ({ pieces } or a bare pieces map)
//   add --json for machine output
// line format: [BLUE #2] r=60m at town(lx, lz) foot(x, z) · PART — "note"   (r=0 = PIN on that exact part)
import { readFileSync } from 'node:fs';
const PROJECT = process.env.SUPABASE_PROJECT_REF || 'qhandcjwlkmovjzwzqfk';
export function reworkFlags(pieces) {
  return Object.entries(pieces || {}).filter(([id, v]) => id.startsWith('!rw_') && v && v.rework)
    .map(([id, v]) => ({ id, ...v })).sort((a, b) => (a.num | 0) - (b.num | 0));
}
export function formatFlag(f) {
  const n = (x) => (Number(x) || 0).toFixed(1);
  return `[${String(f.color || 'red').toUpperCase()} #${f.num}] r=${f.r | 0}m${f.r ? '' : ' (PIN)'} at town(${n(f.lx)}, ${n(f.lz)}) foot(${n(f.x)}, ${n(f.z)}) y=${n(f.y)} · ${f.part || 'GROUND'}${f.partId ? ' [' + f.partId + ']' : ''}${f.note ? ' — "' + f.note + '"' : ''}${f.at ? ' · ' + new Date(f.at).toISOString() : ''}`;
}
async function livePieces() {
  const tok = process.env.SUPABASE_ACCESS_TOKEN; if (!tok) throw new Error('set SUPABASE_ACCESS_TOKEN (or pass a pieces.json file)');
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: "select pieces from pvp_terrain where id = 'island'" }) });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const rows = await r.json(); return rows?.[0]?.pieces || {};
}
async function main() {
  const args = process.argv.slice(2), asJson = args.includes('--json'), file = args.find(a => !a.startsWith('--'));
  let pieces; if (file) { const j = JSON.parse(readFileSync(file, 'utf8')); pieces = j.pieces || j; } else pieces = await livePieces();
  const flags = reworkFlags(pieces);
  if (asJson) { console.log(JSON.stringify(flags, null, 2)); return; }
  if (!flags.length) { console.log('no 🚩 rework flags'); return; }
  console.log(`🚩 ${flags.length} rework flag${flags.length === 1 ? '' : 's'} (PUMPFUN PIRATES build mode)`);
  for (const f of flags) console.log(formatFlag(f));
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
