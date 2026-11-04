// Sound kit: WebAudio synthesis + (v101) recorded samples from Post's sound overhaul (assets/audio/, CC0 / CC-BY, see
// assets/audio/CREDITS.md). Samples load lazily after the first tap; until a sample has decoded (or if it fails, or with
// ?oldaudio=1) every event falls back to the original synth sound, so nothing is ever silent.
// [Raul] sound upgrades: rebuilt for mobile + richer sounds that change with the Shipwright upgrades.
//
// Mobile / iOS Safari notes (why sound could be silent on phones before):
//  - The AudioContext was only created/resumed inside startGame(). PLAY AGAIN awaits saveScore() first, so its
//    resume() ran outside the user gesture and was refused. Fire buttons use pointerdown + preventDefault, which
//    older iOS does not count as an audio-unlocking gesture, so a context that got suspended mid-game stayed silent.
//  - iOS puts the context into 'interrupted' (not 'suspended') after a call, Siri, lock screen or app switch; the
//    old code only checked 'suspended' and had no visibilitychange handling, so it never came back.
//  - With the ring/silent switch on, iOS mutes Web Audio entirely (it plays as "ambient" audio). Playing a silent
//    looping HTML <audio> element from a gesture (and navigator.audioSession.type = 'playback' where supported)
//    moves the page to the playback category so game audio is heard like a video would be.
// Fix: unlock() runs on EVERY pointerup / touchend / click / keydown (capture phase) until the context is running,
// re-arms after interruptions and when the tab becomes visible again, and the mute state is persisted + shown.
import { soundProfile, hitTier, HIT_THROTTLE } from './soundProfile.js';

let ctx = null, comp = null, master = null, sfxBus = null, voiceBus = null, musicBus = null, musicDuck = null, ambBus = null, noiseBuf = null;
const SET_KEY = 'pfp_audio_v1';
const settings = (() => {
  const d = { master: 0.8, sfx: 0.9, music: 0.35 };
  try { return { ...d, ...JSON.parse(localStorage.getItem(SET_KEY) || '{}') }; } catch { return d; }
})();
export let muted = localStorage.getItem('pfp_muted') === '1';
let profile = soundProfile({});
const listeners = new Set();
const notify = () => listeners.forEach(f => { try { f(audioState()); } catch { /* ui */ } });
export const onAudioState = (f) => { listeners.add(f); f(audioState()); };
export const audioState = () => ({ running: ctx?.state === 'running', state: ctx ? ctx.state : 'none', muted, ...settings });

// ---------- unlock (user gesture) ----------
let htmlAudio = null;
function silentWavUrl() { // 0.5 s of 8 kHz silence, as a data URI (no file)
  const n = 4000, b = new ArrayBuffer(44 + n), v = new DataView(b), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  let s = ''; new Uint8Array(b).forEach(x => { s += String.fromCharCode(x); }); return 'data:audio/wav;base64,' + btoa(s);
}
function create() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
  comp = makeLimiter(ctx, ctx.destination); // glue compressor + brick-wall-ish limiter: 7 overlapping booms never clip
  master = ctx.createGain(); sfxBus = ctx.createGain(); musicBus = ctx.createGain(); ambBus = ctx.createGain(); musicDuck = ctx.createGain();
  sfxBus.connect(master); musicBus.connect(musicDuck).connect(master); ambBus.connect(master); master.connect(comp);
  // [v145] BANKSY "emote sounds are very quiet": voices sat ~6 dB under the cannons / hits (-23 vs -17 dBFS speech RMS). They now get their
  // own bus: levelled +5 dB louder into a speech compressor (peaks held, the master limiter still guards clipping) on the sfx bus
  const vc = ctx.createDynamicsCompressor(); vc.threshold.value = -18; vc.knee.value = 6; vc.ratio.value = 4; vc.attack.value = 0.003; vc.release.value = 0.15;
  voiceBus = ctx.createGain(); voiceBus.gain.value = 1.8; vc.connect(voiceBus).connect(sfxBus); voiceBus.in = vc;
  applyLevels();
  noiseBuf = makeNoise(ctx);
  ctx.onstatechange = () => { if (ctx.state !== 'running') arm(); notify(); };
  startAmbient();
  loadSamples();
  return true;
}
// two stages: gentle glue compression, then a fast high-ratio limiter just under 0 dBFS
function makeLimiter(c, dest) {
  const glue = c.createDynamicsCompressor(); glue.threshold.value = -12; glue.knee.value = 10; glue.ratio.value = 4; glue.attack.value = 0.01; glue.release.value = 0.3;
  const lim = c.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.12;
  const trim = c.createGain(); trim.gain.value = 0.92;
  glue.connect(lim).connect(trim).connect(dest);
  return glue;
}
function makeNoise(c) {
  const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function unlock() {
  if (!ctx && !create()) return;
  try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch { /* Safari 17+ only */ }
  if (!htmlAudio) { htmlAudio = new Audio(silentWavUrl()); htmlAudio.loop = true; htmlAudio.setAttribute('playsinline', ''); htmlAudio.preload = 'auto'; }
  if (!muted && htmlAudio.paused) htmlAudio.play().catch(() => {});
  if (ctx.state !== 'running') {
    ctx.resume().then(notify, () => {});
    try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); } catch { /* old iOS kick */ }
  }
  if (ctx.state === 'running') disarm();
  notify();
}
const EVTS = ['pointerup', 'touchend', 'click', 'keydown'];
let armed = false;
function arm() { if (armed) return; armed = true; EVTS.forEach(e => addEventListener(e, unlock, { capture: true, passive: true })); }
function disarm() { if (!armed) return; armed = false; EVTS.forEach(e => removeEventListener(e, unlock, { capture: true })); }
arm();
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) { ctx.suspend?.().catch(() => {}); htmlAudio?.pause(); }
  else { ctx.resume().catch(() => {}); if (!muted) htmlAudio?.play().catch(() => {}); arm(); } // resume may need the next tap on iOS
});
addEventListener('pageshow', () => { if (ctx && ctx.state !== 'running') { ctx.resume().catch(() => {}); arm(); } });

// kept for main.js: called from SET SAIL (a click), harmless if already unlocked
export function initAudio() { unlock(); }

// ---------- levels / mute ----------
function applyLevels() {
  if (!master) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(muted ? 0 : settings.master, t, 0.03);
  sfxBus.gain.setTargetAtTime(settings.sfx, t, 0.03);
  musicBus.gain.setTargetAtTime(settings.music * 0.55, t, 0.05);
  ambBus.gain.setTargetAtTime(Math.min(1, settings.sfx * 1.1), t, 0.05);
}
export function setMuted(m) {
  muted = m; try { localStorage.setItem('pfp_muted', m ? '1' : '0'); } catch { /* private mode */ }
  if (m) htmlAudio?.pause(); else { unlock(); }
  applyLevels(); notify();
}
export function setLevel(which, v) {
  if (!(which in settings)) return;
  settings[which] = Math.max(0, Math.min(1, +v || 0));
  try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch { /* private mode */ }
  applyLevels(); notify();
}
// shop.js calls this whenever upgrade levels change
export function setLoadout(levels) { profile = soundProfile(levels); crewLevel = (levels && levels.reload) | 0; }

// ---------- voices (cap simultaneous sounds) ----------
const MAX_VOICES = 28;
let voices = 0;
let offline = false; // true while rendering preview clips (no live voice budget)
function voice(prio = 1, dur = 1) {
  if (offline) return true;
  if (!ctx || muted || ctx.state !== 'running') return false;
  if (voices >= MAX_VOICES && prio < 2) return false; // low-priority sounds (far splashes, distant guns) drop first
  if (voices >= MAX_VOICES + 8) return false;
  voices++; setTimeout(() => { voices--; }, (dur + 0.1) * 1000);
  return true;
}

// ---------- synth primitives (work on any context, also OfflineAudioContext for clip renders) ----------
let C = null; // { c, noise, out } current target
const live = () => (ctx ? (C = { c: ctx, noise: noiseBuf, out: sfxBus, verb: _liveVerb || (_liveVerb = makeVerb(ctx, sfxBus)) }) : null);
function env(g, t, a, peak, d, end = 0.0008) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
function noise({ t, dur, f0, f1, vol, type = 'lowpass', q = 0.7, a = 0.004, out = C.out, rate = 1 }) {
  const { c } = C, s = c.createBufferSource(); s.buffer = C.noise; s.loop = true; s.playbackRate.value = rate;
  const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = c.createGain(); env(g, t, a, vol, dur);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 1.5); s.stop(t + a + dur + 0.05);
  return g;
}
function tone({ t, dur, f0, f1 = f0, vol, type = 'sine', a = 0.004, out = C.out, detune = 0 }) {
  const { c } = C, o = c.createOscillator(); o.type = type; o.detune.value = detune;
  o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
  const g = c.createGain(); env(g, t, a, vol, dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + a + dur + 0.05);
  return o;
}
// inharmonic ring (bells, iron clangs)
function ring({ t, base, partials = [1, 2.76, 5.4, 8.93], dur = 1.2, vol = 0.1, out = C.out }) {
  partials.forEach((p, i) => tone({ t, dur: dur / (1 + i * 0.6), f0: base * p, vol: vol / (1 + i * 0.8), out, a: 0.002 }));
}

