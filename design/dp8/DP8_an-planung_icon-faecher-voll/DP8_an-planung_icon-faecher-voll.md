Nr: DP8 · Von: Design · An: Planung
Antwort auf: PD7
Erhalten seit der letzten Nachricht: PD7
Status: Fertig zum Weitergeben

# App-Icon F1 (gefächerte Seiten), volle Fassung

## Kurz

- **F1 in allen Fassungen wie D002:**
  - Icon Composer
  - flach (App Store)
  - Landingpage
  - Favicon 16 und 32
  - Manifest (`maskable`, `apple-touch-icon`)
  - Android, adaptiv und einfarbig. `ic_stat_hefta` bleibt wie in D002 und liegt nur zur Vollständigkeit bei.
- **Seiten:** Sie sind um die Ecke unten an der Deckelkante gefächert, um 0°, 6° und 12°. Jede Seite endet links genau an der Kante (x = 772). Im klaren Modus ragt nichts in den Deckel; das ist nachgemessen.
- **Die vordere Seite bei 29 pt (PD7):** Ich habe die Helligkeit der drei Seiten angeglichen. Hell sind es jetzt 72, 81 und 90 % statt 58, 78 und 95 %. Klein liest man einen Fächer und keinen einzelnen Balken. Vorher und nachher stehen in `DP8-29pt-vorher-nachher.png`.
- **Flach:** Ohne Glas trennt ein schmaler Schatten der vorderen Seite auf der hinteren die drei Seiten.
- **Logo-Kit:** `logo-kit/logo/` ist vollständig. Code kann es als Ganzes ersetzen. Die README ist nachgezogen.

## Dateien

| Ordner | Inhalt |
| --- | --- |
| `icon-composer/` | `1-klammer.svg`, `2-deckel.svg`, `3-seite-1…3.svg` (fertig gedreht), `TEST.md` |
| `flach/` | `hefta-icon-flach.svg`, `-1024.png` |
| `web/` | `hefta-icon.svg`, `-512.png`, `-192.png`, `apple-touch-icon.png`, `hefta-icon-maskable.svg`, `-512.png` |
| `favicon/` | `favicon.svg` und `favicon-32.png` mit zwei Seiten; `favicon-16.png` nur mit der Klammer (Quelle `favicon-16-quelle.svg`) |
| `android/` | `ic_launcher_foreground.svg`, `ic_launcher_background.svg`, `ic_launcher_monochrome.svg`, dazu PNG in allen Dichten. `ic_stat_hefta` ist unverändert. |
| `logo-kit/logo/` | das ganze Kit mit README |
| `bilder/` | `DP8-pruefbogen.png`, `DP8-glas.png` (sechs Ansichten, nachgestellt), `DP8-29pt-vorher-nachher.png` |

## Farben

| Teil | Wert |
| --- | --- |
| Deckel, Grund, Klammer | wie D002: #661f14, #3f130b, #fbf8f2 |
| Seiten flach (von hinten nach vorn) | #c6b8b1, #d7ccc6, #e8e1db |
| iOS dunkel | wie D002 |

## Für Code

1. **Alles in einem Zug ersetzen,** wie PD7 es vorsieht. Das betrifft die Ebenen für den Icon Composer, flach, Web, Favicon, Android und das Logo-Kit.
2. **Icon Composer:** nach der neuen `TEST.md`. Die Seiten sind fertig gedreht, im Composer bitte nichts drehen.
3. **`--app-zeichen`** bleibt unverändert: Klammer auf dem Deckel, ohne Seiten.

## Prüfkatalog DP8

| Fall | Ergebnis |
| --- | --- |
| Seiten enden links an der Deckelkante (gemessen: kleinster x-Wert jeder Seite 772,0) | ok |
| 29 pt und 40 pt, hell und dunkel: Fächer statt Balken | ok, nach dem Angleichen |
| sechs Ansichten im nachgestellten Glas | ok; schräge Kanten ruhig |
| Favicon 16 (nur Klammer) und 32 (zwei Seiten) im Tab, hell und dunkel | erkennbar |
| Landingpage, hell und dunkel; `apple-touch-icon`; `maskable` im Kreis | ok |
| Android in vier Masken, Thema hell und dunkel, 48 dp | Klammer vollständig, Fächer sichtbar |
| echter Test im Glas | steht aus; der Auftraggeber macht ihn am iPhone mit dem nächsten Testbau |

## Vom Auftraggeber direkt

Seit DP7 nichts Neues.

## Protokoll

- Neu: `build_dp8.py`, `geo_dp8.py`, `glas_dp8.py`, `pruef_dp8.py` und alle Dateien oben.
- Gegenüber der Skizze DP7: die Deckkraft der Seiten (siehe Kurz).
- D002 und DP5 sind ersetzt.

Fertig zum Weitergeben.
