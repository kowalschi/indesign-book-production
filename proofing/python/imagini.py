"""Paginile intregi (original scanat + export InDesign) pentru revizuire.html."""
import csv, json, os
import pymupdf as fitz

D = 'D:/work/retetar/proofing'
m = json.load(open('potrivire2.json', encoding='utf-8'))
rows = {r['ID']: r for r in csv.DictReader(open(D + '/Retetar_corectura_aprobate.csv', encoding='utf-8-sig'), delimiter=';')}
os.makedirs('pagini/original', exist_ok=True)
os.makedirs('pagini/export', exist_ok=True)

orig = sorted({v['orig'] for v in m.values() if v['orig']})
expo = sorted({int(rows[i]['Pagina']) for i in m})
for folder, src, pages, dpi in (('original', D + '/pdf original/retetar_general_de_preparate.pdf', orig, 110),
                                ('export', D + '/pdf exportat indesign/Retetar_general.pdf', expo, 80)):
    doc = fitz.open(src)
    for p in pages:
        fn = 'pagini/%s/%04d.jpg' % (folder, p)
        if not os.path.exists(fn):
            doc[p - 1].get_pixmap(dpi=dpi, colorspace=fitz.csGRAY).save(fn, jpg_quality=72)
    print(folder, len(pages))
