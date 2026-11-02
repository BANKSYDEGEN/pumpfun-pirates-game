import sys, glob, subprocess, numpy as np
from faster_whisper import WhisperModel
m=WhisperModel(sys.argv.pop(1) if sys.argv[1].endswith(".en") else "base.en",device="cpu",compute_type="int8")
for f in sys.argv[1:]:
    a=np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',f,'-f','f32le','-ac','1','-ar','16000','-'],capture_output=True).stdout,np.float32)
    segs,_=m.transcribe(np.pad(a,(16000,16000)),beam_size=5,language='en')
    print(f, "|", " ".join(s.text for s in segs), flush=True)
