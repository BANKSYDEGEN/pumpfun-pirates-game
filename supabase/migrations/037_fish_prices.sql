-- [v208] BANKSY 12:55 PM: "Turn on Antiques selling and the Marketplace" + "Turn on fish stand too make prices like 25-500 gold".
-- Fish Stand payouts by rarity (js/inventory/catalog.js FISH mirrors these; the server pays from this table only). Data-only, additive.
insert into public.pvp_inv_prices (item, shop, price) values
  ('fish:minnow','fish',25), ('fish:perch','fish',35), ('fish:snapper','fish',60), ('fish:eel','fish',90),
  ('fish:pike','fish',140), ('fish:carp','fish',200), ('fish:koi','fish',300), ('fish:leviathan','fish',500)
  on conflict (item, shop) do update set price = excluded.price;
update public.pvp_flags set on_ = true, updated_at = now() where k in ('fish_sell', 'antiques_sell', 'market');
