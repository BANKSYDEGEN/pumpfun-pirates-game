# ROUND 2 heavy ship cannon. Layers per shot:
#  CRACK  : real musket / black powder / heavy artillery transients (sharp attack, 0-200 ms)
#  BODY   : real cannon shots (chest 70-400 Hz), varispeed down for size
#  SUB    : real deep cannon boom (40-70 Hz dominant) + saturated 62->36 Hz sweep (1.1 s) = the 40-70 Hz punch
#  RECOIL : real heavy wooden cart + chain rattle, pitched down (gun carriage slamming back)
#  TAIL   : real distant explosions / distant cannon roll (long low rumble) + 4.5 s open-sea IR + island slap echo
import sys; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp
from dsp import SR
JC = '/workspace/audio/raw/oga/pirate_pack/Pirate Pack Vol 1/Misc Sfx/sfx_cannon_fire_0%d.wav'
C187 = dsp.load('cannon_187767.mp3'); P347 = dsp.load('powder_34708.mp3'); D320 = dsp.load('boom_320788.mp3'); C675 = dsp.load('cannon2_675613.mp3')
BODY = [dsp.sec(C187, 0.15, 2.6), dsp.sec(dsp.load('cannon_448002.mp3'), 0.07, 2.6), dsp.sec(dsp.load('cannon4_621003.mp3'), 0.0, 2.5), dsp.sec(C187, 6.37, 8.9)]
SUBS = [dsp.sec(dsp.load(JC % 1), 0.0, 2.4), dsp.sec(dsp.load('cannon3_371121.mp3'), 0.0, 2.6), dsp.sec(dsp.load(JC % 2), 0.0, 2.4), dsp.sec(dsp.load(JC % 3), 0.0, 2.4)]
CRACK = [dsp.sec(dsp.load('cannon4_441373.mp3'), 0.0, 0.35), dsp.sec(dsp.load('musket_538795.mp3'), 0.17, 0.5), dsp.sec(P347, 4.12, 4.45), dsp.sec(dsp.load('musket_234869.mp3'), 0.70, 1.0)]
TAIL = [dsp.sec(D320, 30.85, 36.0), dsp.sec(D320, 42.5, 47.6), dsp.sec(C675, 3.38, 7.0), dsp.sec(D320, 36.1, 41.0)]
CART = dsp.load('recoil_480042.mp3'); CHAIN = dsp.load('chain_401622.mp3')
RECOIL = [dsp.sec(CART, 0.84, 1.8), dsp.sec(CART, 1.91, 2.8), dsp.sec(CART, 3.76, 4.6), dsp.sec(CART, 6.03, 6.9)]
CHAINS = [dsp.sec(CHAIN, 0.15, 1.2), dsp.sec(CHAIN, 1.6, 2.6), dsp.sec(CHAIN, 2.83, 3.9)]
SEA = dsp.ir_space(dur=4.5, decay=1.5, lp0=4000, lp1=350, early=[(0.019, 0.5), (0.044, 0.35), (0.083, 0.2)], seed=4)
def firstpeak(x):  # align on the attack
    e = np.abs(dsp.mono(x)); i = int(np.argmax(e > 0.3*e.max())); return x[max(0, i - int(0.002*SR)):]
