# fetch specific Freesound IDs (user/id pairs) if CC0 or CC-BY
import sys, os, json, time; sys.path.insert(0, '/workspace/audio/tools'); import fs_fetch as F
tag = sys.argv[1]
for a in sys.argv[2:]:
    user, sid = a.split('/')
    d = F.info(user, sid); ok = bool(d['license']) and ('publicdomain/zero' in d['license'] or '/licenses/by/' in d['license'])
    print('OK ' if ok else 'SKIP', sid, user, d['license'], d['title'][:80], flush=True)
    if not ok or not d['preview']: continue
    fn = f"{F.RAW}/{tag}_{sid}.mp3"
    if not os.path.exists(fn): os.system(f'curl -s --max-time 40 -o "{fn}" "{d["preview"]}"')
    d.update(tag=tag, file=fn, query='by-id'); open(F.LOG, 'a').write(json.dumps(d) + '\n'); time.sleep(0.3)
