# ROUND 3 "phone-first" ship cannon. Small speakers can't play 40-70 Hz, so the weight has to live in 150 Hz-4 kHz:
#  CRACK  : hard real black-powder / musket transient (HP 450, +5 dB at 2.5 kHz) + a 4 ms snap click, louder than in round 2
#  PUNCH  : body+sub summed, band-passed 90-420 Hz and driven hard (tanh + asymmetric clip) -> 150-300 Hz chest + harmonics to ~1.5 kHz,
#           so the low end can be "heard" as harmonics on a phone (missing-fundamental / virtual bass)
#  BODY   : real cannon shots, varispeed 0.85, shaped for 150-300 Hz, not 50 Hz
#  SUB    : kept but moderate (-11 dB) for good speakers
#  RECOIL : real heavy wood cart, pitched down, HP 150 + 1.5 kHz bite (the gun carriage slamming back)
#  CHAIN  : real chain rattle HP 700 (breeching tackle snapping taut)
#  CREAK  : real wood creak/stress (hull flexing after the shot)
#  ECHO   : rolling echo tail: 6 discrete reflections band-passed 700-3500 Hz (1-3 kHz focus), ping-ponged, each darker + diffused,
#           plus the real distant rumble, HP 200 so it survives on phones
import sys; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp, make_cannon2 as M2
from dsp import SR
FS = '/workspace/audio/raw/freesound/'
CRACK = M2.CRACK + [dsp.sec(dsp.load('musket_244345.mp3'), 0.0, 0.35), dsp.sec(dsp.load('musket_593908.mp3'), 0.0, 0.35)]
CR = dsp.load('woodstress_481882.mp3'); SC = dsp.load('shipcreak_456816.mp3')
CREAK = [dsp.sec(CR, 0.78, 2.31), dsp.sec(SC, 0.09, 1.96), dsp.sec(CR, 27.14, 28.07), dsp.sec(SC, 11.14, 13.3)]
CH2 = dsp.load('chain_593458.mp3'); CHAINS = M2.CHAINS + [dsp.sec(CH2, 0.0, 1.2), dsp.sec(CH2, 1.2, 2.5)]
PLATE = dsp.ir_space(dur=1.2, decay=0.6, lp0=6000, lp1=1800, predelay=0.004, seed=21)
SEA = dsp.ir_space(dur=3.5, decay=1.2, lp0=5000, lp1=900, early=[(0.021, 0.5), (0.047, 0.35)], seed=5)
def pan(x, p): return dsp.st(x) * np.array([1 - max(0, p), 1 + min(0, p)])
def env(n, tau, floor=0.0): t = np.arange(n)/SR; return (floor + (1 - floor)*np.exp(-t/tau))[:, None]
def cannon(i, dist=0.0, seed=None):
    r = np.random.default_rng(seed if seed is not None else 300 + i*17); p = 1 + r.uniform(-0.05, 0.05); lv = r.uniform(-0.7, 0.7)
    fp = M2.firstpeak; t0 = 0.02; dry = dsp.buf(6.0)
    cr = dsp.filt(fp(CRACK[i % len(CRACK)]), 'highpass', 450, 2); cr = dsp.peq(cr, 2500, 5, 0.8); cr = dsp.peq(cr, 1100, 2, 1.0)
    cr = dsp.norm(dsp.sat(dsp.norm(cr, 0)*1.6, 1.8), 0); cr = dsp.fade(cr * env(len(cr), 0.05, 0.05), 0.0003, 0.08)[:int(0.25*SR)]
    n4 = int(0.004*SR); snap = dsp.filt(dsp.noise(0.004, seed=i)*np.exp(-np.arange(n4)/(0.0008*SR)), 'highpass', 1200)
    body = dsp.vari(fp(M2.BODY[i % 4]), 0.85*p); body = dsp.filt(dsp.filt(body, 'highpass', 70), 'lowpass', 5000)
    body = dsp.peq(body, 220, 6, 0.8); body = dsp.peq(body, 600, 2, 1.0); body = dsp.norm(body, 0)
    body = dsp.fade(body * env(len(body), 0.28, 0.15), 0.0005, 0.6)
    sub = dsp.filt(fp(M2.SUBS[i % 4]), 'lowpass', 140, 4); sub = dsp.fade(dsp.norm(sub, 0), 0.001, 0.6)
    raw = dsp.mix(body, sub*0.8); pu = dsp.filt(raw, 'bandpass', [90, 420], 2); pu = dsp.norm(pu, 0)
    pu = np.tanh(pu*7 + 0.25) - np.tanh(0.25)                                         # asymmetric drive -> even + odd harmonics
    pu = dsp.filt(dsp.filt(pu, 'highpass', 130, 2), 'lowpass', 1800, 2); pu = dsp.peq(pu, 230, 4, 0.9)
    pu = dsp.fade(dsp.norm(pu, 0) * env(len(pu), 0.22, 0.05), 0.0005, 0.5)
    rc = dsp.vari(M2.RECOIL[i % 4], 0.8*p); rc = dsp.filt(dsp.filt(rc, 'highpass', 150), 'lowpass', 5000); rc = dsp.peq(rc, 1500, 4, 1.0)
    rc = dsp.fade(dsp.norm(dsp.sat(dsp.norm(rc, 0), 1.5), 0), 0.002, 0.3)
    ch = dsp.filt(CHAINS[i % len(CHAINS)], 'highpass', 700); ch = dsp.peq(ch, 3500, 3, 1.0); ch = dsp.fade(dsp.norm(ch, 0), 0.003, 0.35)
    ck = dsp.filt(dsp.vari(CREAK[i % 4], 0.9*p), 'highpass', 250); ck = dsp.peq(ck, 900, 3, 1.0); ck = dsp.fade(dsp.norm(ck, 0), 0.05, 0.4)
    D = lambda db: db + lv - dist*18
    dsp.place(dry, cr, t0, D(0)); dsp.place(dry, snap, t0, D(-6))
    dsp.place(dry, pu, t0 + 0.0015, -1 + lv - dist*8)
    dsp.place(dry, body, t0 + 0.001, -2 + lv)
    dsp.place(dry, sub, t0, -11 + lv)
    tr = t0 + 0.07 + r.uniform(0, 0.03)
    dsp.place(dry, rc, tr, D(-7)); dsp.place(dry, ch, tr + 0.04 + r.uniform(0, 0.04), D(-10))
    dsp.place(dry, ck, t0 + 0.32 + r.uniform(0, 0.15), D(-13))
    dry = dsp.mix(dry, dsp.conv(dsp.filt(dry, 'highpass', 200), PLATE, -16))[:len(dry)]    # deck/hull resonance
    out = dsp.buf(7.0); dsp.place(out, dry, 0)
    # rolling echo: crack+punch reflections in 1-3 kHz, ping-pong, each later one darker and more diffuse
    src = dsp.filt(dsp.filt(dsp.mix(pan(dsp.sec(dry, 0, 0.6), 0)), 'highpass', 700, 2), 'lowpass', 3500, 2)
    times = np.cumsum([0.30, 0.27, 0.33, 0.42, 0.5, 0.62]) + r.uniform(-0.04, 0.04, 6)
    for k, t in enumerate(times):
        e = dsp.filt(src, 'lowpass', 3500 - k*350, 2); e = dsp.conv(e, dsp.ir_space(dur=0.4 + 0.12*k, decay=0.2 + 0.08*k, lp0=4000, lp1=1200, seed=40 + k + i), 0)
        dsp.place(out, pan(e, (0.55 if k % 2 else -0.55) * r.uniform(0.6, 1.0)), t0 + t, -9 - k*2.6 + dist*3)
    tl = dsp.filt(dsp.filt(fp(M2.TAIL[i % 4]), 'highpass', 180, 2), 'lowpass', 2800); tl = dsp.peq(tl, 1200, 3, 0.8)
    dsp.place(out, dsp.fade(dsp.norm(tl, 0), 0.15, 1.6), t0 + 0.2, -9 + dist*2 + lv)
    dsp.place(out, dsp.conv(dsp.filt(dry, 'highpass', 150), SEA)[:len(out)], 0, -13 + dist*6)
    if dist > 0:
        out = dsp.filt(out, 'lowpass', 6000*(1 - dist) + 900); out = np.concatenate([np.zeros((int(dist*0.5*SR), 2)), out])
    out = dsp.comp(out, -12, 2.5, 0.004, 0.2)
    return dsp.trim_tail(out, -75)
def level(y, punch_db=-8.5):
    r = np.sqrt(np.mean(y[:int(0.4*SR)]**2)); return dsp.fade(dsp.limit(y*(10**(punch_db/20)/r), -1.2), 0, 0.4)
def broadside(n, seed=0, fn=cannon, gain0=-4):
    R = np.random.default_rng(seed); b = dsp.buf(9); t = 0.02
    for k in range(n): dsp.place(b, fn(k % 4, seed=seed*10 + k), t, gain0 - k*0.3); t += 0.19 + R.uniform(0, 0.2)
    return dsp.trim_tail(b, -70)
if __name__ == '__main__':
    for i in range(3):
        y = level(cannon(i)); dsp.save(f'/workspace/audio/sfx/cannon_r3/cannon_phone_{i+1:02d}.wav', y); dsp.save(f'/workspace/audio/preview/round3/01_cannon_phone_v{i+1}.mp3', y)
    print('ok')
