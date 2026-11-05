# Musket arm QA

Run `node --test tests/musketArm.test.mjs` for production-backed bone lookup,
left/right hand axes, reachable/unreachable IK, fallback, and legacy switch checks.

Serve the checkout and run `python3 tools/musket-arm/shots.py after`.
Requires Python Playwright and `/usr/bin/google-chrome`. The default URL is
`http://127.0.0.1:18960/emerly-musket-arm`; override with `MUSKET_QA_URL`.
`MUSKET_QA_OUT` selects the output directory; `MUSKET_QA_DEVICES=desktop,phone`
selects devices. One browser is launched and closed per device, sequentially.
To verify the disabled path: `python3 tools/musket-arm/shots.py legacy '&musketarm=0'`.

Outputs: desktop_idle.png, desktop_aiming.png, phone_idle.png, phone_aiming.png,
and per-state diagnostic JSON. Idle means holding the musket without ADS;
aiming means right mouse / phone AIM held until ADS exceeds 0.95.
A fixed three-quarter inspection camera avoids the original phone capture's
character/bench clipping; it is test-only framing, not a production camera fix.
Supabase requests are blocked and shop equipment is mocked for local QA.

The experimental pose_harness.html is not used: it duplicates the old pose
rather than exercising production battle.js, so it is intentionally not shipped.
