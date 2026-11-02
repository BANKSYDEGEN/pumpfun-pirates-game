# compare two probe dumps: every config's muzzles (port/star positions) and hitbox fields must be identical
import json, sys
a, b = json.load(open(sys.argv[1])), json.load(open(sys.argv[2])); ks = [k for k in a if not k.startswith('__')]
diff = [k for k in ks if json.dumps(a[k], sort_keys=True) != json.dumps(b.get(k), sort_keys=True)]
n = sum(len(a[k]['port']) + len(a[k]['star']) for k in ks)
print(json.dumps({'configs': len(ks), 'muzzles': n, 'differ': len(diff), 'first': diff[:5]}))