// ---------- recorded samples (v101) ----------
// Post's picks, compared slot by slot against the synth through a phone-speaker simulation: only the slots where the
// recording won are listed here. v102 (round 4): phone-first light / medium / heavy hits, sinking, debris, sea ambience,
// low-HP heartbeat + bell, Waves defeat stinger and all 8 emote lines are recorded. v104 audio (round 5): thunder, the
// wave / boss horns and the legendary upgrade fanfare are recorded too. Coins, shop, upgrade, equip, heal and the
// reload-ready ratchet keep the synth (it measured as loud or louder on phones; see audio-dev round 4 / round 5).
const AUD = './assets/audio/';
const NO_SAMPLES = typeof location !== 'undefined' && /[?&]oldaudio=1\b/.test(location.search); // A/B + kill switch
const SAMPLES = {
  cannon: ['cannon_1', 'cannon_2'],                                      // round 3 "phone-first" cannon (v1 + v2)
  impact: ['impact_1', 'impact_2'],                                      // layered wood smash (kill tier only)
  impactLight: ['impact_light_1', 'impact_light_2'], impactMedium: ['impact_medium_1', 'impact_medium_2'], impactHeavy: ['impact_heavy_1', 'impact_heavy_2'], // v102 phone-first hits
  debris: ['debris_1', 'debris_2'], sink: ['sink_1'], sinkBig: ['sink_big'], lowBeat: ['lowhp_beat'], lowBell: ['lowhp_bell'], ambSea: ['amb_sea'], defeat: ['defeat'],
  splashNear: ['splash_near_1', 'splash_near_2', 'splash_near_3'], splashMid: ['splash_mid'], splashFar: ['splash_far'],
  arrM: ['vo_arrr_male_1', 'vo_arrr_male_2', 'vo_arrr_male_3', 'vo_arrr_male_4'], arrF: ['vo_arrr_female_1', 'vo_arrr_female_2', 'vo_arrr_female_3', 'vo_arrr_female_4'],
  fireM: ['vo_fire_male_1', 'vo_fire_male_2', 'vo_fire_male_3'], fireF: ['vo_fire_female_1', 'vo_fire_female_2', 'vo_fire_female_3'],
  laughM: ['vo_laugh_male_1', 'vo_laugh_male_2'], laughF: ['vo_laugh_female_1', 'vo_laugh_female_2'], // round 6: vo_laugh_female_3 dropped (ASR hears words in it)
  // v102 + round 6: the other quick-chat lines, real recordings (CC0 / CC-BY, see CREDITS.md), every take under 1.5 s
  followM: ['vo_follow_male_1', 'vo_follow_male_2', 'vo_follow_male_3'], followF: ['vo_follow_female_1', 'vo_follow_female_2', 'vo_follow_female_3'],
  bossM: ['vo_boss_male_1', 'vo_boss_male_2'], bossF: ['vo_boss_female_1'],
  helpM: ['vo_help_male_1', 'vo_help_male_2'], helpF: ['vo_help_female_1', 'vo_help_female_2', 'vo_help_female_3', 'vo_help_female_4'],
  attackM: ['vo_attack_male_1', 'vo_attack_male_2', 'vo_attack_male_3', 'vo_attack_male_4'], attackF: ['vo_attack_female_1', 'vo_attack_female_2'],
  retreatM: ['vo_retreat_male_1', 'vo_retreat_male_2'], retreatF: [],
  ggM: ['vo_gg_male_1', 'vo_gg_male_2', 'vo_gg_male_3', 'vo_gg_male_4'], ggF: ['vo_gg_female_1'],
  victory: ['victory'], shanty: ['music_shanty'],
  // round 5: phone-first thunder (3 strikes), wave + boss horns (real conch / alpenhorn / horn + frame drums), legendary fanfare
  thunder: ['thunder_1', 'thunder_2', 'thunder_3'], hornWave: ['horn_wave'], hornBoss: ['horn_boss'], legendary: ['upgrade_legendary'],
};
// load order: combat core first, then voices, then the stinger + music (largest file last)
const LOAD_ORDER = [['cannon', 'impact', 'impactLight', 'impactMedium', 'impactHeavy', 'splashNear', 'splashMid', 'splashFar'],
  ['arrM', 'arrF', 'fireM', 'fireF', 'laughM', 'laughF', 'attackM', 'attackF', 'followM', 'followF', 'bossM', 'bossF', 'helpM', 'helpF', 'retreatM', 'retreatF', 'ggM', 'ggF', 'debris', 'sink', 'sinkBig', 'lowBeat', 'lowBell', 'victory', 'defeat', 'hornWave', 'hornBoss', 'legendary'], ['ambSea', 'thunder', 'shanty']];
// per-slot trims (linear), loudness-matched against the synth they replace (see the v101 notes in the commit)
const LVL = { cannon: 0.83, enemy: 1.9, impact: 0.85, splashNear: 0.3, splash: 0.6, voice: 1, /* [v145] was 0.45: see voiceBus */ victory: 0.55, shanty: 0.30,
  light: 1.894, medium: 1.831, heavy: 2.606, debris: 0.937, sink: 0.579, sinkBig: 0.983, beat: 0.642, bell: 0.688, amb: 10.995, defeat: 0.495,
  thunder: 0.719, hornWave: 0.556, hornBoss: 1.122, legendary: 0.589 };
const bufs = {}; let _loading = false;
function decode(ab) { return new Promise((res, rej) => { try { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); } catch (e) { rej(e); } }); }
async function loadOne(n) {
  try { const r = await fetch(AUD + n + '.mp3'); if (!r.ok) throw new Error(r.status); bufs[n] = await decode(await r.arrayBuffer()); }
  catch (e) { console.debug?.('[audio] sample unavailable, synth fallback:', n, e?.message || e); }
}
function loadSamples() {
  if (_loading || NO_SAMPLES || !ctx) return; _loading = true;
  // [perf3] BANKSY "optimize music": the shanty (largest file) waits until the game is playable ('pfp-playable' from main.js, or 45 s),
  // then loads when the main thread is idle, so it never competes with the harbor's own downloads. The synth loop covers the gap. ?musicdefer=0 = old order
  const DEFER = !/[?&]musicdefer=0/.test(location.search), late = DEFER ? ['music_shanty'] : [];
  (async () => { for (const g of LOAD_ORDER) await Promise.all(g.flatMap(k => SAMPLES[k]).filter(n => !late.includes(n)).map(loadOne));
    if (!late.length) return; await new Promise(r => { if (window.__pfpPlayable) return r(); addEventListener('pfp-playable', r, { once: true }); setTimeout(r, 45000); });
    await new Promise(r => (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(r, { timeout: 3000 })); await Promise.all(late.map(loadOne)); })();
}
const _last = {};
function pick(k) { // round-robin-ish: random, never the same file twice in a row
  const L = SAMPLES[k].filter(n => bufs[n]); if (!L.length) return null;
  let i = Math.floor(Math.random() * L.length); if (L.length > 1 && L[i] === _last[k]) i = (i + 1) % L.length;
  _last[k] = L[i]; return bufs[L[i]];
}
const has = (k) => SAMPLES[k].some(n => bufs[n]);
// one buffer voice: source -> (lowpass) -> gain -> (pan) -> out. Real voice count via onended.
function playBuf(buf, { t = ctx.currentTime, vol = 1, rate = 1, pan = 0, out = sfxBus, lp = 0, fadeAt = 0, onend } = {}) {
  const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol; let node = s;
  if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.5; node.connect(f); node = f; }
  node.connect(g); node = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); node = p; }
  node.connect(out);
  if (onend) s.onended = onend;
  s.start(t);
  if (fadeAt && buf.duration / rate > fadeAt + 0.4) { g.gain.setValueAtTime(vol, t + fadeAt); g.gain.linearRampToValueAtTime(0.0001, t + fadeAt + 0.35); s.stop(t + fadeAt + 0.4); }
  return s;
}
const jit = (db) => Math.pow(10, ((Math.random() * 2 - 1) * db) / 20);
// recorded cannon (own or enemy). dist 0 close .. 1 far: darker + quieter, crack gone far away
function boomSample(t, v, dist, P) {
  const buf = pick('cannon'); if (!buf) return false;
  const deep = P === BOSS_GUN ? 0.86 : P && P.subF < 60 ? 0.93 : 1; // boss guns / big CANNONS tiers a little lower
  playBuf(buf, { t, vol: LVL.cannon * (P === profile.cannon ? 1 : LVL.enemy) * v * (1 - dist * 0.45) * jit(1.5), rate: deep * (0.95 + Math.random() * 0.1), pan: (Math.random() - 0.5) * 0.6, lp: dist > 0.05 ? 9000 * Math.pow(1 - dist * 0.88, 1.6) + 600 : 0 });
  return true;
}

