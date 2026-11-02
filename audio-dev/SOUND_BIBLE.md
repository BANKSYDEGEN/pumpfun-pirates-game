# PUMPFUN PIRATES: Sound Bible

**One world:** wooden ships, salt air, black powder, rowdy pirates. Everything should sound recorded, physical, and a bit rough. Reference bar: Sea of Thieves, Blackwake, and World of Warships for the sea; GTA/Rockstar for how detailed and varied the weapons and impacts are.

## 1. Palette
| Family | Is | Is NOT |
|---|---|---|
| Guns | black powder: sharp crack, chesty boom, sub thump, wooden carriage recoil, long roll across the water | sci-fi booms, modern gunshots, clean synth sines |
| Wood | oak hulls: crunch, splinters, groans, rope and plank stress, debris raining into the water | thin "box" foley, cartoon bonks |
| Water | heavy plunges, spray, hull slaps, wake hiss, droplets | swimming-pool splashes |
| Air | wind in canvas and rigging, gulls, harbor bells | white-noise wind |
| People | rowdy crew: shouts, grunts, "HEY!", emotes in two character voices (gravelly male, fierce female) | real-person soundalikes, celebrity impressions |
| Music | fiddle, accordion/concertina, frame drum and stomps, tambourine, low strings, crew gang vocals, timpani for big moments | chiptune, 8-bit, EDM, trap hats |
| UI | wood, rope, brass, coins, parchment, small bells | beeps, square-wave arpeggios |

Synthesis is allowed only as a **layer** (sub sweeps, sweeteners). jsfxr is raw material only and must never be heard as itself.

## 2. Loudness and dynamics targets
| Item | Target |
|---|---|
| Master output | true peak ≤ **-1 dBTP**. Always-on master limiter (lookahead/true-peak style, after a gentle glue compressor) |
| Music loops | **-16 LUFS integrated** (±1) at file level, LRA 3-8 |
| Stingers | -13 to -14 LUFS short-term at the hit. Duck music under them |
| Big SFX one-shots (own cannon, kill, boss) | peaks -1.2 dBFS at file level. Punch window (first 300-400 ms) RMS matched within ±1 dB across round-robin variants |
| Mid SFX (impacts, splashes) | peaks -1.5 dBFS. Matched first-300 ms RMS |
| Voices/emotes | peaks -1.5 dBFS, < 1.5 s, heavily compressed (consistent) |
| UI | 6-10 dB below combat. Short, dry, no low end under 120 Hz |
| Ambience beds | -24 to -28 LUFS. Seamless loops of ≥ 20 s |
| In-game mix | music -6 dB under SFX in combat. Ducking -4 to -6 dB under own broadside, kill, boss arrival, and stingers (attack 30 ms, release 600-900 ms) |

Phone check: every sound must still read on a phone speaker (≥ 150 Hz content in every bass-heavy sound, via the saturated sub harmonics).

## 3. Layer recipes
**Cannon (per shot)**: CRACK (musket/black-powder transient, HP 900 Hz, 0-220 ms) + BODY (real cannon, varispeed 0.75-0.85, LP 5 kHz, transient-shaped) + SUB (real low thump + 95→34 Hz saturated sweep) + RECOIL (wood/chain carriage slam, pitched down, +85-115 ms) + TAIL (real distant cannon roll + open-sea IR + island slap echo at 0.42-0.67 s). Close = louder, drier, full crack. Far = crack removed, LP 5 kHz→700 Hz, more wet, delayed (speed of sound, capped for gameplay).
**Impact**: SMASH (real wood smash) + CRUNCH (real break, pitched 0.6) + THUD (low smash + 120→42 Hz sweep) + 2 SPLINTER layers + DEBRIS tail + 3-4 debris PLOPS in the water + TIMBER GROAN (heavy and kill only) + short sea space.
**Splash**: PLUNK (170→55 Hz cavity thump) + BODY (real big splash) + SPRAY (real slaps) + DROPLETS. Sized by distance.
**Voices** (round 2, real humans only, no TTS): real recorded takes (CC0/CC-BY) → trim → HPF 95 Hz (male) / 150 Hz (female) → -2 dB mud cut → +2 dB at 3.2 kHz presence → 3:1 compression → 22% parallel saturation → barely-there deck room (-21 dB) → active-RMS match to -15 dBFS → limit -1.5 dBFS. Never pitch-shift so far that the voice stops sounding human. 2-4 takes per line, rotated without repeats.

