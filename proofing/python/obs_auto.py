"""Compara rindul din export (observatii) cu rindurile din original (OCR firma + scan)."""
import json, csv, sys, re, collections, unicodedata
from rapidfuzz import fuzz
sys.stdout.reconfigure(encoding='utf-8')
src = open('potrivire2.py', encoding='utf-8').read()
exec(src[src.index('def light'):src.index('def load')])
m = json.load(open('potrivire2.json', encoding='utf-8')); prop = json.load(open('propuneri.json', encoding='utf-8'))
R = [r for r in csv.DictReader(open('../Retetar_corectura_aprobate.csv', encoding='utf-8-sig'), delimiter=';')
     if r['Cauta'] == r['Inlocuieste'] and int(r['Pagina']) >= 104 and r['ID'] not in prop]

def clean(s):
    s = re.sub(r'(?<!\S)(55|99|,,|„|"|”|îî|00)(?!\S)', '”', s)
    return light(s.replace('  |  ', ' ')).replace(' ', '')

def clasa(r):
    v = m[r['ID']]; e = clean(r['Rand_complet'])
    if not e:
        return 'gol', None
    bf = max([(fuzz.ratio(e, clean(x)), x) for x in v['firma']] + [(0, None)])
    bw = max([fuzz.partial_ratio(e, clean(x)) for x in v['win']] + [0])
    if bf[0] >= 97 and bw >= 85:
        return 'identic', bf[1]
    return ('aproape' if bf[0] >= 90 else 'diferit'), bf[1]

if __name__ == '__main__':
    c = collections.Counter(clasa(r)[0] for r in R)
    print(len(R), c)
