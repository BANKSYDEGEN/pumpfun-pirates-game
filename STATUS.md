# Pilly / Parrot work — paused, LOCAL ONLY

Stopped at parent request: finish PumpFun room first. Nothing pushed; no version bump.

Changes: renamed BASE PARROT to PARROT, removed base-parrot store wording, enabled Pilly in js/features.js (actual flag location), retained IDs/DB keys. Fixed Pilly visibility: position the asynchronously loaded model before distance-culling, otherwise the default origin is too far from the harbor and it remains invisible.

Tests: targeted pet/Parrot/HQ suite passed 21 tests, 1 optional SQL skip before the visibility regression test was added. Initial broad suite also had unrelated pre-existing gorilla model/size failures and missing Three dependency; targeted rerun uses /workspace/pilly-node-loader.mjs for vendored Three. Latest headless fake-Supabase QA confirms docking, going ashore, owned LV2 Pilly model spawned visible, no JS errors or Pilly loader warnings at that point. Full walking/plaza and buying checks were interrupted by stop request; do NOT claim complete QA. Earlier run found invisible Pilly, fixed as above. No production writes or deploys.

Artifacts: /workspace/pilly-qa.py; /workspace/petstore-shots/qa.log; targeted.log; debug.png. Requested store.png was NOT captured yet. Browser script blocks all Supabase requests and sockets, returning fake companion responses.

Next: finish QA, capture pet-store screenshot showing Parrot and Pilly, pull/rebase latest main, choose next free service-worker version, and push ONLY after parent/user resumes approval.
