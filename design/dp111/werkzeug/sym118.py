#!/usr/bin/env python3
"""PD158: App-Symbol A1b. Neu aufgebaut auf dem App-Symbol aus 2.0 (DP8: Deckel bis 772, drei gefächerte Seiten, Klammer Maß 20 um 396/512),
nur in den Farben von A1 (Siegellack warm, DP63b). Fehler in A1: Es war aus dem Favicon-Entwurf (32 px) gebaut, nicht aus dem App-Symbol
(Klammer 4,2 bei Maß 21 um 390/512, zwei Seiten, Deckel bis 760 mit Rückenstreifen, flacher Schatten).
Strich der Klammer jetzt 3,2 wie im Logo. Ausgabe: out/ (Icon Composer, flach, web, favicon) und html/ für die Ansichten."""
import os, sys, re, json, math
sys.path.insert(0, '/home/claude/hefta/d002'); sys.path.insert(0, '/home/claude/hefta/dp8'); sys.path.insert(0, '/home/claude/hefta/b27')
import build_d002 as d, geo_dp8 as g
D = '/home/claude/hefta/d118'; OUT = f'{D}/out'
GANZ = d.GANZ; K = g.KANTE
A1B = dict(name='A1b', deckel='#b3261e', grund='#8a1d17', papier='#fdf8f1', deckel_d='#8a1d17', grund_d='#4d110c', hell_d='#f3ede4',
           s=20, cx=396, cy=512, sw=3.2, kante=772,
           flach=['#e3dbd4', '#ece6df', '#f6f2ec'],           # Seiten flach, hinten nach vorn
           schatten_seite=('#000', .12), schatten_deckel=('#8a1d17', .22))   # flach: heller als 2.0 (#000 .20 / .22)
ALT20 = dict(name='2.0 (DP8)', deckel='#661f14', grund='#3f130b', papier='#fbf8f2', deckel_d='#521c12', grund_d='#2a0d07', hell_d='#f3ede4',
           s=20, cx=396, cy=512, sw=3.4, kante=772, flach=['#c6b8b1', '#d7ccc6', '#e8e1db'], schatten_seite=('#000', .20), schatten_deckel=('#000', .22))
POLY = [g.seite_poly(x1, y0, y1, w) for x1, y0, y1, w in g.SEITEN]    # hinten nach vorn
def klammer(v, farbe=None, cx=None, cy=None, s=None, sw=None):
    return d.klammer(farbe or v['papier'], cx or v['cx'], cy or v['cy'], s or v['s'], sw or v['sw'])
def stapel(v):
    from shapely.geometry import box, LineString
    from shapely import affinity
    t = f'<rect width="1024" height="1024" fill="{v["grund"]}"/>'
    for i, (p, c) in enumerate(zip(POLY, v['flach'])):
        if i > 0:
            x1, y0, y1, w = g.SEITEN[i]
            l = affinity.rotate(LineString([(x1 + 4, y0 + 20), (x1 + 4, y1 - 20)]), w, origin=g.PIVOT).buffer(5, cap_style=2).intersection(POLY[i - 1])
            for q in getattr(l, 'geoms', [l]):
                if q.geom_type == 'Polygon': t += f'<path d="{g.pfad(q)}" fill="{v["schatten_seite"][0]}" fill-opacity="{v["schatten_seite"][1]}"/>'
        t += f'<path d="{g.pfad(p)}" fill="{c}"/>'
    u = POLY[0]
    for p in POLY[1:]: u = u.union(p)
    st = u.intersection(box(v['kante'], -100, v['kante'] + 12, 1200))
    for s in getattr(st, 'geoms', [st]):
        if s.geom_type == 'Polygon': t += f'<path d="{g.pfad(s)}" fill="{v["schatten_deckel"][0]}" fill-opacity="{v["schatten_deckel"][1]}"/>'
    return t + f'<path d="M0 0H{v["kante"]}V1024H0Z" fill="{v["deckel"]}"/>' + klammer(v)
