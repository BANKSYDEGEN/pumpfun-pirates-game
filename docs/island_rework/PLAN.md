# PUMPFUN PIRATES: island rework plan (STEP 1, plan only, nothing built)

Status: **draft for BANKSY**. Nothing in the game has been changed. Base is `origin/main` 4f62427 (v148, treasure-map moment live; plaza v2 is the default). This branch bumps the SW to `pfp-v149`.
Map: `plan_map.png` (next to this file) is drawn on the real terrain using the in-game parchment renderer (`js/dock/treasureMap.js` `sheet()`), with the town-local `lx/lz` grid every 100 m.

**Frames.** Town-local: `lx` runs along the waterfront and `+lz` points out to sea. It converts to the foot/world frame as `x = -640 - lz`, `z = -90 + lx` (north = -z). Both frames are given below. Harbor frame = foot - (-890, -150).

---

## 0. Ground rules this plan respects

Frames: town-local lx = z + 90, lz = -640 - x (foot x = -640 - lz, z = lx - 90). The area bound lines below were corrected to this (5:18 PM).
- **No-go zones** (hatched red on the map; nothing new is placed in them or within 8 m of them):

  | Zone | Owner | Town-local | Foot |
  |---|---|---|---|
  | Plaza v2 + boardwalk + jetties | Timothy | lx -176..100, lz -56..66 | x -706..-584, z -266..10 |
  | Musket range (**PROVISIONAL**, Timothy 5:18 PM) | Timothy | lx -126..-82, lz -164..-124 | x -516..-476, z -216..-172 |
  | **Sword pit** (Emerly WIP, not on main, **PROVISIONAL**), east of Main Street, y 6.4 | Emerly | lx 44..76, lz -102..-70 | x -570..-538, z -46..-14 |
  | Cliff cannon battery | | lx 160, lz 36, r 36 + fort | |
  | Swim cove, west beach | Raul | assumed lx -300..-180 | |
  | Main Street + town gate | | | |
  | Legendary cave mouth | | foot (90, 180), r 14 | |

  - The sword pit is not in `main` yet. Its bounds are an assumption; Timothy needs to confirm them.
  - The swim cove bounds are also assumed; Raul needs to confirm them.
- **Code no-go:** Raul's cliff fall and swim code in `foot.js` is untouched. New areas ride on the existing walk, collide and fall pipeline; they do not change it.
- **Economy:** every price or reward below is **PROPOSED, needs BANKSY approval**. Nothing changes until approved.
- **Data:** no leaderboard or player-data changes. Migrations are additive only (new tables or functions, never alter or drop).
- **Look and performance:** the same chunky low-poly style as the plaza.
  - InstancedMesh for repeated props (trees, rocks, tents, barrels, bones).
  - Each area is its own lazy chunk (`js/island/areas/<area>.js`). It loads when the player is within about 250 m and is hidden or disposed outside about 400 m.
  - Two LOD levels per area (full and an impostor box set), with a `low` path that skips particles and shadows on phones.
  - Target is +1 draw-call group and ≤ 40k triangles per *visible* area on phones.

## 1. The six areas

### 1. Jungle Trail & Ruins (north highlands, around Gallows Hill)
- **Bounds:** foot x 0..260, z -450..-215 → lx -360..-125, lz -900..-640. Trail A already runs through it ((-20,-400) → (110,-330) → (230,-262)).
- **Build:**
  - A winding jungle path branches off trail A.
  - A vine-covered stone temple ruin sits on Gallows Hill (110, -320, h 52).
  - Broken columns, a collapsed archway and a sunken courtyard with a pressure-plate floor.
- **Things to do:**
  - **Trap run:** dart walls, swinging log and a falling-floor tile. The fall uses the existing fall/damage path with no new physics. Reach the altar to open the *Ruin Chest*.
  - **Hidden chests (3 per day):** behind a waterfall-moss wall, under a toppled idol, and up a vine climb.
  - **Collectible "Idol Shards" (7):** collect all 7 to unlock the *Golden Idol* cosmetic.
  - **Mini-quest "The Lost Expedition":** find 4 journal pages along the trail. The last page points to a one-off dig.
- **NPC:** *Old Mossbeard*, a hermit cartographer at the trail fork. He hands out the journal quest and sells map-reading hints.
- **Proposed dig spots:**
  - `dig7` (62, -402): lx -312, lz -702, h 25.1, slope 0.07. Nudged 2 m off a tree.
  - `dig8` (200, -260): lx -170, lz -840, h 17.1, slope 0.07.