// ---------- crew voices: emote lines + stacked crew (GUN CREW upgrade = crew size; audio only) ----------
const VOICE_CAP = 8; let liveVoices = 0;
let crewLevel = 0, audioQ = { phone: false, lite: false };
export function setAudioQuality(q = {}) { audioQ = { ...audioQ, ...q }; }
// [v112] your own callouts use the voice of your BODY pick (pirateGear look 'body': 0 male = default, 1 female), live on change
let myVoice = (() => { try { return JSON.parse(localStorage.getItem('pfp_captain_v1') || 'null')?.body === 1 ? 'f' : 'm'; } catch { return 'm'; } })();
if (typeof window !== 'undefined') addEventListener('pfp-gear-local', (e) => { const b = e.detail?.body; if (b === 0 || b === 1) myVoice = b ? 'f' : 'm'; });
// quick-chat line -> recorded key(s), first one with loaded takes wins (Attack! falls back to the Fire! takes)
const LINE_KEY = { 0: ['arr'], 1: ['follow'], 2: ['boss'], 3: ['help'], 4: ['attack', 'fire'], 5: ['retreat'], 6: ['gg'], 7: ['laugh'] };
const STACK = { arr: 1, fire: 1, attack: 1, laugh: 1 }; // the whole crew joins these; the others are the captain's call (1 voice)
const crewSize = () => { const n = [1, 2, 2, 3, 4, 5, 6][Math.max(0, Math.min(6, crewLevel | 0))]; return Math.min(n, audioQ.lite ? 2 : audioQ.phone ? 3 : 6); };
const SPREAD = [0, -0.45, 0.4, -0.7, 0.7, -0.2];
// play one stacked callout. key = 'arr' | 'fire' | 'laugh'; n voices; lead = 'm' | 'f'; v = volume
// [v112] round 6 re-trimmed takes came in 3-8 dB quieter than v110's (fire_male_2 -24.5 dB mean vs -16.8): emotes drowned under sea + music.
// Level every voice take to one speech loudness at decode time (gated RMS over the speech frames), peak-safe, so a quiet take can't vanish again.
const _vNorm = new WeakMap(), V_TARGET = 0.2;   // [v145] 0.16 -> 0.2 into the voice compressor (peaks: the compressor, not a per-take cap)
function voiceNorm(buf) {
  let g = _vNorm.get(buf); if (g) return g;
  const d = buf.getChannelData(0), F = 1024; let e = 0, nf = 0, pk = 0;
  for (let i = 0; i + F <= d.length; i += F) { let s = 0; for (let j = i; j < i + F; j++) { const x = d[j]; s += x * x; const a = x < 0 ? -x : x; if (a > pk) pk = a; } s /= F; if (s > 1e-4) { e += s; nf++; } } // frames above -40 dBFS only
  const rms = nf ? Math.sqrt(e / nf) : V_TARGET;
  g = Math.max(0.4, Math.min(4, V_TARGET / rms)); _vNorm.set(buf, g); return g;   // [v145] loud takes come down too (one level for all)
}
// [v146] strict voices: a female pirate only ever uses female takes, a male only male ones (no female "Retreat!" take exists yet:
// that line is bubble only for her, never a male take). crew = your deck crew's voices in seat order ('m' | 'f' from each crew
// member's body), so the chorus behind you matches who is on deck; without it the crew mix (~42% women) is guessed.
function crewCall(key, n, lead, v, rate0 = 1, crew = null) {
  const kM = key + 'M', kF = key + 'F', hm = has(kM), hf = has(kF); if (!hm && !hf) return false;
  if (lead === 'f' ? !hf : !hm) return false;
  const comp = Math.sqrt(Math.pow(n, Math.log(2) / Math.log(6)) / n); // 1 -> 6 voices grows ~+3 LU, not +8
  const t0 = ctx.currentTime + 0.02; let tt = t0, played = 0;
  for (let i = 0; i < n; i++) {
    if (liveVoices >= VOICE_CAP) break;
    const g = i === 0 ? lead : crew && crew.length ? crew[(i - 1) % crew.length] : (Math.random() < 0.42 ? 'f' : 'm');
    if (g === 'f' ? !hf : !hm) continue;
    const buf = pick(g === 'f' ? kF : kM); if (!buf) continue;
    if (i === 1 || i === 2) tt = t0 + 0.02 + Math.random() * 0.06; else if (i > 2) tt = t0 + 0.08 + Math.random() * 0.05;
    const rate = (i === 0 ? rate0 : 1 + (Math.random() * 2 - 1) * 0.03);
    liveVoices++; played++;
    playBuf(buf, { t: tt, vol: LVL.voice * v * comp * voiceNorm(buf) * (i ? Math.pow(10, -Math.random() * 4 / 20) : 1), rate, pan: SPREAD[i] * (n > 1 ? 1 : 0), out: voiceBus?.in || sfxBus, fadeAt: key === 'laugh' ? 2.1 : 0 /* v105: the v101 laugh takes kept (3.5 dB louder on phones than the round-4 trims), so their 2.1 s fade too */, onend: () => { liveVoices = Math.max(0, liveVoices - 1); } });
  }
  return played > 0;
}
let _nextFireCall = 0;

// ---------- sounds ----------
// ---------- black-powder cannons ----------
// shared "echo across the water / valley" reverb: convolution with a generated 4.5 s dark, slowly decaying impulse
// (early slap from the hull + long low tail). One per context; every boom sends into it.
function makeVerb(c, out) {
  const sr = c.sampleRate, len = Math.floor(sr * 4.5), ir = c.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) {
      const tt = i / sr, k = 0.16 - 0.11 * Math.min(1, tt / 2.5); // ~1 kHz early, darker (~250 Hz) as it decays (one-pole low-pass)
      lp += k * ((Math.random() * 2 - 1) - lp);
      const early = tt > 0.09 && tt < 0.16 ? 2.2 : 1; // first reflection off the water
      d[i] = lp * early * Math.exp(-tt * 1.35) * Math.min(1, tt / 0.03) * 3;
    }
  }
  const cv = c.createConvolver(); cv.normalize = true; cv.buffer = ir;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 55; // keep sub mud out of the tail
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  const g = c.createGain(); g.gain.value = 0.9;
  cv.connect(hp).connect(lp).connect(g).connect(out);
  return cv;
}
let _sat = null;
const satCurve = () => _sat || (_sat = Float32Array.from({ length: 1024 }, (_, i) => Math.tanh((i / 511.5 - 1) * 3.2) / Math.tanh(3.2)));
const verbOf = (X) => X.verb || (X.verb = makeVerb(X.c, X.out));
let _liveVerb = null;
// one muzzle-loader shot. P = SOUND_TIERS.cannons[tier]; dist 0 (close) .. 1 (far): far = darker, wetter, longer echo
function boom(P, t, v = 1, dist = 0) {
  const { c } = C, pitch = 0.92 + Math.random() * 0.16; // every gun a little different
  const pan = c.createStereoPanner ? c.createStereoPanner() : null;
  const dry = c.createGain(); dry.gain.value = 1 - dist * 0.55;
  const dark = c.createBiquadFilter(); dark.type = 'lowpass'; dark.Q.value = 0.5; dark.frequency.value = 1400 * (1 - dist * 0.75); // no high-mid crack
  const send = c.createGain(); send.gain.value = P.verb * (0.7 + dist * 0.6);
  const bus = c.createGain(); // everything for this shot
  bus.connect(dark); dark.connect(dry); if (pan) { pan.pan.value = (Math.random() - 0.5) * 0.6; dry.connect(pan).connect(C.out); } else dry.connect(C.out);
  dark.connect(send).connect(verbOf(C));
  // 1) concussive sub thump with a pitch drop (40-80 Hz), softly saturated so its harmonics (120-400 Hz) carry
  //    the boom on phone speakers that can't play real sub-bass
  const sat = c.createWaveShaper(); sat.curve = satCurve(); sat.oversample = '2x';
  const satG = c.createGain(); satG.gain.value = 0.7; sat.connect(satG).connect(bus);
  tone({ t, dur: P.subDur, f0: P.subF * 1.9 * pitch, f1: P.subF * 0.62 * pitch, vol: P.sub * 0.3 * v, out: bus, a: 0.006 });
  tone({ t, dur: P.subDur * 0.8, f0: P.subF * 1.9 * pitch, f1: P.subF * 0.62 * pitch, vol: P.sub * 1.4 * v, out: sat, a: 0.006 });
  tone({ t, dur: P.subDur * 0.6, f0: P.subF * 3.1 * pitch, f1: P.subF * 1.1 * pitch, vol: P.sub * 0.3 * v, out: bus, a: 0.008, type: 'triangle' });
  // chest of the blast: warm band around 200-450 Hz (soft attack, no click)
  noise({ t, dur: P.blastDur * 0.9, f0: 420 * pitch, f1: 160, vol: P.vol * 2.2 * v, type: 'bandpass', q: 0.6, out: bus, a: P.attack * 1.2, rate: 0.5 });
  // 2) soft-attack low-passed powder blast (most energy under 1 kHz)
  noise({ t, dur: P.blastDur, f0: P.blast * pitch, f1: P.blastEnd, vol: P.vol * 1.4 * v, out: bus, a: P.attack, q: 0.5, rate: 0.55 * pitch });
  noise({ t: t + 0.004, dur: P.blastDur * 1.3, f0: P.blast * 0.5, f1: P.blastEnd * 0.8, vol: P.vol * 0.6 * v, out: bus, a: P.attack * 1.6, q: 0.4, rate: 0.5 });
  // 3) rolling rumble tail (2-4 s) — dark noise that swells a little then rolls away
  noise({ t: t + 0.06, dur: P.rumbleDur * (1 + dist * 0.4), f0: 400 * pitch, f1: 55, vol: P.rumble * v, out: bus, a: 0.22, q: 0.6, rate: 0.5 });
  // 4) faint distant echo off the far shore
  if (P.echo) noise({ t: t + 0.55 + Math.random() * 0.45 + dist * 0.3, dur: P.blastDur * 1.6, f0: 420, f1: 50, vol: P.echo * (1 + dist) * v, out: bus, a: 0.05, q: 0.5, rate: 0.4 });
  // 5) subtle crackle of burning powder (quiet, darkened)
  if (P.crackle && dist < 0.6) for (let i = 0, n = 5 + Math.floor(Math.random() * 5); i < n; i++) noise({ t: t + 0.12 + Math.random() * 0.7, dur: 0.025, f0: 1800, f1: 900, vol: P.crackle * 0.06 * v * (1 - dist), type: 'bandpass', q: 1.5, out: bus, a: 0.003 });
}
// broadside: one boom per gun that actually fires, ragged crew timing (P.gap, e.g. 180-450 ms + jitter) so the
// booms overlap into one rolling thunder. Sound only: cannonball / muzzle-flash timing (main.js, 70 ms) is unchanged.
function broadside(n, P, v, prio = 2, dist = 0, maxGuns = n) {
  const guns = Math.min(n, maxGuns), scale = 0.75 * v / Math.pow(Math.max(1, guns), 0.55); // more guns = bigger, limiter catches the rest
  const life = P.rumbleDur + 1;
  let t = C.c.currentTime + 0.01;
  for (let i = 0; i < guns; i++) {
    if (!voice(prio, life)) break;
    const gv = scale * (0.85 + Math.random() * 0.3);
    if (offline || C.c !== ctx || !boomSample(t, gv, dist, P)) boom(P, t, gv, dist);
    t += P.gap[0] + Math.random() * (P.gap[1] - P.gap[0]);
  }
}
const ENEMY_GUN = { subF: 66, sub: 0.7, subDur: 0.6, blast: 800, blastEnd: 110, blastDur: 0.5, attack: 0.014, rumble: 0.3, rumbleDur: 2.6, verb: 0.75, echo: 0.14, crackle: 0.2, vol: 0.6, gap: [0.22, 0.45] };
const BOSS_GUN = { subF: 46, sub: 1.0, subDur: 0.95, blast: 620, blastEnd: 60, blastDur: 0.75, attack: 0.016, rumble: 0.45, rumbleDur: 3.6, verb: 0.85, echo: 0.2, crackle: 0.3, vol: 0.75, gap: [0.2, 0.45] };

