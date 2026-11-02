# "Salt on the Rail" - original harbor shanty loop for PUMPFUN PIRATES (composed for this project, D dorian, 128 BPM,
# 16 bars = 30.0 s, seamless loop). Fiddle lead, accordion offbeat chords, contrabass + cello, frame drum/stomp/
# tambourine kit, crew "HEY!" shouts. Rendered with GeneralUser GS (free for commercial music) via FluidSynth.
import sys; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp, fsynth
from dsp import SR
BPM = 128; B = 60/BPM; BAR = 4*B; NB = 16; LOOP = NB*BAR; TAIL = 3.0; DUR = LOOP + TAIL
R = np.random.default_rng(128)
def hum(t, s=0.008): return t + R.normal(0, s)
def swing(i8): return (i8//2)*B + (0 if i8 % 2 == 0 else B*0.56)   # light swing on the off-eighths
MEL = [
 [69,74,74,76, 77,76,74,72], [72,-1,76,72, 67,-1,72,74], [74,77,81,77, 76,74,72,74], [76,-1,72,69, 69,-1,-1,0],
 [69,74,74,76, 77,79,81,79], [77,76,72,76, 79,-1,76,72], [74,-1,70,74, 77,76,74,72], [73,-1,76,73, 69,-1,-1,0],
 [81,-1,77,81, 86,-1,81,77], [79,-1,76,79, 84,-1,79,76], [77,79,81,77, 74,76,77,74], [76,-1,72,76, 81,-1,-1,0],
 [81,-1,77,81, 86,84,81,79], [79,77,76,79, 84,-1,79,76], [77,-1,74,77, 82,81,79,77], [76,73,69,73, 76,-1,73,-1]]
CH = {'Dm': [50,53,57,62], 'C': [48,52,55,60], 'Am': [45,48,52,57], 'Bb': [46,50,53,58], 'A': [45,49,52,57]}
PROG = ['Dm','C','Dm','Am','Dm','C','Bb','A']*2
ROOT = {'Dm': 38, 'C': 36, 'Am': 33, 'Bb': 34, 'A': 33}
def melody_events():
    ev = []
    for b, bar in enumerate(MEL):
        i = 0
        while i < 8:
            k = bar[i]
            if k > 0:
                j = i + 1
                while j < 8 and bar[j] == -1: j += 1
                t0 = b*BAR + swing(i); t1 = b*BAR + swing(j) if j < 8 else (b+1)*BAR
                acc = 105 if i in (0, 4) else (88 if i % 2 == 0 else 78)
                ev.append((hum(t0, 0.006), t1 - 0.02, k, int(np.clip(acc + R.integers(-6, 7), 1, 127)))); i = j
            else: i += 1
    return ev
def accordion_events():
    ev = []
    for b, c in enumerate(PROG):
        for beat in (1, 3):   # oom-PAH: chord on 2 and 4, short
            t = b*BAR + beat*B
            for k in CH[c][1:]: ev.append((hum(t, 0.005), t + B*0.42, k + 12, 70 + R.integers(-5, 6)))
        for half in (1.5, 3.5):  # light pickup on the "and"
            t = b*BAR + half*B + B*0.06
            for k in CH[c][1:3]: ev.append((hum(t, 0.005), t + B*0.25, k + 12, 50 + R.integers(-5, 6)))
    return ev
def bass_events():
    ev = []
    for b, c in enumerate(PROG):
        r = ROOT[c]
        ev.append((hum(b*BAR), b*BAR + B*0.9, r, 100)); ev.append((hum(b*BAR + 2*B), b*BAR + 2.9*B, r + 7, 88))
    return ev
def cello_events():
    return [(b*BAR + 0.01, (b+1)*BAR - 0.03, ROOT[c] + 12, 62 if b < 8 else 74) for b, c in enumerate(PROG)]
def drum_events():
    ev = []
    for b in range(NB):
        t = b*BAR
        for beat in (0, 2): ev.append((hum(t + beat*B, 0.004), t + beat*B + 0.2, 36, 112 if beat == 0 else 100))   # stomp
        for beat in (1, 3): ev.append((hum(t + beat*B, 0.004), t + beat*B + 0.2, 54, 84))                          # tambourine
        for e8 in range(8):
            if e8 % 2: ev.append((hum(t + swing(e8), 0.006), t + swing(e8) + 0.05, 54, 46 + R.integers(-6, 6)))
        if b >= 8:
            for beat in (1, 3): ev.append((hum(t + beat*B, 0.005), t + beat*B + 0.1, 39, 70))                    # claps, second strain
        if b % 4 == 3:  # frame-drum fill into the next phrase
            for k, (e8, key) in enumerate([(5, 45), (6, 43), (7, 41)]): ev.append((hum(t + swing(e8)), t + swing(e8) + 0.2, key, 90 + k*8))
    ev.append((0.0, 1.5, 57, 70))
    return ev
def build():
    mel = fsynth.render(melody_events(), DUR, 110, gain=0.5, ccs=[(91, 0), (93, 0), (7, 110)])      # Fiddle
    vio = fsynth.render([(a + 0.012, b, k - 12, int(v*0.7)) for a, b, k, v in melody_events() if 8*BAR <= a], DUR, 40, gain=0.5)  # violin doubling an octave down, strain 2
    acc = fsynth.render(accordion_events(), DUR, 21, gain=0.5)                                     # Accordion
    bas = fsynth.render(bass_events(), DUR, 43, gain=0.6)                                          # Contrabass
    cel = fsynth.render(cello_events(), DUR, 42, gain=0.5)                                         # Cello
    drm = fsynth.render(drum_events(), DUR, 0, chan=9, gain=0.6)
    hey = dsp.load('/workspace/audio/voices/crew_hey.wav'); ho = dsp.load('/workspace/audio/voices/crew_ho.wav')
    crew = dsp.buf(DUR)
    for b, beat, s in [(3, 3, hey), (7, 3, hey), (11, 2, ho), (11, 3, ho), (15, 3, hey)]: dsp.place(crew, s, b*BAR + beat*B - 0.03, -6)
    def pan(x, p): return x * np.array([1 - max(0, p), 1 + min(0, p)])
    mel = pan(dsp.peq(dsp.filt(mel, 'highpass', 200), 3000, 1.5, 1.0), 0.15)
    vio = pan(dsp.filt(vio, 'highpass', 150), -0.3)
    acc = pan(dsp.peq(dsp.filt(acc, 'highpass', 150), 900, -2, 1.0), -0.25)
    bas = dsp.filt(dsp.peq(bas, 90, 2, 1.0), 'lowpass', 2500)
    cel = pan(dsp.filt(cel, 'highpass', 70), 0.2)
    drm = dsp.peq(drm, 70, 3, 1.0)
    stems = [(mel, -2.0), (vio, -9), (acc, -6.5), (bas, -3.5), (cel, -12), (drm, -5.5), (crew, -4)]
    stems = [(dsp.norm(s, 0), g) for s, g in stems]
    dry = sum(dsp.gain(s, g) for s, g in stems)
    ir = dsp.ir_space(dur=2.2, decay=1.6, lp0=7000, lp1=1200, early=[(0.011, 0.3), (0.023, 0.2)], seed=31)  # wooden tavern/harbor
    wet = dsp.conv(dsp.filt(dry - dsp.gain(stems[3][0], stems[3][1]), 'highpass', 250), ir)[:len(dry)]
    mix = dry + wet*10**(-14/20)
    # seamless loop: fold the 3 s tail (reverb + ringing notes) back onto the start
    loop = mix[:int(LOOP*SR)].copy(); tail = mix[int(LOOP*SR):]; loop[:len(tail)] += tail
    loop = dsp.comp(loop, -16, 2.0, 0.02, 0.2)
    # level to ~ -16 LUFS integrated, true-peak <= -1 dBTP
    return loop
if __name__ == '__main__':
    import subprocess, json, re
    y = build()
    for _ in range(3):
        dsp.save('/tmp/shanty_tmp.wav', dsp.limit(y, -1.2))
        o = subprocess.run(['ffmpeg','-hide_banner','-nostats','-i','/tmp/shanty_tmp.wav','-af','ebur128','-f','null','-'],capture_output=True,text=True).stderr
        I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', o)[-1]); y = dsp.gain(y, -16 - I)
    y = dsp.limit(y, -1.2)
    import os; os.makedirs('/workspace/audio/music', exist_ok=True)
    dsp.save('/workspace/audio/music/harbor_shanty_loop.wav', y)
    dsp.save('/workspace/audio/preview/05_harbor_shanty_loop_30s.mp3', y)
    # loop check: play it twice back to back
    dsp.save('/workspace/audio/preview/05_harbor_shanty_loop_x2_seam_check.mp3', np.concatenate([y, y]))
    print('ok', len(y)/SR)