### 2. Smuggler's Cave (south-east coast, Smugglers' Cove)
- **Bounds:** foot x 195..345, z 235..395 → lx 325..485, lz -985..-835. The cove water sits at (262, 300).
- This is a **different cave** from the legendary Skull Peak cave (90, 180), which stays exactly as it is.
- **Build:**
  - A walk-in dungeon cut into the cove cliff: entrance by the existing wreck, then 3 chambers and a locked rare-loot room.
  - Interior is a separate small scene/group that is only rendered when you are inside. Torches use 1 shared point light plus emissive props.
- **Things to do:**
  - **Skeleton guards:** 3 to 5 slow melee skeletons, reusing the boss/NPC combat hooks at PvE scale only.
  - **Dig spots inside:** soft-sand floor patches.
  - **Rare loot room:** needs a *Smuggler's Key*, which drops from the guard captain (1 per day).
  - **Collectible "Contraband Crates":** a rotating daily set of 5.
- **NPC:** *One-Eyed Nell*, a fence at the cave mouth. She buys contraband and sells the key quest.
- **Proposed dig spots:**
  - `dig9` (245, 360): lx 450, lz -885, h 1.8.
  - `dig10` (220, 262): lx 352, lz -860, h 1.9.
  - Both are on the cove beach outside the dungeon. Dig spots *inside* the dungeon are a later, separate `cave_*` id family (see §3).

### 3. Skull Peak Lookout (mountain/volcano summit)
- **Bounds:** foot x 25..178, z 195..335 → lx 285..425, lz -818..-665. The summit is at h ~145.
- The cave mouth exclusion (90, 180) sits just north of this box.
- **Build:**
  - A switchback path that branches off trail B.
  - Rope ladders on the 2 steepest pitches.
  - A summit lookout platform with a smoking vent, which gives the volcano look with cheap particles that are off when `low`.
- **Things to do:**
  - **Spyglass:** reuse the mole spyglass code. It frames the harbor and plaza, and spotting 3 marked ships gives a small reward.
  - **"Summit Flag":** plant your flag once per day.
  - **Collectible "Lava Glass" (5)** along the climb.
  - **Mini-quest "Signal Fire":** carry 3 driftwood pieces up to light the beacon, which is visible from the harbor for 60 s.
- **NPC:** *Lookout Lenny* with a crow's-nest telescope. He gives daily "spot the ship" bounties.
- **Proposed dig spot:** `dig11` (55, 205): lx 295, lz -695, h 110.8, slope 0.21. It needs a small flattened plateau at build time; the check script re-verifies it.

### 4. Freshwater Lagoon (central lake + waterfall)
- **Bounds:** foot x -295..-115, z -265..-60 → lx -175..30, lz -525..-345. This covers LAKE (-205, -130) r 58 and FALLS_CLIFF (-212, -236).
- **Build:**
  - A plunge pool at the falls with a secret ledge behind the waterfall.
  - A reed shore, a small fishing dock and stepping stones.
- **Things to do:**
  - **Fishing:**
    - Cast, wait, then a timing bar.
    - 8 fish species with rarity tiers and a fish journal (collectible).
    - Fish sell to the NPC or cook at the pirate camp.
    - It is server-validated with additive table `pvp_fish` and a daily cap (see §5).
  - **Behind-the-falls grotto:** a hidden chest plus 1 dig spot.
  - **Collectible "River Pearls" (6),** found while fishing at low odds.
- **NPC:** *Grandpa Gill*, the fisherman on the dock. He sells rod upgrades and holds weekly "biggest catch" bragging (cosmetic board, NOT the leaderboard).
- **Proposed dig spots:**
  - `dig12` (-140, -230): lx -140, lz -500, h 50.3, slope 0.19 (top of the falls).
  - `dig13` (-268, -80): lx 10, lz -372, h 24.3 (west shore). Nudged off a tree.

### 5. Pirate Camp & Shipwreck Beach (NW bay, by dig4). MOVED per BANKSY 1:55 PM: "Put the camp by dig 4 in north west"
- **Bounds:** foot x -570..-318, z -612..-432 → lx -522..-342, lz -322..-70. This is the north-west bay (cove (-420, -470)): a flat sand shelf (h 2–8) about 160 × 80 m between the bay and the jungle, and the nearest wild area to town.
- **Does it fit? Yes.** Checked in `tests/digspots.test.mjs` against the registry footprints:

  | Prop | Footprint (foot) | Town-local | Note |
  |---|---|---|---|
  | Beached galleon | x -502..-458, z -532..-518 | lx -442..-428, lz -182..-138 | about 44 × 14 m on its side along the waterline, stern in the surf, bow ramp up onto the sand |
  | Tents | x -530..-470, z -500..-462 | | |
  | 2 campfires + rum-barrel hangout | x -468..-432, z -496..-458 | | |
  | Dinghy post (rowboat to the islets, later) | x -372..-360, z -566..-556 | | |

