# Round 4: shorter seamless "Salt on the Rail" loop for phones (approved audio, re-edited, not re-composed).
# The 30 s master is 16 bars (verse A = bars 1-8, chorus B = bars 9-16, chords Dm C Dm Am | Dm C Bb A twice).
# Short loop = bars 1-4 (verse hook) + bars 13-16 (chorus climax + cadence on A, which resolves back to bar 1's Dm).
# Bars 4 and 12 share the same chord (Am), so the splice lands on a bar line with a 12 ms crossfade; the loop end
# (bar 16 -> bar 1) is the master's own seamless loop point. 15.0 s stereo -> half the decoded memory (5.8 MB at 48 kHz).
import sys; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp, subprocess
from phone_compare import lufs
from dsp import SR
BAR = 4*60/128
def build():
    m = dsp.load('/workspace/audio/music/harbor_shanty_loop.wav'); n = int(round(4*BAR*SR)); xf = int(0.012*SR)
    a = m[:n].copy(); b = m[int(round(12*BAR*SR)) - xf: int(round(16*BAR*SR))].copy()
    w = np.sin(np.linspace(0, np.pi/2, xf))[:, None]
    a[-xf:] = a[-xf:]*np.cos(np.linspace(0, np.pi/2, xf))[:, None] + b[:xf]*w
    return np.concatenate([a, b[xf:]])
if __name__ == '__main__':
    y = build(); ref = np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i','/workspace/pfp-sound/assets/audio/music_shanty.mp3','-f','f32le','-ac','2','-ar',str(SR),'-'],capture_output=True).stdout, np.float32).reshape(-1, 2).astype(np.float64)
    y = dsp.limit(dsp.gain(y, lufs(ref[:int(30*SR)]) - lufs(y)), -1.2)
    dsp.save('/workspace/audio/music/harbor_shanty_loop_15s.wav', y); print('len', len(y)/SR, 'ref', lufs(ref), 'new', lufs(y))
    dsp.save('/workspace/audio/preview/round4/05_shanty_15s_loop_x3_seam_check.mp3', np.concatenate([y, y, y]))
