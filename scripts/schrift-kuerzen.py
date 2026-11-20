"""Archivo für die Landingpage auf die Zeichen kürzen, die sie braucht (PC36, Frage 1 aus CP24).

Aufruf im Repo:  python scripts/schrift-kuerzen.py
Braucht fontTools mit Brotli (nur zum Bauen, nicht in der App). Schreibt web/archivo.woff2; der Bau der
Website kopiert diese Datei. Beide Achsen (Breite, Stärke) und die Kerning- und Ligatur-Tabellen bleiben.

Zeichen: alles, was in web/hefta2.html und web/version1.html steht, der Text des Ratgebers (DP36), dazu die feste Liste aus PC36
(Latein, deutsche Zeichen, Ziffern, Satzzeichen, €, „ “ ‚ ‘, –, …, ½) und ı, ş für Namen (DP30-Test).
Ändert sich der Text der Seite, das Skript wieder laufen lassen; ein Test prüft, dass jedes Zeichen
der Seite in der Schrift steht.
"""

import pathlib
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

WURZEL = pathlib.Path(__file__).resolve().parent.parent
QUELLE = WURZEL / 'node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2'
ZIEL = WURZEL / 'web/archivo.woff2'

FEST = (
    [chr(c) for c in range(0x20, 0x7F)]  # Latein, Ziffern, Satzzeichen
    + list('ÄÖÜäöüßéèêàâçëïîôûÉÈÀ')  # deutsche und häufige Zeichen in Namen
    + list('€„“‚‘”’–—…½·›‹×')
    + ['\u00a0', '\u00ad', '\u200b']  # geschütztes Leerzeichen, weicher Trennstrich, breitenloses Leerzeichen
    + list('ı')  # Namen wie im DP30-Test; „ş“ steht nur in der Datei für Latein-Erweiterung
)


def zeichen_der_seite() -> set[str]:
    zeichen: set[str] = set()
    for name in ['hefta2.html', 'version1.html']:
        t = (WURZEL / 'web' / name).read_text(encoding='utf-8')
        # Nur Text: Tags und Attribute weg, Entitäten wie &shy; zählen als ihr Zeichen.
        t = re.sub(r'<style.*?</style>|<script.*?</script>', ' ', t, flags=re.S)
        t = t.replace('&shy;', '­').replace('&nbsp;', ' ').replace('&amp;', '&')
        text = re.sub(r'<[^>]+>', ' ', t)
        # Text in den Zeichnungen (<text> im SVG) steckt schon im Text zwischen den Tags.
        zeichen |= set(text)
    # DP36: Der Ratgeber auf hefta.de trägt seither dieselbe Schrift; sein Text steht in data/ratgeber.de.json,
    # die festen Wörter der Seite in build/ratgeber.ts. Nur Zeichen, die es in Latein gibt, kommen hinein.
    # PC40: dazu Datenschutz, Impressum und Rückmeldung (Texte des Generators und der Rückfrage).
    for name in [
        'data/ratgeber.de.json',
        'build/ratgeber.ts',
        'data/datenschutz.de.html',
        'data/datenschutz-zusatz.de.json',
        'data/impressum.de.html',
        'src/i18n/de.json',
    ]:
        zeichen |= set((WURZEL / name).read_text(encoding='utf-8'))
    return {z for z in zeichen if z not in '\n\r\t'}


def main() -> None:
    gebraucht = zeichen_der_seite() | set(FEST)
    # ı und ş stehen nicht in der Datei für Latein, nur in der für Latein-Erweiterung: dazunehmen, wenn sie
    # dort sind. Die Website hat bisher nur die Datei für Latein geladen.
    schrift = TTFont(QUELLE)
    vorhanden = set(schrift.getBestCmap())
    fehlt = sorted(z for z in gebraucht if ord(z) not in vorhanden and z.strip())
    if fehlt:
        print('Nicht in der Datei für Latein:', ' '.join(f'{z} U+{ord(z):04X}' for z in fehlt))
    opt = subset.Options()
    opt.flavor = 'woff2'
    opt.layout_features = ['*']
    opt.name_IDs = ['*']
    opt.notdef_outline = True
    opt.glyph_names = False
    sub = subset.Subsetter(opt)
    sub.populate(unicodes=[ord(z) for z in gebraucht if ord(z) in vorhanden])
    sub.subset(schrift)
    schrift.flavor = 'woff2'
    schrift.save(ZIEL)
    # Die Liste der Zeichen in der Schrift, für den Test (build/webseite.test.ts).
    drin = sorted(chr(c) for c in TTFont(ZIEL).getBestCmap())
    (WURZEL / 'web/archivo-zeichen.txt').write_text(''.join(drin), encoding='utf-8')
    vorher = QUELLE.stat().st_size
    nachher = ZIEL.stat().st_size
    print(f'{QUELLE.name}: {vorher} Byte -> {ZIEL.name}: {nachher} Byte ({len(gebraucht)} Zeichen)')


if __name__ == '__main__':
    sys.exit(main())
