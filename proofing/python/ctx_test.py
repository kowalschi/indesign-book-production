import csv, json, collections, sys, re
sys.stdout.reconfigure(encoding='utf-8')
src = open('potrivire2.py', encoding='utf-8').read()
# reuse everything up to the main loop
exec(src[:src.index('out = {}\nfor r in csv')])
def ctx_page(e, pos, m):
    t = etext[e - 1]
    seg = t[max(0, pos - 400):pos + 400] if pos >= 0 else t
    hits = collections.Counter()
    for sh in shingles(norm(seg)):
        for p in index.get(sh, ()):
            if m and abs(p - m) <= 4: hits[p] += 1
    return hits.most_common(2)
old = json.load(open('potrivire2.json', encoding='utf-8'))
diff = []
for r in csv.DictReader(open(CSV, encoding='utf-8-sig'), delimiter=';'):
    e = int(r['Pagina'])
    if e < PRIMA_PAGINA: continue
    pos = etext[e - 1].find(r['Rand_complet'][:30]) if r['Rand_complet'] else -1
    hc = ctx_page(e, pos, mapping.get(e))
    o = old[r['ID']]['orig']
    if hc and hc[0][0] != o:
        diff.append((r['ID'], e, o, hc, pos, max(old[r['ID']]['sF'], old[r['ID']]['sW']), r['Rand_complet'][:50]))
print(len(diff))
for d in diff[:40]: print(d)