function splash(t, v) {
  noise({ t, dur: 0.45, f0: 2600, f1: 380, vol: 0.32 * v, type: 'bandpass', q: 0.6 });
  noise({ t: t + 0.02, dur: 0.7, f0: 900, f1: 120, vol: 0.18 * v, a: 0.03 });
  for (let i = 0; i < 3; i++) tone({ t: t + 0.08 + i * 0.07 + Math.random() * 0.05, dur: 0.06, f0: 500 + Math.random() * 500, f1: 1300 + Math.random() * 600, vol: 0.04 * v });
}
function woodHit(t, v, k = 1) {
  noise({ t, dur: 0.5, f0: 1300 * k, f1: 90 * k, vol: 0.75 * v, a: 0.002 });
  noise({ t, dur: 0.18, f0: 4200 * k, f1: 1600 * k, vol: 0.32 * v, type: 'bandpass', q: 1.2 });
  tone({ t, dur: 0.22, f0: 190 * k, f1: 70 * k, vol: 0.4 * v, type: 'triangle' }); // plank thud
  for (let i = 0; i < 4; i++) noise({ t: t + 0.04 + i * 0.035 + Math.random() * 0.03, dur: 0.05, f0: 5000, f1: 2500, vol: 0.12 * v, type: 'bandpass', q: 3 }); // splinters
}
// damage-scaled impacts: H = tier from hitTier(), k = pitch (bigger hull = lower)
function impactSound(H, t, v, k = 1) {
  const id = H.id, V = H.vol * v;
  const splinters = (n, spread, vol) => { for (let i = 0; i < n; i++) noise({ t: t + 0.03 + Math.random() * spread, dur: 0.04 + Math.random() * 0.04, f0: 4200 + Math.random() * 1500, f1: 2000, vol: vol * V, type: 'bandpass', q: 2.5, a: 0.002 }); };
  if (id === 'light') { // small crack / thunk
    noise({ t, dur: 0.22, f0: 1500 * k, f1: 160 * k, vol: 0.6 * V, a: 0.002 });
    tone({ t, dur: 0.14, f0: 240 * k, f1: 120 * k, vol: 0.32 * V, type: 'triangle' });
    splinters(2, 0.06, 0.08);
    return;
  }
  if (id === 'medium') { // heavier crunch with splinters
    noise({ t, dur: 0.45, f0: 1300 * k, f1: 90 * k, vol: 0.75 * V, a: 0.002 });
    noise({ t, dur: 0.16, f0: 1900 * k, f1: 700 * k, vol: 0.3 * V, type: 'bandpass', q: 1.1 });
    tone({ t, dur: 0.24, f0: 180 * k, f1: 65 * k, vol: 0.45 * V, type: 'triangle' });
    splinters(5, 0.14, 0.11);
    return;
  }
  // heavy / kill: deep splintering crash + timber groan (kill = bigger, longer, hull breaking apart)
  const K = id === 'kill';
  noise({ t, dur: K ? 1.3 : 0.8, f0: 1000 * k, f1: 55 * k, vol: 0.85 * V, a: 0.003 });
  noise({ t: t + 0.01, dur: K ? 0.5 : 0.3, f0: 1700 * k, f1: 500 * k, vol: 0.35 * V, type: 'bandpass', q: 0.9 });
  tone({ t, dur: K ? 0.9 : 0.55, f0: 110 * k, f1: 38 * k, vol: 0.7 * V });
  tone({ t, dur: 0.3, f0: 200 * k, f1: 70 * k, vol: 0.35 * V, type: 'triangle' });
  splinters(K ? 12 : 8, K ? 0.5 : 0.28, 0.12);
  creak(t + 0.12, 0.75 * k, K ? 3.2 : 2.2); // timber groan
  if (K) {
    noise({ t: t + 0.18, dur: 0.9, f0: 700 * k, f1: 60, vol: 0.55 * V, a: 0.02 }); // second crash: beams giving way
    tone({ t: t + 0.18, dur: 0.7, f0: 80 * k, f1: 30 * k, vol: 0.5 * V });
    creak(t + 0.55, 0.6 * k, 2.6);
    noise({ t: t + 0.35, dur: 1.4, f0: 500, f1: 900, vol: 0.18 * V, type: 'bandpass', q: 0.6, a: 0.3 }); // water rushing in
  }
}
function punch(t, v) { tone({ t, dur: 0.35, f0: 75, f1: 30, vol: 0.6 * v, a: 0.004 }); noise({ t, dur: 0.18, f0: 600, f1: 80, vol: 0.4 * v, a: 0.003 }); }
// throttle: at most HIT_THROTTLE.max hit sounds per window; hits within mergeGap merge into the loudest
const _hits = []; let _lastHit = { t: -1, rank: -1 };
const RANK = { light: 0, medium: 1, heavy: 2, kill: 3 };
const IMPACT_KEY = { light: 'impactLight', medium: 'impactMedium', heavy: 'impactHeavy' };
function hitAllowed(now, rank) {
  while (_hits.length && now - _hits[0] > HIT_THROTTLE.window) _hits.shift();
  if (now - _lastHit.t < HIT_THROTTLE.mergeGap && rank <= _lastHit.rank) return false;
  if (_hits.length >= HIT_THROTTLE.max && rank < 3) return false;
  _hits.push(now); _lastHit = { t: now, rank };
  return true;
}
function ironHit(t, v, mix) {
  ring({ t, base: 420 + Math.random() * 60, partials: [1, 2.32, 3.93, 5.41, 6.8], dur: 0.9 + mix * 0.6, vol: 0.16 * v * mix });
  noise({ t, dur: 0.12, f0: 6000, f1: 2500, vol: 0.25 * v * mix, type: 'highpass' });
}
function creak(t, k = 1, v = 1) { // hull creak: slow, rough, pitch-bending sawtooth through a narrow band
  const { c } = C, o = c.createOscillator(); o.type = 'sawtooth';
  const f = 70 * k * (0.85 + Math.random() * 0.3), d = 0.5 + Math.random() * 0.5;
  o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * (1.25 + Math.random() * 0.3), t + d * 0.6); o.frequency.linearRampToValueAtTime(f * 1.05, t + d);
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 7; bp.frequency.value = 600 * k;
  const am = c.createOscillator(); am.frequency.value = 28 + Math.random() * 20; const amg = c.createGain(); amg.gain.value = 0.5;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05 * v, t + d * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + d);
  am.connect(amg).connect(g.gain);
  o.connect(bp).connect(g).connect(C.out); o.start(t); o.stop(t + d + 0.05); am.start(t); am.stop(t + d + 0.05);
}
function horn(t, notes, dur, vol, lp = 900) {
  const { c } = C, f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(lp * 0.4, t); f.frequency.linearRampToValueAtTime(lp, t + 0.25); f.Q.value = 1.5;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.18); g.gain.setValueAtTime(vol, t + dur - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(C.out);
  notes.forEach(fr => [-7, 7].forEach(dt => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = dt; o.connect(f); o.start(t); o.stop(t + dur + 0.05); }));
}
function drum(t, v = 1, f = 110) { tone({ t, dur: 0.35, f0: f * 1.6, f1: f * 0.5, vol: 0.55 * v }); noise({ t, dur: 0.12, f0: 2000, f1: 300, vol: 0.18 * v }); }
function arp(t, notes, step, vol, type = 'triangle', dur = 0.35) { notes.forEach((fr, i) => tone({ t: t + i * step, dur, f0: fr, vol, type, a: 0.008 })); }

