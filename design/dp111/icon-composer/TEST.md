# Icon Composer · App-Symbol A1b (DP111)

Ersetzt die Ebenen aus DP8 für die nächste Version. Die Form ist die aus DP8 (2.0), nur die Farben sind die von A1 (DP63b). Die Klammer hat den Strich 3,2 wie im Logo.

## Ebenen (1024er Raster, flach, ohne Effekte)

Apple sagt dazu: Schatten, Unschärfe, Spiegelung, Deckkraft und Hintergrund nicht ins Bild backen, das macht Icon Composer.

| Gruppe | Datei | Hinweis |
| --- | --- | --- |
| 1 (oben) | `1-klammer.svg` | Klammer, Papier `#fdf8f1`, Strich 3,2 im 32er-Raster, Maß 20 um (396, 512) |
| 2 | `2-deckel.svg` | Deckel `#b3261e`, endet bei x = 772 |
| 3 | `3-seite-1.svg` (vorn, 0°), `3-seite-2.svg` (6°), `3-seite-3.svg` (hinten, 12°) | Papier `#fdf8f1`. **Die Drehung ist schon eingezeichnet**, Drehpunkt (772, 880). Jede Seite beginnt links genau bei x = 772. Im Composer nichts drehen oder verschieben. |
| Hintergrund | – | Füllung `#8a1d17` |

## Deckkraft der Seiten (wie 2.0, DP8)

| Seite | Standard | Dunkel |
| --- | --- | --- |
| Seite 1 (vorn) | 90 % | 42 % |
| Seite 2 | 81 % | 36 % |
| Seite 3 (hinten) | 72 % | 30 % |

## Dunkel

Farbe in Icon Composer je Darstellung setzen (Color: nicht „All“).

| Ebene | Standard | Dunkel |
| --- | --- | --- |
| Deckel | `#b3261e` | `#8a1d17` |
| Hintergrund | `#8a1d17` | `#4d110c` |
| Klammer und Seiten | `#fdf8f1` | `#f3ede4` |

Kontrast Klammer auf Deckel: 6,19 : 1 (Standard), 7,95 : 1 (Dunkel).

## Einstellungen der Gruppen

- **Gruppe 2 (Deckel):** Shadow „Chromatic“ statt „Neutral“. So färbt der Schatten rötlich statt schwarz, und rechts vom Deckel entsteht kein dunkler Balken. In der Nachstellung ist „Neutral“ fast genauso hell. Nur in „Klar, hell“ und „Getönt, hell“ wird es dann so dunkel wie 2.0 oder knapp darunter.
- **Gruppe 3 (Seiten):** Translucency 20 bis 40 %, Specular „Automatic“, Shadow an.
- **Gruppe 1 (Klammer):** Specular „Automatic“.
- Keine Schatten, Verläufe oder Ränder in den SVG.

## Größen

Die Bildgrößen erzeugt Xcode aus der `.icon`-Datei. Bitte kein kleines PNG hoch- oder herunterrechnen. In der Anlage zu PD158 sind die Kanten im Bau etwa 3 px weich mit Überschwingern, und die Lücke wird dadurch weniger tief (Abschnitt 4 in DP111).

## Bitte am iPhone prüfen (Testbau, W12)

1. Ist die Lücke zwischen äußerem und innerem Haus bei der kleinsten Größe (Einstellungen, Spotlight) noch offen? Erwartet: ja, in allen Darstellungen.
2. Liegt rechts vom Deckel ein dunkler Balken, in Standard, Dunkel und Klar? Erwartet: nein, nicht dunkler als in 2.0.
3. Ragt im klaren Modus etwas in den Deckel hinein? Erwartet: nein.
4. Liest man bei 29 und 40 pt einen Fächer, nicht nur einen hellen Balken?
5. Tritt der Deckel im Dunkeln auf dem Startbildschirm genug hervor?

Bitte ein Bildschirmfoto je Darstellung mitschicken (Standard, Dunkel, Klar hell und dunkel, Getönt hell und dunkel), dann prüfe ich SY1b und SY3 am echten Glas nach.
