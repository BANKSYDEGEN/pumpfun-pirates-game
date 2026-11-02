// [security M1] relay ticket check (server/relay.js ticketOk) against tickets made like the pvp function's relayTicket()
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
process.env.RELAY_NO_LISTEN = '1';
let ticketOk;
try { ({ ticketOk } = await import('../server/relay.js')); } catch (e) { ticketOk = null; }
const mk = (secret, net, prefix, exp) => { const data = `${net}.${prefix}.${exp}`; return `${data}.${crypto.createHmac('sha256', secret).update(data).digest('base64url')}`; };
const S = 'test-secret-not-real', now = 1_800_000_000;
test('relay ticket: valid / tampered / expired / wrong id', { skip: !ticketOk && 'ws not installed (npm i in server/)' }, () => {
  const t = mk(S, 'abc123def', 'pfp-pvp-v1', now + 60);
  assert.equal(ticketOk(t, 'abc123def', 'pfp-pvp-v1', S, now), true);
  assert.equal(ticketOk(t, 'zzz999zzz', 'pfp-pvp-v1', S, now), false);          // someone else's id
  assert.equal(ticketOk(t, 'abc123def', 'pfp-pvp-v1sq', S, now), false);        // other arena
  assert.equal(ticketOk(t, 'abc123def', 'pfp-pvp-v1', S, now + 61), false);     // expired
  assert.equal(ticketOk(t.slice(0, -2) + 'xx', 'abc123def', 'pfp-pvp-v1', S, now), false); // forged mac
  assert.equal(ticketOk(mk('other', 'abc123def', 'pfp-pvp-v1', now + 60), 'abc123def', 'pfp-pvp-v1', S, now), false);
  assert.equal(ticketOk(null, 'abc123def', 'pfp-pvp-v1', S, now), false);
  assert.equal(ticketOk(null, 'abc123def', 'pfp-pvp-v1', '', now), true);       // no secret configured = local dev, open
});
