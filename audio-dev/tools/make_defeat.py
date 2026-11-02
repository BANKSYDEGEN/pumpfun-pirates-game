# Waves DEFEAT stinger (original): slow falling fiddle line in D minor (A-F-E-D) over strings Dm -> Bb -> A -> Dm,
# low cello + contrabass, soft timpani roll, and a real ship's bell tolling once (CC0 468847, pitched down).
# Same palette as the shanty / victory stinger. Rendered with GeneralUser GS via FluidSynth.
import sys; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp, fsynth
from dsp import SR
DUR = 5.2
def defeat():
    fid = [(0.00, 0.55, 69, 92), (0.55, 1.05, 65, 86), (1.05, 1.60, 64, 82), (1.60, 3.80, 62, 84)]
    strs = [(0.0, 1.05, k, 80) for k in (50, 57, 62, 65)] + [(1.05, 1.60, k, 78) for k in (46, 53, 58, 62)] + \
           [(1.60, 2.30, k, 76) for k in (45, 52, 57, 61)] + [(2.30, 4.40, k, 72) for k in (38, 50, 53, 57)]
    cel = [(0.0, 1.05, 38, 80), (1.05, 1.6, 34, 78), (1.6, 2.3, 33, 78), (2.3, 4.4, 26, 82)]
    tim = [(2.30 + i*0.06, 2.35 + i*0.06, 38, int(70 - i*3)) for i in range(14)]
    S = {'fid': (fsynth.render(fid, DUR, 110, gain=0.5), -3, 0.15), 'str': (fsynth.render(strs, DUR, 48, gain=0.5), -5, -0.1),
         'cel': (fsynth.render(cel, DUR, 42, gain=0.5), -7, 0.1), 'tim': (fsynth.render(tim, DUR, 47, gain=0.6), -10, 0.0)}
    dry = dsp.buf(DUR)
    for k, (x, g, p) in S.items(): dry += dsp.gain(dsp.norm(x, 0), g) * np.array([1 - max(0, p), 1 + min(0, p)])
    bell = dsp.load('/workspace/audio/raw/freesound/bell_468847.mp3'); e = dsp.env_db(dsp.mono(bell), 0.02); i = int(np.argmax(e))
    bell = dsp.filt(dsp.vari(bell[max(0, i - 500): i + int(2.4*SR)], 0.7), 'highpass', 150)
    dsp.place(dry, dsp.fade(dsp.norm(bell, 0), 0.001, 1.2), 2.30, -8)
    ir = dsp.ir_space(dur=2.8, decay=1.6, lp0=6000, lp1=1000, early=[(0.011, 0.3), (0.023, 0.2)], seed=33)
    y = dry + dsp.conv(dsp.filt(dry, 'highpass', 250), ir)[:len(dry)]*10**(-11/20)
    y = dsp.trim_tail(dsp.comp(y, -14, 2, 0.01, 0.2), -70)
    y = y * (10**(-15/20) / np.sqrt(np.mean(y[:int(2.5*SR)]**2)))
    return dsp.fade(dsp.limit(y, -1.2), 0, 0.6)
if __name__ == '__main__':
    y = defeat(); dsp.save('/workspace/audio/sfx/r4/defeat.wav', y); dsp.save('/workspace/audio/preview/round4/06_defeat_stinger.mp3', y); print('ok', len(y)/SR)
