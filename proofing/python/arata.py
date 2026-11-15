"""Afiseaza un lot de observatii (Cauta == Inlocuieste) cu rindurile din original.
Folosire: python arata.py START NUMAR"""
import csv, json, sys
sys.stdout.reconfigure(encoding='utf-8')
start, n = int(sys.argv[1]), int(sys.argv[2])
m = json.load(open('potrivire.json', encoding='utf-8'))
rows = [r for r in csv.DictReader(open('../Retetar_corectura_aprobate.csv', encoding='utf-8-sig'), delimiter=';')
        if r['Cauta'] == r['Inlocuieste']]
for r in rows[start:start + n]:
    v = m.get(r['ID'], {})
    print('#%s p%s o%s s%s [%s] %r' % (r['ID'], r['Pagina'], v.get('orig_page'), v.get('score'), r['Categorie'], r['Rand_complet']))
    print('   C:', r['Comentariu'])
    for l in v.get('ctx', []):
        print('   O:', l)
