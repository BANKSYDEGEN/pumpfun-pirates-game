#!/usr/bin/env bash
# [inventory] back up the rows migration 036 can touch BEFORE applying it (read-only REST dumps; needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env).
set -euo pipefail; D=/workspace/backups/v200_inventory_$(date +%Y%m%d_%H%M%S); mkdir -p "$D"
for t in pvp_profiles pvp_dev_profiles pvp_owned pvp_maps pvp_map_loot; do
  curl -sf "$SUPABASE_URL/rest/v1/$t?select=*" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Range: 0-999999" > "$D/$t.json"
  echo "$t $(python3 -c "import json,sys;print(len(json.load(open('$D/$t.json'))))")" >> "$D/counts_before.txt"; done
echo "backup: $D"; cat "$D/counts_before.txt"