def cannon(i, dist=0.0, seed=None):
    r = np.random.default_rng(seed if seed is not None else 77 + i*13)
    p = 1 + r.uniform(-0.045, 0.045); lv = r.uniform(-0.8, 0.8)
    out = dsp.buf(7.0); dry = dsp.buf(7.0); t0 = 0.02
    body = dsp.vari(firstpeak(BODY[i % 4]), 0.8*p)
    body = dsp.filt(dsp.filt(body, 'highpass', 45), 'lowpass', 4500); body = dsp.peq(body, 120, 6, 0.9); body = dsp.peq(body, 900, -2, 1.0)
    body = dsp.norm(body, 0); tt = np.arange(len(body))/SR; body = body * (0.3 + 0.7*np.exp(-tt/0.35))[:, None]; body = dsp.fade(body, 0.001, 0.8)
    sub = dsp.filt(firstpeak(SUBS[i % 4]), 'lowpass', 160, 4); sub = dsp.peq(sub, 55, 4, 0.9); sub = dsp.fade(dsp.norm(sub, 0), 0.001, 0.8)
    sw = dsp.sat(dsp.sine_sweep(62*p, 36*p, 1.1, curve=2.0, a=0.003, env_pow=1.6), 3.5)   # 40-70 Hz punch, harmonics for phones
    cr = dsp.filt(firstpeak(CRACK[i % 4]), 'highpass', 700, 2); cr = dsp.peq(cr, 3000, 3, 1.0); cr = dsp.fade(dsp.norm(cr, 0), 0.0005, 0.12)[:int(0.2*SR)]
    tr = dsp.filt(dsp.noise(0.012, seed=i), 'highpass', 1500) * np.exp(-np.arange(int(0.012*SR))/(0.0025*SR))  # 2-3 ms pressure click on the attack
    rc = dsp.vari(RECOIL[i % 4], 0.7*p); rc = dsp.filt(dsp.filt(rc, 'lowpass', 2200), 'highpass', 60); rc = dsp.fade(dsp.norm(rc, 0), 0.003, 0.4)
    ch = dsp.filt(CHAINS[i % 3], 'highpass', 300); ch = dsp.fade(dsp.norm(ch, 0), 0.003, 0.4)
    dsp.place(dry, cr, t0, -1.5 + lv - dist*20)
    dsp.place(dry, tr, t0, -10 - dist*30)
    dsp.place(dry, body, t0 + 0.001, 0 + lv)
    dsp.place(dry, sub, t0, -4 + lv)
    dsp.place(dry, sw, t0, -5 + lv)
    dsp.place(dry, rc, t0 + 0.09 + r.uniform(0, 0.03), -15 + lv - dist*20)
    dsp.place(dry, ch, t0 + 0.11 + r.uniform(0, 0.04), -24 - dist*20)
    tl = dsp.filt(firstpeak(TAIL[i % 4]), 'lowpass', 900); tl = dsp.filt(tl, 'highpass', 30); tl = dsp.fade(dsp.norm(tl, 0), 0.12, 1.8)
    wet = dsp.conv(dsp.filt(dry, 'lowpass', 3000), SEA)[:len(out)]
    dsp.place(out, dry * (1 - dist*0.7), 0)
    dsp.place(out, wet, 0, -12 + dist*8)
    dsp.place(out, tl, t0 + 0.18, -7 + dist*3 + lv)
    d = 0.48 + r.uniform(0, 0.25); e = dsp.filt(dsp.filt(dry, 'lowpass', 1100), 'highpass', 70)   # island slap
    pan = r.uniform(-0.6, 0.6); dsp.place(out, e * np.array([1 - max(0, pan), 1 + min(0, pan)]), d, -13 + dist*4)
    if dist > 0:
        out = dsp.filt(out, 'lowpass', 5000*(1 - dist) + 600); out = dsp.filt(out, 'highpass', 35 + dist*60)
        out = np.concatenate([np.zeros((int(dist*0.5*SR), 2)), out])
    out = dsp.comp(out, -10, 2.0, 0.02, 0.25)
    return dsp.trim_tail(out, -75)
def level(y, punch_db=-9.5):
    r = np.sqrt(np.mean(y[:int(0.4*SR)]**2)); return dsp.fade(dsp.limit(y*(10**(punch_db/20)/r), -1.2), 0, 0.4)
if __name__ == '__main__':
    R = np.random.default_rng(9); vs = []
    for i in range(4):
        y = level(cannon(i)); vs.append(y)
        dsp.save(f'/workspace/audio/sfx/cannon_r2/cannon_heavy_{i+1:02d}.wav', y); dsp.save(f'/workspace/audio/preview/round2/01_cannon_heavy_v{i+1}.mp3', y)
    reel = dsp.buf(32)
    for k, y in enumerate(vs): dsp.place(reel, y, 0.3 + k*3.4)
    t = 14.2
    for k in range(6): dsp.place(reel, cannon(k % 4, seed=900 + k), t, -5.5 - k*0.3); t += 0.2 + R.uniform(0, 0.22)
    dsp.place(reel, cannon(1, dist=0.5, seed=55), 21.5, -5); dsp.place(reel, cannon(3, dist=0.85, seed=56), 26.0, -7)
    dsp.save('/workspace/audio/preview/round2/01_cannon_heavy_reel.mp3', dsp.fade(dsp.limit(dsp.trim_tail(reel, -70), -1.2), 0, 0.3))
    print('ok')
