# Icon Composer · F1 „gefächerte Seiten“ (DP8)

Ersetzt die Ebenen und die `TEST.md` aus B27f-n1.

## Ebenen (1024er Raster, ohne Effekte)

| Gruppe | Datei | Hinweis |
| --- | --- | --- |
| 1 (oben) | `1-klammer.svg` | Klammer, Papier #fbf8f2 |
| 2 | `2-deckel.svg` | Deckel #661f14, endet bei x = 772 |
| 3 | `3-seite-1.svg` (vorn, 0°), `3-seite-2.svg` (6°), `3-seite-3.svg` (hinten, 12°) | **Die Drehung ist schon eingezeichnet.** Drehpunkt (772, 880). Jede Seite endet links genau bei x = 772. Im Composer nichts drehen oder verschieben. |
| Hintergrund | – | Füllung #3f130b |

## Deckkraft der Seiten

| Seite | hell | dunkel |
| --- | --- | --- |
| Seite 1 (vorn) | 90 % | 42 % |
| Seite 2 | 81 % | 36 % |
| Seite 3 (hinten) | 72 % | 30 % |

**Angeglichen nach PD7:** Bei 29 pt soll die vordere Seite nicht als einzelner heller Balken stehen.

## Dunkle Variante

| Ebene | Farbe |
| --- | --- |
| Deckel | #521c12 |
| Hintergrund | #2a0d07 |
| Klammer und Seiten | #f3ede4 |

## Einstellungen

- **Seiten:** „Translucency“ 20 bis 40 %, „Specular“ an, „Shadow“ an.
- **Deckel:** „Shadow“ auf „Neutral“, er wirft nach rechts.
- **Klammer:** „Specular“ an.

## Bitte am iPhone prüfen (Testbau)

1. Ragt im klaren Modus etwas in den Deckel hinein? Erwartet: nein.
2. Wirken die Spiegelungen an den schrägen Kanten ruhig?
3. Liest man bei 29 und 40 pt einen Fächer, oder nur einen hellen Balken?
4. Tritt der Deckel im Dunkeln auf dem Startbildschirm genug hervor?
