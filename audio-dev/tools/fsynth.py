# Minimal offline FluidSynth (1.x, from the LMMS AppImage) renderer via ctypes. Renders per-stem float arrays.
import ctypes, os, numpy as np
L = ctypes.CDLL('/opt/lmms/squashfs-root/usr/lib/libfluidsynth.so.1')
L.new_fluid_settings.restype = ctypes.c_void_p; L.new_fluid_synth.restype = ctypes.c_void_p
L.new_fluid_synth.argtypes = [ctypes.c_void_p]
for f in ('fluid_settings_setnum',): getattr(L, f).argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_double]
L.fluid_settings_setint.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
L.fluid_settings_setstr.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_char_p]
L.fluid_synth_sfload.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
L.fluid_synth_program_select.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int]
L.fluid_synth_noteon.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int]
L.fluid_synth_noteoff.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int]
L.fluid_synth_cc.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int]
L.fluid_synth_pitch_bend.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int]
L.fluid_synth_write_float.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_void_p, ctypes.c_int, ctypes.c_int]
L.delete_fluid_synth.argtypes = [ctypes.c_void_p]; L.delete_fluid_settings.argtypes = [ctypes.c_void_p]
SF = b'/workspace/audio/raw/sf2/GeneralUser-GS.sf2'
SR = 48000
def render(events, dur, program, bank=0, chan=0, gain=0.6, ccs=()):
    """events: list of (t_on, t_off, key, vel). Returns (n,2) float32."""
    st = L.new_fluid_settings()
    L.fluid_settings_setnum(st, b'synth.sample-rate', float(SR)); L.fluid_settings_setnum(st, b'synth.gain', gain)
    for k in (b'synth.reverb.active', b'synth.chorus.active'):
        if L.fluid_settings_setint(st, k, 0) == 0: L.fluid_settings_setstr(st, k, b'no')
    L.fluid_settings_setint(st, b'synth.polyphony', 256)
    sy = L.new_fluid_synth(st); sf = L.fluid_synth_sfload(sy, SF, 1)
    L.fluid_synth_program_select(sy, chan, sf, 128 if chan == 9 else bank, program)
    for (c, v) in ccs: L.fluid_synth_cc(sy, chan, c, v)
    ev = []
    for (a, b, k, v) in events: ev.append((int(a*SR), 1, k, v)); ev.append((int(b*SR), 0, k, 0))
    ev.sort(key=lambda e: (e[0], e[1]))
    n = int(dur*SR); out = np.zeros((n, 2), np.float32); pos = 0
    def write(upto):
        nonlocal pos
        upto = min(upto, n)
        while pos < upto:
            m = min(4096, upto - pos); l = np.zeros(m, np.float32); r = np.zeros(m, np.float32)
            L.fluid_synth_write_float(sy, m, l.ctypes.data, 0, 1, r.ctypes.data, 0, 1)
            out[pos:pos+m, 0] = l; out[pos:pos+m, 1] = r; pos += m
    for (t, on, k, v) in ev:
        write(t)
        if on: L.fluid_synth_noteon(sy, chan, k, v)
        else: L.fluid_synth_noteoff(sy, chan, k)
    write(n)
    L.delete_fluid_synth(sy); L.delete_fluid_settings(st)
    return out
if __name__ == '__main__':
    x = render([(0.1, 0.6, 62, 100), (0.6, 1.1, 69, 100)], 2.0, 110)
    print(x.shape, np.abs(x).max())
