"""Gegenprobe zu SY3: A1b mit schwarzem Schatten wie 2.0 („Neutral“). Zeigt, ob die helle Kante aus der Form kommt oder aus dem farbigen Schatten."""
import json, sys; sys.path.insert(0, '/home/claude/hefta/d118')
import sym118 as s, ansichten118 as an
L = []; uid = 5000
for gr in ('hell', 'dunkel'):
    h = [f'<!doctype html><meta charset="utf-8"><style>body{{margin:0;padding:16px;background:{an.GRUND[gr]}}}.ic{{display:inline-block;overflow:hidden;line-height:0}}</style><body>']
    for m in an.MODI:
        for px in (256, 58):
            uid += 1; i = f'A1bn-{gr}-{m}-{px}'; h.append(f'<span id="{i}">{s.glas(s.A1B, m, px, uid, deckschatten=None)}</span>'); L.append(dict(id=i, fassung='A1bn', grund=gr, modus=m, px=px, datei=f'A1bn-{gr}'))
    open(f'{s.D}/html/A1bn-{gr}.html', 'w').write(''.join(h) + '</body>')
json.dump(L, open(f'{s.D}/html/liste-neutral.json', 'w')); print(len(L))