// [v96] quick-chat: a gruff procedural pirate "voice": sawtooth syllables through two vowel formants (no hosted audio).
// syllable = [start, dur, f0, f1, vowel]
const VOW = { a: [760, 1250], o: [520, 900], e: [480, 1850], i: [330, 2200], u: [380, 820] };
const LINES = [
  [[0, 0.62, 128, 82, 'a']],                                                                   // Arr!
  [[0, 0.17, 140, 150, 'o'], [0.2, 0.17, 150, 132, 'o'], [0.42, 0.32, 165, 195, 'e']],         // Follow me!
  [[0, 0.2, 180, 190, 'o'], [0.24, 0.16, 190, 200, 'i'], [0.43, 0.14, 200, 205, 'o'], [0.6, 0.3, 215, 240, 'i']], // Boss incoming!
  [[0, 0.2, 150, 165, 'i'], [0.25, 0.38, 195, 150, 'e']],                                     // Need help!
  [[0, 0.16, 160, 172, 'a'], [0.19, 0.34, 200, 138, 'a']],                                    // Attack!
  [[0, 0.15, 150, 150, 'i'], [0.18, 0.42, 172, 118, 'i']],                                    // Retreat!
  [[0, 0.17, 135, 138, 'i'], [0.22, 0.28, 140, 115, 'i']],                                    // GG
  [[0, 0.22, 128, 150, 'o'], [0.28, 0.22, 150, 172, 'o'], [0.56, 0.4, 175, 118, 'o']],         // Yo ho ho!
];
function pirateVoice(e, v = 1, pitch = 1) {
  const { c } = C, t = c.currentTime + 0.02, line = LINES[e] || LINES[0], vol = 0.9 * v;
  const g = c.createGain(); g.gain.value = 1; g.connect(C.out);
  for (const [dt, dur, f0, f1, w] of line) {
    const s = t + dt, o = c.createOscillator(), vib = c.createOscillator(), vg = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * pitch, s); o.frequency.linearRampToValueAtTime(f1 * pitch, s + dur);
    vib.frequency.value = 6.5; vg.gain.value = 4 * pitch; vib.connect(vg).connect(o.frequency);           // a little gravel in the throat
    const env = c.createGain(); env.gain.setValueAtTime(0.0001, s); env.gain.linearRampToValueAtTime(vol, s + 0.03); env.gain.setValueAtTime(vol, s + dur * 0.72); env.gain.linearRampToValueAtTime(0.0001, s + dur);
    for (const [k, F] of VOW[w].entries()) { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = F * (0.94 + 0.12 * (pitch - 0.9)); b.Q.value = k ? 9 : 6; o.connect(b).connect(env); }
    env.connect(g); o.start(s); vib.start(s); o.stop(s + dur + 0.05); vib.stop(s + dur + 0.05);
  }
  noise({ t, dur: 0.18, f0: 1400, f1: 500, vol: 0.05 * v, type: 'bandpass', q: 1.2 });                // breath
  if (e === 7) [0, 0.28, 0.56].forEach(d => tone({ t: t + d, dur: 0.12, f0: 180, f1: 90, vol: 0.18 * v }));  // stomp
}
export const sfx = {
  // own = your callout (your crew joins in, crew size = GUN CREW); remote pirates: 1 voice in their body's voice
  // [v145] BANKSY "male voices when male character and female for female": body = 'm' | 'f' from the emoter's v5 body (gear.body)
  emote: (e = 0, v = 1, pitch = 1, own = false, body = null, crew = null) => {
    if (!live() || !voice(2, 1.2)) return;
    const vv = Math.min(1, v), lead = own ? myVoice : body === 'f' || body === 'm' ? body : 'm';
    for (const key of LINE_KEY[e | 0] || []) if (crewCall(key, own && STACK[key] ? crewSize() : 1, lead, vv, own ? 1 : 1 + (pitch - 1) * 0.25, own ? crew : null)) return;
    if ((LINE_KEY[e | 0] || []).some((k) => has(k + 'M') || has(k + 'F'))) return;   // [v146] recorded line, no take in this voice: bubble only
    pirateVoice(e | 0, vv, Math.max(0.75, Math.min(1.3, pitch)));   // the takes failed to load (or ?oldaudio=1): the v96 synth
  },
  // generic cannon (kept for compatibility); v = distance volume
  cannon: (v = 1) => { if (!live() || !voice(1, 3)) return; boom(ENEMY_GUN, ctx.currentTime, v, 1 - v); },
  // the player's broadside: n = guns actually firing; sound follows the CANNONS tier
  broadside: (n = 4, v = 1) => {
    if (!live()) return; broadside(n, profile.cannon, v, 2, 0);
    // crew "Fire!" callout now and then (not every shot): at most once per 8 s, 40 % of broadsides
    const t = ctx.currentTime; if (t > _nextFireCall && Math.random() < 0.4) { _nextFireCall = t + 8; crewCall('fire', crewSize(), myVoice, 0.55 * v); }
  },
  // enemy broadside: same black-powder style; far away = darker, wetter, longer echo; at most 4 booms; bosses deeper
  enemyBroadside: (n = 3, v = 1, boss = false) => { if (!live() || v < 0.04) return; broadside(n, boss ? BOSS_GUN : ENEMY_GUN, v * 0.85, 1, Math.min(1, (1 - v) * 1.15), boss ? 4 : 3); },
  splash: (v = 1) => {
    if (!live() || v < 0.03 || !voice(v > 0.4 ? 2 : 0, 0.8)) return;
    const near = v > 0.45, buf = pick(near ? 'splashNear' : v > 0.2 ? 'splashMid' : 'splashFar');
    if (buf) playBuf(buf, { vol: (near ? LVL.splashNear : LVL.splash) * Math.min(1, v * 1.25) * jit(1.5), rate: 0.94 + Math.random() * 0.12, pan: (Math.random() - 0.5) * 0.5 }); else splash(ctx.currentTime, v);
  },
  // hit on an enemy ship
  hit: (v = 1) => { if (!live() || !voice(2, 0.6)) return; woodHit(ctx.currentTime, v); },
  // damage-scaled cannonball impact on any ship. o = { dmg, maxHp, kill, onPlayer, armor (0..1 metal ring), boss, v }
  impact: (o = {}) => {
    if (!live()) return;
    const H = hitTier({ dmg: o.dmg, maxHp: o.maxHp, kill: o.kill, onPlayer: !!o.onPlayer, cannonTier: o.onPlayer ? -1 : profile.cannonTier }), now = ctx.currentTime;
    if (!hitAllowed(now, RANK[H.id]) || !voice(o.kill || o.onPlayer ? 3 : 2, H.id === 'kill' ? 3 : 1.5)) return;
    const v = o.v ?? 1, metal = o.onPlayer ? profile.armor.metal : (o.armor || 0);
    const k = o.onPlayer ? profile.hull.impact : (o.boss ? 0.8 : 1), kill = H.id === 'kill';
    const ib = pick(kill ? 'impact' : IMPACT_KEY[H.id]), rate = Math.max(0.7, Math.min(1.15, k)) * (0.96 + Math.random() * 0.08);
    if (ib) { // recorded: kill = hull smash (+ debris raining into the water), light / medium / heavy = v102 phone-first hits
      playBuf(ib, { t: now, vol: (kill ? LVL.impact : LVL[H.id]) * H.vol * v * (1 - metal * 0.45) * jit(1), rate, pan: (Math.random() - 0.5) * 0.3 });
      const db = kill ? pick('debris') : null; if (db) playBuf(db, { t: now + 0.18, vol: LVL.debris * v * jit(1.5), rate: 0.95 + Math.random() * 0.1, pan: (Math.random() - 0.5) * 0.5 });
    } else impactSound(H, now, v * (1 - metal * 0.45), k);
    if (metal) ironHit(now, v * (0.6 + 0.2 * RANK[H.id]), metal); // iron plating clang / armored galleon & boss ring
    if (o.boss) punch(now, v);
    return H.id;
  },
  // hit on YOUR ship: deeper with bigger hulls, rings like iron with IRON PLATING
  playerHit: (v = 1) => {
    if (!live() || !voice(3, 1.5)) return;
    const t = ctx.currentTime, m = profile.armor.metal;
    woodHit(t, v * (1 - m * 0.55), profile.hull.impact);
    if (m) ironHit(t, v, m);
  },
  thunder: (delay = 0) => { if (!live() || !voice(2, 4)) return; const t = ctx.currentTime + delay, tb = pick('thunder');
    if (tb) { playBuf(tb, { t, vol: LVL.thunder * jit(2), rate: 0.92 + Math.random() * 0.14, pan: (Math.random() - 0.5) * 0.5 }); return; } // round 5 recorded
    noise({ t, dur: 0.25, f0: 3000, f1: 600, vol: 0.25 }); noise({ t: t + 0.05, dur: 3.2, f0: 260, f1: 30, vol: 0.85, a: 0.08 }); noise({ t: t + 0.5, dur: 2.4, f0: 180, f1: 25, vol: 0.5, a: 0.3, rate: 0.5 }); },
  sink: (big = false) => {
    if (!live() || !voice(3, 3.5)) return;
    const t = ctx.currentTime, k = big ? 0.7 : 1, sb = pick(big ? 'sinkBig' : 'sink');
    if (sb) { playBuf(sb, { t, vol: big ? LVL.sinkBig : LVL.sink, rate: 0.96 + Math.random() * 0.08, pan: (Math.random() - 0.5) * 0.4 }); return; } // v102 recorded
    noise({ t, dur: 2.6, f0: 500 * k, f1: 40, vol: 0.55, a: 0.05 });
    creak(t + 0.1, 0.8 * k, 2.4); creak(t + 0.9, 0.7 * k, 2.2); creak(t + 1.6, 0.6 * k, 1.8);
    for (let i = 0; i < 9; i++) tone({ t: t + 0.6 + i * 0.22 + Math.random() * 0.15, dur: 0.07, f0: 260 + Math.random() * 300, f1: 900 + Math.random() * 500, vol: 0.05 }); // bubbles
    if (big) { noise({ t: t + 0.3, dur: 3, f0: 160, f1: 25, vol: 0.5, a: 0.4 }); tone({ t, dur: 1.6, f0: 70, f1: 30, vol: 0.4 }); }
  },
  // SQUADS round won: recorded victory stinger, the music ducks under it
  victory: () => {
    if (!live() || !voice(4, 5)) return; const b = pick('victory'); if (!b) { sfx.upgrade(true); return; }
    const t = ctx.currentTime; playBuf(b, { t, vol: LVL.victory });
    musicDuck.gain.cancelScheduledValues(t); musicDuck.gain.setTargetAtTime(0.25, t, 0.05); musicDuck.gain.setTargetAtTime(1, t + b.duration - 0.6, 0.5);
  },
  // [v102] Waves run lost (game over): recorded defeat stinger (falling fiddle + ship's bell), the music ducks out
  defeat: () => {
    if (!live() || !voice(4, 5)) return; const t = ctx.currentTime, b = pick('defeat');
    if (b) playBuf(b, { t, vol: LVL.defeat });
    else { horn(t, [146.8, 220], 0.9, 0.06, 900); horn(t + 0.9, [116.5, 174.6], 0.7, 0.06, 800); horn(t + 1.6, [110, 164.8], 1.8, 0.065, 700); drum(t + 1.6, 0.6, 80); }
    musicDuck.gain.cancelScheduledValues(t); musicDuck.gain.setTargetAtTime(0.0001, t, 0.15); musicDuck.gain.setTargetAtTime(1, t + 6, 0.5);
  },
  // WAVE n: ship's horn + two drum hits
  waveStart: () => { if (!live() || !voice(3, 2)) return; const t = ctx.currentTime, hb = pick('hornWave'); if (hb) { playBuf(hb, { t, vol: LVL.hornWave }); return; } horn(t, [146.8, 220], 1.1, 0.07, 1100); drum(t, 0.7); drum(t + 0.28, 0.6); },
  // boss arrival: low minor horn chord + war drums + thunder rumble
  boss: () => { if (!live() || !voice(4, 4)) return; const t = ctx.currentTime + 0.4, hb = pick('hornBoss'); if (hb) { playBuf(hb, { t, vol: LVL.hornBoss }); return; } horn(t, [73.4, 87.3, 110], 2.6, 0.085, 700); [0, 0.45, 0.9, 1.15, 1.4].forEach((d, i) => drum(t + d, 0.9 - i * 0.05, 80)); noise({ t, dur: 3, f0: 200, f1: 30, vol: 0.35, a: 0.6 }); },
  // spyglass tier 3: lookout's bell when a wave spawns
  spawnBell: () => { if (!profile.range.bell || !live() || !voice(2, 2)) return; const t = ctx.currentTime + 0.15; ring({ t, base: 880, dur: 1.6, vol: 0.06 }); ring({ t: t + 0.42, base: 880, dur: 1.6, vol: 0.05 }); },
  coin: () => { if (!live() || !voice(2, 0.6)) return; const t = ctx.currentTime; arp(t, [1319, 1760], 0.07, 0.07, 'square', 0.18); arp(t, [2637, 3520], 0.07, 0.03, 'sine', 0.3); noise({ t: t + 0.02, dur: 0.15, f0: 9000, f1: 5000, vol: 0.05, type: 'highpass' }); },
  // [fish2] the fishing dock (js/island/areas/fishing2.js): cast whoosh, plop, nibble plips, the bite, reel ratchet, line strain / snap, the landing
  // splash and a catch jingle by rarity (a = 0 common .. 4 legendary). Synth only, phone-speaker friendly, muted with everything else (voice()).
  fish: (k, a = 0) => { if (!live() || !voice(k === 'catch' || k === 'bite' ? 2 : 1, k === 'catch' ? 1.6 : 0.6)) return; const t = ctx.currentTime;
    switch (k) {
      case 'cast': noise({ t, dur: 0.32, f0: 700, f1: 3200, vol: 0.09, type: 'bandpass', q: 1.2, a: 0.05 }); tone({ t: t + 0.05, dur: 0.5, f0: 2600, f1: 1800, vol: 0.012, type: 'square' }); break;
      case 'plop': tone({ t, dur: 0.12, f0: 620, f1: 170, vol: 0.16 }); noise({ t, dur: 0.18, f0: 1800, f1: 400, vol: 0.07 }); break;
      case 'nibble': tone({ t, dur: 0.06, f0: 950, f1: 520, vol: 0.07 }); break;
      case 'bite': tone({ t, dur: 0.16, f0: 520, f1: 120, vol: 0.2 }); noise({ t, dur: 0.3, f0: 2400, f1: 300, vol: 0.12 }); tone({ t: t + 0.06, dur: 0.18, f0: 1568, vol: 0.06, type: 'triangle' }); tone({ t: t + 0.14, dur: 0.22, f0: 2093, vol: 0.06, type: 'triangle' }); break;
      case 'hook': noise({ t, dur: 0.12, f0: 5000, f1: 1500, vol: 0.08, type: 'highpass' }); tone({ t, dur: 0.15, f0: 300, f1: 600, vol: 0.08, type: 'sawtooth' }); break;
      case 'reel': for (let i = 0; i < 5; i++) noise({ t: t + i * 0.035, dur: 0.02, f0: 4200 + a * 1800, f1: 3000, vol: 0.06, type: 'highpass', q: 3 }); tone({ t, dur: 0.12, f0: 440 + a * 440, vol: 0.05, type: 'triangle' }); break;
      case 'strain': tone({ t, dur: 0.3, f0: 150 + a * 60, f1: 95, vol: 0.07, type: 'sawtooth' }); noise({ t, dur: 0.25, f0: 900, f1: 600, vol: 0.04, type: 'bandpass', q: 6 }); break;
      case 'snap': noise({ t, dur: 0.08, f0: 7000, f1: 2500, vol: 0.14, type: 'highpass' }); tone({ t, dur: 0.12, f0: 2200, f1: 380, vol: 0.06, type: 'triangle' }); break;
      case 'reelEmpty': for (let i = 0; i < 8; i++) noise({ t: t + i * 0.05, dur: 0.02, f0: 3800, f1: 2800, vol: 0.035, type: 'highpass', q: 3 }); break;
      case 'landing': for (let i = 0; i < 10; i++) noise({ t: t + i * 0.045, dur: 0.02, f0: 4600, f1: 3200, vol: 0.05, type: 'highpass', q: 3 }); break;
      case 'catch': { noise({ t, dur: 0.5, f0: 1800, f1: 260, vol: 0.18 }); tone({ t, dur: 0.2, f0: 380, f1: 110, vol: 0.14 });
        const notes = [[523, 659], [523, 659, 784], [523, 659, 784, 1047], [587, 740, 880, 1175, 1480], [523, 659, 784, 1047, 1319, 1568]][Math.max(0, Math.min(4, a | 0))];
        arp(t + 0.18, notes, 0.075, 0.11, 'triangle', 0.32); if (a >= 3) { arp(t + 0.2 + notes.length * 0.075, [2093, 2637, 3136], 0.05, 0.04, 'sine', 0.5); noise({ t: t + 0.3, dur: 0.8, f0: 9000, f1: 3500, vol: 0.07, type: 'highpass', a: 0.05 }); }
        if (a >= 4) { horn(t + 0.6, [293.7, 370, 440], 0.9, 0.05, 2400); drum(t + 0.6, 0.6); } break; }
      default: break;
    } },
  // [health drops] soft rising heal chime (sine arpeggio + shimmer)
  heal: () => { if (!live() || !voice(3, 1)) return; const t = ctx.currentTime; arp(t, [523, 659, 784, 1047], 0.06, 0.14, 'sine', 0.4); arp(t + 0.03, [1047, 1319, 1568], 0.08, 0.04, 'triangle', 0.5); noise({ t: t + 0.1, dur: 0.35, f0: 6000, f1: 3000, vol: 0.07, type: 'highpass' }); },
  // gun crew: reload-ready ratchet, snappier with GUN CREW tiers
  reloadReady: () => {
    if (!live() || !voice(1, 0.5)) return;
    const R = profile.reload, t = ctx.currentTime;
    for (let i = 0; i < R.clicks; i++) { noise({ t: t + i * R.gap, dur: 0.035, f0: R.pitch, f1: R.pitch * 0.6, vol: R.vol, type: 'bandpass', q: 4, a: 0.001 }); tone({ t: t + i * R.gap, dur: 0.04, f0: R.pitch * 0.25, vol: R.vol * 0.4, type: 'square' }); }
    if (R.ring) ring({ t: t + R.clicks * R.gap, base: 1500, partials: [1, 2.4], dur: 0.35, vol: 0.03 });
  },
  shopOpen: () => { if (!live() || !voice(3, 1)) return; const t = ctx.currentTime; creak(t, 1.4, 1.2); arp(t + 0.18, [1568, 2093, 1760, 2349], 0.045, 0.03, 'square', 0.12); },
  // purchase: rising chime; legendary (tier 3) = brass fanfare + drum + shimmer
  upgrade: (legendary = false) => {
    if (!live() || !voice(4, legendary ? 2 : 0.8)) return;
    const t = ctx.currentTime;
    const lb = legendary ? pick('legendary') : null; if (lb) { playBuf(lb, { t, vol: LVL.legendary }); return; } // round 5 recorded fanfare
    if (!legendary) { arp(t, [659, 880, 1319], 0.07, 0.13); noise({ t: t + 0.05, dur: 0.45, f0: 7000, f1: 2500, vol: 0.1, type: 'highpass' }); return; }
    horn(t, [293.7, 370, 440], 0.28, 0.05, 2400); horn(t + 0.3, [293.7, 370, 440], 0.22, 0.05, 2400); horn(t + 0.55, [392, 493.9, 587.3], 1.1, 0.06, 2600);
    drum(t, 0.6); drum(t + 0.3, 0.5); drum(t + 0.55, 0.8);
    arp(t + 0.55, [1175, 1480, 1760, 2349], 0.06, 0.07, 'triangle', 0.6);
    noise({ t: t + 0.55, dur: 1.2, f0: 9000, f1: 3500, vol: 0.09, type: 'highpass', a: 0.05 });
  },
  // [v145] TREASURE MAP drop reveal: parchment unroll swish, the recorded legendary fanfare (synth brass if it hasn't
  // decoded), then a high sparkle shimmer. voice() returns false while muted, so the mute buttons silence it like everything else.
  treasureMap: () => {
    if (!live() || !voice(4, 2.5)) return;
    const t = ctx.currentTime;
    noise({ t, dur: 0.42, f0: 900, f1: 3800, vol: 0.07, type: 'bandpass', q: 0.9, a: 0.03 });             // the scroll unrolling
    noise({ t: t + 0.18, dur: 0.3, f0: 3200, f1: 1200, vol: 0.05, type: 'bandpass', q: 1.1, a: 0.02 });
    const lb = pick('legendary');
    if (lb) playBuf(lb, { t: t + 0.2, vol: LVL.legendary });
    else { const f = t + 0.2; horn(f, [293.7, 370, 440], 0.26, 0.05, 2400); horn(f + 0.28, [293.7, 370, 440], 0.2, 0.05, 2400); horn(f + 0.52, [392, 493.9, 587.3], 1.2, 0.06, 2600);
      drum(f, 0.6); drum(f + 0.28, 0.5); drum(f + 0.52, 0.8); }
    arp(t + 0.75, [1568, 1976, 2349, 3136, 2637], 0.07, 0.045, 'triangle', 0.5);                            // sparkle
    noise({ t: t + 0.75, dur: 1.4, f0: 9500, f1: 4000, vol: 0.07, type: 'highpass', a: 0.06 });
  },
  // skin equip: cloth swish + sparkle
  equip: () => { if (!live() || !voice(3, 1)) return; const t = ctx.currentTime; noise({ t, dur: 0.35, f0: 500, f1: 4500, vol: 0.18, type: 'bandpass', q: 0.8, a: 0.12 }); arp(t + 0.2, [1047, 1568, 2093], 0.06, 0.06, 'sine', 0.5); },
};

