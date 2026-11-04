-- [fish2] PUMPFUN PIRATES fishing upgrade: the reel fight with SERVER-rolled fish (Edge actions inv_fish_bite / inv_fish_land, inventory.ts).
-- ADDITIVE: one new flag row, OFF. No table, column, function, price or player row changes. The Fish Stand prices (037) are untouched.
-- While the flag is off the Edge Function refuses both actions ("reel closed") and the game keeps using inv_fish (unchanged, plus a length).
-- Turn on (only with BANKSY's OK): update pvp_flags set on_ = true where k = 'fish_reel';
-- ROLLBACK: update pvp_flags set on_ = false where k = 'fish_reel';
begin;
insert into public.pvp_flags (k, on_, note) values ('fish_reel', false, 'fishing: server-rolled bite + reel fight (rarer fish fight harder)') on conflict (k) do nothing;
commit;
