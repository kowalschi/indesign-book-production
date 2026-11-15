"""Corecturile ramase dupa lotul 1 (Tabel / Manual / Fara modificare / negasite / deja corect suspecte) -> indesign/ramase_lot2.csv"""
import csv, json, sys, collections
sys.stdout.reconfigure(encoding='utf-8')
D = 'D:/work/retetar/proofing'
data = json.loads(open('date.js', encoding='utf-8').read()[len('window.DATE = '):].rstrip().rstrip(';'))
src = {r['ID']: r for r in csv.DictReader(open(D + '/Retetar_corectura_aprobate.csv', encoding='utf-8-sig'), delimiter=';')}
dec = {r['ID']: r for r in csv.DictReader(open(D + '/Retetar_corectura_revizuita.csv', encoding='utf-8-sig'), delimiter=';')
       if r['Status'] in ('modificat', 'respins', 'facut')}
J = {x['ID']: x for x in csv.DictReader(open(D + '/indesign/corecturi_jurnal.csv', encoding='utf-8-sig'), delimiter=';')}
# verificate in Retetar_general_corectat v1.pdf: textul e deja corect
OK_V1 = {'157', '197', '387', '388', '389', '391', '392', '573', '1154', '1969', '2648', '3722', '1301', '1306', '1308'}
REPARAT = OK_V1 | {'601', '1568', '1691', '1692', '3561', '3563', '3838', '3872', '4051', '4052'}
SUSPECT = {'3722', '573', '197', '1969', '2648', '1154', '157', '387', '388', '389', '390', '391', '392'}
rows, cnt = [], collections.Counter()
for x in data:
    i = x['id']; d = dec.get(i)
    if d and d['Status'] in ('respins', 'facut'):
        continue
    p = {'act': d['Actiune'], 'cauta': d['Cauta'], 'inloc': d['Inlocuieste']} if d else x['p']
    j = J.get(i)
    if j and j['Status'] == 'aplicat':
        continue
    if j and j['Status'] == 'deja corect' and i not in SUSPECT:
        continue
    if i in REPARAT:
        continue
    if not p or not p.get('act'):
        continue   # observatiile fara propunere -> alt lot
    motiv = (j['Status'] if j else None) or ('manual după simulare' if i in ('3896', '866') else p['act'])
    if motiv == 'deja corect': motiv = 'deja corect (de verificat)'
    cnt[motiv] += 1
    r = src[i]
    rows.append([motiv, x['pag'], (j or {}).get('Pagina gasita', ''), i, x.get('ret') or '', p['act'], p['cauta'], p['inloc'],
                 r['Rand_complet'][:200], x.get('obs', '')])
rows.sort(key=lambda r: (r[0], int(r[1])))
with open(D + '/indesign/ramase_lot2.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f, delimiter=';', quoting=csv.QUOTE_ALL)
    w.writerow(['Motiv', 'Pagina export', 'Pagina gasita', 'ID', 'Reteta', 'Actiune', 'Cauta', 'Inlocuieste', 'Rand complet', 'Observatie'])
    w.writerows(rows)
print(dict(cnt), len(rows))
for r in rows: print(r[0], r[1], r[3], repr(r[6])[:50], '->', repr(r[7])[:50])
