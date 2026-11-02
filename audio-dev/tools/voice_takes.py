import wave, numpy as np, json, sys
from piper import PiperVoice, SynthesisConfig
M="/workspace/audio/raw/piper/en_US-libritts_r-medium.onnx"
v=PiperVoice.load(M)
def f0(x, sr):
    # median voiced F0 via frame autocorrelation
    fr=int(0.04*sr); hop=fr//2; out=[]
    for i in range(0,len(x)-fr,hop):
        s=x[i:i+fr]*np.hanning(fr)
        if np.sqrt(np.mean(s**2))<0.02: continue
        ac=np.correlate(s,s,'full')[fr-1:]; lo,hi=int(sr/400),int(sr/70)
        k=lo+np.argmax(ac[lo:hi]);
        if ac[k]/ac[0]>0.45: out.append(sr/k)
    return float(np.median(out)) if out else 0
res=[]
texts={"arr":"Arrrr!","fire":"Fire!"}
for sid in range(0,904,23):
    row={"sid":sid}
    for k,t in texts.items():
        fn=f"/workspace/audio/voices/takes/{k}_{sid}.wav"
        with wave.open(fn,"wb") as w:
            v.synthesize_wav(t,w,syn_config=SynthesisConfig(speaker_id=sid,length_scale=1.0,noise_scale=0.8,noise_w_scale=0.9))
        with wave.open(fn) as w: sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),np.int16)/32768
        row[k]=(round(len(x)/sr,2), round(f0(x,sr)))
    res.append(row); print(row, flush=True)
json.dump(res,open("/workspace/audio/voices/takes/scan.json","w"))
