"""Vergleichsbogen PD158: 2.0, A1, A1b. Oben flach groß, Mitte echte Größen in der Glas-Nachstellung (Standard, hell und dunkel),
unten 58 px sechsfach vergrößert (pixelgenau), wo die Lücke zugeht. Dazu die Anlage von Code mit gemessener Lückentiefe."""
from PIL import Image, ImageDraw, ImageFont
import json
from PIL import ImageChops
komma = lambda x: f'{x:.2f}'.replace('.', ',')
def rund(a):
    m = Image.new('L', (a.size[0] * 4,) * 2, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, m.size[0] - 1, m.size[1] - 1), radius=int(m.size[0] * .2237), fill=255)
    return a, m.resize(a.size, Image.LANCZOS)
D = '/home/claude/hefta/d118'; F = '/usr/share/fonts/opentype/inter/'
f = lambda s, w='Regular': ImageFont.truetype(F + f'Inter-{w}.otf', s)
LU = json.load(open(f'{D}/luecke118.json'))
W = 2000; H = 2060; img = Image.new('RGB', (W, H), '#f4f1ec'); d = ImageDraw.Draw(img)
d.text((48, 36), 'App-Symbol: 2.0, A1 (DP63b) und A1b (neu, PD158)', font=f(40, 'SemiBold'), fill='#1d1b19')
d.text((48, 90), 'A1b ist die Form von 2.0 in den Farben von A1, Strich 3,2 wie im Logo. Glas: Nachstellung im Browser, nicht Icon Composer.', font=f(24), fill='#5c5650')
spalten = [('2.0', '20', '2.0'), ('A1', 'A1', 'A1 (DP63b)'), ('A1b', 'A1b', 'A1b (neu)')]
x0s = [48, 700, 1352]
flach = {'2.0': f'{D}/out/vergleich/2-0-1024.png', 'A1': f'{D}/luecke/A1-flach-1024.png', 'A1b': f'{D}/out/flach/app-symbol-A1b-1024.png'}
for (fa, k, name), x0 in zip(spalten, x0s):
    d.text((x0, 150), name, font=f(30, 'SemiBold'), fill='#1d1b19')
    img.paste(Image.open(flach[fa]).resize((420, 420), Image.LANCZOS), (x0, 200))
    lu = LU[fa]; g58 = min(v for kk, v in lu['glas'].items() if kk.startswith('58'))
    d.text((x0, 636), f'Lückentiefe 58 px: flach {komma(lu["flach"]["58"])}, Glas schlechtester {komma(g58)}', font=f(20), fill='#5c5650')
    # echte Größen, Standard, auf hellem und dunklem Grund
    for j, (grund, bg) in enumerate((('hell', '#e9e6ef'), ('dunkel', '#1c1c1e'))):
        y = 690 + j * 290; d.rectangle((x0, y, x0 + 600, y + 270), fill=bg); x = x0 + 16
        for px in (180, 120, 87, 58):
            a, m = rund(Image.open(f'{D}/png/einzel/{k}-{grund}-normal-{px}.png')); img.paste(a, (x, y + 16), m); x += px + 18
        d.text((x0 + 16, y + 236), f'Standard, Grund {grund}: 180, 120, 87, 58 px in echter Größe', font=f(17), fill='#8a8580' if j == 0 else '#b8b2ac')
    # 58 px sechsfach: Standard und Getönt hell (schlechteste Darstellung)
    y = 1320
    for i, modus in enumerate(('normal', 'getoent-hell')):
        a = Image.open(f'{D}/png/einzel/{k}-hell-{modus}-58.png').resize((290, 290), Image.NEAREST); img.paste(a, (x0 + i * 305, y))
        d.text((x0 + i * 305, y + 296), ('Standard' if modus == 'normal' else 'Getönt hell') + f' · {komma(lu["glas"]["58 " + modus + "/hell"])}', font=f(18), fill='#5c5650')
d.text((48, 1274), '58 px, sechsfach vergrößert, Pixel wie gerendert (Glas-Nachstellung, Grund hell)', font=f(22, 'SemiBold'), fill='#1d1b19')
# Anlage von Code
y = 1700; d.text((48, y), 'Anlage PD158 (Bau von Code, A1): gemessen mit derselben Mittellinie', font=f(22, 'SemiBold'), fill='#1d1b19')
x = 48
for n, w in (('design-180', '0,99'), ('bau-174', '0,94'), ('design-120', '0,91'), ('bau-116', '0,83')):
    a = Image.open(f'{D}/anlage/kachel/{n}.png'); img.paste(a, (x, y + 44)); d.text((x, y + 44 + a.size[1] + 8), f'{n.replace("-", " ")} px · {w}', font=f(17), fill='#5c5650'); x += max(a.size[0], 200) + 32
d.text((x + 20, y + 60), 'Im Bau ist die Lücke jeweils 0,05 bis 0,08\nweniger tief als im Entwurf. Die Kanten im Bau\nsind etwa 3 px weich mit Überschwingern:\nverkleinert oder vergrößert aus einem anderen\nRaster. Ursache nicht geprüft, Frage an Code.', font=f(19), fill='#5c5650', spacing=6)
d.text((48, H - 40), 'Lückentiefe: 1 = ganz offen, 0 = zu; 10 %-Quantil entlang der Mittellinie. Grenze SY1b: flach ≥ 0,75, Glas ≥ 0,5 und nicht unter 2.0.', font=f(18), fill='#8a8580')
img.save(f'{D}/png/DP111-1-vergleich-2-0-A1-A1b.png'); print(img.size)
for n in ('hell', 'dunkel'):
    for fa in ('20', 'A1', 'A1b'):
        b = Image.open(f'{D}/png/bogen-{fa}-{n}.png'); b.crop((0, 0, b.size[0], 1690)).save(f'{D}/png/DP111-bogen-{fa}-{n}.png')
