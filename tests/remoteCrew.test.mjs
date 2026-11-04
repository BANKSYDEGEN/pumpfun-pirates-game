// [remote-crew] BANKSY 6:09 PM "I can't see other players crews" / "Or pets": another pirate's shore crew follows them on the island
// (their Crew Shop loadout from 'cr' / 'cc'), capped for perf, and their ground pet is distance-culled like yours.
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const net = readFileSync(new URL('../js/onfoot/net.js', import.meta.url), 'utf8'), fol = readFileSync(new URL('../js/onfoot/followers.js', import.meta.url), 'utf8');
const crewV4 = readFileSync(new URL('../js/crewV4.js', import.meta.url), 'utf8');
test('remote pirates get shore crew from their crew wire, capped, disposed on drop', () => {
  assert.match(net, /createFollowers\(\{ scene, world, walker: \{ w: W \}, low: true, count: CREW_N, gearOf: \(\) => p\.crewG/);
  assert.match(net, /crewFromWire\(m\.cr\)/); assert.match(net, /low \? 1 : 2, CREW_PEERS = low \? 2 : 3/); assert.match(net, /p\.crew\?\.dispose\(\)/);
});
test('followers: remote sets skip the local gear events and can be disposed', () => {
  assert.match(fol, /if \(!gearOf\) \{ addEventListener\('pfp-gear'/); assert.match(fol, /function dispose\(\)/);
});
test('the crew never copies captain shop items', () => { assert.match(crewV4, /export const CREW_EXTRA_SLOTS = \[\]/); });
