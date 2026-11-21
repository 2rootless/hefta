#!/usr/bin/env python3
"""PD158/E326: Prüfkatalog SY1–SY8 für das App-Symbol. A1b muss grün sein; A1 (DP63b) wird bei SY1, SY2, SY3, SY4, SY5 rot (Gegenproben).
Grundlage: Einzelbilder der Glas-Nachstellung (shot118.js, DSF 1) und die flachen SVG/PNG."""
import json, re, math, subprocess, os
import numpy as np
from PIL import Image
D = '/home/claude/hefta/d118'
L = json.load(open(f'{D}/html/liste.json'))
import sys; sys.path.insert(0, D); import sym118 as s, ansichten118 as an
FASS = {'20': s.ALT20, 'A1': an.A1, 'A1b': s.A1B}
def lum(a):
    a = a[..., :3] / 255.0; a = np.where(a <= .04045, a / 12.92, ((a + .055) / 1.055) ** 2.4); return a @ np.array([.2126, .7152, .0722])
def kontrast(h1, h2):
    f = lambda h: lum(np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)]], float))[0]
    a, b = sorted((f(h1), f(h2)), reverse=True); return (a + .05) / (b + .05)
erg = []
def p(nr, fa, was, ok, info): erg.append(dict(nr=nr, fassung=fa, was=was, gut=bool(ok), info=str(info)))
# SY1 Lücke zwischen äußerem und innerem Haus bei 58 px: gerechnet und im Bild (je Darstellung, beide Gründe)
for fa, v in FASS.items():
    luecke = (4.9 - v['sw']) * v['s'] * 58 / 1024
    p('SY1a', fa, 'Lücke bei 58 px gerechnet ≥ 1 px', luecke >= 1, f'{luecke:.2f} px')
    k = 58 / 1024
LU = json.load(open(f'{D}/luecke118.json')); key = {'20': '2.0', 'A1': 'A1', 'A1b': 'A1b'}
for fa, v in FASS.items():
    lu = LU[key[fa]]; ref = LU['2.0']['glas']
    g58 = {k: w for k, w in lu['glas'].items() if k.startswith('58')}
    schlecht = [f'{k[3:]} {w}' for k, w in g58.items() if w < .5 or w < ref[k] - .02]
    p('SY1b', fa, 'Lücke im Bild offen: flach 58 px ≥ 0,75; Glas 58 px in jeder Darstellung ≥ 0,5 und nicht unter 2.0', lu['flach']['58'] >= .75 and not schlecht,
      f"flach {lu['flach']['58']}, Glas schlechtester {min(g58.values())}" + (' · ' + '; '.join(schlecht[:3]) if schlecht else ''))
# SY2 Strich wie im Logo (3,2 im 32er-Raster)
for fa, v in FASS.items(): p('SY2', fa, 'Strich wie im Logo: 3,2', abs(v['sw'] - 3.2) < .01, v['sw'])
# SY4 Lage und Größe des Hauses wie 2.0 (Maß 20, Mitte 396/512)
for fa, v in FASS.items(): p('SY4', fa, 'Haus wie 2.0: Maß 20, Mitte 396/512', v['s'] == 20 and v['cx'] == 396 and v['cy'] == 512, f'Maß {v["s"]}, Mitte {v["cx"]}/{v["cy"]}')
# SY5 drei Seiten, beginnen genau an der Deckelkante (kein Rückenstreifen)
svg_a1 = open('/home/claude/hefta/d63b/app-symbol/app-symbol-A1-quadrat.svg').read(); svg_b = open(f'{D}/out/flach/app-symbol-A1b-flach.svg').read()
def seiten(svg):
    deck = re.search(r'M0 0H([\d.]+)V1024H0Z', svg); xs = [min(float(m) for m in re.findall(r'M([\d.]+) ', pp)) for pp in re.findall(r'<path d="(M[\d.]+ [\d.]+L[^"]+)" fill="#(?:f|e|d|c)[0-9a-f]{5}"', svg)]
    return float(deck.group(1)), len(xs), xs
for fa, svg in (('A1', svg_a1), ('A1b', svg_b)):
    kante, n, xs = seiten(svg)
    p('SY5', fa, 'drei Seiten, Deckel reicht bis an die Seiten (kein Streifen)', n == 3 and kante >= 772, f'Deckel bis {kante:.0f}, {n} Seiten')
