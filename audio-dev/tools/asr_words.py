import sys, subprocess, numpy as np
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[1], device="cpu", compute_type="float32")
for f in sys.argv[2:]:
    a = np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',f,'-f','f32le','-ac','1','-ar','16000','-'],capture_output=True).stdout, np.float32)
    segs, _ = m.transcribe(np.pad(a, (8000, 8000)).astype(np.float32), beam_size=3, language='en', word_timestamps=True)
    out = []
    for s in segs:
        for w in s.words: out.append(f"{w.word.strip()}@{w.start-0.5:.2f}-{w.end-0.5:.2f}")
    print(f.split('/')[-1], '|', ' '.join(out), flush=True)