- **dig4** keeps its id and coords exactly: (-332, -580), lx -490, lz -308.
  - It has a 6 m clear ring (`clear: 6` in the registry). The nearest prop, the dinghy post, is 15 m away.
- **Clearances from other owners:**

  | Zone | Gap |
  |---|---|
  | Raul's swim cove (lx -300..-180) | 42 m (camp lx ≤ -342) |
  | Musket range | > 200 m |
  | Sword pit, plaza v2, cliff battery, Main Street | > 150 m |

- **Build note:** trees inside the camp footprint get cleared by the area's scatter mask (step 5). The galleon's walk-in deck needs its own deck or collider entry, like the plaza jetties.
- **Build:**
  - Tents, 2 campfires (flicker on desktop only) and a rum-barrel hangout circle with sit spots, for the social space.
  - A **beached galleon** on its side that you can walk into: hold, captain's cabin and broken mast as a ramp.
- **Things to do:**
  - **Rum barrel hangout:** emotes, sit and a "toast" with players nearby (cosmetic).
  - **Cook fish** from the lagoon at the fire for a small buff (proposed).
  - **Explore the wreck:** captain's log pages (collectible, 5) and a cabin strongbox (daily).
  - **Mini-quest "Raise the Colours":** fetch the galleon's flag from the mast top.
- **NPC:** *Quartermaster Rook* at the camp. He hands out daily chores (fetch rum, gather driftwood) and is the turn-in for all area collectibles.
- **Dig spots:**
  - Existing **dig4**: unchanged.
  - Proposed `dig14` (-537, -470): lx -380, lz -103, west end of the camp.
  - Proposed `dig15` (-400, -492): lx -402, lz -240, east beach.
  - Both are OFF in the registry.
- The east bay keeps **dig5** exactly as it is, with no area there now.

### 6. Hidden Islets (offshore)

| Islet | Foot centre, radius | Town-local | Proposed spot |
|---|---|---|---|
| 6a | (-470, 420), r 42 | lx 510, lz -170 | `dig16` |
| 6b | (-330, 560), r 70 | lx 650, lz -310 | `dig17` (-329, 558) |
| 6c | (420, 560), r 38 | lx 650, lz -1060 | `dig18` |
| 6d | (560, -420), r 34 | lx -330, lz -1200 | `dig19` |
| 6e | (-150, -770), r 30, under the chart title | lx -680, lz -490 | `dig20` |

- All five islets are already above water (h 3–6). Their dig spots sit at the islet centres.
- **Not touched:** the sandbar lighthouse islet near town.
- **Access:**
  - Swim, which depends on Raul's swim code; nothing in it is touched.
  - Or a **rowboat** from a dinghy post on the nearest beach. The rowboat is a simple kinematic boat that reuses the ship controller at small scale.
- **Things to do:**
  - Each islet holds one secret: a buried chest, a marooned skeleton with a note, a message in a bottle, a mermaid statue puzzle or a bird nest egg.
  - Finding all 5 completes *"Cartographer"*, which reveals a bonus legendary-style dig. Proposed: it reuses the `cave` tier rules, with rewards still server-rolled.
- **Rule:** the islet dig spots stay **inactive** (not rollable) until swimming or rowing reachability ships and the check passes.

### 1b. The Pirates' Climb: the route from the plaza gap to the jungle (BANKSY 2:46 PM)
Map: `route_castle_map.png` (also at `/workspace/pfp-island-shots/castle/plan_route_castle_map.png`). The colour on the route is its measured grade.

**What is wrong today:**
- Main Street (lx 6, lz -56 → -205; foot x -584 → -435, z -84) is a flat cobble ramp from y 3 to y 20, with no landings, edges or lights.
- Past the town gate (-435, -84), trail A drops **13 m in ~17 m (78 % grade)** straight down to a stream at y 7.5. It then climbs a ridge to y 36 and comes down to the trailhead (y 25.4).
- Six pitches run at 17–26 % with nothing built on them. The trail is a painted splat with no edges, no lamps and no reason to stop.

