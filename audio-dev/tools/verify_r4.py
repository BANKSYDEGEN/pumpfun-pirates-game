# In-game check (headless Chrome, real js/audio.js): old synth (samples off) vs new (samples on), same call, then phone sim.
import sys, json; sys.path.insert(0, '/workspace/audio/tools'); import dsp
from game_render import render
from phone_compare import compare, fmt
beat_old = "for(let i=0;i<5;i++){const t=0.85+i*0.73; tone({t,dur:0.12,f0:70,f1:45,vol:0.35,out:sfxBus}); tone({t:t+0.16,dur:0.1,f0:60,f1:40,vol:0.25,out:sfxBus});} tone({t:0.3,dur:0.5,f0:880,f1:660,vol:0.05,type:'square',out:sfxBus});"
beat_new = "playBuf(bufs.lowhp_bell,{t:0.3,vol:LVL.bell}); for(let i=0;i<5;i++) playBuf(bufs.lowhp_beat,{t:0.85+i*0.73,vol:LVL.beat*0.95});"
J = []
for t, d in (('light', 1.5), ('medium', 1.8), ('heavy', 3.0)):
    code = "sfx.impact({dmg:%d,maxHp:100,v:1})" % {'light': 5, 'medium': 15, 'heavy': 30}[t]
    J += [(f'old_{t}', code, d, False), (f'new_{t}', code, d, True)]
J += [('old_sink', 'sfx.sink(false)', 5, False), ('new_sink', 'sfx.sink(false)', 5, True), ('old_sinkbig', 'sfx.sink(true)', 6, False), ('new_sinkbig', 'sfx.sink(true)', 6, True),
      ('old_lowhp', beat_old, 4.6, False), ('new_lowhp', beat_new, 4.6, True),
      ('old_amb', 'startAmbient(); amb.seaG.gain.value=0.07;', 12, False),
      ('new_amb', 'startAmbient(); amb.seaG.gain.value=0.028; const s=ctx.createBufferSource(); s.buffer=bufs.amb_sea; s.loop=true; const g=ctx.createGain(); g.gain.value=0.07*LVL.amb; s.connect(g).connect(ambBus); s.start(0.3);', 12, True),
      ('new_kill', "sfx.impact({kill:true,v:1})", 3.5, True), ('new_defeat', 'sfx.defeat()', 6, True), ('old_defeat', 'sfx.defeat()', 4, False)]
for e in range(8): J.append((f'emote_{e}', f'crewLevel=6; sfx.emote({e},1,1,true)', 3.0, True))
out = {}
for j in J:  # fresh page per job: hitAllowed() throttle state would otherwise mute later hits at the same offline time
    out.update(render([j], '/tmp/h4/v')) if j[0].split('_')[-1] in ('light','medium','heavy','kill') else None
out.update(render([j for j in J if j[0].split('_')[-1] not in ('light','medium','heavy','kill')], '/tmp/h4/v'))
rows = []
for k in ('light', 'medium', 'heavy', 'sink', 'sinkbig', 'lowhp', 'amb'):
    r = compare(dsp.load(out['old_' + k]), dsp.load(out['new_' + k]), k); rows.append(r); print(fmt(r))
json.dump(rows, open('/workspace/audio/sfx/r4/verify.json', 'w'), indent=1)
import numpy as np
for e in range(8): print('emote', e, 'peak', round(float(np.abs(dsp.load(out[f'emote_{e}'])).max()), 3))
for k in ('new_kill', 'new_defeat'): print(k, round(float(np.abs(dsp.load(out[k])).max()), 3))
