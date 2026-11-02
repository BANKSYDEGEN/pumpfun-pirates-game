# PUMPFUN PIRATES: audio audit (milestone 1)

Audited at commit `f57d55b` (origin/main, v98.3) in worktree `/workspace/pfp-sound`, branch `post/sound-overhaul`.

## TL;DR
- **There are zero audio files in the repo.** Every sound is synthesized live in WebAudio (`js/audio.js`, 502 lines), with per-upgrade parameters in `js/soundProfile.js` (58 lines). README calls it "synthesized SFX + shanty loop (no audio files)".
- The engineering is solid: a mobile/iOS unlock, a glue compressor plus limiter, 3 buses, a voice cap, a hit throttle, and sounds that change with upgrades. The *sound* is the weak spot. It's all oscillators and filtered white noise, so cannons, impacts, and splashes read as "synth" rather than wood, powder, and water. The emote "voices" are sawtooth formant blips, and the music is a 2-oscillator "Drunken Sailor" loop.
- There are no real recordings, no round-robin samples, no 3D panning (only a random ±0.3 stereo pan per cannon), no ducking, no UI sounds, no victory or defeat stingers, no queue or match-found cues, and only one music track. That track starts on SET SAIL and **never stops** (`setMusic(false)` is never called).

## Engine (`js/audio.js`)
| Piece | What it does | Notes |
|---|---|---|
| Unlock | `unlock()` on every `pointerup/touchend/click/keydown` (capture) until the context is running. A silent looping `<audio>` data-URI plus `navigator.audioSession.type='playback'` gets around the iOS silent switch. Also handles `visibilitychange` suspend/resume and `pageshow` | Good. Keep it as is in the new manager |
| Graph | `sfxBus`, `musicBus`, `ambBus` → `master` → glue comp (-12 dB, 4:1) → limiter comp (-4 dB, 20:1, 1 ms) → trim 0.92 → destination | No Voice or UI bus. A DynamicsCompressor "limiter" isn't true-peak and is not lookahead |
| Levels | `settings = {master .8, sfx .9, music .35}` in localStorage `pfp_audio_v1`. Music bus = music×0.55, amb bus = min(1, sfx×1.1) | Ambience follows the SFX slider |
| Mute | `muted` in localStorage `pfp_muted`. `setMuted()` sets master to 0 and pauses the silent `<audio>` | Wired to `#btn-sound` (HUD), `#btn-sound-title` (start page), and the `M` key (rebindable `sound`). `onAudioState` updates both buttons' icon, title, aria |
| Voice cap | `MAX_VOICES = 28` (soft), plus 8 hard for prio ≥ 2. Counted by `setTimeout`, not by real node lifetime | Low-prio (far splash, creak, flap, reload) drops first |
| Hit throttle | `HIT_THROTTLE {window .3 s, max 5, mergeGap 45 ms}`. Kills always pass | Good idea, keep it |
| Reverb | One generated 4.5 s dark convolution IR (`makeVerb`), used only by cannons | One space for everything. No harbor or open-sea distinction |
| Noise | One 2 s white-noise buffer, looped with a random offset | Every noise layer comes from this |
| Offline renders | `renderCannonClip(tier)`, `renderHitsClip()` (OfflineAudioContext) | Exported but not called anywhere in the repo (test/preview hooks) |
| Test hook | `window.PFP_AUDIO = { sfx, setLoadout }` (main.js:633) | |

## Every sound and where it fires
| `sfx.*` | How it's made | Trigger(s) | Prio / voice life |
|---|---|---|---|
| `broadside(n)` | n × `boom()`: sine sub thump with pitch drop plus saturated copy, 3 filtered noise blast layers, rumble tail, late echo, crackle; ragged 180-450 ms gaps; params per CANNONS tier (4 tiers) | main.js:335 player fires (n = muzzles, max 8) | 2 / rumble+1 s per gun |
| `enemyBroadside(n, v, boss)` | same boom, `ENEMY_GUN`/`BOSS_GUN` presets, darker and wetter with distance (`v = 1 - dist/220`), max 3 (4 boss) guns | main.js:336 AI fires; pvp.js:482 remote pirate fires | 1 |
| `cannon(v)` | single enemy boom | legacy, **unused** | 1 |
| `impact({dmg,maxHp,kill,onPlayer,armor,boss,v})` | tiered light/medium/heavy/kill: filtered noise crunch, triangle plank thud, bandpass "splinter" ticks, sawtooth creak groan; kill adds second crash + "water rushing"; iron ring partials for armor; boss punch | main.js:352 every damage; pvp.js:506 your hit on a remote pirate (fixed maxHp 100, v .8) | 2-3, throttled |
| `hit(v)` / `playerHit(v)` | older wood hit | **unused** (superseded by `impact`) | |
| `splash(v)` | 2 noise sweeps + 3 sine "blips" | main.js:571 cannonball hits water (v by distance, 0.05-0.8) | 0-2 |
| `sink(big)` | noise sweep, 3 creaks, 9 sine bubbles, big = extra sub | main.js:356 any ship sinks; pvp.js:600 remote pirate sunk | 3 |
| `thunder(delay)` | 3 noise sweeps | main.js:1177 storm lightning | 2 |
| `waveStart()` | detuned saw "horn" fifth + 2 synth drums | main.js:279 each Waves wave (non-boss) | 3 |
| `boss()` | low minor saw-horn chord, 5 drums, rumble | main.js:279 boss wave; pvp.js:269 harbor boss | 4 |
| `spawnBell()` | inharmonic sine bell ×2 | main.js:279 if SPYGLASS tier 3 | 2 |
| `coin()` | square + sine arpeggio + hiss (**chiptune-ish**) | main.js:1164 loot pickup; pvp.js:116 holder daily gold, :142 queue offer, :590, :647 gold pile, :749 squads victory gold; shop.js:216 sell/refund; heal fallback | 2 |
| `heal()` | sine/triangle arpeggio + hiss | healthDrops.js:121 health drop pickup | 3 |
| `reloadReady()` | square/noise ratchet clicks per GUN CREW tier | main.js:1129 a broadside cooldown hits 0 | 1 |
| `shopOpen()` | creak + square arpeggio | shop.js:223 | 3 |
| `upgrade(legendary)` | triangle arpeggio, or saw-horn fanfare + drums | shop.js:144, :183, :206 | 4 |
| `equip()` | noise swish + sine sparkle | shop.js:127, :144; pvp.js:918; main.js:822 skin equip | 3 |
| `emote(e, v, pitch)` | `pirateVoice`: sawtooth syllables through 2 bandpass "vowel formants" + vibrato, 8 lines (Arr!, Follow me!, Boss incoming!, Need help!, Attack!, Retreat!, GG, Yo ho ho!). Remote pirates get a pitch from a hash of their id (0.85-1.14) and volume by distance (1 - d/240) | emotes.js:27 via showEmote (own + pvp.js:469 remote) | 2 |

