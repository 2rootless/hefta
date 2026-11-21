Nr: DP111 · Von: Design · An: Planung, zur Weitergabe an Code
Antwort auf: PD158 (App-Symbol überarbeiten, E326). PD157 folgt als nächstes Paket.
Stand: 21. November 2026
Status: Fertig zum Weitergeben. Offen ist nur die Probe am iPhone (W12) mit echtem Icon Composer. Meine Glas-Bilder sind eine Nachstellung (Abschnitt 5).
Anlagen:
- app-symbol/
  - `app-symbol-A1b-quadrat.svg` und `app-symbol-A1b-1024.png`: App Store, ohne Rundung, ohne Transparenz
  - `app-symbol-A1b-rund.svg`, `app-symbol-A1b-maskable.svg`
  - `apple-touch-icon-A1b-180.png`, `icon-A1b-512.png`, `icon-A1b-192.png`, `icon-maskable-A1b-512.png`
- icon-composer/: Ebenen `1-klammer.svg`, `2-deckel.svg`, `3-seite-1..3.svg` und `TEST.md` mit Farben, Deckkraft, Einstellungen und Probe am iPhone
- bilder/
  - `DP111-1-vergleich-2-0-A1-A1b.png`: groß, echte Größen hell und dunkel, 58 px vergrößert, die Anlage von Code gemessen
  - `DP111-bogen-{20,A1,A1b}-{hell,dunkel}.png`: alle sechs Darstellungen, 1024 (als 256), 180, 120, 87, 58 px
- werkzeug/: Bau, Ansichten, Prüfung SY1 bis SY10 und Lückenmessung, jeweils mit Ausgabe

# DP111: App-Symbol A1b

## 1. Was an A1 falsch war (mein Fehler)

In DP63b habe ich geschrieben: „Das Symbol behält seine Form, nur der Deckel wird … rot.“ Das stimmt nicht. Ich habe A1 aus dem Favicon-Entwurf gebaut, nicht aus dem App-Symbol von 2.0 (DP8). Ich habe A1 nicht gegen 2.0 nachgemessen.

| | 2.0 (DP8) | A1 (DP63b) |
| --- | --- | --- |
| Strich der Klammer | 3,4 | 4,2 |
| Lage und Maß | Mitte 396/512, Maß 20 | Mitte 390/512, Maß 21 |
| Deckel | bis 772, direkt an den Seiten | bis 760, dazwischen ein dunkler Rückenstreifen |
| Seiten | drei, gefächert | zwei |

Was daraus folgt:
- Bei 58 px ist die Lücke zwischen äußerem und innerem Haus nur 0,83 px breit, deshalb läuft sie im Bau zu.
- Im Glas wird der Rückenstreifen mit dem schwarzen Schatten zu einem dunklen Balken.

A1 bleibt als Fassung stehen und wird nicht geändert. A1b ersetzt A1.

## 2. A1b

- **Form wie 2.0:** Klammer mit Maß 20 um 396/512, Deckel bis 772, drei Seiten gefächert (0°, 6°, 12° um 772/880). Alles aus der Geometrie von DP8.
- **Farben wie A1:**
  - Deckel `#b3261e`, Grund `#8a1d17`, Papier `#fdf8f1`
  - dunkel: Deckel `#8a1d17`, Grund `#4d110c`, helle Teile `#f3ede4`
- **Strich 3,2 wie im Logo.** Begründung: Im 32er-Raster liegen die Mitten der Wände 4,9 auseinander, die Lücke ist also 4,9 minus Strich. Bei 3,2 sind das 1,7 Einheiten, bei 58 px **1,93 px**. A1 hat 0,83 px, 2.0 hat 1,70 px. Mit 3,2 ist das Zeichen dasselbe wie das Logo auf Website und in der App. Eine eigene Strichstärke nur für das Symbol braucht es nicht.
- **Rücken und Schatten hell wie in 2.0:**
  - Ohne Rückenstreifen.
  - Flache Schatten der Seiten 12 % schwarz (2.0: 20 %).
  - Der Deckel wirft rötlich `#8a1d17` mit 22 % (2.0: schwarz).
  - In Icon Composer: Schatten des Deckels „Chromatic“ (TEST.md).
- **Flächen wie 2.0:** Deckel 64,2 %, Klammer 11,0 %, Seiten 11,9 %, Rest 12,9 %, jeweils höchstens 0,7 Prozentpunkte von 2.0 entfernt. A1 hat 5,6 Punkte weniger Deckel und 4,3 Punkte mehr Klammer.

## 3. Prüfkatalog SY

**A1b: 11 von 11 grün.** A1 als Gegenprobe wird bei SY1a, SY1b, SY2, SY3, SY4, SY5 und SY10 rot.

**Geprüft:**
- sechs Darstellungen (Standard, Dunkel, Klar hell und dunkel, Getönt hell und dunkel)
- 1024 (als 256), 180, 120, 87 und 58 px, je auf hellem und dunklem Grund
- bei Gerätepixelverhältnis 1, damit 58 px wirklich 58 Pixel sind
- flach zusätzlich bei 40 und 29 px

