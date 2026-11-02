# Small DSP toolkit for PUMPFUN PIRATES sound design (numpy/scipy + ffmpeg I/O). 48 kHz stereo float.
import numpy as np, subprocess, scipy.signal as ss, json, os
SR = 48000
RAW = "/workspace/audio/raw/freesound"
rng = np.random.default_rng()
def load(fn, sr=SR, ch=2):
    if not os.path.isabs(fn): fn = f"{RAW}/{fn}"
    out = subprocess.run(["ffmpeg","-v","error","-i",fn,"-f","f32le","-ac",str(ch),"-ar",str(sr),"-"],capture_output=True,check=True).stdout
    x = np.frombuffer(out, np.float32).reshape(-1, ch).copy()
    return x
def save(fn, x, sr=SR):
    x = np.atleast_2d(x.T).T if x.ndim == 1 else x
    if x.ndim == 1: x = x[:, None]
    ch = x.shape[1]
    args = ["ffmpeg","-v","error","-y","-f","f32le","-ar",str(sr),"-ac",str(ch),"-i","-"]
    if fn.endswith(".mp3"): args += ["-c:a","libmp3lame","-b:a","192k"]
    elif fn.endswith(".wav"): args += ["-c:a","pcm_s24le"]
    p = subprocess.run(args + [fn], input=x.astype(np.float32).tobytes(), check=True)
def st(x):  # mono -> stereo
    return np.stack([x, x], 1) if x.ndim == 1 else x
def mono(x): return x.mean(1) if x.ndim == 2 else x
def sec(x, a, b=None): return x[int(a*SR): (int(b*SR) if b is not None else None)].copy()
def env_db(x, win=0.005):
    m = mono(x); n = int(win*SR); e = np.sqrt(np.convolve(m**2, np.ones(n)/n, 'same') + 1e-12); return 20*np.log10(e)
def onsets(x, rise=18, gap=0.25, above=-40):
    e = env_db(x); d = int(0.02*SR); res = []
    i = d
    while i < len(e):
        if e[i] - e[i-d] > rise and e[i] > above:
            j = i - d + np.argmax(np.diff(e[i-d:i+1]))
            res.append(max(0, j - int(0.004*SR)) / SR); i += int(gap*SR)
        else: i += 64
    return res
def grab(fn, idx=0, dur=1.0, pre=0.004, rise=18, above=-40):
    x = load(fn); o = onsets(x, rise=rise, above=above)
    t = o[idx] if o else 0
    return fade(sec(x, max(0, t - pre), t - pre + dur), 0.002, min(0.25, dur*0.4))
def fade(x, fi=0.002, fo=0.05):
    x = x.copy(); a = int(fi*SR); b = int(fo*SR)
    if a: x[:a] *= np.linspace(0, 1, a)[:, None] if x.ndim == 2 else np.linspace(0, 1, a)
    if b: 
        r = np.linspace(1, 0, b)**2
        x[-b:] *= r[:, None] if x.ndim == 2 else r
    return x
def filt(x, kind, f, order=2):
    sos = ss.butter(order, f, kind, fs=SR, output='sos'); return ss.sosfilt(sos, x, axis=0)
def peq(x, f, g_db, q=1.0):  # RBJ peaking EQ
    A = 10**(g_db/40); w = 2*np.pi*f/SR; al = np.sin(w)/(2*q)
    b = [1+al*A, -2*np.cos(w), 1-al*A]; a = [1+al/A, -2*np.cos(w), 1-al/A]
    return ss.lfilter(np.array(b)/a[0], np.array(a)/a[0], x, axis=0)
def shelf(x, f, g_db, low=True):
    A = 10**(g_db/40); w = 2*np.pi*f/SR; al = np.sin(w)/2*np.sqrt(2); c = np.cos(w); sA = 2*np.sqrt(A)*al
    if low: b = [A*((A+1)-(A-1)*c+sA), 2*A*((A-1)-(A+1)*c), A*((A+1)-(A-1)*c-sA)]; a = [(A+1)+(A-1)*c+sA, -2*((A-1)+(A+1)*c), (A+1)+(A-1)*c-sA]
    else: b = [A*((A+1)+(A-1)*c+sA), -2*A*((A-1)+(A+1)*c), A*((A+1)+(A-1)*c-sA)]; a = [(A+1)-(A-1)*c+sA, 2*((A-1)-(A+1)*c), (A+1)-(A-1)*c-sA]
    return ss.lfilter(np.array(b)/a[0], np.array(a)/a[0], x, axis=0)
def vari(x, ratio):  # varispeed: ratio<1 = lower + longer (tape-style, keeps transients natural)
    n = int(len(x)/ratio); return ss.resample(x, n, axis=0)
def sat(x, drive=2.0): return np.tanh(x*drive)/np.tanh(drive)
def norm(x, db=-1.0): return x / (np.max(np.abs(x)) + 1e-12) * 10**(db/20)
def gain(x, db): return x * 10**(db/20)
def place(dst, src, t, g_db=0.0):
    i = int(t*SR); src = st(src) * 10**(g_db/20); n = min(len(src), len(dst)-i)
    if n > 0: dst[i:i+n] += src[:n]
    return dst
