# ROUND 4 phone-first SFX from real CC0 / CC-BY recordings (see CREDITS.md): sinking, debris, coins, shop/upgrade/equip UI,
# sea ambience loop, low-HP heartbeat + bell warning. All voiced for small speakers (energy in 250 Hz-5 kHz).
import sys; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp, make_impact as MI
from dsp import SR
FS = '/workspace/audio/raw/freesound/'; JC = '/workspace/audio/raw/oga/pirate_pack/Pirate Pack Vol 1/Misc Sfx/'
O = '/workspace/audio/sfx/r4/'
L = lambda f: dsp.load(FS + f if not f.startswith('/') else f)
def loudest(x, dur, pre=0.05):
    e = dsp.env_db(dsp.mono(x), 0.02); i = int(np.argmax(e[:len(e) - int(dur*SR)])); a = max(0, i - int(pre*SR)); return x[a:a + int(dur*SR)]
def env(n, tau, floor=0.0): t = np.arange(n)/SR; return (floor + (1 - floor)*np.exp(-t/tau))[:, None]
def voice_phone(x, hp=180, pres=2.5, hs=-3):
    x = dsp.filt(x, 'highpass', hp, 2); x = dsp.peq(x, 2000, pres, 0.8); return dsp.shelf(x, 7000, hs, low=False)
def fin(x, peak=-1.0, fo=0.08): return dsp.fade(dsp.limit(dsp.norm(dsp.trim_tail(x, -70), peak), peak), 0.001, fo)
def pan(x, p): return dsp.st(x) * np.array([1 - max(0, p), 1 + min(0, p)])
ROOM = dsp.ir_space(dur=0.8, decay=0.5, lp0=7000, lp1=2000, predelay=0.004, seed=23)
SEA = dsp.ir_space(dur=2.5, decay=1.2, lp0=5000, lp1=900, early=[(0.02, 0.4)], seed=29)
def coin(i):
    cl = [dsp.load(JC + f'sfx_coin_clink_0{k}.wav') for k in (1, 2, 3, 4)]; o = dsp.buf(0.8)
    a, b = cl[i % 4], cl[(i + 2) % 4]
    dsp.place(o, dsp.vari(a, 1.0 + 0.04*i), 0.005, 0); dsp.place(o, dsp.vari(b, 1.12 - 0.03*i), 0.07 + 0.02*i, -5)
    dsp.place(o, dsp.vari(cl[(i + 1) % 4], 1.25), 0.15, -11)
    o = o + dsp.conv(o, ROOM)[:len(o)] * 10**(-20/20)
    return fin(voice_phone(o, 300, 3, -2))
def shop_open():
    ch = dsp.filt(L('chest_573654.mp3'), 'highpass', 150); ch = dsp.peq(ch, 900, 2, 1.0)
    jc = dsp.load(JC + 'sfx_chest_open.wav'); sp = dsp.load(JC + 'sfx_coin_spill_01.wav')
    o = dsp.buf(2.0); dsp.place(o, dsp.norm(ch, 0)[:int(1.5*SR)], 0.005, -2); dsp.place(o, dsp.norm(jc, 0), 0.02, -6); dsp.place(o, dsp.norm(sp, 0), 0.42, -9)
    return fin(voice_phone(o + dsp.conv(o, ROOM)[:len(o)]*0.1, 160))
def upgrade():
    sp = dsp.load(JC + 'sfx_coin_spill_02.wav'); bell = loudest(L('bell_468847.mp3'), 1.3, 0.01)
    th = loudest(L('thud_706824.mp3'), 0.4, 0.005)   # gavel/mallet knock = shipwright's hammer
    o = dsp.buf(1.8); dsp.place(o, dsp.norm(dsp.filt(th, 'highpass', 200), 0), 0.005, -3); dsp.place(o, dsp.norm(sp, 0), 0.06, -4)
    dsp.place(o, dsp.norm(dsp.filt(dsp.vari(bell, 1.5), 'highpass', 500), 0), 0.1, -7)
    return fin(voice_phone(o, 200, 2))
def equip():
    fl = dsp.filt(L('wind_244982.mp3'), 'highpass', 250); cl = dsp.load(JC + 'sfx_coin_clink_03.wav')
    o = dsp.buf(1.0); dsp.place(o, dsp.norm(fl, 0), 0.005, -1); dsp.place(o, dsp.norm(dsp.vari(cl, 1.35), 0), 0.22, -9); dsp.place(o, dsp.norm(dsp.vari(cl, 1.7), 0), 0.3, -14)
    return fin(voice_phone(o, 200, 2))
def debris(i):
    r = np.random.default_rng(70 + i); src = L('debris_400643.mp3'); segs = [(0.19, 1.06), (2.54, 3.16), (4.05, 4.59), (6.95, 8.0)]
    a, b = segs[i % 4]; d = dsp.filt(dsp.sec(src, a - 0.01, b + 0.25), 'highpass', 250); d = dsp.fade(dsp.norm(d, 0), 0.003, 0.2)
    o = dsp.buf(2.0); dsp.place(o, d, 0.005, -2)
    for k in range(4 + i % 2):
        pl = dsp.filt(dsp.vari(MI.PLOPS[r.integers(0, len(MI.PLOPS))], r.uniform(0.8, 1.25)), 'highpass', 300)
        dsp.place(o, pan(dsp.fade(dsp.norm(dsp.mono(pl), 0), 0.002, 0.1), r.uniform(-0.6, 0.6)), 0.25 + k*0.17 + r.uniform(0, 0.1), -6 - k*1.5)
    return fin(voice_phone(o + dsp.conv(o, SEA)[:len(o)]*0.12, 200, 2.5), fo=0.2)
