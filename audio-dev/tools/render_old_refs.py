# Render the CURRENT synth (no samples) for every slot we compare against -> /workspace/audio/ref_old/*.wav
import sys; sys.path.insert(0, '/workspace/audio/tools'); from game_render import render
beat = "for(let i=0;i<5;i++){const t=0.85+i*0.73; tone({t,dur:0.12,f0:70,f1:45,vol:0.35,out:sfxBus}); tone({t:t+0.16,dur:0.1,f0:60,f1:40,vol:0.25,out:sfxBus});}"
J = [('impact_light', "impactSound({id:'light',vol:0.55},0.3,1)", 1.5, False),
     ('impact_medium', "impactSound({id:'medium',vol:0.75},0.3,1)", 1.8, False),
     ('impact_heavy', "impactSound({id:'heavy',vol:0.9},0.3,1)", 3.0, False),
     ('sink', "sfx.sink(false)", 4.5, False), ('sink_big', "sfx.sink(true)", 4.5, False),
     ('coin', "sfx.coin()", 1.0, False), ('shop_open', "sfx.shopOpen()", 1.6, False), ('upgrade', "sfx.upgrade(false)", 1.2, False),
     ('upgrade_legendary', "sfx.upgrade(true)", 2.5, False), ('equip', "sfx.equip()", 1.2, False), ('heal', "sfx.heal()", 1.2, False),
     ('reload', "sfx.reloadReady()", 0.8, False),
     ('lowhp', "tone({t:0.3,dur:0.5,f0:880,f1:660,vol:0.05,type:'square',out:sfxBus});" + beat, 4.6, False),
     ('ambience', "startAmbient()", 12.0, False)]
for k, v in render(J, '/workspace/audio/ref_old').items(): print(k, v)
