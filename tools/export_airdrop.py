#!/usr/bin/env python3
# Read-only export of known player wallets (Waves + PvP) to /workspace/airdrop_wallets.csv.
# Uses SUPABASE_ACCESS_TOKEN from the environment (never printed). Only SELECTs; nothing is written to the database.
# [security H2 / H4] DEFAULT = SIGNED wallets only: a wallet that signed in (pvp_profiles / players), a verified score, or an airdrop
# wallet confirmed by its own signature (pvp_airdrop.verified, migration 028). Typed-in, never-signed addresses can be anyone's
# (or a farmer's), so anything reward-linked should use the default list. --all adds them, marked signed=false.
# Usage: python3 tools/export_airdrop.py [--all] [out.csv]
import csv, json, os, sys, urllib.request
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
ALL = '--all' in sys.argv
OUT = ARGS[0] if ARGS else '/workspace/airdrop_wallets.csv'
SQL = r"""
with src as (
  select wallet, name, 'waves_score' s, created_at t, coalesce(verified, false) signed from public.scores
  union all select wallet, name, 'waves_player', coalesce(updated_at, created_at), true from public.players
  union all select wallet, name, 'pvp_entry', updated_at, coalesce((to_jsonb(a) ->> 'verified')::boolean, false) from public.pvp_airdrop a
  union all select wallet, null, 'pvp_signed_in', updated_at, true from public.pvp_profiles
)
select s.wallet,
  (array_agg(s.name order by s.t desc) filter (where s.name is not null and s.name <> ''))[1] as name,
  string_agg(distinct s.s, '+') as sources,
  (select max(score) from public.scores x where x.wallet = s.wallet) as waves_best,
  (select count(*) from public.pvp_kills k where k.killer_id = 'wallet:' || s.wallet) as pvp_kills_signed_in,
  bool_or(s.s like 'pvp%') as pvp, bool_or(s.s like 'waves%') as waves,
  max(s.t) as last_seen, bool_or(s.signed) as signed
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
unsigned = sum(1 for r in rows if not r.get('signed'))
if not ALL: rows = [r for r in rows if r.get('signed')]
cols = ['wallet', 'name', 'signed', 'sources', 'waves', 'pvp', 'waves_best', 'pvp_kills_signed_in', 'last_seen']
with open(OUT, 'w', newline='') as f:
  w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore'); w.writeheader(); w.writerows(rows)
print(f'{len(rows)} wallets -> {OUT} (waves {sum(1 for r in rows if r["waves"])}, pvp {sum(1 for r in rows if r["pvp"])}; '
      + (f'{unsigned} never-signed wallets INCLUDED (signed=false)' if ALL else f'{unsigned} never-signed wallets left out, use --all to include them') + ')')