def sink(big):
    r = np.random.default_rng(5 if big else 4); D = 4.6 if big else 3.6; o = dsp.buf(D + 1)
    gr = dsp.filt(dsp.vari(L('woodstress_675785.mp3'), 0.62 if big else 0.75), 'highpass', 160); gr = dsp.peq(gr, 600, 3, 1.0)
    dsp.place(o, dsp.fade(dsp.norm(gr, 0), 0.05, 0.8)[:int((D - 0.4)*SR)], 0.0, -4)
    cr = loudest(L('debris_675967.mp3'), 1.6 if big else 1.1, 0.02); cr = dsp.filt(dsp.vari(cr, 0.85 if big else 1.0), 'highpass', 120)
    dsp.place(o, dsp.fade(dsp.norm(cr, 0), 0.003, 0.5), 0.02, -1)                                 # beams giving way
    sp = dsp.filt(dsp.vari(L('splash_442773.mp3'), 0.8 if big else 0.95), 'highpass', 150)
    dsp.place(o, dsp.fade(dsp.norm(sp, 0), 0.005, 0.5), 0.55, -3)                                 # hull drops into the sea
    bu = dsp.filt(dsp.sec(L('bubbles_852478.mp3'), 10.0, 10.0 + D), 'bandpass', [250, 3000], 2); bu = dsp.norm(bu, 0) * np.minimum(1, np.arange(len(bu))[:, None]/(0.8*SR))
    dsp.place(o, dsp.fade(bu, 0.3, 1.2), 0.9, -5)                                                  # air rushing out / gurgle
    if big:
        g2 = dsp.filt(dsp.vari(dsp.sec(L('woodstress_481882.mp3'), 0.78, 2.31), 0.6), 'highpass', 150); dsp.place(o, dsp.fade(dsp.norm(g2, 0), 0.05, 0.4), 1.6, -6)
        dsp.place(o, debris(2), 1.1, -6)
    else: dsp.place(o, debris(3), 0.9, -8)
    o = o + dsp.conv(dsp.filt(o, 'highpass', 200), SEA)[:len(o)] * 10**(-16/20)
    o = dsp.shelf(dsp.peq(dsp.filt(o, 'highpass', 300 if not big else 120, 2), 2500, 5 if not big else 2.5, 0.7), 6000, -6, low=False)
    return fin(dsp.comp(o, -24 if not big else -14, 3 if not big else 2.5, 0.002, 0.08 if not big else 0.15), fo=0.6)
def heartbeat():
    d = dsp.sec(L('drum_518943.mp3'), 1.93, 2.4); d = dsp.filt(dsp.filt(d, 'lowpass', 1400), 'highpass', 70); d = dsp.norm(d, 0)
    d = dsp.norm(np.tanh(d*3) + 0.0, 0); d = dsp.peq(d, 220, 5, 0.9); d = dsp.peq(d, 500, 3, 1.0)      # harmonics so it reads on phones
    o = dsp.buf(0.6); dsp.place(o, d, 0.005, 0); dsp.place(o, dsp.vari(d, 1.08), 0.17, -4)          # lub-dub
    return fin(o, -1.0, 0.1)
def bell_warn():
    b = loudest(L('bell_468847.mp3'), 1.4, 0.01); b = dsp.filt(b, 'highpass', 300); b = dsp.fade(dsp.norm(b, 0), 0.001, 0.6)
    o = dsp.buf(1.9); dsp.place(o, b, 0.005, 0); dsp.place(o, b, 0.34, -2)                          # ship's bell, double strike
    return fin(o)
def amb_sea(dur=12.0, xf=1.5):
    hs = dsp.sec(L('hullslap_637206.mp3'), 4.17, 4.17 + dur + xf)      # water lapping on the hull
    oc = dsp.sec(L('seawash_824106.mp3'), 2.0, 2.0 + dur + xf)        # open-sea wash (derjuli North Sea waves, CC0; replaced 789503, which has party music in the background)
    m = dsp.gain(dsp.norm(dsp.filt(hs, 'highpass', 120), 0), -3) + dsp.gain(dsp.norm(dsp.filt(oc, 'highpass', 150), 0), -6)
    m = dsp.st(dsp.mono(dsp.shelf(dsp.peq(m, 700, 2, 0.8), 6000, -4, low=False)))
    n, x = int(dur*SR), int(xf*SR); y = m[:n].copy(); w = np.linspace(0, 1, x)[:, None]
    y[:x] = y[:x]*np.sqrt(w) + m[n:n + x]*np.sqrt(1 - w)                                               # seamless loop (equal-power wrap)
    return dsp.limit(dsp.norm(dsp.comp(y, -18, 2, 0.05, 0.5), -3), -3)
if __name__ == '__main__':
    out = {f'coin_{i+1}': coin(i) for i in range(3)}
    out.update(shop_open=shop_open(), upgrade=upgrade(), equip=equip(), debris_1=debris(0), debris_2=debris(1),
               sink=sink(False), sink_big=sink(True), lowhp_beat=heartbeat(), lowhp_bell=bell_warn(), amb_sea=amb_sea())
    for k, y in out.items(): dsp.save(O + k + '.wav', y); print(f'{k:12s} {len(y)/SR:5.2f}s')
