"""Compara textul exportului vechi cu cel corectat: cuvinte unul pe rind, apoi git diff (rapid pe fisiere mari)."""
import pymupdf as fitz, re, sys, json
sys.stdout.reconfigure(encoding='utf-8')
D = 'D:/work/retetar/proofing'
def tok(fn, out):
    doc = fitz.open(fn); pages = []
    with open(out, 'w', encoding='utf-8') as f:
        for i in range(doc.page_count):
            t = doc[i].get_text().replace('\xad\n', '').replace('\xad', '')
            t = re.sub(r'-\n(?=[a-zăîâșțşţ])', '', t)   # exportul nou are cratime reale la capat de rind
            for w in t.split():
                f.write(w + '\n'); pages.append(i + 1)
    return doc.page_count, pages
a = tok(D + '/pdf exportat indesign/Retetar_general.pdf', 'cmp_vechi.txt')
b = tok(D + '/pdf exportat indesign/Retetar_general_corectat v1.pdf', 'cmp_nou.txt')
json.dump({'vechi': a[1], 'nou': b[1]}, open('cmp_pagini.json', 'w'))
print('pagini', a[0], b[0], 'cuvinte', len(a[1]), len(b[1]))
