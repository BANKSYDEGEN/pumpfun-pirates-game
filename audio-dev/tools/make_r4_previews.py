# Round-4 preview reels (from the in-game renders made by verify_r4.py and the shipped mp3s). Each A/B pair is level-matched
# to the same full-range LUFS, so the comparison is fair; *_PHONESIM versions run the same reel through tools/phonesim.py.
import sys, subprocess; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp
from phonesim import phone
from phone_compare import lufs, lead_trim
from dsp import SR
P = '/workspace/audio/preview/round4/'; V = '/tmp/h4/v/'; A = '/workspace/pfp-sound/assets/audio/'
def mp3(fn): return np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',fn,'-f','f32le','-ac','2','-ar',str(SR),'-'],capture_output=True).stdout, np.float32).reshape(-1,2).astype(np.float64)
def git_old(name):
    b = subprocess.run(['git','-C','/workspace/pfp-sound','show',f'876f265~1:assets/audio/{name}.mp3'],capture_output=True).stdout
    return np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i','-','-f','f32le','-ac','2','-ar',str(SR),'-'],input=b,capture_output=True).stdout, np.float32).reshape(-1,2).astype(np.float64)
def reel(clips, gap=0.7, target=-20.0, beep=True):
    o = []; tick = dsp.gain(np.repeat((np.sin(2*np.pi*1500*np.arange(int(0.05*SR))/SR)*np.hanning(int(0.05*SR)))[:, None], 2, 1), -24)
    for i, c in enumerate(clips):
        c = lead_trim(dsp.st(c)); c = dsp.gain(c, target - lufs(c))
        if beep and i % 2 == 0: o += [tick, np.zeros((int(0.25*SR), 2))]
        o += [c, np.zeros((int(gap*SR), 2))]
    return dsp.limit(np.concatenate(o), -1)
def out(name, y):
    dsp.save(P + name + '.mp3', y); dsp.save(P + name + '_PHONESIM.mp3', dsp.st(phone(y)))
ab = []
for t in ('light', 'medium', 'heavy'): ab += [dsp.load(V + f'old_{t}.wav'), dsp.load(V + f'new_{t}.wav')]
out('01_impacts_AB_old_vs_new', reel(ab))   # tick = old (pair starts), then new; light, medium, heavy; then kill
out('01b_kill_smash_plus_debris', reel([dsp.load(V + 'new_kill.wav')], beep=False))
calls = ['vo_follow_male_1','vo_follow_male_2','vo_follow_male_3','vo_follow_female_1','vo_follow_female_2','vo_follow_female_3','vo_boss_male_1','vo_boss_male_2',
         'vo_help_male_1','vo_help_female_1','vo_help_female_2','vo_attack_male_1','vo_attack_male_2','vo_retreat_male_1','vo_gg_male_1','vo_gg_male_2']
out('02_call_lines_reel', reel([mp3(A + c + '.mp3') for c in calls], gap=0.5, target=-18, beep=False))
cr = []
for k in ('sink', 'sinkbig', 'lowhp'): cr += [dsp.load(V + f'old_{k}.wav'), dsp.load(V + f'new_{k}.wav')]
cr += [dsp.sec(dsp.load(V + 'old_amb.wav'), 0.3, 8.3), dsp.sec(dsp.load(V + 'new_amb.wav'), 0.3, 8.3)]
out('03_sfx_AB_sink_sinkbig_lowhp_ambience', reel(cr, gap=0.8, target=-24))
tr = []
for n in ('vo_laugh_male_1','vo_laugh_male_2','vo_laugh_female_1','vo_laugh_female_2','vo_laugh_female_3','vo_fire_male_2','vo_fire_male_3','vo_arrr_male_1'):
    tr += [git_old(n), mp3(A + n + '.mp3')]
out('04_trims_AB_laughs_fire_arr', reel(tr, gap=0.5, target=-18))
dsp.save(P + '06b_defeat_in_game.mp3', dsp.load(V + 'new_defeat.wav'))
