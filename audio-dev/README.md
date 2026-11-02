# PUMPFUN PIRATES audio workspace
Folders: sfx/ voices/ music/ raw/ (unprocessed downloads)

## Freesound.org licence rule
- CC0: OK to use freely.
- CC-BY: OK ONLY if logged in CREDITS.md (sound name, author, URL, licence).
- CC-BY-NC (NonCommercial) or Sampling+: NEVER use. The game may become commercial.

## Tools on the box
- audacity (/opt/audacity, Audacity 4.0.1 AppImage) - GUI editor
- lmms (/opt/lmms, LMMS 1.2.2) - music; headless render: lmms -r song.mmpz -o out.wav -f wav
- jsfxr: node /opt/jsfxr/gen.js <coin|hit|explosion|laser|powerup|jump|blip|click|random> out.wav ; GUI: open file:///opt/jsfxr/index.html
- ffmpeg for conversion/normalising (SoX not available: apt mirror blocked)
