# Pilly / Parrot restoration

Resumed after PumpFun room v495 shipped. Parrot display renamed without key changes; Pilly enabled at 5,000g in its independent companion slot.

Two client fixes found during stubbed QA: place loaded Pilly before distance-culling (otherwise it stays invisible at the harbor); stack Pilly panel above pet store so purchase button receives clicks.

Headless walking checks passed for docking/ashore and near HQ: Pilly visible and following, game loop advancing, no WebGL context loss. Purchase-path rerun in progress. Supabase and sockets are stubbed; no production writes/deploys.

QA artifacts: /workspace/pilly-qa.py and /workspace/petstore-shots/ (store.png, hq-pilly.png, logs).
