# PUMPFUN PIRATES: sound overhaul plan

Status: **milestone 1 (audit, sound bible, preview pack, plan) is done and waiting for BANKSY's approval.** Nothing ships, and no gameplay code changes, until BANKSY approves. No push, merge, or deploy without explicit OK.
Hard rules for every milestone: audio-only changes (no Waves stats, gameplay, gold, leaderboard, or player-data changes). The start-page 🔊 (`#btn-sound-title`), the HUD 🔊 (`#btn-sound`), and `M` must mute ALL new audio. The settings layout stays exactly as it is. Portal builds (itch.io / Newgrounds / CrazyGames) stay crypto-free, so no voice line or sound names a token. Every file is CC0 / CC-BY (credited) / original, logged in `/workspace/audio/CREDITS.md` and `raw/SOURCES.md`.

## Priorities (in order)
1. **Sound manager + asset pipeline** (no audible change yet): buses, voice caps, sample loader, Opus/MP3 delivery, 3D panner. Keep today's unlock and mute logic as is.
2. **Combat core**: cannon (4 tiers × 4 variants + enemy/boss sets), impacts (4 tiers × 3-4), splashes (near/mid/far), sinking, debris, whistle/passby. This is ~70 % of what players hear.
3. **Music**: harbor shanty, menu, Waves theme, BR/Squads tension with intensity layers, boss theme, stingers, crossfades. This also fixes music that never stops today.
4. **Emotes + crew**: 8 lines × 2 voices × 3 takes, crew callouts and grunts.
5. **World/ambience**: recorded sea, wind, rigging, wake/spray by speed, harbor, gulls, bells, storm-only rain, distant battle rumble.
6. **UI/economy**: coins, chest, shop, upgrades, skin equip, skin signatures, queue/match/countdown, kill confirm, holder 2× (web only).
7. **Polish pass**: phone listening tests (iPhone speaker, cheap Android, AirPods), loudness QA, CPU profiling.

## 1. Sound manager (`js/audio.js` rewrite, same public API)
- Keep the exports `initAudio, sfx.*, setMuted, muted, setLevel, setMusic, updateAmbient, onAudioState, setLoadout` so main.js, pvp.js, shop.js, emotes.js, and healthDrops.js call sites barely change. `sfx.*` names stay, and new events get new names.
- **Buses:** `music`, `sfx`, `voice`, `ui`, `amb` → `master` → glue compressor → limiter (current two-stage chain, ceiling ~ -1 dBTP; consider an AudioWorklet true-peak limiter if CPU allows).
- **Audio mixer in settings (APPROVED by BANKSY, 2026-11-02):** per-bus sliders **MASTER, MUSIC, SFX, VOICE, UI, AMBIENCE**, styled exactly like the existing `.vol-box` sliders (gold `--gold` labels, same range inputs, Just Another Hand font). Mockup: `preview/round2/mixer_mockup.png` / `.html`.
  - Option A: inline. The existing `.vol-box` grows from 3 to 6 rows, MASTER on top with a thin divider and a value readout (about 100 px taller).
  - Option B (recommended, smallest change to the panel): MASTER / SFX / MUSIC stay where they are, and one `🎚 AUDIO MIXER` ghost button (same style as `⌨ KEY BINDINGS / CONTROLS`) opens a small mixer panel with all 6 sliders, RESET and BACK.
  - Storage: extend `pfp_audio_v1` with `voice`, `ui`, `amb` (defaults .85 / .7 / .75). Existing saved master/sfx/music values are kept. Migration: missing keys get the defaults.
  - Mute stays global: `#btn-sound`, `#btn-sound-title`, and `M` mute master (all buses). Moving any slider above 0 while muted unmutes (same as today).
  - Not implemented yet. It ships with the M2 sound-manager work after BANKSY picks A or B.
