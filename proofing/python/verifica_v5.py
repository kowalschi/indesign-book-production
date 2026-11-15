"""Verifica fiecare Text_cautat din corecturi_v5.csv in PDF-ul v4 (pe pagina data, apoi pe paginile vecine).
Iesire: _lucru/verifica_v5.json + raport pe ecran."""
import csv, json, re, sys
import pymupdf
sys.stdout.reconfigure(encoding='utf-8')
D = 'D:/work/retetar/proofing'
PDF = 'D:/work/retetar/retetar-01-02_v4.pdf'

def norm(s):
    s = s.replace('\xad', '').replace('\x08', ' ')
    s = re.sub(r'-\s*\n\s*', '-', s)          # cratima la capat de rand (pastrata, cautarea o ignora)
    return re.sub(r'\s+', ' ', s).strip()

def cauta(t, txt):
    """aparitiile lui t in txt; un numar se cauta doar intreg; cratima urmata de spatiu poate lipsi"""
    p = re.escape(t).replace(r'\ ', r'\s+')
    if re.match(r'\d', t): p = r'(?<![\d,.])' + p
    if re.search(r'\d$', t): p = p + r'(?![\d,])'
    n = len(re.findall(p, txt))
    if n: return n
    # cuvant despartit in PDF: "frămân- tă"
    txt2 = re.sub(r'(\w)- (\w)', r'\1\2', txt)
    return len(re.findall(p, txt2))

doc = pymupdf.open(PDF)
pag = [norm(p.get_text()) for p in doc]
rows = list(csv.DictReader(open(D + '/corecturi_v5.csv', encoding='utf-8-sig'), delimiter=';'))
rez = {}
for r in rows:
    p, t = int(r['Pagina']), r['Text_cautat'].strip()
    e = {'pag': p, 'n': 0, 'gasit_pe': None, 'ret_pe_pagina': None}
    if t:
        for dp in (0, -1, 1):
            q = p + dp
            if 1 <= q <= len(pag):
                n = cauta(t, pag[q - 1])
                if n:
                    e.update(n=n, gasit_pe=q); break
    if r['Reteta']:
        nr = re.escape(r['Reteta'].split()[0])
        e['ret_pe_pagina'] = any(re.search(r'(?<![\d,./])' + nr + r'(?![\d,/])', pag[q - 1])
                                 for q in (p - 1, p, p + 1) if 1 <= q <= len(pag))
    rez[r['ID']] = e

json.dump(rez, open(D + '/_lucru/verifica_v5.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
ok = sum(1 for e in rez.values() if e['gasit_pe'] == e['pag'])
print('total', len(rows), '| gasit pe pagina', ok,
      '| pe pagina vecina', sum(1 for e in rez.values() if e['gasit_pe'] and e['gasit_pe'] != e['pag']),
      '| negasit', sum(1 for e in rez.values() if not e['gasit_pe']),
      '| mai multe aparitii', sum(1 for e in rez.values() if e['n'] > 1))
for r in rows:
    e = rez[r['ID']]
    if not e['gasit_pe'] or e['gasit_pe'] != e['pag'] or e['n'] > 1 or e['ret_pe_pagina'] is False:
        print(r['ID'], 'p.', r['Pagina'], 'ret', r['Reteta'] or '-', '|', r['Tip'], '|', repr(r['Text_cautat']),
              '->', 'NEGASIT' if not e['gasit_pe'] else 'p.%d x%d' % (e['gasit_pe'], e['n']),
              '' if e['ret_pe_pagina'] is not False else '| reteta NU e pe pagina')
