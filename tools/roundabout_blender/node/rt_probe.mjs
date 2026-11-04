// [Timothy] Pirates' Climb data near the roundabout (stairs / walls / lamps / sign) -> stdout
const F = await import(new URL('../../../', import.meta.url).href + 'js/island/foot.js');
const RTm = await import(new URL('../../../', import.meta.url).href + 'js/island/areas/route.js'); const RT = RTm._route;
const R = new Proxy({}, { get: () => [0, 0, 1, 1] }); for (const fn of ['buildStreet', 'buildInland', 'buildCoast']) F[fn](R, true, []);
const near = (o) => o.x > -440 && o.x < -400 && o.z > -135 && o.z < -75;
console.log('stairs', RT.stairs.filter(near).map(s => [s.i, +s.x.toFixed(1), +s.z.toFixed(1), +s.along.toFixed(1), s.L.toFixed(1)]));
console.log('walls', RT.walls.filter(near).map(s => [+s.x.toFixed(1), +s.z.toFixed(1), +s.along.toFixed(1)]));
console.log('lamps', RT.lamps.filter(near).map(s => [s.k, +s.x.toFixed(1), +s.z.toFixed(1), +s.y.toFixed(1), +s.along.toFixed(1), s.onWall]));
console.log('sign', RT.lm.sign, 'ford', RT.lm.ford, 'bridge', RT.bridge && [RT.bridge.a0, RT.bridge.a1]);
console.log('interact', F.INTERACT.filter(near).map(q => [q.id, +q.x.toFixed(1), +q.z.toFixed(1)]));
