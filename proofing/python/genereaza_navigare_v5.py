"""Date pentru indesign/navigare_v5.jsx din corecturi_v5.csv (lotul v5, pe retetar-01-02.indd = PDF retetar-01-02_v4.pdf).
- pagina din CSV = pagina din PDF = pagina din .indd
- pagina din original: maparea pagina PDF v4 -> pagina originalului pe textul OCR (ca in potrivire2.py)
- 'k': a cita aparitie a textului pe pagina (in ordinea textului din PDF) e cea vizata, aleasa dupa antetul retetei
  si dupa context; panoul o foloseste cind numara acelasi numar de aparitii pe pagina in InDesign.
Iesire: indesign/v5_date.jsx"""
import csv, json, os, re, collections, sys, unicodedata
import pymupdf
sys.stdout.reconfigure(encoding='utf-8')
D = 'D:/work/retetar/proofing'
PDF = 'D:/work/retetar/retetar-01-02_v4.pdf'

src = open('potrivire.py', encoding='utf-8').read()
exec(src[src.index('def norm'):src.index('# --- original (OCR)')])   # norm, shingles, to_rows

# textul din CSV poate diferi de PDF; inlocuiri verificate pe PDF (cuvint despartit "li-/se", fraza reformulata)
CAUTA = {'v5-024': 'tabla de materii', 'v5-098': 'scoțîndu-li', 'v5-122': 'lăsîndu-li'}
NOTA = {'v5-024': 'Fraza din CSV nu mai e in text; pe pagina e „titlul cu tabla de materii”. ',
        'v5-098': 'In PDF apare „scoțîndu-li-/se” la capat de rind: poate fi deja corect (li-se) - verifica. ',
        'v5-122': 'In PDF apare „lăsîndu-li-/se” la capat de rind: poate fi deja corect (li-se) - verifica. '}

# ---------- PDF v4
doc = pymupdf.open(PDF)
raw = [p.get_text() for p in doc]
def curat(s):
    s = s.replace('\xad', '').replace('\x08', ' ')
    s = re.sub(r'(\w)-\s*\n\s*(\w)', r'\1-\2', s)
    return re.sub(r'\s+', ' ', s)
txt = [curat(t) for t in raw]
def antete(i):   # pozitiile (in txt) ale antetelor de reteta de pe pagina i: [(pozitie, numar)]
    out = []
    for m in re.finditer(r'(?:^|\n)([^\n]*)\x08\s*\n(\d+)(?: ?(/\d+| bis))?\n', raw[i]):
        nr = m.group(2) + (m.group(3) or '').replace(' ', '')
        pre = curat(raw[i][:m.start(1)])   # antetul incepe cu titlul retetei (rindul dinaintea numarului)
        out.append((len(pre), nr, len(pre) + len(curat(m.group(1)))))
    return out

def regex(t):   # la fel ca grep() din navigare_v5.jsx
    p = re.escape(t).replace(r'\ ', r'\s+')
    if re.match(r'\d', t): p = r'(?<![\d,.])' + p
    if re.search(r'\d$', t): p = p + r'(?![\d,])'
    if re.search(r'\w$', t) and not re.search(r'\d$', t): p = p + r'(?!\w)'   # cuvint intreg la capat
    return p
# rindul de tabel complet dupa denumire: cantitate, unitate, cantitate
RIND_PLIN = re.compile(r'\s*\d[\d,/]*\s+\S+\s+\d[\d,/]*(\s|$)')

def comun(a, b, din_capat):
    a, b = re.sub(r'\s+', ' ', a).strip().lower(), re.sub(r'\s+', ' ', b).strip().lower()
    n = 0
    while n < min(len(a), len(b)) and (a[-1 - n] == b[-1 - n] if din_capat else a[n] == b[n]):
        n += 1
    return n

# ---------- maparea pagina v4 -> original (shingles pe OCR-ul firmei si Windows)
def load(folder):
    out = {}
    for fn in sorted(os.listdir(folder)):
        d = json.load(open(os.path.join(folder, fn), encoding='utf-8'))
        out[int(fn[1:5])] = ' '.join(l['text'] for l in to_rows(d))
    return out
index = collections.defaultdict(set)
for S in (load('ocr_firma'), load('ocr')):
    for p, t in S.items():
        for sh in shingles(norm(t)):
            index[sh].add(p)
