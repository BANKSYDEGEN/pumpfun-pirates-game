# Cannonball miss: the ball punches into the sea. PLUNK (synth low "thoomp" of the cavity) + SPLASH body (real big
# splashes) + SPRAY (real hand-slap spray) + falling DROPLETS (real small splooshes). Size by distance:
# near = full, mid = thinner + delayed, far = small, dark, mostly the plunk & body.
import sys; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp
from dsp import SR
L = dsp.load
BIG = [dsp.sec(L('splash_442773.mp3'), 0.0, 2.1), dsp.sec(L('splash_676380.mp3'), 0.0, 2.0), dsp.sec(L('splash_469608.mp3'), 0.0, 2.0)]
SL = L('splash_637974.mp3'); SPRAY = [dsp.sec(SL, t - 0.01, t + 1.2) for t in (0.51, 3.66, 5.77, 8.09)]
DR = L('splashsm_693542.mp3'); DROPS = [dsp.sec(DR, t - 0.005, t + 0.35) for t in (0.06, 0.78, 1.5, 1.86, 2.12, 2.71)]
IR = dsp.ir_space(dur=1.5, decay=2.0, lp0=6000, lp1=900, seed=21)
def splash(i, dist=0.0, seed=None):
    r = np.random.default_rng(seed if seed is not None else 500 + i); p = 1 + r.uniform(-0.07, 0.07)
    out = dsp.buf(3.2)
    b = dsp.vari(BIG[i % len(BIG)], p*0.92); b = dsp.filt(b, 'highpass', 70); b = dsp.fade(dsp.norm(b, 0), 0.001, 0.5)
    sp = dsp.filt(dsp.vari(SPRAY[i % len(SPRAY)], p*1.05), 'highpass', 700); sp = dsp.fade(dsp.norm(sp, 0), 0.002, 0.4)
    pl = dsp.sat(dsp.sine_sweep(170*p, 55, 0.28, curve=2.5, a=0.006, env_pow=2.2), 1.4)
    dsp.place(out, pl, 0.0, -9)
    dsp.place(out, b, 0.004, -3)
    dsp.place(out, sp, 0.02, -11 - dist*10)
    for k in range(int(5 - dist*3)):
        d = dsp.filt(dsp.vari(DROPS[r.integers(0, len(DROPS))], r.uniform(0.85, 1.25)), 'highpass', 300)
        pan = r.uniform(-0.6, 0.6); d = dsp.st(dsp.mono(d)) * np.array([1 - max(0, pan), 1 + min(0, pan)])
        dsp.place(out, dsp.fade(dsp.norm(d, 0), 0.002, 0.1), 0.45 + k*0.16 + r.uniform(0, 0.12), -22 - k*1.5 - dist*8)
    out = out + dsp.conv(dsp.filt(out, 'lowpass', 5000), IR)[:len(out)] * 10**((-20 + dist*10)/20)
    if dist > 0:
        out = dsp.filt(out, 'lowpass', 9000*(1 - dist) + 900); out = dsp.gain(out, -dist*14)
        out = np.concatenate([np.zeros((int(dist*0.25*SR), 2)), out])
    out = dsp.comp(out, -12, 2.0, 0.01, 0.15)
    return dsp.trim_tail(out, -75)
if __name__ == '__main__':
    import os; os.makedirs('/workspace/audio/sfx/splash', exist_ok=True)
    ref = None; reel = dsp.buf(12); t = 0.2
    for i, dist in enumerate([0.0, 0.0, 0.0, 0.45, 0.8]):
        y = splash(i, dist)
        if ref is None: ref = 10**(-12/20) / np.sqrt(np.mean(y[:int(0.4*SR)]**2))
        y = dsp.limit(y * ref, -1.2)
        tag = 'near' if dist == 0 else ('mid' if dist < 0.6 else 'far')
        dsp.save(f'/workspace/audio/sfx/splash/splash_{tag}_{i+1:02d}.wav', y)
        if i == 0: dsp.save('/workspace/audio/preview/03_splash_near.mp3', y)
        dsp.place(reel, y, t); t += 2.3
    dsp.save('/workspace/audio/preview/03_splash_reel_near_mid_far.mp3', dsp.fade(dsp.limit(dsp.trim_tail(reel, -70), -1.2), 0, 0.2))
    print('ok')
