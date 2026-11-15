"""Scrie date.js pentru revizuire.html: toate corecturile de la PRIMA_PAGINA, cu verdictul din potrivire2.json
si propunerile mele pentru observatii (propuneri.json)."""
import csv, json
D = 'D:/work/retetar/proofing'
PRIMA_PAGINA = 104   # paginile export de dinainte se ignora (cerinta utilizatorului)
m = json.load(open('potrivire2.json', encoding='utf-8'))
prop = json.load(open('propuneri.json', encoding='utf-8'))
out = []
for r in csv.DictReader(open(D + '/Retetar_corectura_aprobate.csv', encoding='utf-8-sig'), delimiter=';'):
    if int(r['Pagina']) < PRIMA_PAGINA:
        continue
    v = m.get(r['ID'], {})
    obs = r['Cauta'] == r['Inlocuieste']
    p = prop.get(r['ID']) if obs else {'act': 'Ștergere' if not r['Inlocuieste'] else 'Înlocuire',
                                         'cauta': r['Cauta'], 'inloc': r['Inlocuieste'], 'motiv': ''}
    out.append({'id': r['ID'], 'pag': int(r['Pagina']), 'orig': v.get('orig'), 'ret': v.get('reteta'),
                'tip': r['Tip'], 'cat': r['Categorie'], 'obs': obs, 'rand': r['Rand_complet'], 'com': r['Comentariu'],
                'ver': v.get('verdict'), 'ori': v.get('origine'), 'F': v.get('firma', []), 'W': v.get('win', []),
                'bb': v.get('bbox'), 'w': v.get('w'), 'h': v.get('h'), 'p': p})
with open('date.js', 'w', encoding='utf-8') as f:
    f.write('window.DATE = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(len(out), 'intrari,', sum(1 for x in out if x['p']), 'cu propunere')
