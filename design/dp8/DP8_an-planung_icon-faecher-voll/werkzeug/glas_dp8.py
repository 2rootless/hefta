# DP8 · Glas-Nachstellung von F1 mit fertigen Seitenpolygonen (für Ansichten, Prüfbogen, 29-pt-Prüfung).
import sys; sys.path.insert(0, '/home/claude/hefta/b27')
import build_b27a as a, build_b27f_n1 as f, geo_dp8 as g
DECK = {'vorher': [(.30, .58, .22), (.42, .78, .32), (.55, .95, .44)],          # Rolle, Deckkraft hell, dunkel (B29a)
        'neu':    [(.40, .72, .30), (.47, .81, .36), (.55, .90, .42)]}           # angeglichen (PD7)
def icon(stufe, modus, px, uid):
    s = f.icon('seite', modus, px, uid)
    u = f'f{uid}'; m = f.modusfarben(modus); klar = modus.startswith('klar'); dunkel = modus in ('dunkel', 'klar-dunkel', 'getoent-dunkel')
    i0 = s.index(f'<g filter="url(#{u}d)"><g filter="url(#{u}f)">'); i1 = s.index(f'<g filter="url(#{u}d)"><path d="{f.DECKEL_PFAD}"')
    neu = ''
    for (x1, y0, y1, w), (r, n, d) in zip(g.SEITEN, DECK[stufe]):
        col, op = m['seite'](r, n, d)
        neu += (f'<g filter="url(#{u}d)"><g filter="url(#{u}f)"><path d="{g.pfad(g.seite_poly(x1, y0, y1, w))}" fill="{col}" fill-opacity="{op}"/></g></g>'
                f'<path d="{g.rechte_kante(x1, y0, y1, w)}" stroke="url(#{u}k)" stroke-width="5" stroke-linecap="round" opacity="{0.9 if (klar or dunkel) else 0.75}"/>')
    return s[:i0] + neu + s[i1:]