| Nr | Prüfung | A1b | A1 (Gegenprobe) |
| --- | --- | --- | --- |
| SY1a | Lücke bei 58 px, aus der Geometrie, ≥ 1 px | 1,93 px | **rot**, 0,83 px |
| SY1b | Lücke im Bild offen, entlang der ganzen Mittellinie: flach 58 px ≥ 0,75; Glas 58 px in jeder Darstellung ≥ 0,5 und nicht unter 2.0 | flach 0,83, Glas mindestens 0,53 | **rot**, flach 0,71, Glas 0,33 |
| SY2 | Strich wie im Logo (3,2) | 3,2 | **rot**, 4,2 |
| SY3 | Glas: dunkelste Spalte an der Deckelkante (x 755 bis 800, y 300 bis 700) in jeder Darstellung mindestens so hell wie 2.0 | überall ≥ 2.0 | **rot**, z. B. Standard 0,024 gegen 0,045 |
| SY4 | Haus wie 2.0: Maß 20, Mitte 396/512 | ja | **rot**, 21 und 390 |
| SY5 | drei Seiten, Deckel reicht bis an die Seiten | bis 772, drei | **rot**, bis 760, zwei |
| SY6 | Klammer auf Deckel ≥ 4,5 : 1 | 6,19 und 7,95 | grün |
| SY7 | Klar: keine Seite ragt in den Deckel (aus der Geometrie) | kleinstes x 772,0 | – |
| SY8 | Farbe A1 bleibt | `#b3261e` | – |
| SY9 | App Store: 1024 × 1024, RGB, ohne Transparenz | ja | – |
| SY10 | Flächen wie 2.0, ± 1,5 Prozentpunkte | ja | **rot**, Deckel −5,6, Klammer +4,3 |

**Zu SY1b:**
- So wird gemessen:
  - Die Mittellinie der Lücke kommt aus der Klammer bei 2048 px.
  - An jedem gerenderten Bild wird an etwa 540 Punkten dieser Linie gelesen.
  - Tiefe heißt: 1 ist ganz offen, 0 ist zu.
  - Gezählt wird der Wert, unter dem nur die schlechtesten 10 % der Punkte liegen.
- Meine erste Fassung las nur an einer Zeile. Dort blieb A1 grün. Das habe ich vor dem Versand gefunden und ersetzt.
- Die schwächste Darstellung ist bei allen drei Fassungen „Getönt hell“, weil Klammer und Deckel dort fast gleich hell werden.
  - A1b hat dort 0,53, 2.0 hat 0,52, A1 hat 0,33.
  - Der Abstand von A1b zur Grenze ist also klein. Er ist aber so groß wie bei 2.0, und mehr geht mit dem Strich des Logos nicht.

| flach, Lückentiefe | 180 | 120 | 87 | 58 | 40 | 29 |
| --- | --- | --- | --- | --- | --- | --- |
| 2.0 | 1,00 | 0,97 | 0,95 | 0,82 | 0,76 | 0,62 |
| A1 | 0,99 | 0,89 | 0,82 | 0,71 | 0,40 | 0,37 |
| A1b | 1,00 | 1,00 | 0,96 | 0,83 | 0,81 | 0,65 |

**Zu SY3, Gegenprobe zum Schatten:** A1b mit schwarzem Schatten („Neutral“) statt „Chromatic“ wird in 9 von 12 Fällen höchstens 0,005 dunkler. Der helle Rücken kommt also vor allem aus der Form.
- Klar hell auf hellem Grund: 0,513 statt 0,539 (2.0: 0,518), also knapp darunter.
- Getönt hell, auf beiden Gründen: 0,143 statt 0,228, also so dunkel wie 2.0.

Deshalb rate ich zu „Chromatic“. „Neutral“ wäre kein Rückschritt gegenüber 2.0.

## 4. Die Anlage von Code, nachgemessen

Gemessen mit derselben Mittellinie wie bei A1:

| Kachel | Lückentiefe |
| --- | --- |
| Entwurf 180 | 0,99 |
| Bau 174 | 0,94 |
| Entwurf 120 | 0,91 |
| Bau 116 | 0,83 |

- Meine Nachstellung von A1 bei 120 px ergibt 0,89 und liegt damit beim Entwurf. Die Messung passt also.
- **Im Bau ist die Lücke zusätzlich 0,05 bis 0,08 flacher.**
- In der großen Anlage sind die Kanten im Bau etwa 3 px weich, mit Über- und Unterschwingern (Helligkeit 255 neben 70). Im Entwurf ist es 1 px.
- Das sieht nach Umrechnen aus einem anderen Raster aus. Die Ursache habe ich nicht geprüft (Frage 2).
- A1b hat genug Lücke, dass sie auch so offen bleibt. Besser ist es trotzdem, wenn jede Größe direkt aus der `.icon`-Datei kommt.

