#!/usr/bin/env python3
"""SY1b neu (E326): Lücke zwischen äußerem und innerem Haus entlang der ganzen Mittellinie messen, nicht an einer Zeile.
Mittellinie aus der Klammer bei 4096 px (Schließen mit Kreis, Skelett). Auf jedem gerenderten Bild in der Zielgröße
wird an der Mittellinie gelesen: Tiefe = (L Klammer − L Lücke) / (L Klammer − L Deckel). 1 = ganz offen, 0 = zu.
Grenze: 10 %-Quantil der Tiefe ≥ 0,5 (an keiner nennenswerten Stelle mehr als halb zu)."""
import sys, json, subprocess, os, numpy as np
sys.path.insert(0, '/home/claude/hefta/d118'); import sym118 as s, ansichten118 as an
sys.path.insert(0, '/home/claude/hefta/d002'); import build_d002 as d
from PIL import Image
from scipy import ndimage as ndi
from skimage.morphology import skeletonize, disk, binary_closing
D = '/home/claude/hefta/d118'; T = f'{D}/luecke'; os.makedirs(T, exist_ok=True)
N = 2048
def lum(a):
    a = a[..., :3] / 255.0; a = np.where(a <= .04045, a / 12.92, ((a + .055) / 1.055) ** 2.4); return a @ np.array([.2126, .7152, .0722])
def linien(v, name):
    p = f'{T}/{name}-klammer.svg'; open(p, 'w').write(d.svg(f'<rect width="1024" height="1024" fill="#000"/>' + s.klammer(v, farbe='#fff')))
    subprocess.run(['rsvg-convert', '-w', str(N), '-h', str(N), p, '-o', p[:-4] + '.png'], check=True)
    k = np.asarray(Image.open(p[:-4] + '.png').convert('L')) > 127
    g_px = (4.9 - v['sw']) * v['s'] * N / 1024; r = int(g_px / 2 + 6)
    # Schließen nur in einer Hülle, damit offene Ecken außen nicht mitzählen
    dil = ndi.distance_transform_edt(~k) <= r; zu = ndi.distance_transform_edt(dil) > r   # Schließen über Abstandskarten (schnell)
    luecke = zu & ~k
    dist = ndi.distance_transform_edt(~k)
    sk = skeletonize(luecke) & (dist >= .35 * g_px / 2) & (dist <= g_px / 2 + 3)
    ys, xs = np.nonzero(sk)
    kern = np.argwhere(ndi.distance_transform_edt(k) >= v['sw'] * v['s'] * N / 1024 * .4)   # Mitte des Strichs
    return np.c_[xs, ys] / N * 1024, kern[:, ::-1] / N * 1024, g_px
def lies(bild, pkt, px):
    a = lum(np.asarray(Image.open(bild).convert('RGB')).astype(float)); k = a.shape[1] / 1024
    return ndi.map_coordinates(a, [pkt[:, 1] * k - .5, pkt[:, 0] * k - .5], order=1, mode='nearest')
def tiefe(bild, mitte, kern, deckel_pkt):
    lg, lk, ld = lies(bild, mitte, 0), np.median(lies(bild, kern, 0)), np.median(lies(bild, deckel_pkt, 0))
    t = (lk - lg) / (lk - ld); return np.quantile(t, .10), t.min()
if __name__ == '__main__':
    FASS = {'2.0': s.ALT20, 'A1': an.A1, 'A1b': s.A1B}
    deckel_pkt = np.array([[60, y] for y in range(150, 900, 25)] + [[700, 140], [700, 900]], float)
    L = json.load(open(f'{D}/html/liste.json')); erg = {}
    for fa, v in FASS.items():
        mitte, kern, g = linien(v, fa.replace('.', ''))
        # flach in den echten Größen (rsvg, wie das App-Store-PNG)
        flach = {'2.0': f'{D}/out/vergleich/2-0-flach.svg', 'A1': '/home/claude/hefta/d63b/app-symbol/app-symbol-A1-quadrat.svg', 'A1b': f'{D}/out/flach/app-symbol-A1b-flach.svg'}[fa]
        zeile = {'mittelpunkte': len(mitte), 'flach': {}, 'glas': {}}
        for px in (1024, 180, 120, 87, 58, 40, 29):
            z = f'{T}/{fa}-flach-{px}.png'; subprocess.run(['rsvg-convert', '-w', str(px), '-h', str(px), flach, '-o', z], check=True)
            q, m = tiefe(z, mitte, kern, deckel_pkt); zeile['flach'][px] = round(float(q), 2)
        for x in [e for e in L if e['fassung'] == fa and e['px'] in (58, 87)]:
            q, m = tiefe(f'{D}/png/einzel/{x["id"]}.png', mitte, kern, deckel_pkt); zeile['glas'][f'{x["px"]} {x["modus"]}/{x["grund"]}'] = round(float(q), 2)
        erg[fa] = zeile
        g58 = min(v for k, v in zeile['glas'].items() if k.startswith('58'))
        print(f'{fa:4} Mittellinie {len(mitte)} Punkte · flach', zeile['flach'], f'· Glas 58 px schlechtester Wert {g58}')
    json.dump(erg, open(f'{D}/luecke118.json', 'w'), indent=1, ensure_ascii=False)