# SY3 Glas: dunkelste Spalte an der Deckelkante (x 755–800, y 300–700) mindestens so hell wie 2.0, je Darstellung und Grund
def dunkelste(id_):
    a = np.asarray(Image.open(f'{D}/png/einzel/{id_}.png').convert('RGB')).astype(float); k = a.shape[1] / 1024
    sp = lum(a[int(300 * k):int(700 * k), int(755 * k):int(800 * k)]).mean(0); return sp.min()
ref = {(x['grund'], x['modus']): dunkelste(x['id']) for x in L if x['fassung'] == '2.0' and x['px'] == 256}
for fa in ('A1', 'A1b'):
    schlecht = []
    for x in [e for e in L if e['fassung'] == fa and e['px'] == 256]:
        w = dunkelste(x['id']); r = ref[(x['grund'], x['modus'])]
        if w < r - .005: schlecht.append(f'{x["modus"]}/{x["grund"]} {w:.3f} < {r:.3f}')
    p('SY3', fa, 'Glas: kein dunkler Balken an der Deckelkante, mindestens so hell wie 2.0 (alle Darstellungen)', not schlecht, '; '.join(schlecht[:3]) or 'überall ≥ 2.0')
# SY6 Kontrast Klammer auf Deckel
for fa, v in FASS.items():
    k1, k2 = kontrast(v['papier'], v['deckel']), kontrast(v['hell_d'], v['deckel_d'])
    p('SY6', fa, 'Klammer auf Deckel ≥ 4,5 : 1, Standard und Dunkel', min(k1, k2) >= 4.5, f'{k1:.2f} / {k2:.2f}')
# SY7 Klar: nichts ragt in den Deckel (Seiten beginnen bei x ≥ 772)
mx = min(q.bounds[0] for q in s.POLY); p('SY7', 'A1b', 'Klar: keine Seite ragt in den Deckel (x ≥ 772, aus der Geometrie)', mx >= 772 - .01, f'kleinstes x {mx:.1f}')
# SY8 Farben aus A1 (Wahl des Auftraggebers)
p('SY8', 'A1b', 'Deckel #b3261e wie A1', s.A1B['deckel'] == '#b3261e', s.A1B['deckel'])
# SY9 Formate: App Store 1024 quadratisch ohne Transparenz
im = Image.open(f'{D}/out/flach/app-symbol-A1b-1024.png'); p('SY9', 'A1b', 'App Store: 1024 × 1024, ohne Transparenz', im.size == (1024, 1024) and (im.mode == 'RGB' or np.asarray(im)[..., 3].min() == 255), f'{im.size} {im.mode}')
# SY10 Verhältnis der Flächen wie 2.0 (Deckel, Klammer, Seiten, Rest), je ± 1,5 Prozentpunkte
def anteile(png, v):
    a = np.asarray(Image.open(png).convert('RGB')).astype(int)
    hx = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)])
    kl = {'Deckel': [v['deckel']], 'Klammer': [v['papier']], 'Seiten': v['flach']}
    alle = [(n, hx(c)) for n, cs in kl.items() for c in cs] + [('Rest', hx(v['grund']))]
    dist = np.stack([np.abs(a - c).sum(-1) for _, c in alle]); idx = dist.argmin(0)
    namen = [n for n, _ in alle]; r = {}
    for i, n in enumerate(namen): r[n] = r.get(n, 0) + (idx == i).mean() * 100
    return r
FL = {'20': f'{D}/out/vergleich/2-0-1024.png', 'A1': f'{D}/luecke/A1-flach-1024.png', 'A1b': f'{D}/out/flach/app-symbol-A1b-1024.png'}
r20 = anteile(FL['20'], FASS['20'])
for fa in ('A1', 'A1b'):
    r = anteile(FL[fa], FASS[fa]); ab = {n: r[n] - r20[n] for n in r20}
    p('SY10', fa, 'Flächen wie 2.0 (± 1,5 Prozentpunkte)', all(abs(x) <= 1.5 for x in ab.values()), ' · '.join(f'{n} {r[n]:.1f} % ({ab[n]:+.1f})' for n in r20))
json.dump(erg, open(f'{D}/pruef118.json', 'w'), ensure_ascii=False, indent=1)
for e in erg: print(('ok  ' if e['gut'] else 'ROT ') + e['nr'], e['fassung'].ljust(4), e['was'], '·', e['info'])
b = [e for e in erg if e['fassung'] == 'A1b']; g = [e for e in erg if e['fassung'] == 'A1' and not e['gut']]
print(f'A1b: {sum(e["gut"] for e in b)} von {len(b)} grün · A1 rot bei: {sorted(set(e["nr"] for e in g))}')