### Continuous (`startAmbient` / `updateAmbient`, called every frame from main.js:1228)
- Sea: lowpassed noise at 420 Hz with a 0.11 Hz swell LFO. Gain 0.07 + speed.
- Wind: bandpassed noise with a gust LFO. Gain and centre frequency scale with speed and SAILS tier.
- Rain: highpassed noise, **constant 0.035 always on** (even in the menu and harbor, not tied to storms).
- Hull creaks: random every 2.5-6.5 s, more with roll, deeper with HULL tier.
- Sail flaps: SAILS tier ≥ 1.
- Low HP (<30 %): sine heartbeat plus a one-time square "warning" beep.

### Music (`setMusic`)
- One procedural loop: "Drunken Sailor" (traditional, public domain) at 112 BPM in D dorian. The melody is square+saw "accordion" `squeeze()`, with a triangle bass and a sine kick plus hat. It runs on a 100 ms `setInterval` scheduler with 250 ms lookahead.
- Started at main.js:1014 `startGame()` (Waves and PvP). **Never stopped or changed**: the same loop plays in the harbor, Battle Royale, Squads, boss fights, game over, and the menu after the first run. No crossfades, no stingers.

## Upgrade-linked sound (`js/soundProfile.js`)
`SOUND_TIERS` per Shipwright upgrade (shop levels 0-8 map to 4 tiers via `tier3`): cannons (sub frequency, blast, rumble, verb, gap), reload (ratchet clicks), hull (creak/impact pitch), armor (metal ring mix), sails (wind/flap), range (lookout bell at tier 3). `HIT_TIERS` + `hitTier()` choose the impact tier from damage fraction. `ARMORED_ENEMIES {galleon .35, boss .55}`. **Gameplay-neutral, so this should keep driving the new sample sets.**

## Settings UI (must stay as is)
- `#pause` panel `.vol-box`: **MASTER / SFX / MUSIC** sliders already exist (index.html:263-267, wired at main.js:632). Moving a slider above 0 also unmutes.
- HUD `#btn-sound` 🔊/🔇 and start page `#btn-sound-title` both call `toggleSound()`, plus the `M` key.
- There are no Voice, UI, or Ambience sliders. Ambience follows SFX.

## Formats, sizes, network, portals
- Audio payload: **0 bytes** (all synthesis). The service worker (`sw.js`, VERSION `pfp-v98-3`) caches `js/audio.js` and `js/soundProfile.js`. **Any new audio files must be handled in `sw.js` (precache a small core, runtime-cache the rest) and VERSION bumped.**
- Portal builds (itch.io / Newgrounds / CrazyGames via `ON_PORTAL` in config.js, `html.portal` class) use the same audio. Nothing crypto in audio today, and voice lines must keep it that way.

## Gaps vs a Steam-quality bar
1. No recorded sources: cannons, wood, and water all sound synthetic. No round-robin.
2. No positional audio: no PannerNode, no distance delay, no Doppler. Distance is only a gain/lowpass/reverb tweak, and other pirates' cannons are mono-ish.
3. No ducking: big booms don't duck music. The only "mix" is a compressor at the end.
4. Missing events: UI clicks/hover, queue join, match found, countdown, kill confirm, victory/defeat/game-over stingers, daily chest, whistle of incoming balls, near-miss splash, crew callouts and grunts, gulls/harbor bells, skin signature sounds, holder bonus sound.
5. Music: one track, never stops, chiptune-adjacent timbre.
6. Rain is always on, and the low-HP beep is a square wave (chiptune).
7. Voice accounting uses timers, not `onended`. Many tiny nodes per boom (~15 per gun × 8 guns), which costs CPU on low-end phones during a big fight. Pre-rendered samples will be **cheaper** than the current synthesis.
