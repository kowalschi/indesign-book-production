import json, sys, re, collections
sys.stdout.reconfigure(encoding='utf-8')
src = open('potrivire2.py', encoding='utf-8').read()
exec(src[:src.index('out = {}\nfor r in csv')])
# export: pagina antetului fiecarei retete
hexp = {}
for p, pos, n in heads:
    hexp.setdefault(n, p)
def hdr_cands(S):
    c = collections.defaultdict(list)
    for p, d in S.items():
        for i, l in enumerate(d['lines']):
            seg = [s.strip() for s in l['text'].split('|')]
            if not 2 <= len(seg) <= 3: continue
            nums = [s for s in seg if re.fullmatch(r'\d{1,4}', s)]
            txt = [s for s in seg if re.search(r'[a-zăîâșț]{3}', s.lower())]
            if len(nums) == 1 and txt:
                c[int(nums[0])].append((p, i))
    return c
for name, S in (('F', F), ('W', W)):
    c = hdr_cands(S)
    found = {}
    for n, ep in hexp.items():
        exp_o = mapping.get(ep)
        ok = [x for x in c.get(n, []) if exp_o and abs(x[0] - exp_o) <= 3]
        if ok: found[n] = min(ok, key=lambda x: abs(x[0] - exp_o))
    print(name, 'retete', len(hexp), 'gasite', len(found))
    if name == 'F': fF = found
    else: fW = found
both = set(fF) | set(fW)
print('oricare', len(both), [n for n in sorted(hexp) if n not in both][:60])
print(fF.get(1072), fF.get(1073), fF.get(906))
