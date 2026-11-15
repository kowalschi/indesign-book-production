"""Exportul pe documente (pdf separat/retetar-0N.pdf) fata de exportul vechi intreg: cuvinte unul pe rind + git diff,
apoi harta pagina veche -> (document, pagina noua) din cuvintele neschimbate. Iesire: cmp_sep_*.txt, harta_pagini.json"""
import pymupdf as fitz, re, sys, json, subprocess, collections
sys.stdout.reconfigure(encoding='utf-8')
D = 'D:/work/retetar/proofing'
def words(doc, i):
    t = doc[i].get_text().replace('\xad\n', '').replace('\xad', '')
    t = re.sub(r'-\n(?=[a-zăîâșțşţ])', '', t)
    return t.split()
def tok(fns, out):
    pages = []
    with open(out, 'w', encoding='utf-8') as f:
        for di, fn in enumerate(fns):
            doc = fitz.open(fn)
            for i in range(doc.page_count):
                for w in words(doc, i):
                    f.write(w + '\n'); pages.append([di, i + 1])
    return pages
pv = [[0, p] for d, p in tok([D + '/pdf exportat indesign/Retetar_general.pdf'], 'cmp_sep_vechi.txt')]
pn = tok([D + '/pdf separat/retetar-0%d.pdf' % k for k in range(3)], 'cmp_sep_nou.txt')
diff = subprocess.run(['git', 'diff', '--no-index', '-U0', '--diff-algorithm=histogram', 'cmp_sep_vechi.txt', 'cmp_sep_nou.txt'],
                      capture_output=True).stdout.decode('utf-8')
open('cmp_sep.diff', 'w', encoding='utf-8').write(diff)
# cuvintele neschimbate: perechi (index vechi, index nou)
hunks = [(int(m[1]), int(m[2] or 1), int(m[3]), int(m[4] or 1))
         for m in re.finditer(r'^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@', diff, re.M)]
vot = collections.defaultdict(collections.Counter)
io = inn = 0
def egal(n):
    global io, inn
    for _ in range(n):
        vot[pv[io][1]][tuple(pn[inn])] += 1; io += 1; inn += 1
for a, b, c, d in hunks:
    sa = a - 1 if b else a; sc = c - 1 if d else c
    egal(sa - io)
    io += b; inn += d
egal(len(pv) - io)
harta = {p: list(c.most_common(1)[0][0]) for p, c in vot.items()}
json.dump({'harta': harta, 'nou': pn, 'vechi': [p for _, p in pv]}, open('harta_pagini.json', 'w'))
lips = [p for p in range(1, 2008) if p not in harta]
print('pagini vechi legate', len(harta), 'fara pereche', len(lips), 'ex.', lips[:5], lips[-5:])
ex = [3, 4, 105, 106, 125, 126, 200, 800, 1000, 1500, 2007]
print({p: harta.get(p) for p in ex})
