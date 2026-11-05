// Headless engine check, no browser and no score writes.
const root = new URL('../../../', import.meta.url).href;
const F = await import(root + 'js/island/foot.js');
const CO = await import(root + 'js/island/coast.js');
const { coastLayout } = await import(root + 'js/dock/layout.js');
const A = new Proxy({}, { get: () => [0, 0, 1, 1] });
for (const fn of ['buildStreet', 'buildInland', 'buildCoast']) F[fn](A, true, []);
const layout = await coastLayout();
const checks = CO.PLAZA_POIS.filter(q => ['waves', 'arena'].includes(q.id)).map(q => {
  const p = CO.boardApproach(q), prompt = layout.interact.find(v => v.id === q.id);
  const [px, pz] = CO.fromHarbor(prompt.x, prompt.z), [wx, wz] = CO.t2w(q.lx, q.lz);
  const trace = [];
  const pts = [[p.lx, -24], [p.lx, p.lz]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], n = Math.ceil(Math.hypot(bx - ax, bz - az) / .25);
    for (let j = 0; j <= n; j++) {
      const lx = ax + (bx - ax) * j / n, lz = az + (bz - az) * j / n, [x, z] = CO.t2w(lx, lz);
      trace.push({ lx, lz, hit: !!F.hitCollider(x, z, .45), y: F.areaDeckAt(x, z) ?? F.H(x, z) });
    }
  }
  return { id: q.id, anchor: q, approach: p, prompt: { ...prompt, footX: px, footZ: pz },
    promptHit: !!F.hitCollider(px, pz, .45), backingSolid: !!F.hitCollider(wx, wz, .1),
    pathHits: trace.filter(t => t.hit).length, trace };
});
console.log(JSON.stringify(checks));