## 4. Variation rules
- Round-robin: 4+ variants for cannon, impact, splash, and creak; 3+ takes per emote per voice; never repeat the same file twice in a row.
- Random per play: pitch ±4-6 % (`playbackRate`), level ±1.5 dB, start offset 0-15 ms in broadsides, pan jitter for crew.
- Broadside stacking: ragged crew timing of 180-450 ms per gun, a different variant per gun, -0.3 dB per extra gun, and the bus limiter catches the rest. Cap own guns at 8 and enemy guns per broadside at 3-4.

## 5. Space
| Space | Reverb | Where |
|---|---|---|
| Open sea | 3.2 s dark IR, early water reflections 20-50 ms | Waves, Battle Royale |
| Harbor | 1.6 s brighter, slap off the quay and buildings at 80-150 ms | queue harbor, menu |
| Island / cliffs | discrete slap echo 0.4-0.7 s, darker | near rocks/islands (later) |
| Caves | 2.5 s wet, metallic flutter | future map content |

## 6. Event list (existing → new)
Legend: E = exists today (synth), N = new event. Prio: 4 critical (never dropped), 3 high, 2 normal, 1 low, 0 ambient filler.

| Event | Today | New sound | Bus | Prio | Variants |
|---|---|---|---|---|---|
| Own broadside (per gun) | E `broadside` | layered cannon, tier-scaled (CANNONS 0-3 = bigger body, lower sub, longer tail) | SFX | 4 | 4 per tier |
| Enemy / remote broadside | E `enemyBroadside` | same set, 3D positioned, distance-filtered and delayed | SFX | 2 | shared |
| Boss guns | E (BOSS_GUN) | heavier set: pitched down, extra sub, longer tail | SFX | 3 | 3 |
| Ball whistle / passby | N | incoming whistle with Doppler for balls passing within ~25 m | SFX | 2 | 3 |
| Hit: light/medium/heavy/kill | E `impact` | layered impact set per tier. Kill adds a hull break and water rushing in | SFX | 3/4 | 3-4 per tier |
| Hit on own ship | E | same, deeper (HULL tier), with an iron ring (ARMOR tier) and a short camera-close layer | SFX | 4 | 4 |
| Armored hit (galleon/boss) | E `ironHit` | real metal clang layer | SFX | 3 | 3 |
| "Crit" (top-tier damage hit) | N | the game has no crits, so use the heavy tier plus a sweetener crack and a brief music dip | SFX | 3 | 2 |
| Miss splash | E `splash` | near/mid/far splash set | SFX | 1-2 | 4 + 2 + 2 |
| Sinking | E `sink` | groans, cracks, air-pocket bursts, masts falling, bubbles (big ships longer) | SFX | 3 | 3 |
| Debris raining | N | wood debris into water after kills | SFX | 1 | 4 |
| Reload ready | E `reloadReady` | real ratchet and rammer thunk, snappier per GUN CREW tier | SFX | 1 | 2 per tier |
| Low HP | E heartbeat + square beep | low heartbeat plus hull stress groans and muffling (LP on SFX/music under 30 %). No beep | SFX | 3 | loop |
| Wave start | E `waveStart` | conch/ship's horn + 2 frame-drum hits + crew "HO!" | SFX | 3 | 2 |
| Boss arrival | E `boss` | deep horn, war drums, thunder, crew murmurs. Starts the boss theme | Music+SFX | 4 | 1 |
| Spyglass bell | E `spawnBell` | real ship's bell, 2 strikes | SFX | 2 | 2 |
| Lightning | E `thunder` | real thunder cracks and rolls | Amb | 2 | 4 |
| Sea / wind / rain beds | E (noise) | recorded beds. Rain only during storms | Amb | 0 | loops |
| Hull creaks, rigging, sail flaps | E (synth) | recorded rope, plank, and canvas, scaled by roll, speed, and SAILS tier | Amb | 0 | 6+ |
| Wake / bow spray | N | speed-scaled water hiss and spray loop | Amb | 0 | loop |
| Wheel / rudder | N | wheel spin clicks and rope tension when turning hard | Amb | 0 | 3 |
| Gulls, harbor bells, distant rumble | N | harbor and queue ambience. Distant battle rumble while queued for Battle Royale | Amb | 0 | loops |
| Coin pickup / gold pile | E `coin` (chiptune) | real coins: pickup clink, pile scoop for big amounts | UI | 2 | 4 |
| Daily gold / chest | E (coin) | wooden chest creak, lid thump, coin cascade, small bell | UI | 3 | 1 |
| Holder 2× gold (web build only) | E (coin) | richer cascade with a brass shimmer. Must never exist in portal builds | UI | 3 | 1 |
| Health drop | E `heal` (sine arp) | cork pop and bottle glug, warm swell | UI | 3 | 2 |
| Shop open | E `shopOpen` | wooden door/chest creak, rope | UI | 3 | 1 |
| Upgrade / legendary | E `upgrade` | hammer on wood, coin pay, brass hit (legendary adds crew cheer) | UI | 3 | 2+1 |
| Skin equip | E `equip` | canvas unfurl + rope cinch, plus the skin's signature layer | UI | 3 | 1 + per skin |
| Skin signatures | N | DIAMOND shimmer · FIRE crackle · KRAKEN wet squelch · GHOST whisper + long reverb · GOLDEN GALLEON coin jingle · COMMODORE brass horn | UI/SFX | 3 | 1 each |
| UI click / hover / back | N | wood tap, rope creak, parchment | UI | 1 | 3 |
| Queue join / leave | N | bell strike / muffled bell | UI | 2 | 1 |
| Match found / offer | E (coin) | ship's bell ×3 + crew "ALL HANDS!" | UI | 4 | 1 |
| Countdown 3-2-1 | N | drum hits, last one with a crash | UI | 4 | 1 |
| Kill confirm | N | short brass/bell sting + crowd "HEY!" (not on assists) | UI | 4 | 2 |
| Victory / defeat / sunk | N | music stingers (victory D major, defeat minor with bell toll), "SUNK!" stinger | Music | 4 | 1 each |
| Emotes (8 wheel lines) | E (synth formants) | 2 voices × 3 takes each (section 7) | Voice | 2 | 48 files |
| Crew callouts/grunts | N | "Reload!", "Fire!", hurt grunts, cheers on kills | Voice | 1 | 4 each |
| Music | E (1 synth loop) | menu shanty, harbor shanty, Waves theme, BR/Squads tension (intensity rises as ships remain fall), boss theme, stingers | Music | n/a | stems |

## 7. Emote voice lines (crypto-free, so they're safe in every build)
| # | Wheel text | Male "old salt" takes | Female "captain" takes |
|---|---|---|---|
| 0 | Arr! | "Arrr!", "Arrgh!", "Yarrr!" | same |
| 1 | Follow me! | "Follow me!", "This way, lads!", "With me!" | "Follow me!", "On me!", "This way!" |
| 2 | Boss incoming! | "Boss incoming!", "Big one off the bow!", "Here she comes!" | same |
| 3 | Need help! | "Need help!", "Help me, ye dogs!", "Lend a hand!" | same |
| 4 | Attack! | "Attack!", "FIRE!", "Give 'em the broadside!" | same |
| 5 | Retreat! | "Retreat!", "Fall back!", "Hard to port!" | same |
| 6 | GG | "Good game!", "Well fought!", "Fair winds!" | same |
| 7 | Yo ho ho! | "Yo ho ho!", "Yo ho!", (laugh) | same |
Rules: voice lines never name a token, coin, wallet, or project ticker. No real person is imitated. Each line < 1.5 s.
