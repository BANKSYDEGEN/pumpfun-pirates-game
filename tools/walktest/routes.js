// [island-rework] walk-test ROUTES (tools/walktest/walktest.js). A route = { id, cell?, pts: [[x, z], ...] } in the FOOT frame (north = -z).
// Sets: 'batch' = the B3/D3 ship batch (plaza -> Main Street -> gate -> fort, the Pirates' Climb, trail A -> rope bridge -> trail A);
//       'island' = every trail (A, B), every area path, every stair / bridge / dock deck along its long axis, + the 25 grid-cell borders.
export const GRID = { x0: -810, z0: -680, size: 250, cols: 'ABCDE', rows: 5 };
export const cellOf = (x, z) => { const c = Math.floor((x - GRID.x0) / GRID.size), r = Math.floor((z - GRID.z0) / GRID.size);
  return c < 0 || r < 0 || c > 4 || r > 4 ? 'off' : GRID.cols[c] + (r + 1); };
const offset = (P, o) => P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [p[0] + (b[1] - a[1]) / L * o, p[1] - (b[0] - a[0]) / L * o]; });
export function routes(set, ctx) {
  const { FM, AREA_DECKS } = ctx, R = [];
  const GATE = FM.townToWorld(FM.STREET.x, FM.STREET.z1), PLAZA = FM.townToWorld(FM.STREET.x, -40);
  if (set === 'batch' || set === 'island') {
    R.push({ id: 'plaza_to_gate', pts: [PLAZA, FM.townToWorld(FM.STREET.x, FM.STREET.z0), GATE] });
    R.push({ id: 'gate_to_fort_ramparts', pts: [GATE, [-434, -76], [-434, -72], [-434, -44], [-431.5, -44], [-420, -44], [-414, -44], [-417.5, -34.75], [-416.5, -34.75], [-404, -34.75], [-404, -32.4], [-410, -32.4], [-418, -32.4]] });
    R.push({ id: 'fort_yard_to_keep', pts: [[-414, -44], [-409, -44], [-405, -44]] });
    R.push({ id: 'pirates_climb_gate_to_trailhead', pts: ctx.ROUTE_PTS }); // the designed route (route.js: trail A + the straight gate lead-in)
    for (const o of [-1.6, 1.6]) R.push({ id: 'pirates_climb_edge_' + (o < 0 ? 'l' : 'r'), pts: offset(ctx.ROUTE_PTS, o) }); // both edges of the 4.6 m tread (turn wedges, cross-slope)
    R.push({ id: 'rope_bridge_s_to_n', pts: [[16, -150], [16, -104.5], [16, -83], [16, -62.5], [16, -46]] });
  }
  if (set === 'island') {
    for (const [k, T] of Object.entries(FM.TRAILS)) R.push({ id: 'trail_' + k, pts: T });
    for (const p of ctx.AREA_TERRAIN?.paths || []) R.push({ id: 'path_' + p.id, pts: p.pts });
    for (const d of AREA_DECKS) { if (d.r) continue; const L = d.hl, ux = Math.sin(d.yaw || 0), uz = Math.cos(d.yaw || 0);
      R.push({ id: 'deck_' + d.id, deck: true, pts: [[d.x - ux * (L + 1.5), d.z - uz * (L + 1.5)], [d.x + ux * (L + 1.5), d.z + uz * (L + 1.5)]] }); }
    for (let c = 0; c <= 5; c++) { const x = GRID.x0 + c * GRID.size; R.push({ id: 'border_x' + x, border: true, pts: [[x + 0.5, GRID.z0], [x + 0.5, GRID.z0 + 5 * GRID.size]] }); }
    for (let r = 0; r <= 5; r++) { const z = GRID.z0 + r * GRID.size; R.push({ id: 'border_z' + z, border: true, pts: [[GRID.x0, z + 0.5], [GRID.x0 + 5 * GRID.size, z + 0.5]] }); }
  }
  return R;
}
