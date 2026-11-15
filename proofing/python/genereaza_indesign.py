"""Scrie indesign/corecturi_date.jsx pentru aplica_corecturi.jsx: corecturile aprobate (implicit sau modificate)
cu actiune automata. Deciziile utilizatorului vin din Retetar_corectura_revizuita.csv (butonul „Exportă CSV”)."""
import csv, json, os, collections, sys
sys.stdout.reconfigure(encoding='utf-8')
D = 'D:/work/retetar/proofing'
AUTO = {'Înlocuire', 'Ștergere', 'Inserare', 'Despărțire'}   # Tabel / Manual / Fără modificare -> mai tirziu, de mina

data = json.loads(open('date.js', encoding='utf-8').read()[len('window.DATE = '):].rstrip().rstrip(';'))
src = {r['ID']: r for r in csv.DictReader(open(D + '/Retetar_corectura_aprobate.csv', encoding='utf-8-sig'), delimiter=';')}
dec = {}
fn = D + '/Retetar_corectura_revizuita.csv'
if os.path.exists(fn):
    for r in csv.DictReader(open(fn, encoding='utf-8-sig'), delimiter=';'):
        if r['Status'] in ('modificat', 'respins', 'facut'):
            dec[r['ID']] = {'status': r['Status'], 'act': r['Actiune'], 'cauta': r['Cauta'], 'inloc': r['Inlocuieste']}

def ctx(rand, cauta, r):
    """contextul din jurul textului cautat (din rindul complet, altfel din CSV)"""
    i = rand.find(cauta) if cauta else -1
    if i >= 0:
        return rand[max(0, i - 40):i], rand[i + len(cauta):i + len(cauta) + 40]
    return r['Context_inainte'][-40:], r['Context_dupa'][:40]

# ajustari dupa simularea din InDesign
MANUAL = {'3896', '866'}   # fragment de tabel corupt; cap de tabel in celula -> de mina
FIX = {'3837': ('servește, a d. PREPARATE DIN PEȘTE', 'servește.')}   # titlul citit in fraza continua pe rindul urmator

out, skip = [], collections.Counter()
for x in data:
    d = dec.get(x['id'])
    if d and d['status'] in ('respins', 'facut'):
        skip[d['status']] += 1
        continue
    p = d or x['p']
    if not p or p['act'] not in AUTO:
        skip[(p or {}).get('act') or 'fără acțiune'] += 1
        continue
    if not p['cauta'] or p['cauta'] == p['inloc']:
        skip['fără modificare'] += 1
        continue
    if x['id'] in MANUAL:
        skip['manual după simulare'] += 1
        continue
    r = src[x['id']]
    c, n = FIX.get(x['id'], (p['cauta'], p['inloc']))
    cb, ca = ctx(r['Rand_complet'], c, r)
    # „cuvînt-” la capăt de rînd = despărțire automată în InDesign (în text nu există cratima)
    if c.endswith('-') and n.endswith('-'):   # fara cratima se gaseste si cind ea exista in text
        c, n = c[:-1], n[:-1]
    out.append({'id': x['id'], 'pag': x['pag'], 'ap': int(r['Aparitia'] or 1),
                'c': c, 'r': n, 'cb': cb, 'ca': ca})

os.makedirs(D + '/indesign', exist_ok=True)
with open(D + '/indesign/corecturi_date.jsx', 'w', encoding='ascii') as f:
    f.write('// generat de _lucru/genereaza_indesign.py - nu edita de mina\n')
    f.write('var CORECTURI = ' + json.dumps(out, ensure_ascii=True, separators=(',', ':')) + ';\n')
print(len(out), 'corecturi automate; sarite:', dict(skip))
