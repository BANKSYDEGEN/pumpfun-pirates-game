# Round 2: REAL recorded human pirate voices (no TTS). Light processing only:
# trim -> HPF -> gentle EQ (mud cut, presence) -> compression -> a touch of grit -> tiny deck room -> level match.
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(__file__)); from dsp import *
R = '/workspace/audio/raw/'; FS = R + 'freesound/'; OGA = R + 'oga/'
ST = OGA + 'starter/RPG Voice Starter Pack/'
OUT = '/workspace/audio/voices/real/'; PV = '/workspace/audio/preview/round2/'
# (line, gender, file, start, end)  start/end None = whole file (auto-trimmed)
TAKES = [
 ('arrr','m', FS+'vox_399851.mp3', None, None),      # JD_Brick_Productions, CC0
 ('arrr','m', FS+'vox_399852.mp3', None, None),      # JD_Brick_Productions, CC0
 ('arrr','m', FS+'vox_476325.mp3', None, None),      # JD_Brick "Yarrr!", CC0
 ('arrr','m', OGA+'arrr.wav', None, None),           # bart (OpenGameArt), CC0, full-quality WAV
 ('arrr','f', FS+'voxf_515634.mp3', None, None),     # sounagix "YARRRR!", CC0
 ('arrr','f', FS+'voxf_515635.mp3', None, None),     # sounagix "YAAARRRR!", CC0
 ('arrr','f', FS+'voxf_515633.mp3', None, None),     # sounagix "DAAARRRR!", CC0
 ('arrr','f', FS+'voxf_669879.mp3', 0.10, 1.15),     # SnowFightStudios "Argh!", CC0
 ('fire','m', FS+'voxfire_405577.mp3', None, None),  # JD_Brick "FIRE!", CC0
 ('fire','m', FS+'voxfire_405576.mp3', None, None),  # JD_Brick "Fire!", CC0
 ('fire','m', FS+'voxfire_468881.mp3', None, None),  # alphatone "Fire at will!", CC0
 ('fire','f', OGA+'riddles/fire.ogg', None, None),   # riddlesyouthis (OGA), CC-BY 3.0
 ('fire','f', ST+'Type 3/fire.wav', None, None),     # cicifyre (OGA), CC0
 ('fire','f', ST+'Type 2/fire.wav', None, None),     # cicifyre (OGA), CC0
 ('ahoy','m', FS+'vox_511559.mp3', None, None),      # CaptainCuthbertandScatthecat "Ahoy!", CC-BY 3.0
 ('ahoy','m', FS+'vox_789588.mp3', None, None),      # dr_dig1 "Ahoy matey!", CC0
 ('ahoy','m', FS+'vox_846324.mp3', None, None),      # AshdenWicka (FPG) "Land ahoy!", CC-BY 4.0
 ('ahoy','m', FS+'vox_846325.mp3', None, None),      # AshdenWicka (FPG) "Land ahoy!" 2, CC-BY 4.0
 ('matey','f', FS+'voxf_669879.mp3', 2.85, 4.40),    # SnowFightStudios "Me matey!", CC0
 ('landho','m', FS+'vox_474343.mp3', 0.75, 2.90),    # annB "Land ho!", CC0
 ('landho','m', FS+'vox_474343.mp3', 4.50, 6.45),    # annB take 2, CC0
 ('taunt','m', FS+'vox_846326.mp3', None, None),     # FPG "Scallywag!", CC-BY 4.0
 ('taunt','m', FS+'vox_846327.mp3', 0.0, 1.20),      # FPG "Walk the plank!", CC-BY 4.0
 ('taunt','m', FS+'vox_846323.mp3', None, None),     # FPG "Arr, matey!", CC-BY 4.0
 ('taunt','f', FS+'voxf_669879.mp3', 6.90, 8.05),    # SnowFightStudios "Walk the plank!", CC0
 ('taunt','f', OGA+'riddles/comeandgetme.ogg', None, None),  # riddlesyouthis "Come and get me!", CC-BY 3.0
 ('taunt','f', OGA+'riddles/takethis.ogg', None, None),      # riddlesyouthis "Take this!", CC-BY 3.0
 ('yarr','m', FS+'vox_846328.mp3', None, None),      # FPG "Yaargh!", CC-BY 4.0
 ('laugh','m', FS+'vox_822664.mp3', None, 3.2),      # riippumattog evil male laugh, CC0
 ('laugh','m', FS+'vox_519426.mp3', None, None),     # kookienomz pirate laugh/yar, CC0
 ('laugh','f', FS+'voxf_515632.mp3', None, None),    # sounagix "hahaha", CC0
 ('laugh','f', OGA+'riddles/evillaugh.ogg', None, None),  # riddlesyouthis evil laugh, CC-BY 3.0
 ('laugh','f', FS+'voxf_468514.mp3', None, None),    # SamuelGremaud woman laugh, CC0
]
def autotrim(x, thr=-42, pre=0.03, post=0.12):
    e = env_db(mono(x)); idx = np.where(e > e.max() + thr)[0]
    if not len(idx): return x
    a = max(0, idx[0] - int(pre*SR)); b = min(len(x), idx[-1] + int(post*SR)); return x[a:b]
