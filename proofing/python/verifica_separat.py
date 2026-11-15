"""Verifica in exportul pe documente reparatiile manuale si lotul 2: textul corect e pe pagina, cel gresit nu."""
import pymupdf as fitz, json, csv, re, sys
sys.stdout.reconfigure(encoding='utf-8')
D = 'D:/work/retetar/proofing'
H = {int(k): v for k, v in json.load(open('harta_pagini.json'))['harta'].items()}
docs = [fitz.open(D + '/pdf separat/retetar-0%d.pdf' % k) for k in range(3)]
sq = lambda s: re.sub(r'\s+', ' ', s.replace('\xad', '')).strip()
def text(p):   # pagina veche -> textul paginilor noi corespunzatoare (+-1)
    if p not in H: return None, ''
    di, q = H[p]; d = docs[di]
    t = ' '.join(d[i].get_text() for i in range(max(0, q - 2), min(d.page_count, q + 1)))
    return '%s p%d' % (['retetar-00', 'retetar-01', 'retetar-02'][di], q), sq(re.sub(r'-\n(?=[a-zăîâșț])', '', t))
print('== reparatii manuale')
for r in csv.DictReader(open(D + '/indesign/de_reparat_manual.csv', encoding='utf-8-sig'), delimiter=';'):
    loc, t = text(int(r['Pagina PDF']))
    ok, ramas = sq(r['Corect']) in t, sq(r['Acum']) in t and sq(r['Acum']) not in sq(r['Corect'])
    print('OK ' if ok and not ramas else '?? ', r['Pagina PDF'], loc, r['ID'], '|', r['Corect'], '| gresit ramas' if ramas else '')
print('== lot 2')
for r in csv.DictReader(open(D + '/indesign/ramase_lot2.csv', encoding='utf-8-sig'), delimiter=';'):
    p = int(r['Pagina gasita'] or r['Pagina export']); loc, t = text(p)
    c, n = sq(r['Cauta']), sq(r['Inlocuieste'])
    if r['Actiune'] in ('Înlocuire',) and c:
        st = ('OK ' if (not n or n in t) and not (c in t and c not in n) else '?? ')
    else:
        st = '-- '
    print(st, p, loc, r['ID'], r['Motiv'], '|', c[:40], '->', n[:50])
