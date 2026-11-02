# Phone-speaker simulation (a typical single bottom-firing micro speaker, ~11x15 mm):
# mono sum -> 4th-order HPF 300 Hz (no real output below ~250 Hz) -> 2nd HPF 180 Hz (cone excursion limit)
# -> small-speaker curve: +3 dB bump ~900 Hz, +4 dB presence ~3 kHz, -6 dB dip 6.5 kHz, LPF 10 kHz
# -> the phone's own fast limiter (DRC) that squashes peaks, like iOS/Android do on loud content.
import sys; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp
def phone(x):
    m = dsp.mono(dsp.st(x))
    m = dsp.filt(m, 'highpass', 300, 4); m = dsp.filt(m, 'highpass', 180, 2)
    m = dsp.peq(m, 900, 3, 1.2); m = dsp.peq(m, 3000, 4, 1.0); m = dsp.peq(m, 6500, -6, 1.5); m = dsp.filt(m, 'lowpass', 10000, 4)
    m = dsp.comp(m, -14, 4.0, 0.001, 0.08)
    return dsp.st(m)