def chain(x, g):
    x = filt(x, 'highpass', 95 if g == 'm' else 150, 2)
    x = peq(x, 320 if g == 'm' else 420, -2.0, 1.0)        # de-mud
    x = peq(x, 3200, 2.0, 0.9)                              # presence / intelligibility
    x = shelf(x, 9500, -2.0, low=False)                     # tame preview-codec fizz
    x = comp(x, -22, 3.0, 0.003, 0.11, knee=6)
    x = 0.78*x + 0.22*sat(x*1.5, 2.2) / 1.5                 # a little grit, parallel
    x = mix(x, conv(x, ir_space(0.45, 0.25, 7000, 1500, predelay=0.006, seed=7), -21))  # small open deck, barely there
    return x
def level(x, rms_db=-15.0):
    m = mono(x); e = env_db(m, 0.03); act = m[np.repeat(e > e.max() - 20, 1)[:len(m)]] if False else m[(e > e.max() - 20)[:len(m)]]
    r = 20*np.log10(np.sqrt(np.mean(act**2)) + 1e-9)
    return limit(gain(x, rms_db - r), -1.5)
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True); out = {}
    for line, g, f, a, b in TAKES:
        x = load(f)
        if a is not None or b is not None: x = sec(x, a or 0, b)
        x = fade(level(chain(autotrim(x), g)), 0.003, 0.06)
        k = (line, g); out.setdefault(k, []).append(x)
        n = len(out[k]); fn = f'{OUT}{line}_{"male" if g=="m" else "female"}_{n:02d}.wav'; save(fn, x)
        print(f'{fn.split("/")[-1]:28s} {len(x)/SR:.2f}s  <- {f.split("/")[-1]}')
    def strip(clips, gap=0.7):
        t = 0.3; tot = sum(len(c)/SR + gap for c in clips) + 0.6; o = buf(tot)
        for c in clips: place(o, c, t); t += len(c)/SR + gap
        return o
    for (line, g), clips in out.items():
        save(f'{PV}02_voice_{line}_{"male" if g=="m" else "female"}.mp3', strip(clips))
    order = [('arrr','m'),('arrr','f'),('fire','m'),('fire','f'),('ahoy','m'),('matey','f'),('landho','m'),('taunt','m'),('taunt','f'),('yarr','m'),('laugh','m'),('laugh','f')]
    save(PV + '02_voice_reel.mp3', strip([c for k in order for c in out[k]], 0.55))
    # in-context: crew callouts over a heavy broadside + sea, so the mix balance can be judged
    cn = [load('/workspace/audio/sfx/cannon_r2/cannon_heavy_%02d.wav' % i) for i in (1,2,3,4)]
    o = buf(16.0)
    try:
        amb = sec(load(FS + 'ocean_789503.mp3'), 0, 16.0)                       # YouMightLikeThis, CC0
        deck = sec(load(R + 'oga/pirate_pack/Pirate Pack Vol 1/Ambiences (Loops)/amb_deck_creaks.wav'), 0, 16.0)  # JC Sounds, CC-BY 4.0
        place(o, amb, 0, -14); place(o, deck, 0, -18)
    except Exception as e: print('no amb', e)
    place(o, out[('fire','m')][0], 0.4, -1)
    for i, t in enumerate((1.25, 1.65, 2.1, 2.45)): place(o, cn[i], t, -4)
    place(o, out[('arrr','f')][0], 5.6, -1); place(o, out[('fire','f')][0], 7.4, -1)
    for i, t in enumerate((8.15, 8.6)): place(o, cn[i+2], t, -4)
    place(o, out[('laugh','m')][0], 11.6, -3); place(o, out[('ahoy','m')][2], 13.6, -2)
    save(PV + '02_voice_in_context_broadside.mp3', limit(o, -1.2))
