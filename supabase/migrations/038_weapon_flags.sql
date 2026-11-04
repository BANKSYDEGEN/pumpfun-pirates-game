-- [v209] BANKSY 1:03 PM "Turn on weapon stats and rare weapon drops" (the marketplace fee stays OFF for good). Additive: flips two 036 flags.
update public.pvp_flags set on_ = true, updated_at = now() where k in ('weapon_stats', 'rare_weapon_drops');
