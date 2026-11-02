import wave, numpy as np, subprocess
from piper import PiperVoice, SynthesisConfig
from faster_whisper import WhisperModel
V=PiperVoice.load("/workspace/audio/raw/piper/en_US-libritts_r-medium.onnx")
W=WhisperModel("base.en",device="cpu",compute_type="int8")
def asr(fn):
    a=np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',fn,'-f','f32le','-ac','1','-ar','16000','-'],capture_output=True).stdout,np.float32)
    s,_=W.transcribe(np.pad(a,(8000,8000)),beam_size=5,language='en'); return " ".join(x.text for x in s).strip()
for sex,sids in (("f",[0,23,115,138,161,322,529,207,414]),("m",[736,575,483,690,460,437,506,552,253])):
    for sid in sids:
        for t,ls in (("Fire!",1.0),("Fire!",1.3),("Arrr!",1.6),("Yarr!",1.4)):
            fn=f"/workspace/audio/voices/takes/s2_{sex}{sid}_{t.strip('!')}_{ls}.wav"
            with wave.open(fn,"wb") as w: V.synthesize_wav(t,w,syn_config=SynthesisConfig(speaker_id=sid,length_scale=ls,noise_scale=0.7,noise_w_scale=0.8))
            print(sex,sid,t,ls,"->",asr(fn),flush=True)
