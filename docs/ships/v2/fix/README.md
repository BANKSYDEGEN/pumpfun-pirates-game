# Ships v2 fix: STORM and FLAMING (visual only)
BEFORE = stage 3 (e81153d), AFTER = this fix. In-game gameplay camera on desktop (high) and phone (low), at lvl 0 and with every upgrade at max.

**Images**
- One combined sheet per skin: `storm_fix_sheet.jpg`, `flaming_fix_sheet.jpg`.
- Single pairs: `{storm,flaming}_{desktop,phone}_{lv0,max}_before_after.jpg`.
- Zoomed desktop comparison: `storm_flaming_desktop_zoom_before_after.jpg`.

**STORM** (catalog: slate hull #4a5058, lightning-blue #9fdcff trim and stripe). On the v2 hull it now has:
- a dark slate-navy body;
- storm-blue sail cloth instead of white, with the lightning veins kept as the accent;
- electric-blue trim, wales, stern windows and lanterns;
- the rim and flash glow over the body cut to 0.12 of its old strength.

**FLAMING** keeps a black, charred hull with glowing red-orange cracks:
- the orange heat and rim glow are gone from the hull and dress;
- the trim is dark iron instead of gold;
- the stern windows and lanterns are a dim ember red;
- fire point lights are at 0.35;
- the fire tongues are dimmer, the rail tongues stay clear of the stern quarters, and there are fewer stern tongues, set in from the taffrail. This cuts the bloom halo that made the hull read bronze.

These changes apply only to the v2 player hull (the `art*` palette keys and the `ud.art` paths). COMMODORE, Waves enemies and the main-branch look are unchanged.

**Verification**
- Muzzle/hitbox harness: 676 configs, 7,480 muzzles, **0 differ** from main.
- Kraken clip check: ALL OK.
- In-game fire: every ball launched from its own muzzle, offset 0 m. One flaming max run first logged 18 of 24 inside the 15 s window; the rerun of that config logged 24 of 24.
- Phone LOW scene draw calls are unchanged from stage 3 (`phone_budget_stage3_vs_fix.json`):

| Skin | lvl 0 | all max |
|---|---|---|
| Storm | 42 | 64 |
| Flaming | 43 | 65 |
| Classic | 40 | 62 |
