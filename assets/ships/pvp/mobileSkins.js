// [Raul] Ship skins that exist ONLY in the SALTY PIRATES mobile apps (BANKSYDEGEN/pumpfun-pirates-ios and
// pumpfun-pirates-android, js/skins.js, identical in both repos), staged for PvP kill tiers.
// They are palette skins on the same procedural three.js ship as the web game (no GLB / model files exist):
// same data shape as the web js/skins.js, so skinBuildOpts() + the upgrade compiler build them unchanged.
// Copied verbatim; only price/premium changed (they were iap / season-pass in the apps). No killsRequired is
// set here, so the PvP config decides which tier gets which (KRAKEN INK fits the 100-kill Kraken tier).
export const MOBILE_SKINS = [
  { id: 'seagreen', name: 'SEA GREEN', price: 0, premium: 'pvp', blurb: 'Dark green timbers with bright sea-green trim.',
    palette: { seed: 101, wood: 0x3a2a1c, band: 0x0f2a18, stripe: 0x4ee37a, band2: 0x14361f, tar: 0x0b120d, trim: 0x4ee37a, sail: 0x0f1a12, patch: [0x16301e, 0x0a120c], hem: 0x4ee37a, lantern: 0x7dffa8, window: 0x9cffb5, stripes: 0x1f6b37 },
    sail: { bg: '#0d1610', lines: 'rgba(78,227,122,0.06)', border: '#4ee37a' }, flag: { bg: '#0d1610', border: '#4ee37a' },
    parts: { oak: 0x2a1e14, plank: 0x14361f, iron: 0x16201a, gold: 0x4ee37a, glow: 0x5cff8f },
    swatch: { hull: '#3a2a1c', band: '#0f2a18', stripe: '#4ee37a', sail: '#0d1610', trim: '#4ee37a' } },
  { id: 'kraken', name: 'KRAKEN INK', price: 0, premium: 'pvp', blurb: 'Deep-sea purple with ink-black sails.',
    palette: { seed: 131, wood: 0x3a2440, band: 0x1a0f22, stripe: 0xb07cff, band2: 0x2a1836, tar: 0x120a18, trim: 0xb07cff, sail: 0x1c1028, patch: [0x2a1a3a, 0x120a1a], hem: 0xb07cff, lantern: 0xc9a2ff, window: 0xd8b8ff },
    sail: { bg: '#1c1028', lines: 'rgba(176,124,255,0.10)', border: '#b07cff' }, flag: { bg: '#2a1836', border: '#b07cff' },
    parts: { oak: 0x2e1c34, plank: 0x3a2440, iron: 0x1a1220, gold: 0xb07cff, glow: 0xc9a2ff },
    swatch: { hull: '#3a2440', band: '#1a0f22', stripe: '#b07cff', sail: '#1c1028', trim: '#b07cff' } },
  { id: 'storm', name: 'STORM RIDER', price: 0, premium: 'pvp', blurb: 'Slate grey hull, lightning-white sails.',
    palette: { seed: 141, wood: 0x4a5058, band: 0x23272c, stripe: 0x9fdcff, band2: 0x30363d, tar: 0x15181b, trim: 0x9fdcff, sail: 0xe8eef4, patch: [0xd0d8e0, 0xf6f9fc], hem: 0x23272c, lantern: 0xbfe8ff, window: 0xd8f0ff },
    sail: { bg: '#dfe6ee', lines: 'rgba(35,39,44,0.10)', border: '#23272c' }, flag: { bg: '#30363d', border: '#9fdcff' },
    parts: { oak: 0x3a4048, plank: 0x4a5058, iron: 0x23272c, gold: 0x9fdcff, glow: 0xbfe8ff },
    swatch: { hull: '#4a5058', band: '#23272c', stripe: '#9fdcff', sail: '#dfe6ee', trim: '#9fdcff' } },
  { id: 'coral', name: 'CORAL REEF', price: 0, premium: 'pvp', blurb: 'Warm coral sails over sea-green timbers.',
    palette: { seed: 151, wood: 0x2f5a52, band: 0x173a34, stripe: 0xff7f6a, band2: 0x204a43, tar: 0x0f2420, trim: 0xffb3a3, sail: 0xff8c75, patch: [0xf2735d, 0xffa894], hem: 0x173a34, lantern: 0xffc4a8, window: 0xffd8c4 },
    sail: { bg: '#ff8c75', lines: 'rgba(23,58,52,0.12)' }, flag: { bg: '#204a43', border: '#ff7f6a' },
    parts: { oak: 0x264a44, plank: 0x2f5a52, iron: 0x173a34, gold: 0xffb3a3 },
    swatch: { hull: '#2f5a52', band: '#173a34', stripe: '#ff7f6a', sail: '#ff8c75', trim: '#ffb3a3' } },
  { id: 'admiral', name: 'ADMIRAL WHITE', price: 0, premium: 'pvp', blurb: 'Season pass exclusive: white and gold flagship.',
    palette: { seed: 161, wood: 0xe8e2d4, band: 0xffcd77, stripe: 0x1b2f6b, band2: 0xd8cfba, tar: 0x5a5040, trim: 0xffcd77, sail: 0xfaf6ec, patch: [0xece4d2, 0xffffff], hem: 0xffcd77, lantern: 0xffe2a8, window: 0xfff0c8 },
    sail: { bg: '#f6f1e4', lines: 'rgba(255,205,119,0.14)', border: '#ffcd77' }, flag: { bg: '#1b2f6b', border: '#ffcd77' },
    parts: { oak: 0xd8d0be, plank: 0xe8e2d4, deck: 0xf0ead8, iron: 0x8a8070, gold: 0xffcd77, glow: 0xffe2a8 },
    swatch: { hull: '#e8e2d4', band: '#ffcd77', stripe: '#1b2f6b', sail: '#f6f1e4', trim: '#ffcd77' } },
];
export default MOBILE_SKINS;