def buf(dur): return np.zeros((int(dur*SR), 2))
def ir_space(dur=3.0, decay=1.4, lp0=6000, lp1=600, early=(), predelay=0.012, width=1.0, seed=None):
    """Generated stereo IR: decaying noise that darkens over time + discrete early reflections [(t, gain)]."""
    r = np.random.default_rng(seed); n = int(dur*SR); t = np.arange(n)/SR
    ir = np.zeros((n, 2))
    for ch in range(2):
        nz = r.standard_normal(n)
        # time-varying darkening: crossfade between two filtered copies
        a = ss.sosfilt(ss.butter(2, lp0, 'low', fs=SR, output='sos'), nz); b = ss.sosfilt(ss.butter(2, lp1, 'low', fs=SR, output='sos'), nz)
        k = np.clip(t/(dur*0.6), 0, 1); y = a*(1-k) + b*k*2.2
        ir[:, ch] = y*np.exp(-t*decay/ (dur/3.0))*np.minimum(1, t/0.02)
    pd = int(predelay*SR); ir = np.concatenate([np.zeros((pd, 2)), ir])[:n]
    for (te, g) in early:
        i = int(te*SR)
        if i < n:
            for ch in range(2): ir[i + r.integers(0, 40), ch] += g*(1 if ch == 0 else 0.8)*np.max(np.abs(ir))*4
    if width < 1: m = ir.mean(1, keepdims=True); ir = m + (ir - m)*width
    return ir/np.sqrt((ir**2).sum()/2)
def conv(x, ir, wet_db=0.0):
    x = st(x); y = np.stack([ss.fftconvolve(x[:, c], ir[:, c]) for c in range(2)], 1)
    return y * 10**(wet_db/20)
def pad_to(x, n): 
    x = st(x); return np.concatenate([x, np.zeros((n-len(x), 2))]) if len(x) < n else x[:n]
def mix(*xs):
    n = max(len(x) for x in xs); return sum(pad_to(x, n) for x in xs)
def sine_sweep(f0, f1, dur, curve=4.0, a=0.003, env_pow=1.5):
    t = np.arange(int(dur*SR))/SR; f = f1 + (f0-f1)*np.exp(-t*curve/dur*3)
    ph = 2*np.pi*np.cumsum(f)/SR; e = np.minimum(1, t/a)*(1-t/dur)**env_pow
    return np.sin(ph)*e
def noise(dur, seed=None): return np.random.default_rng(seed).standard_normal(int(dur*SR))
def comp(x, thr_db=-18, ratio=3, att=0.005, rel=0.12, makeup=0.0, knee=6):
    m = np.max(np.abs(st(x)), 1); a1 = np.exp(-1/(att*SR)); r1 = np.exp(-1/(rel*SR))
    lvl = 20*np.log10(m + 1e-9)
    e = np.zeros_like(lvl); prev = -120
    # one-pole envelope on dB (attack/release)
    for i, v in enumerate(lvl):
        c = a1 if v > prev else r1; prev = c*prev + (1-c)*v; e[i] = prev
    over = e - thr_db
    gr = np.where(over <= -knee/2, 0, np.where(over >= knee/2, over*(1-1/ratio), (over+knee/2)**2/(2*knee)*(1-1/ratio)))
    g = 10**((-gr + makeup)/20)
    return st(x)*g[:, None]
def limit(x, ceil_db=-1.2, look=0.003, rel=0.08):
    """Lookahead peak limiter (4x oversampled peak detect for true-peak safety)."""
    x = st(x); up = ss.resample_poly(x, 4, 1, axis=0); pk = np.max(np.abs(up), 1).reshape(-1, 4).max(1)[:len(x)]
    pk = np.pad(pk, (0, len(x)-len(pk)), constant_values=0)
    c = 10**(ceil_db/20); need = np.minimum(1, c/(pk+1e-12))
    L = int(look*SR); need = ss.minimum_filter1d(need, size=2*L+1) if hasattr(ss, 'minimum_filter1d') else __import__('scipy.ndimage', fromlist=['x']).minimum_filter1d(need, 2*L+1)
    g = np.empty_like(need); r = np.exp(-1/(rel*SR)); cur = 1.0
    for i, v in enumerate(need):
        cur = v if v < cur else r*cur + (1-r)*v; g[i] = cur
    g = np.convolve(g, np.ones(L)/L, 'same'); g = np.minimum(g, need*1.0 + (g-need).clip(max=0))
    y = x*g[:, None]
    return y * min(1, c/(np.max(np.abs(ss.resample_poly(y, 4, 1, axis=0)))+1e-12))
def trim_tail(x, db=-70):
    e = env_db(x, 0.02); idx = np.where(e > db)[0]; return x[: (idx[-1] + int(0.02*SR)) if len(idx) else len(x)]
