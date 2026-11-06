"""Erzeugt die statischen Archivo-Schnitte für die PDF-Mappe.

Einmalig auszuführen (Ergebnis liegt im Repo). Quelle: google/fonts, ofl/archivo,
Archivo[wdth,wght].ttf, Lizenz OFL-1.1. Aufruf:
    python scripts/make-pdf-fonts.py <Pfad zu Archivo[wdth,wght].ttf>
Benötigt fonttools (pip install fonttools).
"""

import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SCHNITTE = {
    "Archivo-Regular.ttf": {"wght": 400, "wdth": 100},
    "Archivo-Bold.ttf": {"wght": 700, "wdth": 100},
    "Archivo-ExtraBold-Wide.ttf": {"wght": 800, "wdth": 108},
}

quelle = Path(sys.argv[1])
ziel = Path(__file__).resolve().parent.parent / "src" / "pdf" / "fonts"
ziel.mkdir(parents=True, exist_ok=True)
for name, achsen in SCHNITTE.items():
    font = TTFont(quelle)
    statisch = instancer.instantiateVariableFont(font, achsen, updateFontNames=False)
    statisch.save(ziel / name)
    print(name, (ziel / name).stat().st_size)
