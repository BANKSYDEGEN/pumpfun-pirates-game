# Crew gang shout "HEY!" (and "HO!"): 6 synthesized Piper speakers (libritts_r, CC BY 4.0) stacked with timing/pitch
# offsets -> a crowd, not any individual. Output: voices/crew_hey.wav, voices/crew_ho.wav
import sys, wave, subprocess, numpy as np
sys.path.insert(0, '/workspace/audio/tools'); import dsp
from piper import PiperVoice, SynthesisConfig
V = PiperVoice.load('/workspace/audio/raw/piper/en_US-libritts_r-medium.onnx')
def one(text, sid, ls):
    fn = f'/tmp/crew_{sid}.wav'
    with wave.open(fn, 'wb') as w: V.synthesize_wav(text, w, syn_config=SynthesisConfig(speaker_id=sid, length_scale=ls, noise_scale=0.7, noise_w_scale=0.8))
    x = dsp.mono(dsp.load(fn)); i = np.argmax(np.abs(x) > 0.05*np.abs(x).max()); return x[max(0, i-240):]
def crowd(text, out):
    r = np.random.default_rng(4); mix = np.zeros(int(1.2*dsp.SR)); stems = dsp.buf(1.2)
    for k, (sid, pitch) in enumerate([(690, 0.9), (483, 0.95), (460, 0.88), (575, 1.0), (437, 0.93), (253, 0.97), (529, 1.0), (207, 1.02)]):
        x = one(text, sid, 0.9)
        x = dsp.vari(x, pitch); x = dsp.sat(dsp.norm(x, 0), 1.8)
        pan = (k/7 - 0.5)*1.2; s = dsp.st(x) * np.array([1 - max(0, pan), 1 + min(0, pan)])
        dsp.place(stems, s, 0.01 + r.uniform(0, 0.035), -3 if k < 6 else -7)
    y = dsp.filt(dsp.peq(dsp.peq(stems, 250, 2, 1), 2500, 3, 1), 'highpass', 110)
    y = y + dsp.conv(y, dsp.ir_space(1.2, 2.2, 5000, 900, seed=8))[:len(y)] * 0.2
    y = dsp.limit(dsp.norm(dsp.trim_tail(y, -60), -1.5), -1.5); dsp.save(out, dsp.fade(y, 0.002, 0.08))
crowd('Hey!', '/workspace/audio/voices/crew_hey.wav')
crowd('Ho!', '/workspace/audio/voices/crew_ho.wav')
print('ok')
