// [Timothy] ground beside the fort stair (fort_stair_1) for the castle approach walls -> stdout
const F = await import(new URL('../../../', import.meta.url).href + 'js/island/foot.js');
const R = new Proxy({}, { get: () => [0, 0, 1, 1] }); for (const fn of ['buildStreet', 'buildInland', 'buildCoast']) F[fn](R, true, []);
for (let z = -72; z <= -46; z += 2) console.log(z, [-438, -436.8, -436, -434, -432, -431.2, -430].map(x => [F.H(x, z).toFixed(2), F.groundAt ? (F.groundAt(x, z, 99)?.toFixed?.(2) ?? '') : ''].join('/')).join('  '));
