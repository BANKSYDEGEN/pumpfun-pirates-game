# Loudness-matched A/B files: OLD (current game synth, rendered from js/audio.js) vs NEW (round 2 heavy cannon).
# Each clip is gained so its first 2.5 s measures -16 LUFS (EBU R128 integrated), then the whole file is true-peak limited.
import sys, subprocess, re; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp, make_cannon2 as MC
from dsp import SR
def lufs(x):
    dsp.save('/tmp/_m.wav', x[:int(2.5*SR)])
    o = subprocess.run(['ffmpeg','-hide_banner','-nostats','-i','/tmp/_m.wav','-af','ebur128','-f','null','-'],capture_output=True,text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', o)[-1])
def match(x, target=-16.0):
    for _ in range(2): x = dsp.gain(x, target - lufs(x))
    return x
def seq(clips, gap=0.6):
    out = []
    for c in clips: out += [c, np.zeros((int(gap*SR), 2))]
    return np.concatenate(out)
old1 = dsp.load('/workspace/audio/preview/old/old_cannon_broadside.mp3')
new1 = dsp.load('/workspace/audio/sfx/cannon_r2/cannon_heavy_01.wav'); new2 = dsp.load('/workspace/audio/sfx/cannon_r2/cannon_heavy_03.wav')
A = [match(old1), match(new1), match(old1), match(new2)]
y = dsp.limit(seq(A), -1.2); dsp.save('/workspace/audio/preview/round2/01_cannon_AB_old_vs_new.mp3', y)
# bonus: 4-gun broadside, old vs new
old4 = dsp.load('/workspace/audio/preview/old/old_cannon_broadside4.mp3')
R = np.random.default_rng(3); b = dsp.buf(8); t = 0.02
for k in range(4): dsp.place(b, MC.cannon(k, seed=400 + k), t, -4 - k*0.3); t += 0.2 + R.uniform(0, 0.2)
b = dsp.trim_tail(b, -70)
y = dsp.limit(seq([match(old4), match(b), match(old4), match(b)]), -1.2); dsp.save('/workspace/audio/preview/round2/01_cannon_AB_broadside_old_vs_new.mp3', y)
print('ok')
