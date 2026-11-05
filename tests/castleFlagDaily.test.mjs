// [castle-flag-daily] BANKSY 11:39 AM: claim daily gold by raising the fort courtyard flag
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fort = readFileSync(new URL('../js/island/areas/fort.js', import.meta.url), 'utf8');
const pvp = readFileSync(new URL('../js/pvp.js', import.meta.url), 'utf8');
const dock = readFileSync(new URL('../js/dock/index.js', import.meta.url), 'utf8');
const cfg = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const crew = readFileSync(new URL('../js/crewV4.js', import.meta.url), 'utf8');

test('sw is at or past pfp-v274', () => { const v = +(sw.match(/const VERSION = 'pfp-v(\d+)'/) || [])[1]; assert.ok(v >= 274, 'sw ' + v); });

test('FLAG_DAILY kill switch defaults on; &flagdaily=0 restores HUD button', () => {
  assert.match(cfg, /export const FLAG_DAILY/);
  assert.match(cfg, /get\('flagdaily'\) !== '0'/);
  assert.match(pvp, /!FLAG_DAILY/);
  assert.match(pvp, /c\.hidden = !\(HOLDER_ENABLED && holder\.on && !holder\.claimed && !FLAG_DAILY\)/);
});

test('courtyard mast interact + raise animation kept (no conflict with upstairs stone)', () => {
  assert.match(fort, /MAST = \{ x: F\.x - 6, z: F\.z - 6 \}/);
  assert.match(fort, /id: 'fort_flag'/);
  assert.match(fort, /raise\(\) \{ fyT = 11\.5; \}/);
  assert.match(fort, /fort_pfp_flag/);
});

test('flag daily activate calls existing holder claim; server action name untouched', () => {
  assert.match(fort, /flagDailyActivate/);
  assert.match(fort, /api\.claimDaily/);
  assert.match(fort, /HOLDER_DAILY_GOLD/);
  assert.match(fort, /COME BACK TOMORROW/);
  assert.match(fort, /untilIndyMidnight/);
  assert.match(dock, /claimDaily:/);
  assert.match(dock, /claimHolderGold\(\{ fromFlag: true/);
  assert.match(pvp, /claimHolderGold/);
  // server still has holder_claim only — client still posts that action
  const save = readFileSync(new URL('../js/pvpSave.js', import.meta.url), 'utf8');
  assert.match(save, /api\('holder_claim'/);
  const idx = readFileSync(new URL('../supabase/functions/pvp/index.ts', import.meta.url), 'utf8');
  assert.match(idx, /case "holder_claim"/);
});

test('indy day helpers + markFortFlagRaised exported in fort.js', () => {
  assert.match(fort, /export const indyDay = /);
  assert.match(fort, /export function untilIndyMidnight/);
  assert.match(fort, /export function markFortFlagRaised/);
  assert.match(fort, /export function fortFlagIsUp/);
  assert.match(fort, /timeZone: 'America\/Indiana\/Indianapolis'/);
});

test('untilIndyMidnight format (inline mirror of fort helper)', () => {
  const untilIndyMidnight = (now = Date.now()) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Indiana/Indianapolis', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date(now));
    const g = (t) => +parts.find(p => p.type === t).value;
    let h = g('hour'); if (h === 24) h = 0;
    const leftMin = Math.max(0, (23 - h) * 60 + (59 - g('minute')));
    const hh = Math.floor(leftMin / 60), mm = leftMin % 60;
    return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
  };
  assert.match(untilIndyMidnight(), /^\d+h \d+m$|^\d+m$/);
});

test('CREW_EXTRA_SLOTS stays empty', () => {
  assert.match(crew, /export const CREW_EXTRA_SLOTS = \[\]/);
});
