# Export round-4 WAVs to assets/audio/*.mp3 in the formats Emerly used (44.1 kHz; hits/sfx mono 80 kbps, voices mono 64 kbps,
# ambience mono 64 kbps, stingers stereo 112 kbps, shanty stereo 96 kbps) and compute the LVL trims that match each new
# slot's full-range in-game loudness to the synth it replaces. Prints the LVL constants for js/audio.js.
import sys, os, subprocess, json; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp
from phone_compare import lufs
from dsp import SR
S = '/workspace/audio/sfx/r4/'; A = '/workspace/pfp-sound/assets/audio/'; REF = '/workspace/audio/ref_old/'
def enc(src, dst, ch, kbps):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ac', str(ch), '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', dst], check=True)
def dec(fn):
    return np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',fn,'-f','f32le','-ac','2','-ar',str(SR),'-'],capture_output=True).stdout, np.float32).reshape(-1, 2).astype(np.float64)
G = 0.9 * 0.8  # default sfx * master
MONO80 = ['impact_light_1', 'impact_light_2', 'impact_medium_1', 'impact_medium_2', 'impact_heavy_1', 'impact_heavy_2', 'debris_1', 'debris_2', 'sink', 'sink_big', 'lowhp_beat', 'lowhp_bell']
if __name__ == '__main__':
    for n in MONO80: enc(S + n + '.wav', A + ('sink_1' if n == 'sink' else n) + '.mp3', 1, 80)
    enc(S + 'amb_sea.wav', A + 'amb_sea.mp3', 1, 64)
    enc(S + 'defeat.wav', A + 'defeat.mp3', 2, 112)
    enc('/workspace/audio/music/harbor_shanty_loop_15s.wav', A + 'music_shanty.mp3', 2, 96)
    for f in sorted(os.listdir(S)):
        if f.startswith('vo_'): enc(S + f, A + f[:-4] + '.mp3', 1, 64)
    L = lambda n: lufs(dec(A + n + '.mp3'))
    lv = {}
    for t, v in (('light', 0.55), ('medium', 0.75), ('heavy', 0.9)):
        lo = lufs(dsp.load(REF + f'impact_{t}.wav')); ln = np.mean([L(f'impact_{t}_1'), L(f'impact_{t}_2')])
        lv[t] = 10**((lo - ln)/20) / (v*G)
    lv['sink'] = 10**((lufs(dsp.load(REF + 'sink.wav')) - L('sink_1'))/20) / G
    lv['sinkBig'] = 10**((lufs(dsp.load(REF + 'sink_big.wav')) - L('sink_big'))/20) / G
    kill = L('impact_1') + 20*np.log10(0.85*G); lv['debris'] = 10**((kill - 8 - np.mean([L('debris_1'), L('debris_2')]))/20) / G
    beat = dec(A + 'lowhp_beat.mp3'); seq = dsp.buf(4.3)
    for i in range(5): dsp.place(seq, beat, 0.05 + i*0.73)
    lo = lufs(dsp.load(REF + 'lowhp.wav')); lv['beat'] = 10**((lo - lufs(seq))/20) / G
    lv['bell'] = 10**((lo - 2 - L('lowhp_bell'))/20) / G
    lv['amb'] = 10**((lufs(dsp.load(REF + 'ambience.wav')) - 1 - L('amb_sea'))/20) / (0.07*0.99*0.8)
    lv['defeat'] = 0.55 * 10**((L('victory') - L('defeat'))/20) * 0.9
    print(json.dumps({k: round(float(v), 3) for k, v in lv.items()}))
    json.dump({k: round(float(v), 3) for k, v in lv.items()}, open('/workspace/audio/sfx/r4/lvl.json', 'w'))
