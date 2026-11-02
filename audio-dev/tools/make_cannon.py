# Layered black-powder ship cannon: CRACK (real musket / black powder) + BODY (real cannon) + SUB (real low thump +
# synthesized pitch-drop sine) + RECOIL (real wood/chain carriage hit, pitched down) + TAIL (real distant cannon roll +
# generated open-sea IR + island slap echo). Round-robin variants with random pitch/level.
import sys; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp
from dsp import SR
R = np.random.default_rng(1717)
C187 = dsp.load('cannon_187767.mp3'); C675 = dsp.load('cannon2_675613.mp3'); P347 = dsp.load('powder_34708.mp3')
BODIES = [lambda: dsp.sec(C187, 0.15, 2.6), lambda: dsp.sec(C187, 6.37, 8.9), lambda: dsp.sec(dsp.load('cannon_448002.mp3'), 0.07, 2.6), lambda: dsp.sec(dsp.load('cannon_758072.mp3'), 0.18, 1.4)]
CRACKS = [lambda: dsp.sec(dsp.load('musket_538795.mp3'), 0.17, 0.5), lambda: dsp.sec(P347, 4.12, 4.45), lambda: dsp.sec(dsp.load('musket_234869.mp3'), 0.70, 1.0), lambda: dsp.sec(P347, 8.02, 8.35), lambda: dsp.sec(C187, 10.17, 10.5)]
TAILS = [3.39, 8.97, 7.01, 14.35 - 0.0]
THUMP = dsp.sec(dsp.load('musket_244345.mp3'), 0.62, 1.5)
RECOIL = dsp.sec(dsp.load('plank_104003.mp3'), 0.21, 1.6)
SEA_IR = dsp.ir_space(dur=3.2, decay=1.6, lp0=4500, lp1=450, early=[(0.021, 0.5), (0.047, 0.3)], seed=3)
def tight(x, keep, fo): return dsp.fade(x[:int(keep*SR)], 0.0015, fo)
def cannon(i, dist=0.0, island=True, seed=None):
    r = np.random.default_rng(seed if seed is not None else i*101+7)
    pitch = 0.9 + r.uniform(-0.05, 0.06); lv = r.uniform(-1.2, 0.8)
    out = dsp.buf(5.5)
    # BODY: real cannon, slowed a bit for weight, top end tamed (the crack provides the top)
    body = dsp.vari(BODIES[i % len(BODIES)](), pitch*0.86)
    body = dsp.filt(body, 'highpass', 35); body = dsp.filt(body, 'lowpass', 5200); body = dsp.peq(body, 220, 3, 0.8); body = dsp.peq(body, 2400, -3, 1.0)
    body = dsp.fade(dsp.norm(body, 0), 0.001, 0.8)
    tt = np.arange(len(body))/SR; body = body * (0.24 + 0.76*np.exp(-tt/0.28))[:, None]  # transient shaper: punch first, then let the tail carry
    # CRACK: real musket/black powder transient, high-passed, short
    cr = dsp.vari(CRACKS[(i*2+1) % len(CRACKS)](), pitch*1.02)
    cr = dsp.filt(cr, 'highpass', 900, 2); cr = dsp.peq(cr, 3500, 2, 1.2); cr = tight(dsp.norm(cr, 0), 0.22, 0.15)
    # SUB: real low thump + synthesized pitch-drop sine with soft saturation (harmonics carry on phones)
    th = dsp.filt(dsp.vari(THUMP, pitch*0.8), 'lowpass', 180); th = dsp.fade(dsp.norm(th, 0), 0.001, 0.4)
    sub = dsp.sat(dsp.sine_sweep(95*pitch, 34*pitch, 0.75, curve=3.2, a=0.004, env_pow=1.8), 1.6)
    # RECOIL: gun carriage slams back on the deck: wood + chain, pitched down, after the blast
    rc = dsp.vari(RECOIL, 0.62 + r.uniform(-0.04, 0.04)); rc = dsp.filt(rc, 'lowpass', 2400); rc = dsp.filt(rc, 'highpass', 70); rc = dsp.fade(dsp.norm(rc, 0), 0.003, 0.5)
    t0 = 0.02
    dry = dsp.buf(5.5)
    dsp.place(dry, body, t0, -2.5 + lv)
    dsp.place(dry, cr, t0 - 0.002, -5.0 + lv - dist*16)
    dsp.place(dry, th, t0, -5.5 + lv)
    dsp.place(dry, sub, t0, -7.0 + lv)
    dsp.place(dry, rc, t0 + 0.085 + r.uniform(0, 0.03), -17 + lv - dist*20)
    # TAIL: real distant roll of a real cannon (low passed) + open-sea reverb + island slap
    tl = dsp.sec(C675, TAILS[i % len(TAILS)] - 0.01, TAILS[i % len(TAILS)] + 3.2)
    tl = dsp.fade(dsp.norm(dsp.filt(tl, 'lowpass', 1600), 0), 0.08, 1.2)
    wet = dsp.conv(dsp.filt(dry, 'lowpass', 3500), SEA_IR)[:len(out)]
    dsp.place(out, dry * (1 - dist*0.7), 0)
    dsp.place(out, wet, 0, -15 + dist*9)
    dsp.place(out, tl, t0 + 0.12, -12 + dist*4 + lv)
    if island:  # slap echo off the island: a darker, delayed copy, panned a little
        d = 0.42 + r.uniform(0, 0.25); e = dsp.filt(dsp.filt(dry, 'lowpass', 1300), 'highpass', 90)
        pan = r.uniform(-0.5, 0.5); e = e * np.array([1 - max(0, pan), 1 + min(0, pan)])
        dsp.place(out, e, d, -16 + dist*4)
    if dist > 0:  # far away: thinner, darker, delayed by the speed of sound
        out = dsp.filt(out, 'lowpass', 5000 * (1 - dist) + 700); out = dsp.filt(out, 'highpass', 60 + dist*70)
        out = np.concatenate([np.zeros((int(dist*0.5*SR), 2)), out])
    out = dsp.comp(out, -12, 2.0, 0.015, 0.2)
    return dsp.trim_tail(out, -75)
def master(x, ceil=-1.2): return dsp.fade(dsp.limit(x, ceil), 0, 0.3)
if __name__ == '__main__':
    import json
    variants = []
    for i in range(4):
        y = cannon(i); r = np.sqrt(np.mean(y[:int(0.4*SR)]**2)); y = y * (10**(-12.5/20) / r)  # match punch loudness across variants
        y = master(y)
        dsp.save(f'/workspace/audio/sfx/cannon/cannon_fire_{i+1:02d}.wav', y); variants.append(y)
    # preview reel: 4 close variants, a broadside of 5 (ragged crew timing), then 2 distant shots
    reel = dsp.buf(26)
    for k, y in enumerate(variants): dsp.place(reel, y, 0.3 + k*2.6)
    t = 11.2
    for k in range(5):
        dsp.place(reel, cannon(k % 4, seed=900 + k), t, -4.5 - k*0.3); t += 0.22 + R.uniform(0, 0.2)
    dsp.place(reel, cannon(1, dist=0.55, seed=55), 17.5, -4)
    dsp.place(reel, cannon(2, dist=0.85, seed=56), 21.0, -6)
    reel = master(dsp.trim_tail(reel, -70))
    dsp.save('/workspace/audio/preview/01_cannon_fire_reel.mp3', reel)
    for i, y in enumerate(variants): dsp.save(f'/workspace/audio/preview/01_cannon_fire_v{i+1}.mp3', y)
    print('ok')
