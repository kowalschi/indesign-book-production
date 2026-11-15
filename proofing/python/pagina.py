"""Afiseaza rindurile OCR ale unei pagini din original. Folosire: python pagina.py P [DE LA] [PINA LA]"""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
src = open('potrivire.py', encoding='utf-8').read()
exec(src[src.index('def to_rows'):src.index('# --- original (OCR)')])
FIRMA = '-f' in sys.argv
sys.argv = [a for a in sys.argv if a != '-f']
p = int(sys.argv[1]); a = int(sys.argv[2]) if len(sys.argv) > 2 else 0; b = int(sys.argv[3]) if len(sys.argv) > 3 else 999
rows = to_rows(json.load(open(('ocr_firma' if FIRMA else 'ocr') + '/p%04d.json' % p, encoding='utf-8')))
for i, r in enumerate(rows[a:b], a):
    print('%3d  %s' % (i, r['text']))
