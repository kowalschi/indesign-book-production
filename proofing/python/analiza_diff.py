"""Leaga fiecare diferenta (export vechi -> export corectat) de o corectura aplicata; listeaza ce ramine neexplicat
si corecturile aplicate care nu se vad in exportul nou. Iesire: verificare_export.csv in folderul indesign."""
import re, json, csv, sys, collections
sys.stdout.reconfigure(encoding='utf-8')
D = 'D:/work/retetar/proofing'
P = json.load(open('cmp_pagini.json'))
old = open('cmp_vechi.txt', encoding='utf-8').read().split('\n')
new = open('cmp_nou.txt', encoding='utf-8').read().split('\n')
cl = lambda w: w.replace('\x08', '')
hunks = []
for m in re.finditer(r'^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@', open('cmp.diff', encoding='utf-8').read(), re.M):
    a, b, c, d = int(m[1]), int(m[2] or 1), int(m[3]), int(m[4] or 1)
    ia = a - 1 if b else a          # la b == 0 git da pozitia de dinainte
    ic = c - 1 if d else c
    hunks.append({'ia': ia, 'ic': ic, 'o': [cl(w) for w in old[ia:ia + b]], 'n': [cl(w) for w in new[ic:ic + d]],
                  'po': P['vechi'][min(ia, len(P['vechi']) - 1)], 'pn': P['nou'][min(ic, len(P['nou']) - 1)]})

# 1) despartire diferita la capat de rind
hy = lambda w: ''.join(w).replace('-', '').replace('\u2013', '')
hunks = [h for h in hunks if hy(h['o']) != hy(h['n'])]
# 2) numere de pagina si text mutat peste granita paginii: stergere + aceeasi inserare in apropiere
import pymupdf as fitz
LAB = {}
for fn in ('Retetar_general.pdf', 'Retetar_general_corectat v1.pdf'):
    dd = fitz.open(D + '/pdf exportat indesign/' + fn)
    for i in range(dd.page_count):
        LAB.setdefault(i + 1, set()).add(dd[i].get_label())
def isfolio(w, p):   # numarul tiparit al paginii (al 3-lea document are alta numerotare decit indexul PDF)
    return re.fullmatch(r'\d{1,4}', w) and any(w in LAB.get(q, ()) for q in range(p - 2, p + 3))
def num(ws, p):
    return ws and all(isfolio(w, p) for w in ws)
hunks = [h for h in hunks if not ((not h['n'] and num(h['o'], h['po'])) or (not h['o'] and num(h['n'], h['pn'])))]
def strip_num(ws, p):
    return [w for w in ws if not isfolio(w, p)]
for h in hunks:
    h['o2'], h['n2'] = strip_num(h['o'], h['po']), strip_num(h['n'], h['pn'])
dele = [h for h in hunks if h['o2'] and not h['n2']]
ins = [h for h in hunks if h['n2'] and not h['o2']]
moved = set()
for x in dele:
    for y in ins:
        if id(y) not in moved and y['n2'] == x['o2'] and abs(y['ic'] - x['ia']) < 400:
            moved.add(id(x)); moved.add(id(y)); break
hunks = [h for h in hunks if id(h) not in moved and (h['o2'] or h['n2'])]

# 3) legatura cu corecturile aplicate
J = {x['ID']: x for x in csv.DictReader(open(D + '/indesign/corecturi_jurnal.csv', encoding='utf-8-sig'), delimiter=';')}
sq = lambda s: re.sub(r'\s+', ' ', s.replace('\u00ad', '').replace('~-', '').replace('\u00b6', ' ')).strip()
corr = collections.defaultdict(list)
for x in J.values():
    if x['Status'] == 'aplicat':
        corr[int(x['Pagina gasita'] or x['Pagina export'])].append(x)
def atinge(w, s):
    """cuvintul din diferenta face parte din textul corecturii (sau invers), fara punctuatia lipita"""
    w2 = re.sub(r'^[\W_]+|[\W_]+$', '', w)
    return (w2 and w2 in s) or (s and s in w) or (w in s)
def leaga(h):
    for dp in (0, 1, -1, 2, -2):
        for x in corr.get(h['po'] + dp, []):
            c, r = sq(x['Cauta']), sq(x['Inlocuieste'])
            ok_o = not h['o2'] or any(atinge(w, c) for w in h['o2'])
            ok_n = not h['n2'] or any(atinge(w, r) for w in h['n2'])
            if ok_o and ok_n:
                return x
    return None
used, unexpl = collections.Counter(), []
for h in hunks:
    x = leaga(h)
    if x: used[x['ID']] += 1
    else: unexpl.append(h)

# 4) corecturile aplicate care nu au produs nicio diferenta: textul nou e pe pagina in exportul nou?
pg_new = collections.defaultdict(list)
for w, p in zip(new, P['nou']):
    pg_new[p].append(cl(w))
pg_txt = {p: ' '.join(ws) for p, ws in pg_new.items()}
nevazute = []
for p, xs in corr.items():
    for x in xs:
        if x['ID'] in used:
            continue
        r = sq(x['Inlocuieste'])
        win = ' '.join(pg_txt.get(q, '') for q in (p - 1, p, p + 1))
        if r and r in win.replace('- ', ''):
            continue
        nevazute.append(x)

print('diferente reale', len(hunks), 'legate de corecturi', len(hunks) - len(unexpl), 'neexplicate', len(unexpl))
print('corecturi aplicate fara urma in exportul nou', len(nevazute))
with open(D + '/indesign/verificare_export.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f, delimiter=';')
    w.writerow(['Tip', 'Pagina', 'ID', 'Vechi', 'Nou', 'Context vechi'])
    for h in unexpl:
        ctx = ' '.join(old[max(0, h['ia'] - 6):h['ia'] + len(h['o']) + 6])
        w.writerow(['schimbare neexplicata', h['po'], '', ' '.join(h['o']), ' '.join(h['n']), ctx])
    for x in nevazute:
        w.writerow(['corectura fara urma', x['Pagina gasita'], x['ID'], x['Cauta'], x['Inlocuieste'], ''])
for h in unexpl[:80]:
    print(h['po'], repr(' '.join(h['o'])), '->', repr(' '.join(h['n'])))