| seg | where (foot) | build |
|---|---|---|
| **R0** | lz -56 → -64 (8 m) | **waits for Timothy's plaza edge**: one deck piece matching his gap height |
| **R1 Main Street, "Pirates' Stair"** | x -576 → -435 | stone flights (0.35 m risers) with a landing every 12 m, kerb stones, low retaining walls where the street cuts the slope, a lamp post every 16 m alternating sides, 2 benches + a notice board at mid-landing |
| **Gate plaza** | (-435, -84) | paved landing, signpost (TOWN / FORT / JUNGLE TRAIL), the fort ramp branch |
| **Gate drop** | (-430, -110), 78 % | **stone stair with 2 switchbacks** + retaining wall (the worst pitch on the route) |
| **L1 Stream ford** | along 89 m, (-391, -157), y 7.5 | stepping-stone ford + a log footbridge (deck) |
| **L2 Switchback stair** | along ~179 m, (-367, -186) | 3 timber-step legs + log retaining walls |
| **L3 Lagoon Overlook** | along 268 m, (-264, -281) | timber railing deck over the lagoon falls (ties to Area 4) |
| ridge pitches | (-191,-319) … (-97,-373), 17–26 % | timber steps + rope rail, edging logs |
| **L4 Ridge View** | along 450 m, (-104, -369), y 36 | stone seat + cairn, the high point, views to the harbor + Skull Peak |
| **L5 Ruin Steps** | along 538 m, (-23, -400) | old temple stair with mossy pillars, a teaser for the ruins |
| **Trailhead** | (4.7, -395.9) | locked; the Area 1 jungle trail starts here (already built in v151) |

**Everywhere on the route:**
- A **lamp post every 30 m** (19 lamps; instanced, with the flame as an emissive sprite, no real lights on Low).
- Edging stones on both sides, plus a 3–5 m walkable band (`AREA_DECKS` on steps).
- Phones: lamps, steps and edging are 3 InstancedMeshes per segment, culled per segment by the area loader. Budget: under +25 draw calls on a phone at any point on the route.

