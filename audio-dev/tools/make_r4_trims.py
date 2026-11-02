# Round 4 voice trims: laughs < 1.5 s, tighter Fire!/Arrr! takes. Cut from the processed round-2 WAVs (same chain),
# then loudness-matched to the file currently shipped in assets/audio so the game's LVL.voice trim stays valid.
import sys; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp, subprocess
from phone_compare import lufs
from dsp import SR
V = '/workspace/audio/voices/real/'; A = '/workspace/pfp-sound/assets/audio/'; O = '/workspace/audio/sfx/r4/'
JOBS = [  # (shipped name, source wav, max length s, fade-out s, active threshold dB)
 ('vo_laugh_male_1', 'laugh_male_01', 1.42, 0.30, -28), ('vo_laugh_male_2', 'laugh_male_02', 1.42, 0.30, -28),
 ('vo_laugh_female_1', 'laugh_female_01', 1.30, 0.20, -28), ('vo_laugh_female_2', 'laugh_female_02', 1.42, 0.30, -28),
 ('vo_laugh_female_3', 'laugh_female_03', 1.42, 0.30, -28),
 ('vo_fire_male_2', 'fire_male_02', 1.95, 0.15, -32), ('vo_fire_male_3', 'fire_male_03', 1.50, 0.12, -32),
 ('vo_arrr_male_1', 'arrr_male_01', 1.20, 0.15, -32)]
def cut(x, maxlen, fo, thr):
    e = dsp.env_db(dsp.mono(x), 0.01); act = np.where(e > e.max() + thr)[0]
    a = max(0, act[0] - int(0.015*SR)); b = min(len(x), act[-1] + int(0.14*SR), a + int(maxlen*SR))
    return dsp.fade(x[a:b], 0.004, fo)
def dec(fn):
    return np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',fn,'-f','f32le','-ac','2','-ar',str(SR),'-'],capture_output=True).stdout, np.float32).reshape(-1, 2).astype(np.float64)
if __name__ == '__main__':
    for name, src, ml, fo, thr in JOBS:
        y = cut(dsp.load(V + src + '.wav'), ml, fo, thr); ref = dec(A + name + '.mp3')
        y = dsp.limit(dsp.gain(y, lufs(ref) - lufs(y)), -1.5); dsp.save(O + name + '.wav', y)
        print(f'{name:20s} {len(ref)/SR:5.2f}s -> {len(y)/SR:5.2f}s')