- **Ducking:** sidechain-style gain automation on `music` (and `amb`) when prio-4 events fire (own broadside, kill, boss arrival, stingers, match found): -5 dB, 30 ms attack, 700 ms release. Voice lines duck SFX by -3 dB.
- **Voice caps by priority:** global cap 32 sample voices on desktop and 20 on phones. Each event has a per-event cap (cannon 10, impact 6, splash 6, creak 2, emote 3) and a priority. When full, steal the oldest lowest-priority voice with a 15 ms fade. Count real voices via `onended` (not timers). Keep the existing hit throttle (merge within 45 ms, ≤ 5 per 300 ms).
- **Round-robin + randomization** per event: no immediate repeats, pitch ±4-6 %, level ±1.5 dB.
- **Upgrade tiers:** `soundProfile.js` keeps choosing tiers. It maps to sample sets instead of synth params (cannons tier → set, hull tier → impact pitch, armor tier → metal layer mix, sails → wind/flap gain, spyglass III → bell).

## 2. 3D / spatial
- `PannerNode` (HRTF on desktop, `equalpower` on phones for CPU) per positioned voice. `distanceModel: 'inverse'`, refDistance ~15 m, rolloff ~1.1, maxDistance 260 m (matches the current 220-240 m cutoffs). Listener follows the camera (position + orientation each frame, smoothed).
- **Distance low-pass:** BiquadFilter per voice, 18 kHz at 0 m → 1.2 kHz at 220 m. Crack layer dropped beyond ~90 m (far set used instead).
- **Distance delay:** delayed by distance / 343 m/s, capped at 250 ms so combat still feels responsive (`start(when)` offset, no extra nodes).
- **Doppler** for passing balls: whistle pitch via `playbackRate` automation from the relative velocity along the line of sight (PannerNode has no built-in doppler anymore).
- **Reverb sends per space:** open sea / harbor / island slap (pre-rendered IRs, 2-3 ConvolverNodes shared, ~1 per space, cross-faded by location). Far sounds send more.
- Broadside stacking: per-gun variant, ragged 180-450 ms timing (as today), and bus limiter.

## 3. Combat (3-5 variants each + random pitch/volume)
| Event | Plan |
|---|---|
| Cannon fire | 5 layers (crack/body/sub/recoil/tail), 4 CANNONS tiers × 4 variants, enemy set, boss set, far set |
| Whistle / passby | 3 variants, Doppler, only for balls passing within ~25 m of the listener |
| Hits | light / medium / heavy / kill × 3-4. Armor metal layer. Own-ship set is deeper and closer |
| Misses | splash near / mid / far, picked by the impact distance to the listener |
| Crits | the game has no crit mechanic, so the heaviest damage tier gets an extra crack sweetener and a 150 ms music dip (sound only, no gameplay) |
| Sinking | groan + cracks + air bursts + bubbles + mast fall. Big ships get the long version |
| Boss | horn + war drums + thunder on arrival. Boss theme swaps in with a 2-bar crossfade |
| COMMODORE skin | brass horn blast on equip and match start |
| Low HP | heartbeat + hull groans + a gentle low-pass on music and ambience under 30 % HP. Remove the square beep |

## 4. Ship & world
Speed-scaled sail/canvas, wake hiss and bow spray. Wheel/rudder clicks on hard turns. Recorded wave beds (calm/storm). Wind and rigging. Gulls + harbor bells in the harbor and menu. Distant battle rumble while queued. Rain only in storms. Island and cave ambiences when the map adds them.