**Optional cosmetic quest:** "Lamplighter": light every lamp at dusk (see PRICES #28).

### 1c. Hilltop Fort: the "castle at the top of the hill" (BANKSY 2:46 PM)
**Found:** `CO.FORT` in `js/island/coast.js` (lx 46, lz -232 = foot **(-408, -44)**). It is built in `foot.js` ("fort at the top of Main Street": keep, curtain wall, 4 round towers, pirate flag, 4 cannons). It sits on a terrain knoll whose top is **y 36**, 16 m above the gate plaza.

**Why players can't get in:** all four causes apply.
1. **Collision:** one solid `addBox(27 × 27)` covers the whole footprint, so nothing inside can ever be reached.
2. **No door:** the curtain wall is one solid 26 × 7 × 26 box, and the keep is a solid 14 × 18 × 14 box. There is no gate, no opening and no interior.
3. **A cliff:** the knoll rises 20 → 36 m over ~10 m on every side, about 1.6 : 1, which the walker can't climb.
4. **No path:** nothing leads up to it, from either Main Street or trail A.

(Also checked: the Gallows Hill "ruined keep" walls are open ruins and already walkable. The cliff battery that Timothy owns is the headland at (160, 36), about 570 m away, so it is not this fort.)

**Redesign:**
- **Approach:** a switchback ramp up the north face from the gate plaza.
  - 3 legs, about 32–38 m each, rising 20 → 36 at ~13 % grade.
  - Retaining walls with parapet, a lamp at each turn, `AREA_DECKS` with a sloped y.
  - It ends at a **gatehouse** on the north wall: an open arch, the portcullis raised and chained, banners.
- **Courtyard:**
  - The solid wall box is replaced by 4 hollow curtain walls (1.6 m thick), leaving a 22 × 22 m yard walkable at y 36.
  - In the yard: a well, the flag mast (the pirate flag stays), crates, a training dummy and a weapons rack.
  - The collider becomes the wall ring + the keep + the towers, not one box.
- **Keep, walk-in WAR ROOM:**
  - A door on its north face.
  - A map table that **shows your active treasure map's X** (it reads the same `digSpots` registry as MAPS), plus the fort chronicle (lore).
- **Ramparts:**
  - 2 stone stairs (NW + SE corners) up to a wall-walk at y 43 all the way round.
  - The 4 towers get lookout tops, and the NE tower gets a **spyglass** (cosmetic zoom over the harbor and jungle).
- **Things to do (all cosmetic on the branch):**
  - **Cannon drill:** the 4 rampart cannons fire at floating targets in the bay, keeping a local best score. Gold is proposed only (PRICES #26).
  - **Raise the colours:** hoist the flag once a day, a cosmetic flourish.
  - **Quartermaster's Vault:** a cellar trapdoor in the yard leads to a small vault room with a chest. Cosmetic; a daily gold version is proposed (#27).
- **Tie-ins:**
  - **Jungle:** Mossbeard's **journal page 5** and **idol shard 8** are hidden in the fort. Mossbeard's dialogue points players to it, the shard count becomes 8, and the Golden Idol needs all 8.
  - **Treasure maps:** the war-room table, plus a proposed dig spot **`dig21` "fort glacis"** on the knoll shoulder outside the walls. It is registered **OFF** (append-only id), and its coordinates get snapped and validated by `check_digspots.py` when 9c is built, with a ≥ 6 m clear ring.
- **Phones:** the fort is its own area chunk. Near = full fort (about 18 draw calls: walls, towers and stairs instanced by material). Far = today's silhouette as the impostor. The interior only builds within 60 m.
- **Exclusions:** the fort (lx 31..61, lz -247..-217) and its ramp stay clear of the main_street strip's centre, Timothy's plaza (lz ≥ -56), the musket range and the cliff battery. All of this is verified by the static test once the fort is added to `AREAS`.
- **BEFORE shots:** `/workspace/pfp-island-shots/castle/before_{desktop,phone}_*.png` + `*_views.json` (fixed poses in `/workspace/pfp-island-test/castle_shot.py`).

## 2. Treasure map & dig-site integration
- Every area registers dig spots in the shared registry (§3). Boss and kill maps then roll into the new areas automatically once a spot is marked `active`.
- The parchment chart labels each area via its POIs.
- Area-specific map flavour is **visual only**: a jungle map gets vine edges, a cave map gets a skull wax seal. It is chosen from `spot.area` on the client.
- Mini-quest final steps ("Lost Expedition", "Cartographer") are **client-side breadcrumbs** that point to an already-held or newly granted map. Any gold still comes from `pvp_map_dig` on the server. No new gold path is added without approval.

## 3. TREASURE MAP COMPATIBILITY ([pt63u] "Make sure treasure map locations are compatible with the map changes we will be making")

### 3.1 Audit: how it works today

| Piece | Where | What it does |
|---|---|---|
| Rollable ids | `supabase/functions/pvp/lib.ts:167` `MAP_SPOTS = dig1..dig6` | Sent as `p_spots` to `pvp_maps_sync` (index.ts:478) |
| Valid ids | `lib.ts:168` `MAP_SPOTS_ALL = [...MAP_SPOTS, "cave"]` | `map_dig` rejects unknown ids (index.ts:486) |
| Roll | migration 026 `pvp_maps_sync` | `spot = p_spots[1 + pvp_map_roll(seed) % len]`. Seeds are `boss:pid:n` and `spot:<kill id>`; streak maps are always `cave` |
| Storage | `pvp_maps.spot text check ^[a-z0-9_]{2,16}$` | The id is **stored at drop time** and never re-rolled |
| Dig check | `pvp_map_dig` | `m.spot = p_spot`, 30 s after drop, 20 s between digs, 25/day. **There is no position check on the server** |
| Client positions | `js/island/foot.js:463` `DIG_HINTS` + `beachNear()` | The hint is snapped **at runtime** to the nearest sand cell (h 1.4–3.0, SDF < -6) and registered as POI / INTERACT r 3 |
| Client X / chart | `world.footInteract` → `treasure.js target()` and `treasureMap.js` | The X sits at the snapped point. The chart is drawn from `FM.H`, POIs and decks |

**Measured on current main** (from this run's terrain dump; `work/audit.json`):

| Spot | Foot | Town-local | h | Slope | Walkable | Note |
|---|---|---|---|---|---|---|
| dig1 | (-340, 164) | lx 254, lz -300 | 1.41 | 0.23 | yes | |
| dig2 | (-28, 436) | lx 526, lz -612 | 1.43 | 0.10 | yes | |
| dig3 | (396, -460) | lx -370, lz -1036 | 2.87 | 0.09 | yes | |
| dig4 | (-332, -580) | lx -490, lz -308 | 1.83 | 0.12 | yes | inside the pirate camp (NW bay): 6 m clear ring |
| dig5 | (420, 100) | lx 190, lz -1060 | 1.72 | 0.09 | yes | east bay (no area there after the camp moved) |
| dig6 | (-628, -212) | lx -122, lz -12 | 2.85 | 0.01 | yes | **inside Timothy's plaza v2 bounds** (raised shore strip behind the boardwalk) |
| cave | (90, 180) | | | | | interact r 4 at Skull Peak |

**Risks this exposes:**
- (a) Positions come from the terrain at runtime. Any terrain or prop edit near a hint silently moves an X (or snaps it onto a new prop). Since the server has no position check, the X would still "work" but could be unreachable.
- (b) dig6 is already within Timothy's area. Any plaza build-out over that shore strip could bury it.
- (c) An old cached client (SW) that receives a map naming an id it doesn't know would show no X.

### 3.2 Design: one shared source of truth
1. **`js/island/digSpots.js`** (new, pure data, no imports; BUILT, see the file for the exact fields), shared by client, server generator and tests:
   ```js
   export const DIG_SPOTS = [
     // id      area        x     z    (foot frame, BAKED, the exact X)   active  roll  note
     { id:'dig1', area:'west_inlet', x:-340, z:164, active:true,  roll:true },
     ...
     { id:'dig6', area:'town_shore', x:-628, z:-212, active:true, roll:true, guard:'plaza-v2' },
     { id:'dig7', area:'jungle',     x:60,   z:-400, active:false, roll:false },
     { id:'dig16',area:'islet_6a',   x:-470, z:420,  active:false, roll:false, needs:'swim|row' },
     { id:'cave', area:'skull_cave', x:90,   z:180,  active:true,  roll:false, r:4 },
   ];
   export const RETIRED = {};   // id -> replacement coords, if a spot ever has to move (id is never deleted)
   ```
   - Coordinates are **baked** from the current `beachNear` result, so today's X positions do not move by a centimetre.
   - `DIG_HINTS` / `beachNear` stay as a dev-only re-snap tool.
2. **Server is derived, not hand-kept.** `tools/gen-digspots.mjs` writes `supabase/functions/pvp/digSpots.ts`:
   - `MAP_SPOTS` = ids with `roll && active`.
   - `MAP_SPOTS_ALL` = **every id ever listed + 'cave'**. The list is append-only, and the generator fails if an id disappears.
   - lib.ts imports these two lists; the existing call sites are unchanged.
3. **Maps players already hold.** The spot id is stored in `pvp_maps` and is checked only by id, so held maps stay valid as long as the id stays in `MAP_SPOTS_ALL`, which it always does.
   - If the rework forces a spot to move (for example dig6 if the plaza grows), we change its **coordinates** in `digSpots.js` and keep the id.
   - The client X follows automatically, the server is unaffected and **no DB migration or wipe is needed**.
   - New areas only **append** ids. Appending changes only *future* rolls (`% len` changes), never stored maps.
4. **Chart and X update automatically.**
   - `foot.js` registers POIs / INTERACT from `DIG_SPOTS` (active, or held by the player) instead of `DIG_HINTS`.
   - `treasureMap.js` already redraws from `FM.H` + POIs + decks, so new terrain, the lagoon, ruins and camp labels appear on the parchment once each area adds its POI and label (`FOOT_POIS` / map label list).
   - The X uses the exact spot via `target()`, which is already exact after the treasure-moment fix.
5. **Rollout order** (avoids risk (c)):
   - First ship the client that knows all new ids, with `active:false`, and bump the SW.
   - Wait at least 48 h.
   - Then flip `active/roll` and regenerate `digSpots.ts`, which is a server-only deploy.
   - A client getting an unknown id falls back to the area label + "update your game" toast and does not crash.

### 3.3 Automated check: `tools/check-digspots.mjs` (+ headless `tests/digspots.spec`)
Run in CI or by hand; it fails on any violation. For **every** id in `DIG_SPOTS`:
1. **Walkable:** terrain `h` within the area's allowed range (beach 1.2–3.2; inland > 1.0), slope ≤ 0.35 over a 5 m cross, `blocked` false (sampled from the same FM grid the game uses).
2. **Clear of geometry:** no prop collider, deck or new-area mesh bounding box within 3 m (beyond the INTERACT radius). Each area exports `colliders()` for the check to read.
3. **Clear of exclusion zones:** distance ≥ 8 m from every no-go zone in §0. The zone list lives in `digSpots.js` `EXCLUDE` and is shared with the plan map.
4. **Reachable:** a grid flood-fill from the town spawn over walkable cells (islets allow the swim/row edge only when `needs` is satisfied) reaches the spot. `active` spots must be reachable.
5. **Client = server:**
   - Headless boot reads `world.footInteract` for each id and asserts it is within 0.05 m of the canonical x/z.
   - `treasure.js target(id)` and the drawn X centre must match to the same tolerance (as in the treasure-moment test).
   - `digSpots.ts` `MAP_SPOTS_ALL` ⊇ every id ever shipped (a frozen `tests/digspots.ever.json`).
   - `MAP_SPOTS` == active ∩ roll.
6. **Spacing:** ≥ 40 m between spots and ≥ 6 m from any area NPC or interactable.

**Results as built (v149, 2026-11-03), RESULT PASS, 0 warnings:**
- **Live spots** (dig1–6 + cave) pass all four checks:
  - walkable, with slope ≤ 0.15
  - no prop within 3 m
  - outside the zones (dig6 sits inside plaza v2 by design, with a clear ring)
  - reachable from the harbor spawn (flood fill of 235,865 cells × 2 m)
  - client X error 0.000 m in foot.js DIGS, INTERACT, world.footInteract and treasure.spotAt
  - the server lists are byte-identical to before: MAP_SPOTS dig1..dig6, MAP_SPOTS_ALL + cave
- **OFF spots** (dig7–20) are all walkable and clear. The islet spots dig16–20 are correctly unreachable on foot and stay OFF until swimming or rowing ships.
- Report and chart: `/workspace/pfp-island-shots/a_digcheck/digcheck.json` and `digcheck_chart.png`.

## 4. New items & rewards (**ALL PROPOSED, need BANKSY approval; nothing is priced until you say so**). Full list with rationale: `PRICES_FOR_BANKSY.md`

| Item | Where | Proposed |
|---|---|---|
| Fishing rod (basic) | free starter from Grandpa Gill | free |
| Rod upgrades (Bamboo / Iron / Golden) | Grandpa Gill | 300 / 900 / 2,500 gold, **needs BANKSY approval** |
| Fish sell values | Gill / Rook | 5–150 gold by rarity, daily cap 40 fish, **needs approval** |
| Smuggler's Key | guard captain drop, 1/day | not sold; rare room loot 150–600 gold, **needs approval** |
| Ruin Chest | trap run, 1/day | 100–400 gold, **needs approval** |
| Hidden chests (jungle 3, falls 1, wreck 1, islets 5) | daily | 25–200 gold each, **needs approval** |
| Golden Idol (7 shards) | cosmetic hat/back item | no gold, **needs approval** |
| Lava Glass cutlass skin (5 glass) | cosmetic | no gold, **needs approval** |
| Captain's Log set (5) | cosmetic flag | no gold, **needs approval** |
| Rowboat rental | dinghy posts | 25 gold/trip or free, **needs approval** |
| Cooked fish buff | camp fire | +10% speed 60 s, PvE only, **needs approval** |
| Cartographer bonus dig | all 5 islet secrets | uses existing legendary dig tier, **needs approval** |

New dig spots use the **existing** dig reward rolls (no change).

## 5. Server changes needed (all additive)
- `digSpots.ts` generated (§3), and lib.ts imports it. There is no behaviour change until ids are activated.
- **Migration 031 (additive, new tables only):**
  - `pvp_area_daily(player_id, key, day, n)`: one-a-day chests, keys, bounties.
  - `pvp_fish(player_id, species, size, caught_at)` + function `pvp_fish_catch` (server-rolled from a nonce, daily cap).
  - `pvp_collect(player_id, set, item)`: idols, glass, logs, pearls.
  - Functions mirror the `pvp_map_dig` style: rate limits and server-side rolls.
  - No changes to `pvp_maps`, scores or leaderboards.
- New `index.ts` actions: `area_claim`, `fish_cast` / `fish_land`, `collect`. All gold-granting ones stay disabled behind a flag until prices are approved.

## 6. Risks
- **Phone performance:** five more dressed areas. Mitigation: lazy chunks, instancing, LOD, the `low` path and a per-area triangle budget checked in a headless perf test.
- **Terrain edits moving the X:** solved by baked coords + the check script (§3).
- **dig6 / plaza overlap:** needs agreement with Timothy. Either guard a 6 m ring at (-628, -212), or move dig6's coords (id kept).
- **dig4 inside the pirate camp:** the 6 m prop clear-ring is enforced by `tests/digspots.test.mjs` (footprints) and `tools/check_digspots.py` (real colliders).
- **Unknown-id on old clients:** handled by the rollout order + fallback.
- **Islet reachability depends on Raul's swim code:** islets stay inactive until it is available. Rowboat as a backup.
- **Smuggler's Cave combat:** PvE skeletons must not touch PvP balance. They use separate stats and grant no PvP score.
- **Merge state:** `post/treasure-moment` shipped as v148 (4f62427). This branch is rebased on it and bumps to v149.

## 7. Build order & sizing
1. **DONE (v149, branch post/island-rework): dig registry + generator + check script.** Baked coords; zero visible change. *Done first: it protects existing maps.*
   - `js/island/digSpots.js`: the registry, also holding the exclusion zones and area footprints.
   - `tools/gen_digspots.mjs` → `supabase/functions/pvp/digSpots.ts`. lib.ts re-exports the same MAP_SPOTS and MAP_SPOTS_ALL as before.
   - `foot.js` reads the registry; `dock/treasure.js` checks every server id has an X and shows a "reload" toast for maps that name unknown spots.
   - `tests/digspots.test.mjs` + `tests/digspots.ever.json`: static, frozen ids and coords.
   - `tools/check_digspots.py`: in-game, covering walkable, props, zones, reachability flood-fill from spawn, and client X == server.
   - No migration is needed.
2. **DONE (in v150): area chunk loader** (`js/island/areas/`), with lazy build, far LOD and per-area culling.
3. **DONE (v150, bc68f96): Lagoon + fishing**, cosmetic. Gold stays behind `AREA_GOLD_ON=false`.
4. **DONE (v151, 3241bd5): Jungle Trail & Ruins**, traps + chests, starting at the locked trailhead.
5. **Pirate Camp & Wreck Beach**, hangout + walk-in galleon (M, 3 days).
6. **Skull Peak Lookout**, path + spyglass + beacon (S–M, 2 days).
7. **Smuggler's Cave dungeon**, interior + skeletons + key room (L, 4–5 days).
8. **Islets + rowboat**, then activate the islet spots (M, 2–3 days).
9. **THE PIRATES' CLIMB: whole route, plaza gap → gate → trail A → jungle trailhead** (BANKSY 2:45 PM + 2:46 PM "the path on, redesign it all make it better"). See **§1b** and `route_castle_map.png`. (M–L, 3–4 days)
   - **9a, build now:** everything past the plaza edge, meaning R1 Main Street (lz -64 → -205), the gate plaza, and trail A from the gate to the trailhead (566 m, landmarks L1–L5).
   - **9b, waits:** R0, the first 8 m (lz -56 → -64) that join Timothy's plaza. It waits for `timothy/plaza-blender` to land and for his gap-edge coords + height. It is one short deck piece, so it slots in as soon as he sends them.
   - **Walk height must match the visuals:** steps, ramps and landings are `AREA_DECKS` (or terrain cut to the step tops). A new check-script sampler: |walker y − surface y| < 3 cm every 0.5 m along the whole route.
   - **Before/after shots:** the camera from `/workspace/brand/requests/path_rework_ref.png`. BEFORE = `/workspace/pfp-island-shots/path_rework/before_{desktop,phone}.png`. That is the reference match: top of Main Street by the gate, the fort knoll on the right, trail A ahead. `before_street_*` is the plaza mouth looking up Main Street. AFTER = `path_shot.py after desktop|phone [gate|street]`, with the poses fixed in the script.
   - Touches nothing inside Timothy's plaza-v2 bounds or the musket range.
9c. **HILLTOP FORT: the inaccessible castle made explorable** (BANKSY 2:46 PM). See **§1c**. Comes right after 9a, because the switchback ramp starts at the gate plaza that 9a builds. (M, 3 days)
10. **Activate the new dig spots in the roll** (server-only deploy after the 48 h window) + chart polish (S, 0.5 day).

Each step: its own branch, the check script green, before/after shots on desktop and phone, SW bump, and Emerly merges.

## 8. Open questions for BANKSY
- Approve or adjust the §4 prices and rewards. Nothing gold-granting ships until approved.
- ~~Pirate camp location~~ decided: the NW bay by dig4 (BANKSY, 1:55 PM).
- Confirm with Timothy: sword pit bounds, and whether dig6's shore strip stays open. Confirm with Raul: swim cove bounds, and islet swim reachability.

### Files
- `plan_map.png`: the plan map.
- `route_castle_map.png`: the route + Hilltop Fort plan (renderer: `work/route_render.py`).
- `work/render.py`: the renderer + spot snapper/validator prototype.
- `work/newdigs.json`, `work/audit.json`: results.
- `work/sheet.png`, `work/dump.json`: the raw terrain dump.