// ---------- continuous: ambient sea / wind / rain, hull creaks, low-health heartbeat ----------
let amb = null;
function startAmbient() {
  live();
  const c = ctx, loop = (f) => { const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = f; return s; };
  // ocean: low rolling noise with a slow swell
  const sea = loop(0.5), seaLp = c.createBiquadFilter(); seaLp.type = 'lowpass'; seaLp.frequency.value = 420;
  const seaG = c.createGain(); seaG.gain.value = 0.08;
  const swell = c.createOscillator(); swell.frequency.value = 0.11; const swellG = c.createGain(); swellG.gain.value = 0.05; swell.connect(swellG).connect(seaG.gain);
  sea.connect(seaLp).connect(seaG).connect(ambBus);
  // wind: band-passed noise, gusts; louder with speed and SAILS tier
  const wind = loop(1), windBp = c.createBiquadFilter(); windBp.type = 'bandpass'; windBp.Q.value = 1.4; windBp.frequency.value = 520;
  const gust = c.createOscillator(); gust.frequency.value = 0.17; const gustG = c.createGain(); gustG.gain.value = 180; gust.connect(gustG).connect(windBp.frequency);
  const windG = c.createGain(); windG.gain.value = 0.02;
  wind.connect(windBp).connect(windG).connect(ambBus);
  // rain
  const rain = loop(1), rainHp = c.createBiquadFilter(); rainHp.type = 'highpass'; rainHp.frequency.value = 2200;
  const rainG = c.createGain(); rainG.gain.value = 0.035; rain.connect(rainHp).connect(rainG).connect(ambBus);
  // heartbeat bus for low health
  const hb = c.createGain(); hb.gain.value = 0; hb.connect(sfxBus);
  [sea, wind, rain, swell, gust].forEach(s => s.start());
  amb = { seaG, windG, windBp, rainG, hb, nextCreak: 0, nextFlap: 0, nextBeat: 0, low: false };
}
// call every frame: speed (m/s), sail 0..3, playing (bool), hpFrac 0..1, roll (rad)
export function updateAmbient({ speed = 0, sail = 1, playing = false, hpFrac = 1, roll = 0, dt = 0.016 } = {}) {
  if (!amb || !ctx || ctx.state !== 'running') return;
  live();
  const t = ctx.currentTime, S = profile.sails, H = profile.hull;
  const sp = Math.min(1, Math.abs(speed) / 18);
  amb.windG.gain.setTargetAtTime((0.018 + sp * 0.05 * S.wind) * (0.6 + sail * 0.2), t, 0.4);
  amb.windBp.frequency.setTargetAtTime(420 + sp * 380 * S.wind, t, 0.5);
  if (!amb.rec && bufs.amb_sea) { // v102: recorded sea (water lapping on the hull + open-sea wash), gapless loop; synth sea stays under it
    const s = ctx.createBufferSource(); s.buffer = bufs.amb_sea; s.loop = true; const ab = bufs.amb_sea, AL = 12, al = Math.max(0, Math.min(0.06, ab.duration - AL)); if (ab.duration >= AL) { s.loopStart = al; s.loopEnd = al + AL; } /* 12 s master: skip mp3 padding */ const g = ctx.createGain(); g.gain.value = 0.0001;
    s.connect(g).connect(ambBus); s.start(t, Math.random() * bufs.amb_sea.duration); amb.rec = s; amb.recG = g;
  }
  amb.seaG.gain.setTargetAtTime((0.07 + sp * 0.05) * (amb.rec ? 0.4 : 1), t, 0.6);
  if (amb.rec) amb.recG.gain.setTargetAtTime((0.07 + sp * 0.05) * LVL.amb, t, 0.6);
  if (!playing) { amb.low = false; return; }
  // hull creaks: more when rolling, deeper with HULL tiers
  if (t > amb.nextCreak) { amb.nextCreak = t + 2.5 + Math.random() * 4 - Math.min(2, Math.abs(roll) * 8); if (voice(0, 1)) creak(t, H.creak, 0.8 + Math.abs(roll) * 4); }
  // sail flaps (SAILS tiers 1-3)
  if (S.flap && sail > 0 && t > amb.nextFlap) { amb.nextFlap = t + 1.6 + Math.random() * 2.5 / S.flap; if (voice(0, 0.4)) noise({ t, dur: 0.18, f0: 300, f1: 1800, vol: 0.06 * S.flap * (0.5 + sp), type: 'bandpass', q: 0.9, a: 0.02 }); }
  // low health heartbeat + warning under 30 %
  const low = playing && hpFrac > 0 && hpFrac < 0.3;
  if (low && t > amb.nextBeat) {
    const rate = 0.55 + hpFrac * 1.2; amb.nextBeat = t + rate;
    const hb = pick('lowBeat'); // v102: recorded lub-dub (frame drum, harmonics that read on phone speakers)
    if (hb) playBuf(hb, { t, vol: LVL.beat * (0.8 + (0.3 - hpFrac)), rate: 1 + (0.3 - hpFrac) * 0.15 });
    else { tone({ t, dur: 0.12, f0: 70, f1: 45, vol: 0.35, out: sfxBus }); tone({ t: t + 0.16, dur: 0.1, f0: 60, f1: 40, vol: 0.25, out: sfxBus }); }
  }
  if (low && !amb.low) { const bb = pick('lowBell'); if (bb) playBuf(bb, { t, vol: LVL.bell }); else tone({ t, dur: 0.5, f0: 880, f1: 660, vol: 0.05, type: 'square', out: sfxBus }); } // ship's bell warning
  amb.low = low;
}

