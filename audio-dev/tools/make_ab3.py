# Round 3 A/B: OLD (current game synth) vs NEW phone-first cannon, loudness-matched (first 2.5 s = -16 LUFS),
# plus the same files passed through the phone-speaker simulation, plus objective measurements -> preview/round3/phone_measurements.txt
import sys; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, scipy.signal as ss, dsp, make_ab as AB, make_cannon2 as M2, make_cannon3 as M3
from phonesim import phone
from dsp import SR
P = '/workspace/audio/preview/round3/'
old1 = dsp.load('/workspace/audio/preview/old/old_cannon_broadside.mp3'); old4 = dsp.load('/workspace/audio/preview/old/old_cannon_broadside4.mp3')
r2 = dsp.load('/workspace/audio/sfx/cannon_r2/cannon_heavy_01.wav')
n1 = dsp.load('/workspace/audio/sfx/cannon_r3/cannon_phone_01.wav'); n2 = dsp.load('/workspace/audio/sfx/cannon_r3/cannon_phone_02.wav')
def seq(cl, gap=0.7): return AB.seq(cl, gap)
A = [AB.match(old1), AB.match(n1), AB.match(old1), AB.match(n2)]
s = seq(A); dsp.save(P + '01_cannon_AB_phone_old_vs_new.mp3', dsp.limit(s, -1.2))
dsp.save(P + '01_cannon_AB_phone_old_vs_new_PHONESIM.mp3', dsp.limit(phone(s), -1.2))   # same file, no re-matching: what a phone does to each
nb = M3.broadside(4, seed=7)
b = seq([AB.match(old4), AB.match(nb), AB.match(old4), AB.match(nb)])
dsp.save(P + '01_cannon_AB_broadside.mp3', dsp.limit(b, -1.2)); dsp.save(P + '01_cannon_AB_broadside_PHONESIM.mp3', dsp.limit(phone(b), -1.2))
# ---- measurements ----
def bands(x, edges):
    m = dsp.mono(x); f, p = ss.welch(m, SR, nperseg=8192); tot = p.sum()
    return [10*np.log10(p[(f >= a) & (f < b)].sum()/tot + 1e-12) for a, b in edges]
def crest(x, a=0, b=0.5):
    m = dsp.mono(x)[int(a*SR):int(b*SR)]; return 20*np.log10(np.max(np.abs(m))/np.sqrt(np.mean(m**2)))
def centroid(x):
    m = dsp.mono(x)[:int(1.0*SR)]; f, p = ss.welch(m, SR, nperseg=4096); return (f*p).sum()/p.sum()
def tail_ratio(x):   # 1-3 kHz energy from 0.5-3.0 s vs the first 0.3 s (how audible the rolling echo is)
    m = dsp.filt(dsp.mono(x), 'bandpass', [1000, 3000], 4)
    return 10*np.log10(np.mean(m[int(0.5*SR):int(3*SR)]**2)/np.mean(m[:int(0.3*SR)]**2))
def tailT(x):    # seconds until the 200-4k envelope falls 30 dB below its peak
    m = dsp.filt(dsp.mono(x), 'bandpass', [200, 4000], 4); e = dsp.env_db(m, 0.03); i = np.argmax(e); j = np.where(e[i:] > e[i] - 30)[0]; return j[-1]/SR
def spec_db(x):
    f, p = ss.welch(dsp.mono(x)[:int(3*SR)], SR, nperseg=8192); return f, 10*np.log10(p + 1e-14)
E = [(20, 80), (80, 150), (150, 300), (300, 1000), (1000, 4000), (4000, 12000), (200, 4000)]
rows = []; C = {}
for name, x in [('OLD game synth', old1), ('R2 heavy (sub-first)', r2), ('R3 phone-first v1', n1), ('R3 phone-first v2', n2)]:
    xm = AB.match(x); ph = phone(xm); C[name] = (xm, ph)
    rows.append((name, AB.lufs(ph), bands(xm, E), bands(ph, E[2:]), crest(xm), crest(ph), centroid(ph), tail_ratio(ph), tailT(ph)))
