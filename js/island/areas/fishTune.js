// [fish2] PUMPFUN PIRATES fishing numbers (no three.js, so node tests import it): the reel fight per rarity, weights, shown sizes.
export const TIERS = { // the reel fight by rarity: zone = green width (0..1 of the bar), hz = marker sweeps per second, pulls = good presses to land it
  common: { zone: 0.34, hz: 0.85, pulls: 3 }, uncommon: { zone: 0.28, hz: 1.05, pulls: 4 }, rare: { zone: 0.22, hz: 1.3, pulls: 4 },
  epic: { zone: 0.17, hz: 1.55, pulls: 5, drift: 1 }, legendary: { zone: 0.13, hz: 1.8, pulls: 6, drift: 1 } };
export const STRIKES = 3, FIGHT_S = 14, BITE_S = 1.6;
// kg from cm (a length-cubed fit per body shape; eels are thin, the leviathan is a sea serpent)
const KG = { minnow: 1.0e-5, perch: 1.2e-5, snapper: 1.5e-5, eel: 0.25e-5, pike: 0.6e-5, carp: 1.6e-5, koi: 1.4e-5, leviathan: 0.8e-5 };
export const fishKg = (id, cm) => Math.max(0.01, Math.round((KG[id] || 1e-5) * cm * cm * cm * 100) / 100);
export const fmtKg = (kg) => kg < 1 ? Math.round(kg * 1000) + ' g' : (kg < 10 ? kg.toFixed(1) : Math.round(kg)) + ' kg';
// the length the 3D fish is shown at (m): real lengths, lifted for the little ones and capped for the serpent so they read in the hands
export const showLen = (cm) => Math.min(2.3, 0.34 + cm / 100 * 0.78);

