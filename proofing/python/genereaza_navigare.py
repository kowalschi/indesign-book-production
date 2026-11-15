"""Date pentru indesign/navigare_ramase.jsx: reparatiile ramase + observatiile fara propunere, fiecare cu
documentul .indd si pagina lui (din harta_pagini.json) si pagina din PDF-ul OCR al originalului impartit in 3
(Partea I = pag. 1-440, II = 441-880, III = 881-1320). Iesire: indesign/ramase_date.jsx"""
import csv, json, sys, collections
sys.stdout.reconfigure(encoding='utf-8')
D = 'D:/work/retetar/proofing'
data = {x['id']: x for x in json.loads(open('date.js', encoding='utf-8').read()[len('window.DATE = '):].rstrip().rstrip(';'))}
src = {r['ID']: r for r in csv.DictReader(open(D + '/Retetar_corectura_aprobate.csv', encoding='utf-8-sig'), delimiter=';')}
dec = {r['ID'] for r in csv.DictReader(open(D + '/Retetar_corectura_revizuita.csv', encoding='utf-8-sig'), delimiter=';')
       if r['Status'] in ('modificat', 'respins', 'facut')}
H = {int(k): v for k, v in json.load(open('harta_pagini.json'))['harta'].items()}
def nou(p):   # pagina din exportul vechi -> [document, pagina in document]
    for dp in (0, -1, 1, -2, 2, -3, 3):
        if p + dp in H:
            di, q = H[p + dp]
            return di, max(1, q - dp)
    return None, None
def original(x):
    o = x['orig']
    return {'orig': o, 'parte': (o - 1) // 440, 'op': (o - 1) % 440 + 1}

out = []
# reparatiile ramase dupa verificarea exportului pe documente
GASESTE = {'1691': 'Muștar', '3872': 'Șalău fără cap', '601': 'Calcan', '718': 'Total'}
for r in csv.DictReader(open(D + '/indesign/de_reparat_manual_2.csv', encoding='utf-8-sig'), delimiter=';'):
    x, s = data[r['ID']], src[r['ID']]
    e = {'id': r['ID'], 'doc': int(r['Document'][-6]), 'dp': int(r['Pagina in document']), 'pag': int(r['Pagina export vechi']),
         'motiv': 'Reparatie', 'ret': str(x['ret'] or ''), 'c': r['Acum'], 'r': r['Corect'],
         'com': r['Unde'] + ': ' + s['Comentariu'], 'prop': '', 'gaseste': GASESTE.get(r['ID'], ''),
         'cb': '', 'ca': '', 'rand': ''}
    e.update(original(x)); out.append(e)
# observatiile fara propunere
n = collections.Counter()
for i, x in data.items():
    if i in dec or (x['p'] and x['p'].get('act')) or x['ver'] != 'observatie':
        continue
    s = src[i]; di, q = nou(x['pag'])
    if di is None:
        n['fara pagina noua'] += 1; continue
    e = {'id': i, 'doc': di, 'dp': q, 'pag': x['pag'], 'motiv': s['Categorie'], 'ret': str(x['ret'] or ''),
         'c': '', 'r': '', 'com': s['Comentariu'], 'prop': '', 'gaseste': s['Cauta'],
         'cb': s['Context_inainte'][-40:], 'ca': s['Context_dupa'][:40], 'rand': s['Rand_complet'][:300]}
    e.update(original(x)); out.append(e); n[s['Categorie']] += 1
out.sort(key=lambda e: (e['motiv'] != 'Reparatie', e['doc'], e['dp'], int(e['id'])))
with open(D + '/indesign/ramase_date.jsx', 'w', encoding='ascii') as f:
    f.write('// generat de _lucru/genereaza_navigare.py - nu edita de mina\n')
    f.write('var RAMASE = ' + json.dumps(out, ensure_ascii=True, separators=(',', ':')) + ';\n')
print(len(out), dict(n))
print(out[0]); print(out[10])
