import json, collections
USED = {  # id -> intended layer (preview pack v1)
 '187767': 'cannon BODY (3 shots, round-robin)', '448002': 'cannon BODY', '758072': 'cannon BODY',
 '538795': 'cannon CRACK (musket transient)', '234869': 'cannon CRACK (musket transient)', '34708': 'cannon CRACK (real black powder shots)',
 '244345': 'cannon SUB thump (musket explosion low end)', '104003': 'cannon RECOIL (wood + chain carriage slam, pitched down)',
 '675613': 'cannon TAIL (real distant cannon roll over open ground)',
 '536777': 'impact SMASH + low THUD', '109359': 'impact SMASH / CRUNCH', '518791': 'impact SMASH / CRUNCH (plywood break)', '669457': 'impact CRUNCH',
 '873248': 'impact SPLINTERS', '438331': 'impact SPLINTERS', '562187': 'impact DEBRIS tail', '568413': 'impact DEBRIS tail', '774268': 'impact DEBRIS (wood tear)',
 '693541': 'impact debris PLOPS in water', '406093': 'impact TIMBER GROAN (heavy hits)',
 '442773': 'splash BODY', '676380': 'splash BODY', '469608': 'splash BODY', '637974': 'splash SPRAY (hand slaps)', '693542': 'splash DROPLETS',
}
rows = {}
for l in open('raw/sources.jsonl'):
    d = json.loads(l); rows.setdefault(d['id'], d); rows[d['id']].setdefault('files', set()).add(d['file'].split('/')[-1])
def lic(d): return 'CC0 1.0' if 'publicdomain/zero' in (d['license'] or '') else d['license']
src = ['# Raw source log', '', 'Every file in `raw/`. Freesound files are the public **HQ preview MP3s (~128 kbps)**, fetched without an account by `tools/fs_fetch.py`, which only saves sounds whose page shows **CC0**. Re-download the original WAV/FLAC from each URL once the account exists, then re-render.', '',
       '| Raw file(s) | Freesound ID | Title | Author | URL | License | Used in preview v1 |', '|---|---|---|---|---|---|---|']
for i, d in sorted(rows.items(), key=lambda kv: kv[1]['tag']):
    src.append(f"| {', '.join(sorted(d['files']))} | {i} | {d['title'].replace('Freesound - ','').replace('|','/')[:70]} | {d['user']} | {d['url']} | {lic(d)} | {USED.get(i, '')} |")
src += ['', '## Other raw sources', '',
 '| Raw file | Source | License | Use |', '|---|---|---|---|',
 '| raw/piper/en_US-libritts_r-medium.onnx (+ .json, MODEL_CARD) | Piper TTS voice "libritts_r" medium, https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/libritts_r/medium, trained on LibriTTS-R (http://www.openslr.org/141/) | Dataset CC BY 4.0 (Piper code MIT) | Base for synthesized emote voices + crew shouts (heavily processed, multi-speaker blends) |',
 '| raw/sf2/GeneralUser-GS.sf2 (+ LICENSE) | GeneralUser GS v2.0.3 by S. Christian Collins, https://github.com/mrbumpy409/GeneralUser-GS | Free for private or commercial music; may be bundled/modified (see raw/sf2/GeneralUser-GS-LICENSE.txt) | Instruments for the shanty + victory stinger (fiddle, violin, accordion, contrabass, cello, strings, timpani, drum kit) |']
open('raw/SOURCES.md', 'w').write('\n'.join(src) + '\n')
cr = ['# PUMPFUN PIRATES audio credits', '', 'Licence rule: CC0, or CC-BY credited here. Never CC-BY-NC or Sampling+. Nothing ripped from games, films, or YouTube.', '',
 '## CC-BY (attribution required, so ship this in the game credits)', '',
 '| Used for | Work | Author | URL | Licence |', '|---|---|---|---|---|',
 '| Emote voice lines (voices/emote_*.wav), crew "HEY!/HO!" shouts | LibriTTS-R corpus, via the Piper "en_US-libritts_r-medium" voice model | Y. Koizumi et al. (LibriTTS-R), derived from LibriVox/LibriTTS; model by the Piper project (rhasspy) | http://www.openslr.org/141/ · https://huggingface.co/rhasspy/piper-voices | CC BY 4.0 |',
 '', 'Suggested in-game credit line: *"Voice synthesis uses the LibriTTS-R corpus (CC BY 4.0) via Piper TTS."*', '',
 '## Other licensed tools/assets (no attribution required, credit appreciated)', '',
 '| Used for | Work | Licence |', '|---|---|---|',
 '| Shanty + stinger instruments | GeneralUser GS v2.0.3 SoundFont, S. Christian Collins | Free for commercial music, see raw/sf2/GeneralUser-GS-LICENSE.txt. Note: the author says a few samples came from other free banks and he can\'t trace them all. No complaints in 20+ years, but flagged for BANKSY |',
 '| Music | All compositions are original for PUMPFUN PIRATES ("Salt on the Rail" shanty, victory stinger) | Owned by the project |', '',
 '## CC0 sources used in preview v1 (no attribution required, listed for provenance)', '',
 '| Freesound ID | Title | Author | URL | Licence | Layer |', '|---|---|---|---|---|---|']
for i, layer in USED.items():
    d = rows[i]; cr.append(f"| {i} | {d['title'].replace('Freesound - ','').replace('|','/')[:60]} | {d['user']} | {d['url']} | {lic(d)} | {layer} |")
cr += ['', '## Freesound candidates (pull the ORIGINAL WAV/FLAC once the account exists)', '',
 'Preview v1 was built from Freesound **HQ preview MP3s (~128 kbps)**. Download the originals for every ID in the table above (all CC0) and re-render with `tools/make_*.py`. These extra CC0 candidates are also worth pulling for more round-robin variants and planned events:', '',
 '| Freesound ID | Title | Author | URL | Licence | Intended layer |', '|---|---|---|---|---|---|']
CAND = {'852980': 'distant battle rumble bed (Battle Royale ambience)', '565794': 'far-cannon variant / distance layer', '388200': 'cannon body alt (darker)',
        '254130': 'harbor ambience bed', '360633': 'harbor wind + rigging/mast rattle', '55034': 'chain creak (anchor, harbor)', '166710': 'gull calls', '263786': 'gull call (single)',
        '861755': 'shoreline + gulls (island ambience)', '130364': 'hull/rope creak loop', '862995': 'rope friction creak', '843241': 'boat squeaks (hull stress)', '573654': 'daily chest open',
        '554439': 'sail flapping', '207371': 'splash variants', '320330': 'splash variants', '233975': 'small plops (debris)', '853277': 'hull damage alt (designed SFX, CC0)'}
for i, layer in CAND.items():
    if i in rows: d = rows[i]; cr.append(f"| {i} | {d['title'].replace('Freesound - ','').replace('|','/')[:60]} | {d['user']} | {d['url']} | {lic(d)} | {layer} |")
open('CREDITS.md', 'w').write('\n'.join(cr) + '\n')
print(len(rows), 'sources logged')
