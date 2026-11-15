"""Leaga paginile din PDF-ul exportat de paginile din original (OCR) si gaseste,
pentru fiecare intrare din CSV, pasajul corespunzator din original.
Iesire: potrivire.json  {ID: {orig_page, score, lines:[...], bbox:[x0,y0,x1,y1], w, h}}"""
import csv, json, os, re, unicodedata, collections, sys
import pymupdf as fitz
from rapidfuzz import fuzz

sys.stdout.reconfigure(encoding='utf-8')
D = 'D:/work/retetar/proofing'
HERE = os.path.dirname(os.path.abspath(__file__))
CSV = D + '/Retetar_corectura_aprobate.csv'
EXP = D + '/pdf exportat indesign/Retetar_general.pdf'

def norm(s):
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    return ' '.join(s.split())

def shingles(s, n=3):
    w = s.split()
    return {' '.join(w[i:i + n]) for i in range(len(w) - n + 1)}

def to_rows(d):
    """regrupeaza cuvintele OCR in rinduri vizuale (dupa y), ca tabelele sa se citeasca pe rind"""
    ws = sorted((w for l in d['lines'] for w in l['words']), key=lambda w: w['y'] + w['h'] / 2)
    rows, cur = [], []
    for w in ws:
        c = w['y'] + w['h'] / 2
        if cur and abs(c - sum(x['y'] + x['h'] / 2 for x in cur) / len(cur)) > 14:
            rows.append(cur); cur = []
        cur.append(w)
    if cur:
        rows.append(cur)
    out = []
    for r in rows:
        r.sort(key=lambda w: w['x'])
        txt, prev = '', None
        for w in r:
            if prev is not None:
                txt += '  |  ' if w['x'] - (prev['x'] + prev['w']) > 60 else ' '
            txt += w['t']; prev = w
        out.append({'text': txt, 'words': r})
    return out

# --- original (OCR)
orig = {}
for fn in sorted(os.listdir(os.path.join(HERE, 'ocr'))):
    p = int(fn[1:5])
    d = json.load(open(os.path.join(HERE, 'ocr', fn), encoding='utf-8'))
    d['lines'] = to_rows(d)
    orig[p] = d
index = collections.defaultdict(set)
for p, d in orig.items():
    for sh in shingles(norm(' '.join(l['text'] for l in d['lines']))):
        index[sh].add(p)

# --- export -> original, cea mai buna pagina dupa shingle-uri comune, apoi netezire monotona
exp = fitz.open(EXP)
raw = {}
for i in range(exp.page_count):
    hits = collections.Counter()
    for sh in shingles(norm(exp[i].get_text())):
        ps = index.get(sh)
        if ps and len(ps) < 5:
            hits.update(ps)
    if hits:
        best, n = hits.most_common(1)[0]
        if n >= 3:
            raw[i + 1] = best
pages = sorted(raw)
mapping = {}
for e in range(1, exp.page_count + 1):
    before = [p for p in pages if p <= e][-3:]
    after = [p for p in pages if p >= e][:3]
    cands = [raw[p] for p in before + after]
    mapping[e] = sorted(cands)[len(cands) // 2] if cands else None
json.dump({'raw': raw, 'map': mapping}, open(os.path.join(HERE, 'mapare_pagini.json'), 'w'), indent=0)

# --- intrari
def best_window(p, q):
    """cel mai bun grup de 1-3 rinduri din pagina p pentru interogarea q"""
    lines = orig[p]['lines']
    nl = [norm(l['text']) for l in lines]
    best = (0, 0, 0)
    for i in range(len(lines)):
        for k in (1, 2, 3):
            if i + k > len(lines):
                break
            t = ' '.join(nl[i:i + k]).replace(' ', ' ')
            if not t:
                continue
            sc = fuzz.ratio(q, t) if len(t) < len(q) * 1.6 else fuzz.partial_ratio(q, t)
            if sc > best[0]:
                best = (sc, i, i + k)
    return best

out = {}
rows = list(csv.DictReader(open(CSV, encoding='utf-8-sig'), delimiter=';'))
for r in rows:
    e = int(r['Pagina'])
    q = norm(r['Rand_complet'] or (r['Context_inainte'] + ' ' + r['Cauta'] + ' ' + r['Context_dupa']))
    if not q:
        continue
    m = mapping.get(e)
    cands = [p for p in ({m - 1, m, m + 1, m + 2} if m else set()) if p in orig]
    best = (0, None, 0, 0)
    for p in cands:
        sc, a, b = best_window(p, q)
        if sc > best[0]:
            best = (sc, p, a, b)
    sc, p, a, b = best
    if p is None:
        out[r['ID']] = {'orig_page': m, 'score': 0}
        continue
    lines = orig[p]['lines']
    ctx = lines[max(0, a - 3):b + 3]
    ws = [w for l in ctx for w in l['words']]
    bbox = [min(w['x'] for w in ws), min(w['y'] for w in ws),
            max(w['x'] + w['w'] for w in ws), max(w['y'] + w['h'] for w in ws)] if ws else None
    out[r['ID']] = {'orig_page': p, 'score': round(sc), 'hit': [l['text'] for l in lines[a:b]],
                    'ctx': [l['text'] for l in ctx], 'bbox': bbox, 'w': orig[p]['w'], 'h': orig[p]['h']}

json.dump(out, open(os.path.join(HERE, 'potrivire.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
sc = [v['score'] for v in out.values()]
print('intrari', len(out), 'scor>=85:', sum(s >= 85 for s in sc), '70-84:', sum(70 <= s < 85 for s in sc), '<70:', sum(s < 70 for s in sc))
print('pagini export mapate direct', len(raw), 'din', exp.page_count)
