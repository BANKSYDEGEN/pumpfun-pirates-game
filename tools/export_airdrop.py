#!/usr/bin/env python3
# Read-only export of every known player wallet (Waves + PvP) to /workspace/airdrop_wallets.csv.
# Uses SUPABASE_ACCESS_TOKEN from the environment (never printed). Only SELECTs; nothing is written to the database.
import csv, json, os, sys, urllib.request
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/airdrop_wallets.csv'
SQL = r"""
with src as (
  select wallet, name, 'waves_score' s, created_at t from public.scores
  union all select wallet, name, 'waves_player', coalesce(updated_at, created_at) from public.players
  union all select wallet, name, 'pvp_entry', updated_at from public.pvp_airdrop
  union all select wallet, null, 'pvp_signed_in', updated_at from public.pvp_profiles
)
select s.wallet,
  (array_agg(s.name order by s.t desc) filter (where s.name is not null and s.name <> ''))[1] as name,
  string_agg(distinct s.s, '+') as sources,
  (select max(score) from public.scores x where x.wallet = s.wallet) as waves_best,
  (select count(*) from public.pvp_kills k where k.killer_id = 'wallet:' || s.wallet) as pvp_kills_signed_in,
  bool_or(s.s like 'pvp%') as pvp, bool_or(s.s like 'waves%') as waves,
  max(s.t) as last_seen
from src s where s.wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
group by s.wallet order by last_seen desc nulls last
"""
tok = os.environ.get('SUPABASE_ACCESS_TOKEN')
if not tok: sys.exit('SUPABASE_ACCESS_TOKEN is not set')
req = urllib.request.Request('https://api.supabase.com/v1/projects/qhandcjwlkmovjzwzqfk/database/query', data=json.dumps({'query': SQL, 'read_only': True}).encode(),
  headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json', 'User-Agent': 'pfp-export'})
try: rows = json.loads(urllib.request.urlopen(req).read())
except urllib.error.HTTPError as e: sys.exit(f'query failed: HTTP {e.code} {e.read()[:300].decode(errors="replace")}')
rows = [r for r in rows if not (r.get('name') or '').startswith('QA_')]  # test rows never go in the list
cols = ['wallet', 'name', 'sources', 'waves', 'pvp', 'waves_best', 'pvp_kills_signed_in', 'last_seen']
with open(OUT, 'w', newline='') as f:
  w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore'); w.writeheader(); w.writerows(rows)
print(f'{len(rows)} wallets -> {OUT} (waves {sum(1 for r in rows if r["waves"])}, pvp {sum(1 for r in rows if r["pvp"])})')