// ---------- music: light procedural sea shanty (D dorian), scheduled with lookahead ----------
const BPM = 112, BEAT = 60 / BPM;
const MEL = [ // [semitones from D4, beats] — "Drunken Sailor", traditional sea shanty (public domain)
  [7, 1], [7, 0.5], [7, 0.5], [7, 1], [7, 0.5], [7, 0.5], [7, 1], [0, 1], [3, 1], [7, 1],
  [5, 1], [5, 0.5], [5, 0.5], [5, 1], [5, 0.5], [5, 0.5], [5, 1], [-2, 1], [2, 1], [5, 1],
  [7, 1], [7, 0.5], [7, 0.5], [7, 1], [7, 0.5], [7, 0.5], [7, 1], [9, 1], [10, 1], [12, 1],
  [10, 1], [7, 1], [5, 1], [2, 1], [0, 2], [0, 2],
];
const BASS = [0, 0, -2, -2, 0, 0, -2, 0]; // per bar, from D2
let music = { on: false, next: 0, i: 0, bar: 0, beatT: 0, timer: 0 };
const mtof = (semi, base = 293.66) => base * Math.pow(2, semi / 12);
function squeeze(t, fr, dur, vol) { // accordion-ish: two detuned pulses through a soft lowpass
  live(); const c = ctx, f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; f.Q.value = 0.8;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.setValueAtTime(vol * 0.85, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(musicBus);
  [['square', -8], ['sawtooth', 9]].forEach(([ty, dt]) => { const o = c.createOscillator(); o.type = ty; o.frequency.value = fr; o.detune.value = dt; o.connect(f); o.start(t); o.stop(t + dur + 0.02); });
}
// recorded "Salt on the Rail" shanty (BANKSY approved), gapless buffer loop; the synth loop is only the fallback
const SHANTY_LEN = 15; // seconds, exact loop length of the master (v102: 8-bar edit, half the decoded memory)
function startShanty() {
  const b = bufs.music_shanty; if (!b || music.src) return !!music.src;
  const s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
  const lead = Math.max(0, Math.min(0.06, b.duration - SHANTY_LEN)); // encoder padding (if the decoder kept any)
  if (b.duration >= SHANTY_LEN) { s.loopStart = lead; s.loopEnd = lead + SHANTY_LEN; }
  const g = ctx.createGain(), t = ctx.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(LVL.shanty, t + 1.5);
  s.connect(g).connect(musicBus); s.start(t, lead); music.src = s; music.srcG = g; return true;
}
function stopShanty() { if (!music.src) return; const t = ctx.currentTime; music.srcG.gain.setTargetAtTime(0.0001, t, 0.3); music.src.stop(t + 1.5); music.src = null; music.srcG = null; }
function schedMusic() {
  if (!music.on || !ctx || ctx.state !== 'running' || muted || settings.music <= 0.001) return;
  if (startShanty()) return;
  const ahead = ctx.currentTime + 0.25;
  while (music.next < ahead) {
    const [semi, beats] = MEL[music.i], t = music.next, d = beats * BEAT;
    squeeze(t, mtof(semi), d * 0.92, 0.05);
    music.i = (music.i + 1) % MEL.length;
    music.next += d;
  }
  while (music.beatT < ahead) { // bass on 1 & 3, light stomp + jingle on every beat
    const t = music.beatT, b = music.bar % 4;
    if (b === 0 || b === 2) { const root = BASS[Math.floor(music.bar / 4) % BASS.length]; live(); tone({ t, dur: BEAT * 1.6, f0: mtof(root, 73.42), vol: 0.13, type: 'triangle', out: musicBus, a: 0.01 }); tone({ t: t + BEAT, dur: BEAT * 0.5, f0: mtof(root + 7, 73.42), vol: 0.07, type: 'triangle', out: musicBus }); }
    live(); tone({ t, dur: 0.12, f0: 120, f1: 55, vol: b % 2 === 0 ? 0.13 : 0.06, out: musicBus });
    if (b % 2 === 1) noise({ t, dur: 0.07, f0: 8000, f1: 5000, vol: 0.025, type: 'highpass', out: musicBus });
    music.bar++; music.beatT += BEAT;
  }
}
export function setMusic(on) {
  if (on === music.on) return;
  music.on = on;
  if (!on && ctx) stopShanty();
  if (on && ctx) { music.next = music.beatT = ctx.currentTime + 0.1; music.i = 0; music.bar = 0; }
  clearInterval(music.timer); if (on) music.timer = setInterval(() => { if (ctx && music.next < ctx.currentTime) { music.next = music.beatT = ctx.currentTime + 0.05; } schedMusic(); }, 100);
}

// ---------- offline render of a cannon tier (for preview clips / tests) ----------
export async function renderHitsClip({ sampleRate = 44100 } = {}) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const oc = new OAC(2, sampleRate * 5.5, sampleRate);
  const out = oc.createGain(); out.gain.value = settings.master * settings.sfx; out.connect(makeLimiter(oc, oc.destination));
  const prev = C; C = { c: oc, noise: makeNoise(oc), out };
  offline = true;
  try { ['light', 'medium', 'heavy', 'kill'].forEach((id, i) => impactSound({ id, vol: { light: 0.55, medium: 0.75, heavy: 0.9, kill: 1 }[id] }, 0.1 + i * 1.1, 1)); }
  finally { offline = false; C = prev; }
  return oc.startRendering();
}
export async function renderCannonClip(tier = 0, { guns = 4, sampleRate = 44100, seconds = 5 } = {}) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const oc = new OAC(2, Math.floor(sampleRate * seconds), sampleRate);
  const out = oc.createGain(); out.gain.value = settings.master * settings.sfx; // same levels as the game
  out.connect(makeLimiter(oc, oc.destination));
  const prev = C; C = { c: oc, noise: makeNoise(oc), out };
  const P = soundProfile({ cannons: Math.round(tier * 8 / 3) }).cannon;
  offline = true; try { broadside(guns, P, 1, 9, 0); } finally { offline = false; C = prev; }
  return oc.startRendering();
}

// test hook (headless checks): sample load state + a tap point; no effect on play
export const audioDebug = () => ({ ctx, master, musicBus, myVoice, loaded: Object.keys(bufs), want: Object.values(SAMPLES).flat().length, liveVoices, noSamples: NO_SAMPLES, lvl: LVL });
