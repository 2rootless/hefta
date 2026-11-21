# Logo und Icon von Hefta

Stand: Hefta 2, Icon F1 mit gefächerten Seiten (DP8, PD7). Ersetzt die README aus DP5 (D005).

## Zeichen

Das Zeichen ist eine Büroklammer, zum Haus gebogen. „Heften“ heißt Papiere zusammenhalten. Der Strich ist kräftig, ein Blatt gehört nicht dazu.

| Datei | Wofür |
| --- | --- |
| `hefta-marke.svg` | Zeichen allein in Tinte, für helle Gründe |
| `hefta-marke-hell.svg` | dasselbe hell, für dunkle Gründe |
| `hefta-logo.svg`, `hefta-logo-dunkel.svg` | Zeichen und Wortmarke „hefta“ (Archivo, als Pfad). So steht es im Kopf von App und Website. |

**In der App:**
- Das Zeichen folgt dem Thema und ist ein Pfad mit `stroke: currentColor`.
- Strich 3,2 im 32er Raster.

**Regeln:**
- Das Zeichen ist **immer einfarbig und aus einem Stück**, auch im App-Icon (E95).
- So bleibt es in Druck, Fax und hartem Schwarzweiß gleich.
- Mindestgröße 16 px.
- Schutzraum: ein Viertel der Zeichenhöhe.
- Nicht drehen, nicht verzerren, keinen zweiten Akzent hinzufügen, nicht teilen.

## App-Icon „Seiten von der Seite“, gefächert (F1)

Das Icon zeigt einen Deckel im tiefen Rostrot. Darauf liegt die Klammer. Rechts schauen drei Seiten aus Papier hervor, gefächert um die Ecke unten an der Deckelkante (0°, 6°, 12°). Es ist eine Mappe, zusammengehalten.

| Teil | Wert |
| --- | --- |
| Deckel | #661f14 |
| Grund rechts | #3f130b |
| Klammer | Papier #fbf8f2 |
| Seiten, flach (von hinten nach vorn) | #c6b8b1, #d7ccc6, #e8e1db, dazu je ein schmaler Schatten der vorderen Seite (Schwarz, 20 %) |
| iOS dunkel | Deckel #521c12, Grund #2a0d07, Klammer und Seiten #f3ede4 |

- **Die Seitentöne** sind Papier über Grund, gemischt mit 72, 81 und 90 % Deckkraft (angeglichen, damit klein ein Fächer und kein einzelner Balken entsteht). Das Maß gegen die Personenfarben gilt für das App-Icon nicht (P007).
- **Glas (iOS ab 26):** Es entsteht im Icon Composer aus den Ebenen Klammer, Deckel und Seiten. Die Quelle liegt bei Code, nach DP8 (`icon-composer/`, `TEST.md`). Die Seiten sind dort schon gedreht und enden an der Deckelkante.

| Datei | Wofür |
| --- | --- |
| `hefta-icon-flach.svg`, `png/hefta-icon-flach-1024.png` | quadratisch, ohne Rundung: Grundlage aller flachen Fassungen, App Store |
| `hefta-icon.svg`, `png/hefta-icon-512.png`, `-192.png` | abgerundet: Landingpage, Manifest |
| `png/apple-touch-icon.png` | 180, eckig, iOS rundet selbst |
| `hefta-icon-maskable.svg`, `png/hefta-icon-maskable-512.png` | Manifest `purpose: maskable`, Stapel auf 80 % |
| `favicon.svg`, `png/favicon-32.png` | Tabs ab 32 px: Klammer und zwei gefächerte Seiten |
| `favicon-16-quelle.svg`, `png/favicon-16.png` | 16 px: nur die Klammer auf dem Deckel, ohne Seiten |

**Android** (adaptiv, einfarbig): nach DP8. Das Symbol der Erinnerungen `ic_stat_hefta` bleibt wie in D002.

- **Kachel in der App** (`--app-zeichen`, erster Start, Ziel am Ende des Wegs): nur die Klammer in Papier auf dem Deckel #661f14. Die Seiten wären dort zu fein.
- **Am Ende des Wegs** steht das Zeichen blass (Tinte, 18 %) in einem gestrichelten Feld, solange etwas fehlt. Ist alles da, wird daraus die Kachel.

## Überholt

Diese Dateien gelten nicht mehr und werden nicht mehr benutzt:

- `hefta-app-symbol.svg` und `hefta-app-symbol-maskable.svg`, die weiße Klammer auf Koralle #ff8466
- das alte `favicon.svg` auf Koralle
- `hefta-app-symbol-512.png`
- die gereihten Seiten aus D002 und DP5 (ersetzt durch F1)
