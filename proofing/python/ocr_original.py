"""OCR pe PDF-ul original (scanat) cu Windows OCR (ro-RO).
Salveaza ocr/pNNNN.json: lista de rinduri {text, words:[{t,x,y,w,h}]} in coordonate pixel la 200 dpi."""
import asyncio, json, os, sys
import pymupdf as fitz
import winocr
from PIL import Image

D = 'D:/work/retetar/proofing'
SRC = D + '/pdf original/retetar_general_de_preparate.pdf'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ocr')
DPI = 200

async def main():
    os.makedirs(OUT, exist_ok=True)
    doc = fitz.open(SRC)
    for i in range(doc.page_count):
        fn = os.path.join(OUT, 'p%04d.json' % (i + 1))
        if os.path.exists(fn):
            continue
        pix = doc[i].get_pixmap(dpi=DPI, colorspace=fitz.csGRAY)
        img = Image.frombytes('L', (pix.width, pix.height), pix.samples).convert('RGBA')
        res = await winocr.recognize_pil(img, 'ro-RO')
        lines = []
        for ln in res.lines:
            words = [{'t': w.text, 'x': w.bounding_rect.x, 'y': w.bounding_rect.y,
                      'w': w.bounding_rect.width, 'h': w.bounding_rect.height} for w in ln.words]
            lines.append({'text': ln.text, 'words': words})
        with open(fn, 'w', encoding='utf-8') as f:
            json.dump({'w': pix.width, 'h': pix.height, 'lines': lines}, f, ensure_ascii=False)
        if (i + 1) % 50 == 0:
            print(i + 1, flush=True)

asyncio.run(main())
