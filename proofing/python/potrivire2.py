"""V2: potrivire cu doua OCR-uri ale originalului (firma + Windows) si verdict pentru fiecare corectura.
Iesire: potrivire2.json {ID: {orig, bbox, firma:[rinduri], win:[rinduri], verdict, sF, sW, reteta}}"""
import csv, json, os, re, unicodedata, collections, sys
import pymupdf as fitz
from rapidfuzz import fuzz

sys.stdout.reconfigure(encoding='utf-8')
D = 'D:/work/retetar/proofing'
CSV = D + '/Retetar_corectura_aprobate.csv'
EXP = D + '/pdf exportat indesign/Retetar_general.pdf'
PRIMA_PAGINA = 104

src = open('potrivire.py', encoding='utf-8').read()
exec(src[src.index('def norm'):src.index('# --- original (OCR)')])   # norm, shingles, to_rows

def light(s):
    """normalizare care pastreaza diacriticele si punctuatia (pentru verdict)"""
    s = unicodedata.normalize('NFC', s).lower()
    s = s.replace('ş', 'ș').replace('ţ', 'ț').replace('ã', 'ă')
    s = re.sub(r'[„”“"«»]', '"', s)
    s = re.sub(r'[–—―-]', '-', s)
    s = s.replace('\xad', '')
    return re.sub(r'\s+', ' ', s).strip()

def load(folder):
    out = {}
    for fn in sorted(os.listdir(folder)):
        d = json.load(open(os.path.join(folder, fn), encoding='utf-8'))
        d['lines'] = to_rows(d)
        out[int(fn[1:5])] = d
    return out

F, W = load('ocr_firma'), load('ocr')

# --- mapare export -> original pe textul firmei (rezerva: Windows)
index = collections.defaultdict(set)
for src_ in (F, W):
    for p, d in src_.items():
        for sh in shingles(norm(' '.join(l['text'] for l in d['lines']))):
            index[sh].add(p)
exp = fitz.open(EXP)
etext = [exp[i].get_text() for i in range(exp.page_count)]
raw = {}
for i, t in enumerate(etext):
    hits = collections.Counter()
    for sh in shingles(norm(t)):
        ps = index.get(sh)
        if ps and len(ps) < 5:
            hits.update(ps)
    if hits and hits.most_common(1)[0][1] >= 3:
        raw[i + 1] = hits.most_common(1)[0][0]
