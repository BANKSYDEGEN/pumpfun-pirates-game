# Synthesize + process emote lines. Base: Piper libritts_r (CC BY 4.0) speakers, then pitch/formant shift, growl,
# saturation, shout EQ, compression -> an original character voice that is not any one reader's voice.
import wave, numpy as np, subprocess, os, sys
from piper import PiperVoice, SynthesisConfig
V=PiperVoice.load("/workspace/audio/raw/piper/en_US-libritts_r-medium.onnx")
OUT="/workspace/audio/voices/work"; os.makedirs(OUT,exist_ok=True)
def tts(text, sid, ls, fn, ns=0.75, nw=0.9):
    with wave.open(fn,"wb") as w: V.synthesize_wav(text,w,syn_config=SynthesisConfig(speaker_id=sid,length_scale=ls,noise_scale=ns,noise_w_scale=nw))
def ff(*a): subprocess.run(["ffmpeg","-v","error","-y",*a],check=True)
def rd(fn):
    out=subprocess.run(["ffmpeg","-v","error","-i",fn,"-f","f32le","-ac","1","-ar","48000","-"],capture_output=True).stdout
    return np.frombuffer(out,np.float32).copy()
def wr(fn,x,sr=48000):
    p=subprocess.Popen(["ffmpeg","-v","error","-y","-f","f32le","-ar",str(sr),"-ac","1","-i","-",fn],stdin=subprocess.PIPE); p.communicate(x.astype(np.float32).tobytes())
def growl(x, amt, f=38, sr=48000):
    # vocal-fry style subharmonic roughness: amplitude modulation following the voice envelope
    t=np.arange(len(x))/sr; jitter=np.cumsum(np.random.randn(len(x)))*0.0006
    ph=2*np.pi*f*t+jitter
    m=1-amt*(0.5+0.5*np.sin(ph))**3   # smooth fry pulses, no clicks
    return x*m
def make(name, text, sid, ls, pitch, formant, gr, drive, eq, tempo=1.0):
    raw=f"{OUT}/{name}_raw.wav"; tts(text,sid,ls,raw)
    sh=f"{OUT}/{name}_sh.wav"
    ff("-i",raw,"-af",f"aresample=48000,rubberband=pitch={pitch}:tempo={tempo}:formant={formant}:transients=mixed",sh)
    x=rd(sh); x=x/ (np.max(np.abs(x))+1e-9)
    x=growl(x,gr)
    x=np.tanh(x*drive)/np.tanh(drive)
    pr=f"{OUT}/{name}_pr.wav"; wr(pr,x)
    # shout EQ + compression + short wooden-deck room + trim silence + level
    tmp=f"{OUT}/{name}_fx.wav"
    ff("-i",pr,"-af",
       f"highpass=f=90,lowpass=f=10500,{eq},acompressor=threshold=-20dB:ratio=4:attack=3:release=80:makeup=4,"
       "aecho=0.8:0.25:18|37:0.18|0.10,"
       "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse",
       tmp)
    y=rd(tmp); n=len(y); fi=int(0.004*48000); fo=int(0.06*48000)
    y[:fi]*=np.linspace(0,1,fi); y[-fo:]*=np.linspace(1,0,fo)**2
    y=np.concatenate([np.zeros(480),y,np.zeros(int(0.1*48000))])
    y=y/np.max(np.abs(y))*10**(-1.5/20)
    wr(f"{OUT}/{name}.wav",y)
if __name__=="__main__":
    np.random.seed(7)
    MEQ="equalizer=f=160:t=q:w=1:g=2,equalizer=f=2400:t=q:w=1.2:g=3.5,equalizer=f=7000:t=q:w=1:g=-3"
    FEQ="equalizer=f=250:t=q:w=1:g=1,equalizer=f=3200:t=q:w=1.2:g=3,equalizer=f=8500:t=q:w=1:g=-2"
    # MALE: gravelly old salt (base speaker 690, pitched + formant-shifted down, fry growl, saturation)
    make("arr_male","Arrr!",690,1.6,0.88,"shifted",0.16,1.7,MEQ,0.8)
    make("fire_male","Fire!",690,1.0,0.9,"shifted",0.12,1.6,MEQ)
    # FEMALE: fierce captain (base speaker 529, slight pitch up for shout energy, light grit)
    make("arr_female","Arrr!",529,1.6,1.03,"preserved",0.06,1.5,FEQ,0.9)
    make("fire_female","Fire!",529,1.0,1.05,"preserved",0.05,1.5,FEQ)
