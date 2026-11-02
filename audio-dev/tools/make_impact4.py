# ROUND 4 phone-first cannonball impacts on wood: light / medium / heavy (2 variants each).
# Weight lives in 150 Hz-4 kHz: hard wood CRACK transient (1-4 kHz), saturated 150-300 Hz hull PUNCH (harmonics carry the
# low end on phones), CRUNCH, SPLINTERS (2-6 kHz); heavy adds a timber GROAN + debris + water plops. Real CC0 recordings
# (same sources as the v101 kill smash, see CREDITS.md) + a tiny synthesized pressure click.
import sys; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp, make_impact as MI
from dsp import SR
def env(n, tau, floor=0.0): t = np.arange(n)/SR; return (floor + (1 - floor)*np.exp(-t/tau))[:, None]
def punch(src, p, tau, f=230):
    x = dsp.filt(src, 'bandpass', [90, 450], 2); x = dsp.norm(x, 0); x = np.tanh(x*6 + 0.2) - np.tanh(0.2)
    x = dsp.filt(dsp.filt(x, 'highpass', 130), 'lowpass', 1600); x = dsp.peq(x, f, 4, 0.9)
    return dsp.fade(dsp.norm(x, 0) * env(len(x), tau, 0.02), 0.0005, 0.12)
def crack(src, p, dur, hp=600):
    x = dsp.filt(dsp.vari(src, p), 'highpass', hp, 2); x = dsp.peq(x, 2200, 5, 0.8); x = dsp.peq(x, 4200, 2, 1.0)
    x = dsp.norm(dsp.sat(dsp.norm(x, 0)*1.5, 1.6), 0); return dsp.fade(x[:int(dur*SR)] * env(int(dur*SR), dur/3, 0.05)[:len(x)], 0.0003, 0.05)
def click(seed, ms=3):
    n = int(ms/1000*SR); return dsp.filt(dsp.noise(ms/1000, seed=seed)*np.exp(-np.arange(n)/(0.0007*SR)), 'highpass', 1500)
