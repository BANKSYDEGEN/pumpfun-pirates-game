# PUMPFUN PIRATES · PvP relay server (draft, NOT deployed)

Why: Supabase Realtime FREE allows 100 messages/s **project-wide** (every message sent or delivered), so with peer
broadcast only ~4 players can be in the arena at once (see `../PVP_PROGRESS.md`). This relay keeps the same client code
(`js/transport.js`) but the server batches **one frame per tick per client** with interest management, so traffic grows
with N·r instead of N²·r and there is no per-project message cap.

What it does (`relay.js`, Node 18+, one dependency: `ws`):
- **Lobby (authoritative):** arena seats, FIFO queue, 'Battle ready!' offers (OFFER_S), missed-offer rule (keep place once,
  then back of the line), death rotation (queue non-empty ⇒ the dying player goes to the back), leave / AFK. Same rules as
  `supabase/migrations/007_pvp_lobby.sql`. Up to ROOMS arenas of MAX_ARENA players; the queue starts when all are full.
- **Relay:** clients send one batched message per tick (`{t:'b', s: state-delta, e: events}`); the server stamps the sender
  id, merges state deltas, and each tick sends every client ONE frame with the other ships (near ones every tick, far ones
  every FAR_EVERY ticks) and the events (cannon volleys only within SHOT_R). Spectators get everything, never send state.
- Limits: MAX_CLIENTS, MSG_RATE (msgs/s per socket), MSG_MAX (bytes), ping/pong dead-socket cleanup. `/health` = JSON stats.

## Run locally
    npm install && PORT=8080 node relay.js
    # game: http://localhost:8787/?relay=ws://localhost:8080   (the ?relay= switch accepts wss://… or ws://localhost only)
    node loadtest.js 16 2 20 ws://localhost:8080 20   # 20 arenas × (16 players + 2 spectators) for 20 s

## Deploy (owner's decision; nothing has been deployed or signed up for)
- Docker: `docker build -t pfp-relay . && docker run -p 8080:8080 -e MAX_ARENA=16 pfp-relay` (any $5 VPS, Railway, Render…)
- Fly.io: copy `fly.toml.example` to `fly.toml`, `fly launch --copy-config`, `fly deploy`. Put it behind TLS (wss://).
- Then set `PVP_RELAY_URL` in `js/config.js` to the wss:// URL (and keep `PVP_NET.relay.maxArena` = MAX_ARENA).

## Env
PORT 8080 · HZ 10 · MAX_ARENA 16 · ROOMS 12 · MAX_SPEC 64 (per room) · MAX_QUEUE 500 · MAX_CLIENTS 3000 · OFFER_S 15 ·
INTEREST_R 320 · FAR_EVERY 5 · SHOT_R 360 · MSG_RATE 40 · MSG_MAX 16384

## Measured on the dev box (load generator on the same machine)
| load | relay CPU (1 core) | out | per client | latency p50 / p99 |
|---|---|---|---|---|
| 1 arena: 16 players + 4 spectators | – | 2.6 Mbps | 15.6 KB/s, 9.9 frames/s | 87 / 100 ms |
| 20 arenas: 320 players + 40 spectators | 12 % | 39 Mbps | 13.3 KB/s | 60 / 85 ms |
| 40 arenas: 640 players | 20 % | 63 Mbps | 12 KB/s | 67 / 113 ms |
CPU is not the limit; bandwidth is (~12-15 KB/s ≈ 50 MB per player-hour). A 1 TB/month VPS ≈ 20,000 player-hours/month.
Not cheat-proof (clients stay authoritative for their own ship, as on Supabase). Not load-tested on real hosting yet.
