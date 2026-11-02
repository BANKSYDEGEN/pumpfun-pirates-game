// [security M5] ?relay= allowlist: on the live domains only listed wss hosts; dev/test hosts keep the free switch
import test from 'node:test';
import assert from 'node:assert/strict';
import { relayAllowed, RELAY_HOSTS } from '../js/config.js';

test('production rejects arbitrary relays', () => {
  assert.equal(relayAllowed('wss://evil.example', true), false);
  assert.equal(relayAllowed('wss://evil.example:443/x', true), false);
  assert.equal(relayAllowed('ws://localhost:8787', true), false);
  assert.equal(relayAllowed('javascript:alert(1)', true), false);
  assert.equal(relayAllowed('wss://relay.pumpfunpirates.com.evil.example', true), false);
  for (const h of RELAY_HOSTS) assert.equal(relayAllowed(`wss://${h}`, true), true);
});

test('dev / tests can point at any well-formed ws(s) relay', () => {
  assert.equal(relayAllowed('ws://localhost:8787', false), true);
  assert.equal(relayAllowed('wss://relay.example.org/pvp', false), true);
  assert.equal(relayAllowed('https://evil.example', false), false);
  assert.equal(relayAllowed('wss://a b', false), false);
  assert.equal(relayAllowed(null, false), false);
});