L = ['Phone-sim measurements (each clip loudness-matched to -16 LUFS full-range BEFORE the phone sim)', '',
     'Phone sim = mono, HPF 300 Hz 24 dB/oct + 180 Hz, +3 dB at 900 Hz, +4 dB at 3 kHz, -6 dB at 6.5 kHz, LPF 10 kHz, fast 4:1 limiter.', '',
     'A) Loudness that survives on the phone (LUFS after sim; higher = sounds bigger on the phone)']
for r in rows: L.append(f'   {r[0]:22s} {r[1]:6.1f} LUFS')
L += ['', 'B) Full-range share of energy per band, dB re total (pre-sim)', '   ' + ' ' * 22 + ''.join(f'{f"{a}-{b}":>11s}' for a, b in E)]
for r in rows: L.append(f'   {r[0]:22s}' + ''.join(f'{v:11.1f}' for v in r[2]))
L += ['', 'C) After phone sim: crest factor (peak/RMS of first 0.5 s), spectral centroid, 1-3 kHz echo tail vs attack, audible tail length (200-4k, -30 dB)']
for r in rows: L.append(f'   {r[0]:22s} crest full {r[4]:5.1f} dB / phone {r[5]:5.1f} dB   centroid {r[6]:6.0f} Hz   echo {r[7]:6.1f} dB   tail {r[8]:4.2f} s')
fo, so_ = spec_db(C['OLD game synth'][1]); fn, sn = spec_db(C['R3 phone-first v1'][1]); _, s2 = spec_db(C['R2 heavy (sub-first)'][1])
k = (fo >= 200) & (fo <= 4000)
L += ['', 'D) Spectral difference in 200 Hz-4 kHz, after phone sim (mean |dB| over the band, absolute levels)',
      f'   NEW R3 vs OLD : mean diff {np.mean(np.abs(sn[k]-so_[k])):.1f} dB, NEW louder by {np.mean(sn[k]-so_[k]):+.1f} dB on average',
      f'   R2 vs OLD     : mean diff {np.mean(np.abs(s2[k]-so_[k])):.1f} dB, R2 louder by {np.mean(s2[k]-so_[k]):+.1f} dB on average']
for a, b in [(200, 500), (500, 1000), (1000, 2000), (2000, 4000)]:
    kk = (fo >= a) & (fo < b); L.append(f'   {a}-{b} Hz: NEW R3 - OLD = {np.mean(sn[kk]-so_[kk]):+5.1f} dB    R2 - OLD = {np.mean(s2[kk]-so_[kk]):+5.1f} dB')
open(P + 'phone_measurements.txt', 'w').write('\n'.join(L) + '\n'); print('\n'.join(L))
# E) attack sharpness after phone sim: 10->90 % rise time of the 1 ms envelope, and peak of the first 15 ms vs RMS of 100-400 ms
L2 = ['', 'E) Attack after phone sim: rise time (10->90 %) and transient-over-body (peak first 15 ms / RMS 100-400 ms)']
for name, (xm, ph) in C.items():
    m = np.abs(dsp.mono(ph)); e = np.convolve(m, np.ones(48)/48, 'same'); pk = np.argmax(e[:int(0.3*SR)]); a = np.argmax(e > 0.1*e[pk]); b = np.argmax(e > 0.9*e[pk])
    i0 = a; tb = 20*np.log10(np.max(m[i0:i0+int(0.015*SR)])/np.sqrt(np.mean(dsp.mono(ph)[i0+int(0.1*SR):i0+int(0.4*SR)]**2)))
    L2.append(f'   {name:22s} rise {1000*(b-a)/SR:5.1f} ms   transient/body {tb:5.1f} dB')
open(P + 'phone_measurements.txt', 'a').write('\n'.join(L2) + '\n'); print('\n'.join(L2))
