#!/usr/bin/env python3
"""PD158/E326: A1b, 2.0 und A1 (Gegenprobe) in der Glas-Nachstellung: sechs Darstellungen von Icon Composer (Standard, Dunkel, Klar hell/dunkel,
Getönt hell/dunkel), Größen 1024 (als 256 gezeigt), 180, 120, 87, 58 px, auf hellem und dunklem Grund. Schreibt html/*.html und eine Liste der Einzelbilder."""
import json, sys
sys.path.insert(0, '/home/claude/hefta/d118')
import sym118 as s
MODI = ['normal', 'dunkel', 'klar-hell', 'klar-dunkel', 'getoent-hell', 'getoent-dunkel']
NAME = {'normal': 'Standard', 'dunkel': 'Dunkel', 'klar-hell': 'Klar, hell', 'klar-dunkel': 'Klar, dunkel', 'getoent-hell': 'Getönt, hell', 'getoent-dunkel': 'Getönt, dunkel'}
A1 = dict(s.A1B, name='A1 (DP63b)', cx=390, s=21, sw=4.2)          # Aufbau wie A1: Klammer, Deckel bis 760 (Rückenstreifen), schwarzer Schatten
FASS = {'2.0': (s.ALT20, dict(deckschatten=None)), 'A1': (A1, dict(deckschatten=None, kante_deckel=760)), 'A1b': (s.A1B, {})}
GROESSEN = [256, 180, 120, 87, 58]
GRUND = {'hell': 'radial-gradient(60% 45% at 18% 15%, #f2a66a 0, transparent 70%),radial-gradient(55% 45% at 88% 55%, #5fa6c4 0, transparent 70%),#e9e3f2',
         'dunkel': 'radial-gradient(60% 45% at 18% 15%, #5a3a2a 0, transparent 70%),radial-gradient(55% 45% at 88% 55%, #1f3a4a 0, transparent 70%),#121016'}
liste = []; uid = 0
for fa, (v, kw) in FASS.items():
    for gr in ('hell', 'dunkel'):
        h = [f'<!doctype html><meta charset="utf-8"><style>body{{margin:0;padding:16px;background:{GRUND[gr]};font-family:system-ui;color:{"#26221e" if gr=="hell" else "#f3ede4"}}}'
             '.r{display:flex;gap:18px;align-items:flex-end;margin:10px 0}.ic{display:inline-block;overflow:hidden;line-height:0}.l{width:120px;font-size:13px}</style><body>'
             f'<b>{v["name"]}, Grund {gr}</b>']
        for m in MODI:
            h.append(f'<div class="r"><span class="l">{NAME[m]}</span>')
            for px in GROESSEN:
                uid += 1; i = f'{fa}-{gr}-{m}-{px}'.replace('.', '')
                h.append(f'<span id="{i}">{s.glas(v, m, px, uid, **kw)}</span>'); liste.append(dict(id=i, fassung=fa, grund=gr, modus=m, px=px, datei=f'{fa}-{gr}'.replace('.', '')))
            h.append('</div>')
        open(f'{s.D}/html/{fa}-{gr}.html'.replace('2.0', '20'), 'w').write(''.join(h) + '</body>')
json.dump(liste, open(f'{s.D}/html/liste.json', 'w'))
print(len(liste))
