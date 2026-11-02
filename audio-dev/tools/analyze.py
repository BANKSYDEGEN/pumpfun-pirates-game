import sys, subprocess, numpy as np, json
def rd(fn, sr=48000):
    out=subprocess.run(["ffmpeg","-v","error","-i",fn,"-f","f32le","-ac","1","-ar",str(sr),"-"],capture_output=True).stdout
    return np.frombuffer(out,np.float32)
for fn in sys.argv[1:]:
    x=rd(fn); sr=48000
    if len(x)==0: print(fn,"EMPTY"); continue
    fr=int(0.01*sr); e=np.array([np.sqrt(np.mean(x[i:i+fr]**2)+1e-12) for i in range(0,len(x)-fr,fr)])
    db=20*np.log10(e); floor=np.percentile(db,10); pk=db.max()
    # count onsets: rises > 15 dB within 30 ms above floor+20
    on=[i for i in range(3,len(db)) if db[i]-db[i-3]>15 and db[i]>floor+20]
    ons=[]; 
    for i in on:
        if not ons or i-ons[-1]>30: ons.append(i)
    X=np.abs(np.fft.rfft(x[:sr*3] if len(x)>sr*3 else x)); f=np.fft.rfftfreq(min(len(x),sr*3),1/sr)
    cen=float((X*f).sum()/X.sum())
    lowr=float(X[f<200].sum()/X.sum())
    print(f"{fn.split('/')[-1]:28s} dur={len(x)/sr:6.2f}s peak={20*np.log10(np.abs(x).max()):6.1f} floor={floor:6.1f} onsets={[round(o/100,2) for o in ons][:8]} cen={cen:6.0f} low<200={lowr:.2f}")
