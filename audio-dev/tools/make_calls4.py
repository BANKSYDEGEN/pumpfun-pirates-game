# Round 4: the 5 missing quick-chat call lines + a real battle call for "Attack!", from real CC0 / CC-BY recordings
# (no TTS, no imitation). Same light chain as the round-2 voices (make_voices_real.chain), loudness-matched to the
# shipped Arr!/Fire! takes so the game's LVL.voice trim applies unchanged.
import sys; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp, make_voices_real as V
from phone_compare import lufs
from dsp import SR
FS = '/workspace/audio/raw/freesound/'; OGA = '/workspace/audio/raw/oga/'; O = '/workspace/audio/sfx/r4/'
TAKES = [  # (slot, gender, file, start, end)  None = whole file
 ('follow', 'm', FS + 'call_421874.mp3', None, None),        # theuncertainman "Advance!" CC-BY 4.0
 ('follow', 'm', FS + 'call_188488.mp3', None, None),        # unfa "Let's go!" CC0
 ('follow', 'm', FS + 'call_458073.mp3', None, None),        # theuncertainman "Move!" CC-BY 4.0
 ('follow', 'f', FS + 'call_362665.mp3', 4.85, 5.50),        # AmeAngelofSin "This way!" CC-BY 4.0
 ('follow', 'f', FS + 'call_362665.mp3', 3.12, 3.72),        # AmeAngelofSin "Come over!"
 ('follow', 'f', FS + 'call_362665.mp3', 0.30, 1.48),        # AmeAngelofSin "Over here!"
 ('boss', 'm', FS + 'call_627292.mp3', 0.0, 0.78),          # dhartshorn "Incoming enemy..." (cut before 'fighters') CC0
 ('boss', 'm', FS + 'call_800876.mp3', None, None),          # TyrantTim "Incoming!" CC0
 ('help', 'm', FS + 'call_397297.mp3', None, None),          # theuncertainman "I need reinforcements!" CC-BY 4.0
 ('help', 'f', OGA + 'riddles/helpme.ogg', None, None),       # riddlesyouthis "Help me, please!" CC-BY 3.0
 ('help', 'f', FS + 'call_422689.mp3', None, None),          # niamhd00145229 "Help me!" CC0
 ('attack', 'm', FS + 'call_458067.mp3', None, None),        # theuncertainman "Charge!" v1 CC-BY 4.0
 ('attack', 'm', FS + 'call_458068.mp3', None, None),        # theuncertainman "Charge!" v2 CC-BY 4.0
 ('retreat', 'm', FS + 'call_397302.mp3', 1.62, 3.20),       # theuncertainman "Fall back at once!" CC-BY 4.0
 ('gg', 'm', FS + 'call_340360.mp3', None, None),            # "Well done, well done!" CC0 (deleted_user_5205523)
 ('gg', 'm', FS + 'call_340360.mp3', 0.72, None),            # "Well done!"
]
def dec(fn):
    import subprocess
    return np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',fn,'-f','f32le','-ac','2','-ar',str(SR),'-'],capture_output=True).stdout, np.float32).reshape(-1, 2).astype(np.float64)
if __name__ == '__main__':
    ref = np.mean([lufs(dec(f'/workspace/pfp-sound/assets/audio/vo_{k}.mp3')) for k in ('arrr_male_1', 'fire_male_1', 'fire_female_1', 'arrr_female_1')])
    n = {}
    for slot, g, f, a, b in TAKES:
        x = dsp.load(f)
        if a is not None or b is not None: x = dsp.sec(x, a or 0, b)
        y = V.chain(V.autotrim(x, -36, 0.02, 0.1), g)
        y = dsp.fade(dsp.limit(dsp.gain(y, ref - lufs(y)), -1.5), 0.003, 0.06)
        k = (slot, g); n[k] = n.get(k, 0) + 1; fn = f'{O}vo_{slot}_{"male" if g == "m" else "female"}_{n[k]}.wav'
        dsp.save(fn, y); print(fn.split('/')[-1], round(len(y)/SR, 2))