brut = {}
for i, t in enumerate(raw):
    hits = collections.Counter()
    for sh in shingles(norm(t)):
        ps = index.get(sh)
        if ps and len(ps) < 5:
            hits.update(ps)
    if hits and hits.most_common(1)[0][1] >= 3:
        brut[i + 1] = hits.most_common(1)[0][0]
ps = sorted(brut)
def original(e):
    cands = [brut[p] for p in [p for p in ps if p <= e][-3:] + [p for p in ps if p >= e][:3]]
    return sorted(cands)[len(cands) // 2] if cands else None

# ---------- pagina originalului a retetelor din lotul 1 (date.js): corecteaza maparea cind difera cu peste 2 pagini
data = json.loads(open('date.js', encoding='utf-8').read()[len('window.DATE = '):].rstrip().rstrip(';'))
ro = collections.defaultdict(list)
for x in data:
    if x.get('ret'): ro[str(x['ret'])].append(x['orig'])

# ---------- intrarile
out, prob = [], collections.Counter()
for r in csv.DictReader(open(D + '/corecturi_v5.csv', encoding='utf-8-sig'), delimiter=';'):
    i, p = r['ID'], int(r['Pagina'])
    t = CAUTA.get(i, r['Text_cautat'].strip())
    cb, ca = r['Context_inainte'], r['Context_dupa']
    k, n = -1, 0
    if t:
        occ = [m.start() for m in re.finditer(regex(t), txt[p - 1])]
        n = len(occ)
        if n > 1:
            ant = antete(p - 1)
            ret = r['Reteta'].replace(' ', '').split(',')[0]
            def zona(pos):   # 1 daca aparitia e in reteta din CSV (dupa antetul ei, inaintea urmatorului)
                cur = None
                for a, nr, _ in ant:
                    if a <= pos: cur = nr
                if cur is None:   # inceputul paginii continua reteta de pe pagina anterioara
                    return 1 if ret and all(nr != ret for _, nr, _ in ant) else 0
                return 1 if cur == ret else 0
            # la tabele, aparitia din titlul retetei nu e cea vizata
            titlu = lambda pos: r['Tip'].startswith('Tabel') and any(a <= pos < b for a, _, b in ant)
            # celula goala: rindul de dupa denumire nu e complet (semnul cel mai sigur, peste numarul retetei)
            gol = lambda pos: r['Tip'] == 'Tabel – celulă goală' and not RIND_PLIN.match(txt[p - 1][pos + len(t):])
            sc = [100 * zona(pos) - 50 * titlu(pos) + 150 * gol(pos) + comun(txt[p - 1][max(0, pos - 40):pos], cb, True)
                  + comun(txt[p - 1][pos + len(t):pos + len(t) + 40], ca, False) for pos in occ]
            best = max(sc)
            k = sc.index(best)   # la egalitate: prima aparitie din reteta
            if sc.count(best) > 1:
                prob['aparitii la egalitate (aleasa prima)'] += 1
                print('egal', i, p, r['Reteta'], t, n, '-> k', k)
        elif n == 0:
            prob['negasit'] += 1
    o = original(p) if r['Reteta'] else None
    rr = r['Reteta'].split('/')[0].split(',')[0].strip()
    if o and rr in ro and min(abs(o - q) for q in ro[rr]) > 2:
        print('original corectat', i, 'ret', rr, o, '->', min(ro[rr]))
        o = min(ro[rr])
    e = {'id': i, 'doc': 0, 'dp': p, 'pag': p, 'motiv': r['Tip'], 'ret': r['Reteta'],
         'c': r['Text_cautat'], 'r': r['Corectie'], 'com': NOTA.get(i, '') + r['Observatii'], 'prop': '',
         'gaseste': t, 'cb': cb[-40:], 'ca': ca[:40], 'rand': '', 'k': k, 'n': n}
    if o:
        e.update(orig=o, parte=(o - 1) // 440, op=(o - 1) % 440 + 1)
    else:
        e.update(orig=0, parte=-1, op=0)
        prob['fara original'] += 1
    out.append(e)

with open(D + '/indesign/v5_date.jsx', 'w', encoding='ascii') as f:
    f.write('// generat de _lucru/genereaza_navigare_v5.py - nu edita de mina\n')
    f.write('var RAMASE = ' + json.dumps(out, ensure_ascii=True, separators=(',', ':')) + ';\n')
print(len(out), dict(prob))
print('tipuri', collections.Counter(e['motiv'] for e in out).most_common())
for e in out:
    if e['n'] > 1 and e['k'] < 0: print('neclar', e['id'], e['dp'], e['ret'], e['gaseste'], e['n'])
