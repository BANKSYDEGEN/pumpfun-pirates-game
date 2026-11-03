// [island-rework] THE single switch for every gold-paying island activity (PRICES_FOR_BANKSY.md: all PENDING BANKSY approval).
// While false, nothing on the island pays or charges gold: chests / fish / bounties show "reward pending" and give cosmetic progress only.
// Turning it on is NOT enough by itself: each reward also needs its server-side handler (none exist yet), so gold can't leak from the client.
export const AREA_GOLD_ON = false;
export const goldReward = (_id) => (AREA_GOLD_ON ? null /* server-rolled when built */ : null);
export const PENDING = '<small>gold reward pending approval · progress saved</small>';
