# DP8 · Icon F1 (gefächerte Seiten), volle Fassung: Icon Composer, flach, Landingpage, Favicon, Manifest, Android, Logo-Kit.
import os, sys
sys.path.insert(0, '/home/claude/hefta/d002')
import build_d002 as d, geo_dp8 as g
from shapely.geometry import box
from shapely import affinity
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(OUT, exist_ok=True)
PAPIER, DECKEL, GRUND, GANZ = d.PAPIER, d.DECKEL, d.GRUND, d.GANZ
K = g.KANTE
DECK_HELL = [.72, .81, .90]; DECK_DUNKEL = [.30, .36, .42]          # von hinten nach vorn (PD7: angeglichen)
FLACH = [d.mix(GRUND, PAPIER, op) for op in DECK_HELL]
POLY = [g.seite_poly(x1, y0, y1, w) for x1, y0, y1, w in g.SEITEN]
def schreibe(name, inhalt):
    p = os.path.join(OUT, name); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w').write(inhalt); return p
def png(src, px, ziel): d.png(src, px, os.path.join(OUT, ziel))
def seiten_flach(polys=POLY, farben=FLACH, kante=K, params=g.SEITEN):
    t = ''
    for i, (p, c) in enumerate(zip(polys, farben)):
        if i > 0:  # Schatten der vorderen Seite auf die hintere: dunkle Linie knapp rechts ihrer Kante, nur auf der hinteren Seite
            x1, y0, y1, w = params[i]
            from shapely.geometry import LineString
            l = affinity.rotate(LineString([(x1 + 4, y0 + 20), (x1 + 4, y1 - 20)]), w, origin=g.PIVOT).buffer(5, cap_style=2).intersection(polys[i - 1])
            if not l.is_empty:
                for q in getattr(l, 'geoms', [l]):
                    if q.geom_type == 'Polygon': t += f'<path d="{g.pfad(q)}" fill="#000" fill-opacity=".2"/>'
        t += f'<path d="{g.pfad(p)}" fill="{c}"/>'
    # flacher Schatten des Deckels: schmaler dunkler Streifen an der Kante, nur auf den Seiten
    u = polys[0]
    for p in polys[1:]: u = u.union(p)
    streif = u.intersection(box(kante, -100, kante + 12, 1200))
    if not streif.is_empty:
        geoms = getattr(streif, 'geoms', [streif])
        t += ''.join(f'<path d="{g.pfad(s)}" fill="#000" fill-opacity=".22"/>' for s in geoms if s.geom_type == 'Polygon')
    return t
def stapel():
    return f'<rect width="1024" height="1024" fill="{GRUND}"/>' + seiten_flach() + f'<path d="M0 0H{K}V1024H0Z" fill="{DECKEL}"/>' + d.klammer(PAPIER)