## 5. Was ich nicht nachstellen kann (offen gesagt)

- **Icon Composer selbst:**
  - Die Glas-Bilder kommen aus meiner Nachstellung im Browser, mit SVG-Filtern für Spiegelung, Lichtbrechung, Schatten und Tönung.
  - Das echte Glas von iOS 26 ist anders, vor allem bei „Klar“ und „Getönt“.
  - Die Werte zu SY1b und SY3 sind daher Vergleiche innerhalb derselben Nachstellung: A1b gegen 2.0 gegen A1. Es sind keine Werte vom Gerät.
- **Die echten Einstellungen von 2.0:**
  - Ich kenne nur DP8 und die Iterationen bis B27f.
  - Was Code danach in der `.icon`-Datei von 2.0 eingestellt hat, also Schatten, Deckkraft, Translucency und Specular, weiß ich nicht (Frage 1).
- **Ob die Schattenstärke einstellbar ist:** Laut Apple ist der Schatten eine Einstellung der Gruppe, „Neutral“ oder „Chromatic“. Ob man seine Stärke regeln kann, steht in den Seiten von Apple nicht. Wenn nicht, gilt einfach „Chromatic“.
- **WebKit und iPhone:** Gerendert ist mit Chromium und rsvg. Die Probe am Gerät macht Code (TEST.md, W12).

## 6. Für Code

1. Die Ebenen aus `icon-composer/` in die `.icon`-Datei übernehmen. Farben je Darstellung, Deckkraft und Einstellungen stehen in `TEST.md`.
2. App Store: `app-symbol-A1b-1024.png` (quadratisch, ohne Transparenz).
3. Web: `apple-touch-icon-A1b-180.png` und die Icons im Manifest ersetzen die A1-Dateien aus DP63b.
   - Das Favicon bleibt das eigene Zeichen (W34).
   - Nach W38 steht das App-Symbol nur dort, wo das System die App zeigt.
4. Tests mit Gegenprobe, A1 aus DP63b als falsche Fassung:
   - `symbol-luecke`: SY1a aus der Geometrie und SY1b mit `luecke118.py` am Bau.
   - `symbol-strich`: SY2.
   - `symbol-form`: SY4, SY5 und SY10 gegen die flache 1024er.
   - SY3 nur am Gerät mit Bildschirmfotos, nicht im Bau.
5. Die Werkzeuge rechnen mit dem Ordner `d118`. Pfade bitte anpassen.

## 7. Fragen

1. **An Code:** Bitte die Einstellungen aus der `.icon`-Datei von 2.0 schicken, so wie sie im Release ist. Gemeint sind Schatten, Deckkraft je Darstellung, Translucency und Specular, als Datei oder Bildschirmfoto. Dann prüfe ich SY3 gegen die echten Werte statt gegen DP8.
2. **An Code:** Wie entstehen die Größen im Bau? Kommen sie direkt aus der `.icon`-Datei, oder wird ein PNG umgerechnet?
3. **An Code:** Nach dem Testbau bitte je Darstellung ein Bildschirmfoto vom Startbildschirm, dazu eines aus den Einstellungen (kleinste Größe). Dann messe ich SY1b und SY3 am echten Glas nach.

## Wunschliste (Fassung 41)

| W | Ergebnis |
| --- | --- |
| W5 Farbe mit Bedeutung | eingehalten: Siegellack im Symbol, Farbe von A1 bleibt (SY8) |
| W12 Am iPhone prüfen | offen: Probe am Gerät durch Code (TEST.md); hier nur Chromium und rsvg |
| W34 Eigenes Favicon | eingehalten: A1b ist nicht das Favicon |
| W35 Logo auf der Website | betrifft das Symbol nicht; der Strich der Klammer ist jetzt der des Logos (SY2) |
| W38 App-Symbol nur als App-Symbol | eingehalten: Dateien nur für Store, Startbildschirm, `apple-touch-icon` und Manifest |

## Protokoll

- **17.11. (DP63b):** A1 gewählt. Fehler: Die Form kam aus dem Favicon-Entwurf, und der Satz „Das Symbol behält seine Form“ war falsch.
- **21.11. (PD158):** Code zeigt, dass die Lücke im Bau zuläuft und der Rücken dunkel ist. E326 wird feste Regel.
- **21.11. (DP111):**
  - A1b neu aufgebaut auf der Form von DP8.
  - SY1 bis SY10 mit Gegenproben.
  - SY1b vor dem Versand verschärft, weil A1 in der ersten Fassung grün blieb.
  - Die Anlage von Code nachgemessen.
- A1 und DP63b bleiben unverändert stehen. Diese Fassung ersetzt nur die Dateien unter `app-symbol/` aus DP63b, nicht die Tokens oder die Prüfpunkte AK.

Fertig zum Weitergeben. Offen ist nur die Probe am iPhone (Fragen 1 bis 3).
