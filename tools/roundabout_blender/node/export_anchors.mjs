// [Timothy] writes assets/island/fountain_anchor.json from js/island/areas/hillRound.js (the wishing-fountain anchors, world coords)
import { writeFileSync } from 'node:fs';
const HR = await import(new URL('../../../', import.meta.url).href + 'js/island/areas/hillRound.js');
const r = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(3) : v]));
const out = { note: 'Fountain plaza (js/island/areas/hillRound.js FOUNTAIN_ANCHORS). rim = where a player stands for the prompt (world feet y); coin = the splash point on the basin water; radius = the prompt trigger radius around rim. &roundabout=0 = no fountain.',
  fountain: r({ x: HR.FOUNTAIN.x, z: HR.FOUNTAIN.z, basinR: HR.FOUNTAIN.basinR, rimY: HR.FOUNTAIN.rimY, waterY: HR.FOUNTAIN.waterY }), rim: r(HR.FOUNTAIN_ANCHORS.rim), coin: r(HR.FOUNTAIN_ANCHORS.coin), radius: HR.FOUNTAIN_ANCHORS.radius };
writeFileSync(new URL('../../../assets/island/fountain_anchor.json', import.meta.url), JSON.stringify(out, null, 1) + '\n'); console.log(JSON.stringify(out));