svg = d.svg
if __name__ == '__main__':
    # Icon Composer
    schreibe('icon-composer/1-klammer.svg', svg(d.klammer(PAPIER)))
    schreibe('icon-composer/2-deckel.svg', svg(f'<path d="M0 0H{K}V1024H0Z" fill="{DECKEL}"/>'))
    for i, p in enumerate(reversed(POLY), 1):        # 1 = vorn
        schreibe(f'icon-composer/3-seite-{i}.svg', svg(f'<path d="{g.pfad(p)}" fill="{PAPIER}"/>'))
    # flach
    f = schreibe('flach/hefta-icon-flach.svg', svg(stapel())); png(f, 1024, 'flach/hefta-icon-flach-1024.png')
    # Landingpage, Manifest
    r = schreibe('web/hefta-icon.svg', svg(f'<clipPath id="r"><rect width="1024" height="1024" rx="230"/></clipPath><g clip-path="url(#r)">{stapel()}</g>'))
    for px in (512, 192): png(r, px, f'web/hefta-icon-{px}.png')
    png(f, 180, 'web/apple-touch-icon.png')
    sk = .8; o = 512 * (1 - sk)
    m = schreibe('web/hefta-icon-maskable.svg', svg(f'<rect width="1024" height="1024" fill="{GRUND}"/><path d="M0 0H{o + K * sk:.1f}V1024H0Z" fill="{DECKEL}"/>'
                                                    f'<g transform="translate({o:.1f} {o:.1f}) scale({sk})">{seiten_flach()}<path d="M-200 -200H{K}V1300H-200Z" fill="{DECKEL}"/>{d.klammer(PAPIER)}</g>'))
    png(m, 512, 'web/hefta-icon-maskable-512.png')
    # Favicon: 32 mit Seiten (zwei vordere, Klammer kräftiger), 16 nur Klammer (wie D002)
    k32 = 760
    p32 = [affinity.translate(g.seite_poly(x1, y0, y1, w), 0, 0) for x1, y0, y1, w in g.SEITEN[1:]]
    P32 = [(900, 150, 880, 9), (870, 150, 880, 0)]
    p32 = [g.seite_poly(*q).intersection(box(k32, -400, 1600, 1600)) for q in P32]
    fav32 = (f'<clipPath id="r"><rect width="1024" height="1024" rx="200"/></clipPath><g clip-path="url(#r)"><rect width="1024" height="1024" fill="{GRUND}"/>'
             f'{seiten_flach(p32, FLACH[1:], k32, P32)}<path d="M0 0H{k32}V1024H0Z" fill="{DECKEL}"/>{d.klammer(PAPIER, 390, 512, 21, 4.2)}</g>')
    a32 = schreibe('favicon/favicon.svg', svg(fav32)); png(a32, 32, 'favicon/favicon-32.png')
    fav16 = (f'<clipPath id="r"><rect width="1024" height="1024" rx="190"/></clipPath><g clip-path="url(#r)"><rect width="1024" height="1024" fill="{DECKEL}"/>{d.klammer(PAPIER, 512, 528, 31, 3.8)}</g>')
    a16 = schreibe('favicon/favicon-16-quelle.svg', svg(fav16)); png(a16, 16, 'favicon/favicon-16.png')
    # Android adaptiv (108 dp = 1080, sichtbar 72 dp in der Mitte)
    s = 720 / 1024; o = 180
    vg = (f'<path d="M0 0H{o + K * s:.1f}V1080H0Z" fill="{DECKEL}"/><g transform="translate({o} {o}) scale({s})">{seiten_flach()}'
          f'<path d="M-300 -300H{K}V1400H-300Z" fill="{DECKEL}"/>{d.klammer(PAPIER)}</g>')
    av = schreibe('android/ic_launcher_foreground.svg', svg(vg, '0 0 1080 1080', 432))
    ah = schreibe('android/ic_launcher_background.svg', svg(f'<rect width="1080" height="1080" fill="{GRUND}"/>', '0 0 1080 1080', 432))
    mono_p = [g.seite_poly(x1, y0, y1, w).intersection(box(K + 14, -400, 1600, 1600)) for x1, y0, y1, w in g.SEITEN]
    mono = (f'<g transform="translate({o} {o}) scale({s})">' + ''.join(f'<path d="{g.pfad(p)}" fill="#000" fill-opacity="{op:.2f}"/>' for p, op in zip(mono_p, [.45, .65, .9]))
            + d.klammer('#000') + '</g>')
    am = schreibe('android/ic_launcher_monochrome.svg', svg(mono, '0 0 1080 1080', 432))
    for dd, px in (('mdpi', 108), ('hdpi', 162), ('xhdpi', 216), ('xxhdpi', 324), ('xxxhdpi', 432)):
        for n, src in (('foreground', av), ('background', ah), ('monochrome', am)):
            png(src, px, f'android/png/mipmap-{dd}/ic_launcher_{n}.png')
    print('ok', FLACH)
