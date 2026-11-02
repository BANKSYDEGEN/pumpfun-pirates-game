# Victory stinger (original): fiddle run up D major + timpani roll -> full D major hit (strings, accordion, contrabass,
# timpani, crash) + crew "HEY!". Same palette as the shanty. Rendered with GeneralUser GS via FluidSynth.
import sys; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp, fsynth
from dsp import SR
DUR = 5.5; HIT = 0.94
def victory():
    run = [74, 76, 78, 79, 81, 83, 85]; st = HIT/len(run)
    fid = [(i*st, (i+1)*st - 0.01, k, 85 + i*5) for i, k in enumerate(run)] + [(HIT, HIT + 2.4, 86, 118), (HIT + 0.02, HIT + 2.4, 81, 90)]
    tim = [(i*0.055, i*0.055 + 0.05, 38, int(40 + i*4.5)) for i in range(16)] + [(HIT, HIT + 2.5, 38, 127), (HIT, HIT + 2.5, 45, 110)]
    strs = [(HIT, HIT + 2.6, k, 112) for k in (50, 57, 62, 66, 69, 74)]
    acc = [(HIT, HIT + 0.35, k, 105) for k in (62, 66, 69, 74)] + [(HIT + 0.47, HIT + 2.3, k, 95) for k in (62, 66, 69, 74)]
    bas = [(HIT, HIT + 2.4, 38, 120), (HIT, HIT + 2.4, 26, 100)]
    drm = [(HIT, HIT + 2, 57, 120), (HIT, HIT + 0.3, 36, 127), (HIT + 0.47, HIT + 0.6, 41, 100), (HIT + 0.7, HIT + 0.8, 43, 100)]
    S = {
      'fid': (fsynth.render(fid, DUR, 110, gain=0.5), -3, 0.15),
      'tim': (fsynth.render(tim, DUR, 47, gain=0.6), -4, -0.1),
      'str': (fsynth.render(strs, DUR, 48, gain=0.5), -5, 0.0),
      'acc': (fsynth.render(acc, DUR, 21, gain=0.5), -9, -0.25),
      'bas': (fsynth.render(bas, DUR, 43, gain=0.6), -6, 0.0),
      'drm': (fsynth.render(drm, DUR, 0, chan=9, gain=0.6), -6, 0.0)}
    dry = dsp.buf(DUR)
    for k, (x, g, p) in S.items(): dry += dsp.gain(dsp.norm(x, 0), g) * np.array([1 - max(0, p), 1 + min(0, p)])
    dsp.place(dry, dsp.load('/workspace/audio/voices/crew_hey.wav'), HIT - 0.03, -4)
    ir = dsp.ir_space(dur=2.6, decay=1.5, lp0=7000, lp1=1200, early=[(0.011, 0.3), (0.023, 0.2)], seed=31)
    y = dry + dsp.conv(dsp.filt(dry, 'highpass', 250), ir)[:len(dry)]*10**(-12/20)
    y = dsp.comp(y, -14, 2, 0.01, 0.2)
    y = dsp.trim_tail(y, -70)
    y = y * (10**(-14/20) / np.sqrt(np.mean(y[int(HIT*SR):int((HIT+1.5)*SR)]**2)))
    return dsp.fade(dsp.limit(y, -1.2), 0, 0.4)
if __name__ == '__main__':
    y = victory(); dsp.save('/workspace/audio/music/stinger_victory.wav', y); dsp.save('/workspace/audio/preview/06_victory_stinger.mp3', y); print('ok')
