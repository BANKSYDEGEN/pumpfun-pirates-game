# Old-vs-new phone comparison. Both clips are first matched to the SAME full-range loudness (what the in-game LVL trims do),
# then run through phonesim.phone(). Reports phone-side loudness, 200 Hz-4 kHz band level, crest factor and attack.
import sys, subprocess, re; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, scipy.signal as ss, dsp
from phonesim import phone
from dsp import SR
def lufs(x):
    x = dsp.st(x)
    if len(x) < int(0.45*SR): x = np.concatenate([x, np.zeros((int(0.45*SR) - len(x), 2))])
    dsp.save('/tmp/_pc.wav', x)
    o = subprocess.run(['ffmpeg','-hide_banner','-nostats','-i','/tmp/_pc.wav','-af','ebur128','-f','null','-'],capture_output=True,text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', o)[-1])
def lead_trim(x, db=-50):
    m = np.abs(dsp.mono(x)); i = int(np.argmax(m > m.max()*10**(db/20))); return x[max(0, i - int(0.005*SR)):]
def band(x, a, b):
    f, p = ss.welch(dsp.mono(x), SR, nperseg=4096); return 10*np.log10(p[(f >= a) & (f < b)].sum() + 1e-15)
def crest(x, dur=0.5):
    m = dsp.mono(x)[:int(dur*SR)]; return 20*np.log10(np.max(np.abs(m))/(np.sqrt(np.mean(m**2)) + 1e-12))
def rise(x):
    m = np.abs(dsp.mono(x)); e = np.convolve(m, np.ones(48)/48, 'same'); k = np.argmax(e[:int(0.3*SR)]); return 1000*(np.argmax(e > 0.9*e[k]) - np.argmax(e > 0.1*e[k]))/SR
def compare(old, new, name=''):
    old, new = lead_trim(dsp.st(old)), lead_trim(dsp.st(new)); Lo = lufs(old); new = dsp.gain(new, Lo - lufs(new))
    po, pn = phone(old), phone(new)
    r = dict(name=name, full=Lo, ph_old=lufs(po), ph_new=lufs(pn), b_old=band(po, 200, 4000), b_new=band(pn, 200, 4000),
             cr_old=crest(po), cr_new=crest(pn), ri_old=rise(po), ri_new=rise(pn))
    r['d_ph'] = r['ph_new'] - r['ph_old']; r['d_b'] = r['b_new'] - r['b_old']; return r
def fmt(r):
    return (f"{r['name']:18s} full-range matched {r['full']:6.1f} LUFS | phone: old {r['ph_old']:6.1f} -> new {r['ph_new']:6.1f} LUFS ({r['d_ph']:+5.1f} LU) | "
            f"200-4k band {r['d_b']:+5.1f} dB | crest old {r['cr_old']:4.1f} / new {r['cr_new']:4.1f} dB | rise old {r['ri_old']:5.1f} / new {r['ri_new']:5.1f} ms")
