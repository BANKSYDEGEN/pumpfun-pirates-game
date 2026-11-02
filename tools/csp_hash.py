#!/usr/bin/env python3
"""[security M4] Re-pin the CSP after editing an inline <script type="importmap">.
Usage: python3 tools/csp_hash.py [--write] index.html island.html
Prints each page's importmap sha256; --write updates the 'sha256-…' in that page's CSP <meta>."""
import base64, hashlib, re, sys
write = '--write' in sys.argv
for p in [a for a in sys.argv[1:] if not a.startswith('--')] or ['index.html', 'island.html']:
    s = open(p, encoding='utf-8').read()
    m = re.search(r'<script type="importmap">(.*?)</script>', s, re.S)
    if not m: print(p, 'no importmap'); continue
    h = base64.b64encode(hashlib.sha256(m.group(1).encode('utf-8')).digest()).decode()
    cur = re.search(r"script-src 'self' 'sha256-([^']+)'", s)
    ok = cur and cur.group(1) == h
    print(f"{p}: sha256-{h} {'OK' if ok else 'MISMATCH'}")
    if write and not ok and cur:
        open(p, 'w', encoding='utf-8').write(s.replace(cur.group(0), f"script-src 'self' 'sha256-{h}'"))
        print('  updated')
