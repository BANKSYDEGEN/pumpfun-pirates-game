// [squad-hall] node --test tests/squadHall.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const foot = readFileSync(root + 'js/island/foot.js', 'utf8');
const hall = readFileSync(root + 'js/dock/squadHall.js', 'utf8');
const dock = readFileSync(root + 'js/dock/index.js', 'utf8');
const pvp = readFileSync(root + 'js/pvp.js', 'utf8');
const online = readFileSync(root + 'supabase/functions/pvp/online.ts', 'utf8');
const mig = readFileSync(root + 'supabase/migrations/041_squad_hall.sql', 'utf8');

describe('squad hall interior', () => {
  it('dresses a war table, banners, crew board, lanterns, wings (the Blender hall, [Timothy v312])', () => {
    const bl = readFileSync(root + 'tools/hill_blender/hill_street_blender.py', 'utf8');
    assert.match(bl, /War Table/);
    assert.match(bl, /roster board/);
    assert.match(bl, /wall_lantern/);
    assert.match(bl, /PURP, PURP_D, CRIM[^\n]*= 0x5a2f9e/);
    assert.match(bl, /if hi:/); // phone (LOD1) trim
  });
  it('keeps the mid-hall interact', () => {
    assert.match(foot, /id: 'squadhall'/);
    assert.match(foot, /E · SQUAD HALL/);
  });
});

describe('squad hall panel', () => {
  it('lists INVITE and JOIN WORLD', () => {
    assert.match(hall, /INVITE/);
    assert.match(hall, /JOIN WORLD/);
    assert.match(hall, /SQUAD HALL/);
    assert.match(hall, /inv_online/); assert.match(hall, /detail:\s*true/);
  });
  it('handles incoming invites', () => {
    assert.match(hall, /squad_invites/);
    assert.match(hall, /ACCEPT/);
    assert.match(hall, /DECLINE/);
  });
  it('invite-discreet: under-inventory pill + pad VIEW glyph, not a centred toast', () => {
    assert.match(hall, /id = 'sq-note'|id="sq-note"|#sq-note\b/);
    assert.match(hall, /sq-note-panel/);
    assert.match(hall, /hud-tr/);
    assert.doesNotMatch(hall, /id="sq-invite"/);
    assert.match(hall, /openInvites/);
    assert.match(hall, /hasInvites/);
    assert.match(hall, /data-gly/);
    assert.match(hall, /pfp-padc/);
    assert.match(hall, /VIEW|CREATE/);
  });

  it('invite pill: no per-frame syncGlyph / partyBar from tick', () => {
    assert.match(hall, /MutationObserver/);
    assert.match(hall, /never from the per-frame dock tick|no per-frame DOM/);
    assert.doesNotMatch(hall, /function tick\(now\)[\s\S]*syncGlyph\(\);\s*\n\s*\}/);
  });

  it('is opened from the Squad Hall interact', () => {
    assert.match(dock, /createSquadHall/);
    assert.match(dock, /squadHall\.open/);
  });
});

describe('cross-world server', () => {
  it('online detail carries copy + mode', () => {
    assert.match(online, /detail/);
    assert.match(online, /copy/);
    assert.match(online, /modeOf/);
  });
  it('migration 041 adds invites + want_copy', () => {
    assert.ok(existsSync(root + 'supabase/migrations/041_squad_hall.sql'));
    assert.match(mig, /pvp_squad_invites/);
    assert.match(mig, /p_want_copy/);
    assert.match(mig, /pvp_harbor_core/);
  });
  it('pvp exposes partyMake / joinWorld', () => {
    assert.match(pvp, /function partyMake/);
    assert.match(pvp, /function joinWorld/);
    assert.match(pvp, /wantCopy/);
  });
});
