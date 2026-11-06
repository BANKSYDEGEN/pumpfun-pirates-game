// [review fix 2] real Postgres, two connections at once: lock-first ordering vs concurrent double pay / daily cap / balance / bounty / horde.
// Needs `npm i embedded-postgres pg` somewhere: PFP_NODE_MODULES=/that/node_modules node tests/sql/053_island_concurrency.mjs  (MIG=other.sql to compare)
// Against the pre-fix 053 this reports 3 double pays (contract, cap, horde wave); against this 053 all pass.
import { readFileSync, rmSync } from 'fs';
const NM = process.env.PFP_NODE_MODULES ? process.env.PFP_NODE_MODULES.replace(/\/$/, '') + '/' : '';
const EmbeddedPostgres = (await import(NM ? NM + 'embedded-postgres/dist/index.js' : 'embedded-postgres')).default;
const pgk = (await import(NM ? NM + 'pg/lib/index.js' : 'pg')).default;
const MIG = readFileSync(process.env.MIG || new URL('../../supabase/migrations/053_island_money_makers.sql', import.meta.url), 'utf8');
const H = readFileSync(new URL('./053_island_check.mjs', import.meta.url), 'utf8'); const STUB = H.slice(H.indexOf('const STUB = `') + 14, H.indexOf('`;', H.indexOf('const STUB = `'))).replace(/\$\{process\.env\.NOSAVE \? '' : ", save jsonb"\}/, ', save jsonb');
const dir = (process.env.TMPDIR || '/tmp') + '/pfp-isl-pg-' + process.pid; const port = 55400 + (process.pid % 500);
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'qa', password: 'qa', port, persistent: false, onLog: () => {}, onError: () => {} });
let fails = 0; const ok = (c, m, x) => { if (!c) { fails++; console.log('FAIL', m, x ?? ''); } else console.log('ok  ', m); };
await pg.initialise(); await pg.start();
try {
  await pg.createDatabase('isl');
  const mk = async () => { const c = new pgk.Client({ host: 'localhost', port, user: 'qa', password: 'qa', database: 'isl' }); await c.connect(); return c; };
  const c0 = await mk(), c1 = await mk(), c2 = await mk();
  await c0.query(STUB); await c0.query(MIG);
  const A = 'dev:aaaaaaaaaaaaaaaaaaaaaaaa', B = 'dev:bbbbbbbbbbbbbbbbbbbbbbbb', C = 'dev:cccccccccccccccccccccccc';
  const gold = async (id) => (await c0.query('select gold from pvp_dev_profiles where id = $1', [id])).rows[0].gold;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // race: c1 holds an open transaction after its call; c2 calls concurrently; c1 commits; c2 must then see c1's row
  async function race(label, sql1, args1, sql2, args2) {
    await c1.query('begin'); const r1 = (await c1.query(sql1, args1)).rows[0].r;
    let done = false; const p2 = c2.query(sql2, args2).then(x => { done = true; return x.rows[0].r; });
    await sleep(700); const blocked = !done; await c1.query('commit'); const r2 = await p2;
    console.log(`  ${label}: first=${JSON.stringify(r1).slice(0, 90)} second=${JSON.stringify(r2).slice(0, 90)} second_blocked=${blocked}`);
    return { r1, r2, blocked };
  }
  // 1 one-time payout (daily contract): two different req ids at the same moment
  let g0 = await gold(A);
  let x = await race('contract x2', 'select public.pvp_isl_contract($1, $2, $3) r', [A, 'cave_raiders', 'req_race_c1'], 'select public.pvp_isl_contract($1, $2, $3) r', [A, 'cave_raiders', 'req_race_c2']);
  ok(x.r1.ok && !x.r2.ok && (await gold(A)) === g0 + 150, 'concurrent contract claims pay ONCE', { g: await gold(A), g0 });
  ok(x.blocked, 'the second call waited on the pirate lock');
  // 2 daily cap inside pvp_isl_move (cap 100, two credits of 60 at once)
  g0 = await gold(B);
  x = await race('cap 100 / 60+60', 'select public.pvp_isl_move($1, 60, $2, $3, $4, 100) r', [B, 'req_cap_1', 'qa_cap', 'r1'], 'select public.pvp_isl_move($1, 60, $2, $3, $4, 100) r', [B, 'req_cap_2', 'qa_cap', 'r2']);
  ok(x.r1.ok && !x.r2.ok && x.r2.why === 'daily cap' && (await gold(B)) === g0 + 60, 'concurrent credits respect the daily cap', { g: await gold(B), g0 });
  // 3 balance: two debits of 700 from 1000 at once
  await c0.query('update pvp_dev_profiles set gold = 1000 where id = $1', [C]);
  x = await race('debit 700 x2', 'select public.pvp_isl_move($1, -700, $2, $3, $4) r', [C, 'req_deb_1', 'bet', 'dd1'], 'select public.pvp_isl_move($1, -700, $2, $3, $4) r', [C, 'req_deb_2', 'bet', 'dd2']);
  ok(x.r1.ok && !x.r2.ok && (await gold(C)) === 300, 'concurrent debits never go below 0', await gold(C));
  // 4 the same confirmed kill claimed twice at once (two req ids)
  await c0.query(`insert into pvp_isl_bounties (target_key, target_name, pot, posts) values ('bravo', 'Bravo', 400, 1)`);
  await c0.query(`insert into pvp_kills (killer_id, victim_id) values ($1, $2)`, [A, B]);
  g0 = await gold(A);
  x = await race('bounty claim x2', 'select public.pvp_isl_bounty_claim($1, $2, $3, $4) r', [A, 'Alpha', 'Bravo', 'req_bc_1'], 'select public.pvp_isl_bounty_claim($1, $2, $3, $4) r', [A, 'Alpha', 'Bravo', 'req_bc_2']);
  ok(x.r1.ok && !x.r2.ok && (await gold(A)) === g0 + 400, 'concurrent bounty claims pay ONCE', { g: await gold(A), g0 });
  // 5 the same horde wave at once
  g0 = await gold(A);
  x = await race('horde wave x2', 'select public.pvp_isl_horde($1, $2, 1, $3) r', [A, 'runRACE0001', 'req_hw_1'], 'select public.pvp_isl_horde($1, $2, 1, $3) r', [A, 'runRACE0001', 'req_hw_2']);
  ok(x.r1.ok && !x.r2.ok && (await gold(A)) === g0 + 60, 'concurrent horde wave pays ONCE', { g: await gold(A), g0 });
  for (const c of [c0, c1, c2]) await c.end();
} catch (e) { fails++; console.log('ERROR', e.message); }
finally { await pg.stop(); try { rmSync(dir, { recursive: true, force: true }); } catch {} }
console.log(fails ? `CONCURRENCY FAILED ${fails}` : 'ALL CONCURRENCY CHECKS PASSED'); process.exit(fails ? 1 : 0);
