# DP8 · Geometrie der gefächerten Seiten (F1): Rechteck mit runden rechten Ecken, gedreht um (KANTE, 880), links an der Deckelkante abgeschnitten.
from shapely.geometry import Polygon, box
from shapely import affinity
import math
KANTE, R = 772, 30
PIVOT = (KANTE, 880)
# von hinten nach vorn: (x1, y0, y1, Drehung)
SEITEN = [(870, 170, 880, 12), (870, 170, 880, 6), (870, 170, 880, 0)]
def roh(x1, y0, y1, x0=KANTE - 400, n=12):
    pts = [(x0, y0), (x1 - R, y0)]
    for i in range(n + 1):
        a = -math.pi / 2 + (math.pi / 2) * i / n; pts.append((x1 - R + R * math.cos(a), y0 + R + R * math.sin(a)))
    for i in range(n + 1):
        a = (math.pi / 2) * i / n; pts.append((x1 - R + R * math.cos(a), y1 - R + R * math.sin(a)))
    pts.append((x0, y1))
    return Polygon(pts)
def seite_poly(x1, y0, y1, w):
    p = affinity.rotate(roh(x1, y0, y1), w, origin=PIVOT)   # shapely: positiv = gegen den Uhrzeigersinn in y-oben; in SVG (y unten) ist das im Uhrzeigersinn wie rotate(w)
    return p.intersection(box(KANTE, -400, 1600, 1600))
def pfad(poly):
    c = list(poly.exterior.coords)
    return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in c[:-1]) + 'Z'
def rechte_kante(x1, y0, y1, w):
    # Linie entlang der rechten Kante (für den hellen Saum), gedreht
    from shapely.geometry import LineString
    l = affinity.rotate(LineString([(x1 - 3, y0 + R), (x1 - 3, y1 - R)]), w, origin=PIVOT)
    (a, b), (c, d) = l.coords
    return f'M{a:.1f} {b:.1f}L{c:.1f} {d:.1f}'
