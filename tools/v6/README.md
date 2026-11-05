# V6 characters tools (Blender 4.2 headless + Playwright)
- rig.py SEX LOD OUT.glb: generated V6 body -> v5 skeleton (weights transferred from the v5 body, hair = head / her braid), hi 19k / lo 3.6k, eyes/brows/lips decal re-cut ('v5_face_eyes'), v5 clips + 'v5warp' extras, body extras {v6: 1}.
- refit.py SEX LOD OUTDIR items...: refits the v5 per-body item GLBs onto V6 (smoothed v5->V6 surface field + push-out; hats over the outer hair; face paint / grills / eyepatch on the face only; boots keep heights; ground pets untouched).
- pose.py / fit.py: Blender deformation + fit renders. fit_shots.py + fit_sheet.py: SHEET_v6_fit (real game code via tools/gear_viewer.html). v6_shots.py / ingame_shots.py: gear / emote / island shots (desktop + phone), Supabase blocked. Serve /workspace on :18970.

## v5-shape conform (BANKSY "V5 is fine tuned why can't v5 clothes go on v6 characters")
- rig.py: decimate, conform to the v5 body (morph.py: smoothed nearest-surface field, legs push-in only, radial head/hair squeeze, push under the base outfit), v5 weights.
- paint.py: per-face skin / hair / white-cloth classes (split edges for the per-vertex retint), albedo rebuilt per class with neutral skin / hair maps (the tint gives the colour, as on V5), clean eyes + brows decal, painted smile.
- The v5 item GLBs are NOT refitted (refit.py removed): the bodies match the v5 shape instead.
- Store shoes: shoes/build_shoes.py (SDF last + shaft, sole, heel, buckles; sandal straps swept round the foot). Store pants: pants.py (v5 classic pants, tailored texture). Clothing textures: sharpen_cloth.py.