pages = sorted(raw)
mapping = {}
for e in range(1, exp.page_count + 1):
    cands = [raw[p] for p in [p for p in pages if p <= e][-3:] + [p for p in pages if p >= e][:3]]
    mapping[e] = sorted(cands)[len(cands) // 2] if cands else None

# --- numerele retetelor din export: (pagina, pozitie in text, numar)
heads = []
for i, t in enumerate(etext):
    for mm in re.finditer(r'\n([^\n]+)\x08\n(\d+)\n', t):
        heads.append((i + 1, mm.start(), int(mm.group(2))))

def reteta(page, pos):
    best = None
    for h in heads:
        if (h[0], h[1]) <= (page, pos):
            best = h[2]
        else:
            break
    return best

# --- antetele retetelor in original: rind cu numarul retetei + titlu -> (pagina, y); ancora pentru fiecare corectura
hexp = {}
for p_, pos_, n_ in heads:
    hexp.setdefault(n_, p_)

def ytop(l):
    return min(w['y'] for w in l['words']) if l['words'] else 0

def hdr_pos(S):
    c = collections.defaultdict(list)
    for p, d in S.items():
        for l in d['lines']:
            seg = [s.strip() for s in l['text'].split('|')]
            if not 2 <= len(seg) <= 3:
                continue
            nums = [s for s in seg if re.fullmatch(r'\d{1,4}', s)]
            if len(nums) == 1 and any(re.search(r'[a-zăîâșț]{3}', s.lower()) for s in seg):
                c[int(nums[0])].append((p, ytop(l)))
    found = {}
    for n, ep in hexp.items():
        eo = mapping.get(ep)
        ok = [x for x in c.get(n, []) if eo and abs(x[0] - eo) <= 3]
        if ok:
            found[n] = min(ok, key=lambda x: abs(x[0] - eo))
    return found

HP = hdr_pos(W)
HP.update(hdr_pos(F))   # firma are prioritate
ks = sorted(HP)
bad = [ks[i] for i in range(1, len(ks) - 1)   # antetele care strica ordinea
       if not HP[ks[i - 1]] <= HP[ks[i]] <= HP[ks[i + 1]] and HP[ks[i - 1]] <= HP[ks[i + 1]]]
for k in bad:
    del HP[k]
ks = sorted(HP)

def span(r):
    """(pagina, y) de la antetul retetei r pina la antetul urmator gasit"""
    import bisect
    if r is None or not ks:
        return None
    i = bisect.bisect_right(ks, r)
    lo = HP[ks[i - 1]] if i else None
    hi = HP[ks[i]] if i < len(ks) else None
    if lo is None or hi is None or hi[0] - lo[0] > 6:
        return None
    return (lo[0], lo[1] - 25), (hi[0], hi[1] + 25)

def best_window(d, q, p=None, sp=None):
    lines = d['lines']
    if sp:
        keep = [sp[0] <= (p, ytop(l)) <= sp[1] for l in lines]
    nl = [norm(l['text']) if not sp or keep[i] else '' for i, l in enumerate(lines)]
    best = (0, 0, 0)
    for i in range(len(lines)):
        for k in (1, 2, 3):
            if i + k > len(lines):
                break
            t = ' '.join(nl[i:i + k])
            if not t:
                continue
            sc = fuzz.ratio(q, t) if len(t) < len(q) * 1.6 else fuzz.partial_ratio(q, t)
            if sc > best[0]:
                best = (sc, i, i + k)
    return best

NT = {}
def ctx_pages(e, q, m):
    """paginile originalului care contin textul din jurul rindului in export (nu doar rindul, care se poate repeta)"""
    if e not in NT:
        NT[e] = norm(etext[e - 1])
    nt = NT[e]
    al = fuzz.partial_ratio_alignment(q, nt) if q and nt else None
    seg = nt[max(0, al.dest_start - 350):al.dest_end + 350] if al and al.score >= 70 else nt
    hits = collections.Counter()
    for sh in shingles(seg):
        for p in index.get(sh, ()):
            if abs(p - m) <= 4:
                hits[p] += 1
    top = hits.most_common(2)
    if not top:
        return [m, m + 1, m - 1, m + 2]
    if len(top) > 1 and top[1][1] >= top[0][1] * 0.5:   # la granita dintre doua pagini
        return [top[0][0], top[1][0]]
    return [top[0][0]]

def locate(S, cands, q, sp=None):
    best = (0, None, 0, 0)
    if sp:
        cands = range(sp[0][0], sp[1][0] + 1)
    for p in cands:
        if p in S:
            sc, a, b = best_window(S[p], q, p, sp)
            if sc > best[0]:
                best = (sc, p, a, b)
    return best

def bbox(rows):
    ws = [w for r in rows for w in r['words']]
    if not ws:
        return None
    return [min(w['x'] for w in ws), min(w['y'] for w in ws),
            max(w['x'] + w['w'] for w in ws), max(w['y'] + w['h'] for w in ws)]

def judge(S, p, a, b, A, B):
    """cit de bine se potriveste originalul cu varianta corectata (A) fata de cea actuala (B)"""
    if p is None:
        return 0
    rows = S[p]['lines'][max(0, a - 1):b + 1]
    t = light(' '.join(r['text'] for r in rows))
    tn = t.replace(' ', '')
    return fuzz.partial_ratio(A.replace(' ', ''), tn) - fuzz.partial_ratio(B.replace(' ', ''), tn)

out = {}
for r in csv.DictReader(open(CSV, encoding='utf-8-sig'), delimiter=';'):
    e = int(r['Pagina'])
    if e < PRIMA_PAGINA:
        continue
    q = norm(r['Rand_complet'] or (r['Context_inainte'] + ' ' + r['Cauta'] + ' ' + r['Context_dupa']))
    m = mapping.get(e)
    rc = r['Rand_complet']
    pos = etext[e - 1].find(rc[:30]) if rc else -1
    if pos < 0 and rc:
        al = fuzz.partial_ratio_alignment(rc, etext[e - 1])
        pos = al.dest_start if al.score >= 80 else -1
    ret = reteta(e, max(pos, 0)) if e >= 124 else None
    sp = span(ret) if pos >= 0 else None
    cands = ctx_pages(e, q, m) if m else []
    sF, pF, aF, bF = locate(F, cands, q, sp)
    sW, pW, aW, bW = locate(W, cands, q, sp)
    if sp and max(sF, sW) < 70:   # ancora retetei nu a ajutat
        sF, pF, aF, bF = locate(F, cands, q)
        sW, pW, aW, bW = locate(W, cands, q)
    p = pF if sF >= sW else pW
    if pF != p: sF, aF, bF = 0, 0, 0
    if pW != p: sW, aW, bW = 0, 0, 0
    ctxb, ctxa = r['Context_inainte'][-25:], r['Context_dupa'][:25]
    A = light(ctxb + ' ' + r['Inlocuieste'] + ' ' + ctxa)
    B = light(ctxb + ' ' + r['Cauta'] + ' ' + ctxa)
    if r['Cauta'] == r['Inlocuieste']:
        verdict = 'observatie'
        dF = dW = 0
    else:
        dF = judge(F, pF, aF, bF, A, B) if sF >= 70 else 0
        dW = judge(W, pW, aW, bW, A, B) if sW >= 70 else 0
        # OCR-ul Windows e singura sursa independenta de textul din InDesign (care provine din OCR-ul firmei)
        if dW > 0 or (dW == 0 and dF > 0):
            verdict = 'confirmat'
        elif dW < 0 and dF <= 0:
            verdict = 'carte=actual'
        else:
            verdict = 'neclar'
    # unde a aparut greseala: deja in OCR-ul firmei sau mai tirziu (corectura / Word)
    origine = ('ocr firma' if dF < 0 or (dF == 0 and dW > 0) else 'dupa ocr') if verdict == 'confirmat' else ''
    hitF = F[p]['lines'][aF:bF] if sF else []
    hitW = W[p]['lines'][aW:bW] if sW else []
    out[r['ID']] = {
        'orig': p, 'sF': round(sF), 'sW': round(sW), 'dF': dF, 'dW': dW, 'verdict': verdict, 'origine': origine,
        'bbox': bbox(hitF if sF >= sW else hitW), 'w': (F.get(p) or W.get(p) or {}).get('w'), 'h': (F.get(p) or W.get(p) or {}).get('h'),
        'firma': [l['text'] for l in F[p]['lines'][max(0, aF - 3):bF + 3]] if sF else [],
        'win': [l['text'] for l in W[p]['lines'][max(0, aW - 3):bW + 3]] if sW else [],
        'reteta': ret, 'ancora': bool(sp),
    }

json.dump(out, open('potrivire2.json', 'w', encoding='utf-8'), ensure_ascii=False)
c = collections.Counter(v['verdict'] for v in out.values())
print(len(out), dict(c))
print('gasite slab (<70 la ambele):', sum(1 for v in out.values() if max(v['sF'], v['sW']) < 70))