PICK = {'light': [0, 2], 'medium': [2, 1], 'heavy': [1, 2]}
ROOM = dsp.ir_space(dur=0.9, decay=0.7, lp0=6000, lp1=1500, early=[(0.009, 0.4), (0.021, 0.25)], seed=17)
def impact(tier, i, seed=None):
    r = np.random.default_rng(seed if seed is not None else {'light': 10, 'medium': 20, 'heavy': 30}[tier] + i); p = 1 + r.uniform(-0.05, 0.05)
    D = {'light': 0.7, 'medium': 1.2, 'heavy': 2.4}[tier]; dry = dsp.buf(D + 0.8); t0 = 0.005
    sm = MI.SMASH[PICK[tier][i] if PICK else i % 4]
    if tier == 'light':
        dsp.place(dry, crack(sm, p*1.15, 0.16, 700), t0, 0)
        dsp.place(dry, punch(dsp.vari(sm, 0.7*p), p, 0.07, 380), t0 + 0.001, -6)
        kn = dsp.filt(dsp.vari(sm, 0.9*p), 'bandpass', [500, 1400], 2); dsp.place(dry, dsp.fade(dsp.norm(kn, 0) * env(len(kn), 0.05), 0.0005, 0.1)[:int(0.25*SR)], t0 + 0.002, -5)  # plank knock
        dsp.place(dry, click(i), t0, -8)
        sp = dsp.filt(dsp.vari(MI.SPLS[i % 5], p*1.1), 'highpass', 1800); dsp.place(dry, dsp.fade(dsp.norm(sp, 0), 0.002, 0.15)[:int(0.35*SR)], t0 + 0.02, -14)
        wet = -20
    elif tier == 'medium':
        dsp.place(dry, crack(sm, p, 0.2, 700), t0, 0)
        dsp.place(dry, punch(dsp.vari(sm, 0.6*p), p, 0.1, 300), t0 + 0.001, -4)
        cr = dsp.vari(MI.CRUNCH[i % 3], p*0.75); cr = dsp.filt(dsp.filt(cr, 'lowpass', 4500), 'highpass', 200); dsp.place(dry, dsp.fade(dsp.norm(cr, 0) * env(len(cr), 0.15, 0.1), 0.002, 0.25)[:int(0.6*SR)], t0 + 0.01, -9)
        dsp.place(dry, click(i + 5), t0, -8)
        for k, dt in enumerate((0.03, 0.1)):
            sp = dsp.filt(dsp.vari(MI.SPLS[(i*2 + k) % 5], p*(1.05 - k*0.1)), 'highpass', 1400); dsp.place(dry, dsp.fade(dsp.norm(sp, 0), 0.002, 0.2)[:int(0.5*SR)], t0 + dt + r.uniform(0, 0.03), -11 - k*3)
        wet = -18
    else:
        dsp.place(dry, crack(sm, p*0.95, 0.3, 500), t0, 0)
        dsp.place(dry, punch(dsp.vari(sm, 0.5*p), p, 0.2, 200), t0 + 0.001, -1)
        sub = dsp.sat(dsp.sine_sweep(110*p, 45, 0.45, curve=3.5, a=0.002, env_pow=2), 2.2); dsp.place(dry, sub, t0, -11)
        cr = dsp.vari(MI.CRUNCH[(i + 1) % 3], p*0.62); cr = dsp.filt(dsp.filt(cr, 'lowpass', 4000), 'highpass', 150); dsp.place(dry, dsp.fade(dsp.norm(cr, 0), 0.002, 0.3), t0 + 0.012, -5)
        dsp.place(dry, click(i + 9, 4), t0, -6)
        for k, dt in enumerate((0.03, 0.12, 0.22)):
            sp = dsp.filt(dsp.vari(MI.SPLS[(i*2 + k + 1) % 5], p*(1.05 - k*0.08)), 'highpass', 1200); dsp.place(dry, dsp.fade(dsp.norm(sp, 0), 0.002, 0.25), t0 + dt + r.uniform(0, 0.04), -10 - k*2.5)
        g = dsp.filt(dsp.filt(dsp.vari(MI.GROAN, 0.75*p), 'lowpass', 2500), 'highpass', 220); g = dsp.peq(g, 700, 3, 1.0); dsp.place(dry, dsp.fade(dsp.norm(g, 0), 0.05, 0.6), t0 + 0.22, -12)
        db = dsp.filt(dsp.vari(MI.DEBRIS[i % 3], p*0.9), 'highpass', 250); dsp.place(dry, dsp.fade(dsp.norm(db, 0), 0.02, 0.5), t0 + 0.3, -15)
        for k in range(3):
            pl = dsp.filt(dsp.vari(MI.PLOPS[r.integers(0, len(MI.PLOPS))], r.uniform(0.85, 1.2)), 'highpass', 300)
            dsp.place(dry, dsp.fade(dsp.norm(pl, 0), 0.002, 0.1), t0 + 0.55 + k*0.21 + r.uniform(0, 0.12), -19 - k*2)
        wet = -15
    out = dry + dsp.conv(dsp.filt(dry, 'highpass', 200), ROOM)[:len(dry)] * 10**(wet/20)
    # phone voicing: energy where small speakers play (300 Hz-4 kHz), less wasted below 140 Hz / above 6 kHz
    out = dsp.filt(out, 'highpass', 140 if tier != 'heavy' else 90, 2); out = dsp.peq(out, 1600, 3.5, 0.7); out = dsp.peq(out, 450, 2, 0.9)
    out = dsp.shelf(out, 6000, -5, low=False)
    out = dsp.comp(out, -14, 3.0, 0.004, 0.1)
    return dsp.trim_tail(out, -70)
def level(y): return dsp.fade(dsp.limit(dsp.norm(y, -1.0), -1.0), 0, 0.08)
if __name__ == '__main__':
    for tier in ('light', 'medium', 'heavy'):
        for i in range(2):
            y = level(impact(tier, i)); dsp.save(f'/workspace/audio/sfx/r4/impact_{tier}_{i+1}.wav', y); print(tier, i, round(len(y)/SR, 2))
