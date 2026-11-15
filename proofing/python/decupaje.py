"""Decupaje din originalul scanat pentru fiecare observatie (Cauta == Inlocuieste).
Folosire: python decupaje.py [ID ...]   (fara ID-uri: toate)"""
import csv, json, os, sys
import pymupdf as fitz

D = 'D:/work/retetar/proofing'
SRC = D + '/pdf original/retetar_general_de_preparate.pdf'
OUT = 'decupaje'
ROWS = 7          # rinduri OCR deasupra/dedesubt
DPI_OCR = 200

sys.path.insert(0, '.')
os.makedirs(OUT, exist_ok=True)
m = json.load(open('potrivire.json', encoding='utf-8'))
ids = sys.argv[1:] or [r['ID'] for r in csv.DictReader(open(D + '/Retetar_corectura_aprobate.csv', encoding='utf-8-sig'), delimiter=';')
                       if r['Cauta'] == r['Inlocuieste']]
doc = fitz.open(SRC)
for i in ids:
    v = m.get(i)
    if not v or not v.get('orig_page'):
        continue
    page = doc[v['orig_page'] - 1]
    k = 72 / DPI_OCR
    if v.get('bbox'):
        x0, y0, x1, y1 = v['bbox']
        pad = 120
        clip = fitz.Rect(0, max(0, y0 - pad) * k, page.rect.width, min(v['h'], y1 + pad) * k)
    else:
        clip = page.rect
    page.get_pixmap(dpi=130, clip=clip, colorspace=fitz.csGRAY).save(os.path.join(OUT, i + '.jpg'), jpg_quality=70)