## 5. Crew & voices
- Emotes: 8 wheel lines × male "old salt" + female "captain" × 3 takes = 48 short files (< 1.5 s, ~6-10 KB each as Opus). Remote players get a voice by id hash (male/female + take), plus the existing hash-pitch.
- Crew: "Reload!", "Fire!", "All hands!", hurt grunts, kill cheers ("HEY!"). Low priority, capped at 1 at a time.
- Production (round 2, BANKSY's call): **real recorded human voices only** (CC0 / CC-BY from Freesound and OpenGameArt). Light processing only: trim, EQ, compression, a touch of grit, level match. The TTS route is dropped. Real female pirate callouts are scarce on CC0/CC-BY sites, so the best long-term option is to commission or record 2 voice actors (1 male, 1 female) for the full 8-line × 3-take set.

## 6. UI & economy
Coins (pickup, pile, big payout), daily chest, shop open/close, upgrade buy/legendary, skin equip + **skin signatures** (DIAMOND shimmer, FLAMING crackle, KRAKEN squelch, GHOST whisper + long reverb, GOLDEN GALLEON coin jingles, COMMODORE horn), queue join/leave, match found, countdown, kill confirm, victory/defeat/SUNK stingers. **Holder 2× gold** gets a richer coin cascade + brass shimmer, loaded only when `!ON_PORTAL` and the holder perk is active (never in portal builds).

## 7. Music
| Track | Use | Notes |
|---|---|---|
| Menu shanty | title / menus | variation of the harbor theme, sparser |
| Harbor shanty "Salt on the Rail" | queue harbor | preview v1 (30 s loop). Final: 60-90 s with an A/B section |
| Waves theme | Waves mode | driving 6/8 jig, 3 intensity stems (base / combat / boss-near) |
| Battle Royale / Squads tension | arena | stems layered by **ships remaining** (4 → 2 → 1v1 adds drums, low strings, then choir). Crossfades on bar lines |
| Boss theme | boss waves / harbor boss | low strings, timpani, horn, crew chant |
| Stingers | victory, defeat, SUNK!, wave clear, match found | 2-6 s. The music bed ducks or pauses under them |
Mechanics: one music player with 2 decks (A/B) for 1-2 bar equal-power crossfades on the beat grid. Loops use `loopStart/loopEnd` for gapless playback. `setMusic(false)` on game over/menu (fixes music that never stops today).

## 8. Phone performance & delivery
- **Formats:** Opus in WebM/OGG at 64-96 kbps (music 96 kbps stereo, SFX 64-80 kbps, voices 48-64 kbps mono) with an **MP3 (or AAC) fallback for iOS Safari** (detect via `canPlayType('audio/ogg; codecs=opus')` / decode success). One `decodeAudioData` per file. Keep music decoded in chunks or stream with `<audio>` + MediaElementSource if memory is tight.
- **Budget:** core combat pack ≤ 600 KB (Opus), first load. Music loads lazily per mode (~400-700 KB per track). Total ≤ 4 MB.
- **Lazy loading:** core pack after the first tap, then everything else on idle (`requestIdleCallback`) or on mode entry. Until a sample loads, fall back to today's synth sound (graceful, no silence).
- **Service worker:** precache the core pack. Runtime-cache the rest (cache-first) and bump `VERSION` in `sw.js`.
- **Unlock/resume:** keep today's unlock (capture-phase gestures, silent `<audio>` for the iOS silent switch, `audioSession.type='playback'`, visibilitychange/pageshow resume).
- **No frame-rate cost:** samples replace ~15 synth nodes per gun with 1-3 buffer sources. All per-frame work stays O(active voices). No AudioWorklet on phones unless profiling allows. Panner updates throttled to 30 Hz.

## 9. Milestones after approval
- **M2 (engine + combat):** new manager, loader, Opus pipeline, cannon/impact/splash/sink/whistle wired, A/B toggle `?oldaudio=1` for comparison. Branch `post/sound-overhaul`. Audio-only diff.
- **M3 (music):** all tracks + stingers + crossfades + ducking.
- **M4 (voices, world, UI):** emotes 48 takes, crew, ambience, UI, skin signatures, holder 2× (web only).
- **M5 (polish):** loudness QA, phone tests, CPU profiling, credits screen line, then a release PR for BANKSY to review.

## Open questions for BANKSY
1. ~~Sliders~~ **Answered:** BANKSY wants the 6-bus mixer. Open sub-question: **Option A (inline) or Option B (mixer button + panel)?** See `preview/round2/mixer_mockup.png`.
2. ~~Voices~~ **Answered:** BANKSY wants REAL recorded human voices, not TTS. Round 2 uses CC0/CC-BY human recordings (see CREDITS.md). TTS voices are dropped.
3. **Freesound originals:** the preview pack uses 128 kbps CC0 preview MP3s. A teammate is creating the free account. Pull the original WAVs for the IDs in `CREDITS.md` (or share an API key) and I'll re-render.
4. **SoundFont:** the shanty/stingers use GeneralUser GS (free for commercial music; the author can't trace every sample's origin). OK to use, or should I re-render with FluidR3 (MIT) or record live instruments?
5. **Download budget:** OK with ~600 KB core audio on first load and ~4 MB total, lazy-loaded?
6. **Music direction:** keep the original "Salt on the Rail" theme as the main motif for all tracks?
7. **Should the dev audio folder `audio-dev/` stay in the repo?** It's committed on the branch only. It would be served by the static host if merged, and it adds ~5 MB. Alternatively keep it out of the repo.


## Round 2 status (2026-11-02)
- Shanty: **approved by BANKSY**, kept as is.
- Cannons: heavy sub-dominant rebuild (`tools/make_cannon2.py`), with loudness-matched A/B files in `preview/round2/`.
- Voices: real recordings (`tools/make_voices_real.py`), with WAVs in `voices/real/`. Not wired into gameplay.
- Mixer: approved and spec'd above, with a mockup in `preview/round2/`. Not in game code.

## Crew voice stacking (requested by BANKSY in round 3; plan only, not in game code)
- **Goal:** crew callouts ("Fire!", "Arrr!", cheers, laughs) overlap and stack as the crew grows. A small crew gets 1-2 voices; a maxed crew gets a whole deck shouting together.
- **Count follows the existing GUN CREW upgrade** (`upgrades.js`, id `reload`, levels 0-6). This is audio only, so no stats change:

  | GUN CREW level | 0 | 1-2 | 3 | 4 | 5 | 6 (max) |
  |---|---|---|---|---|---|---|
  | voices per callout | 1 | 2 | 3 | 4 | 5 | 6 |

- **Caps for performance:** at most 6 voices per callout on desktop, 3 on `PHONE`, and 2 in `lite` mode. Other ships (PvP or enemies) use at most 2 voices. A global voice budget of 8 live voice sources steals the oldest and quietest first. One shared deck-room convolver sits on the VOICE bus, not one per voice.
- **How each extra voice is made:**
  - Use a different real take where one exists (male and female mixed), otherwise re-use a take detuned further.
  - The 2nd and 3rd voices come in 20-80 ms behind the caller; the rest bunch up 0-50 ms after them.
  - Detune each voice by ±1-3% using `playbackRate`, plus ±0-4 dB of level variation.
  - Spread voices across the deck with panning (0, -0.45, +0.4, -0.7, +0.7, -0.2), and add a touch more deck room as the crowd grows.
- **Loudness:** the bus is gain-compensated so loudness grows only about +3 LU from 1 to 6 voices. A big crew sounds bigger, not just louder, and stays under the limiter.
- **Variety:** never play the same take twice in a row for the same caller slot. All of this follows the VOICE slider (mixer) and the global mute and M key.
- Demo: `preview/round3/02_crew_stack_demo.mp3` ('Fire!' at crew size 1, 3, 6) and `02_crew_stack_in_context.mp3` (each size followed by its broadside). Built by `tools/make_crew_stack.py`.

## Phone-first cannon (round 3)
- BANKSY couldn't hear the round-2 difference, most likely on phone speakers, which reproduce almost nothing below about 250 Hz.
- The weight moves to **150 Hz-4 kHz**:
  - a hard, sharp crack (with a 4 ms snap on the attack)
  - a saturated 150-300 Hz chest punch whose harmonics carry the low end to small speakers
  - an audible recoil, chain rattle and wood creak
  - a rolling 1-3 kHz echo tail with 6 ping-pong reflections
- The sub stays but is moderate (-11 dB), for good speakers. Built by `tools/make_cannon3.py`.
- Every cannon candidate is now checked through `tools/phonesim.py` (mono, HPF 300 Hz, small-speaker EQ, phone limiter) before it goes to BANKSY. Measurements are in `preview/round3/phone_measurements.txt`.
- Mixer Option A vs B is **still pending** (no decision).
