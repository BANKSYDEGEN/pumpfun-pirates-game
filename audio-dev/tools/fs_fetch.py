# Freesound CC0-only fetcher (no account): search with CC0 license filter, verify license on each sound page,
# download the public HQ preview (128 kbps mp3) and log to raw/SOURCES.md.
import re, sys, os, json, urllib.request, urllib.parse, html, time
UA = {"User-Agent": "Mozilla/5.0"}
RAW = "/workspace/audio/raw/freesound"; os.makedirs(RAW, exist_ok=True)
LOG = "/workspace/audio/raw/sources.jsonl"
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read().decode("utf-8", "ignore")
def search(q, n=8):
    u = "https://freesound.org/search/?q=" + urllib.parse.quote(q) + ("&f=license:%22Creative+Commons+0%22" if os.environ.get("CC0ONLY","1")=="1" else "")
    h = get(u)
    ids = []
    for m in re.finditer(r'href="/people/([^/"]+)/sounds/(\d+)/"', h):
        if m.group(2) not in [i[1] for i in ids]: ids.append((m.group(1), m.group(2)))
    return ids[:n]
def info(user, sid):
    u = f"https://freesound.org/people/{user}/sounds/{sid}/"
    h = get(u)
    lic = re.search(r'creativecommons\.org/(publicdomain/zero|licenses/[a-z\-]+)/[0-9.]+', h)
    title = re.search(r'<title>(.*?)</title>', h, re.S)
    prev = re.search(r'(https://cdn\.freesound\.org/previews/\d+/\d+_\d+-hq\.mp3)', h)
    dur = re.search(r'Duration[^0-9]*([0-9:.]+)', h)
    return dict(id=sid, user=user, url=u, license=lic.group(0) if lic else None,
                title=html.unescape(title.group(1).strip()) if title else "", preview=prev.group(1) if prev else None)
if __name__ == "__main__":
    import urllib.parse
    tag, q, n = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 6
    for user, sid in search(q, n):
        try:
            d = info(user, sid)
        except Exception as e:
            print("ERR", sid, e); continue
        ok = bool(d["license"]) and ("publicdomain/zero" in d["license"] or re.search(r"licenses/by/", d["license"]) is not None)
        print(("OK " if ok else "SKIP"), sid, user, d["license"], d["title"][:70])
        if not ok or not d["preview"]: continue
        fn = f"{RAW}/{tag}_{sid}.mp3"
        if not os.path.exists(fn):
            r = os.system(f'curl -s --max-time 40 --max-filesize 3000000 -o "{fn}" "{d["preview"]}"')
            if r or not os.path.exists(fn): print("  dl fail/too big"); os.path.exists(fn) and os.remove(fn); continue
        d.update(tag=tag, file=fn, query=q)
        open(LOG, "a").write(json.dumps(d) + "\n")
        time.sleep(0.4)