def schreibe(name, inhalt):
    p = os.path.join(OUT, name); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w').write(inhalt); return p

# ---- Glas-Nachstellung (aus B27f-n1/DP8), Farben je Fassung gesetzt; Schatten des Deckels farbig statt schwarz ----
import build_b27f_n1 as f, glas_dp8 as gl
def glas(v, modus, px, uid, deckschatten=('#8a1d17', .30, .40), kante_deckel=None):
    f.DECKEL, f.GRUND, f.DECKEL_D, f.GRUND_D, f.HELL, f.PAPIER = v['deckel'], v['grund'], v['deckel_d'], v['grund_d'], v['hell_d'], v['papier']
    f.KL.update(cx=v['cx'], cy=v['cy'], s=v['s'], sw=v['sw']); f.KL_T = f'translate({v["cx"]} {v["cy"]}) scale({v["s"]}) translate(-15.95 -17.5)'
    kd = kante_deckel or v['kante']; f.DECKEL_PFAD = f'M-40 -40H{kd}V1064H-40Z'
    s = gl.icon('neu', modus, px, uid)
    dunkel = modus in ('dunkel', 'klar-dunkel', 'getoent-dunkel')
    if deckschatten:   # Icon Composer: Schatten „Chromatic“, schwächer als „Neutral“
        fc, oh, od = deckschatten
        s = re.sub(r'(dx="16" result="o"/><feFlood) flood-color="#000" flood-opacity="[\d.]+"', lambda m: f'{m.group(1)} flood-color="{fc}" flood-opacity="{od if dunkel else oh}"', s)
    return s

if __name__ == '__main__':
    os.makedirs(f'{D}/html', exist_ok=True)
    v = A1B
    # 1 Icon Composer: Ebenen ohne Effekte, 1024er Raster (wie DP8)
    schreibe('icon-composer/1-klammer.svg', d.svg(klammer(v)))
    schreibe('icon-composer/2-deckel.svg', d.svg(f'<path d="M0 0H{K}V1024H0Z" fill="{v["deckel"]}"/>'))
    for i, p in enumerate(reversed(POLY), 1):
        schreibe(f'icon-composer/3-seite-{i}.svg', d.svg(f'<path d="{g.pfad(p)}" fill="{v["papier"]}"/>'))
    # 2 flach (App Store, ohne Rundung, ohne Transparenz) und Web
    fl = schreibe('flach/app-symbol-A1b-flach.svg', d.svg(stapel(v))); d.png(fl, 1024, f'{OUT}/flach/app-symbol-A1b-1024.png')
    r = schreibe('web/app-symbol-A1b-rund.svg', d.svg(f'<clipPath id="r"><rect width="1024" height="1024" rx="230"/></clipPath><g clip-path="url(#r)">{stapel(v)}</g>'))
    for px in (512, 192): d.png(r, px, f'{OUT}/web/icon-A1b-{px}.png')
    d.png(fl, 180, f'{OUT}/web/apple-touch-icon-A1b-180.png')
    sk = .8; o = 512 * (1 - sk)
    m = schreibe('web/app-symbol-A1b-maskable.svg', d.svg(f'<rect width="1024" height="1024" fill="{v["grund"]}"/><path d="M0 0H{o + K * sk:.1f}V1024H0Z" fill="{v["deckel"]}"/>'
                                                       f'<g transform="translate({o:.1f} {o:.1f}) scale({sk})">{stapel(v)}</g>'))
    d.png(m, 512, f'{OUT}/web/icon-maskable-A1b-512.png')
    # 2.0 und A1 zum Vergleich (flach)
    alt = schreibe('vergleich/2-0-flach.svg', d.svg(stapel(ALT20))); d.png(alt, 1024, f'{OUT}/vergleich/2-0-1024.png')
    print('ok')
