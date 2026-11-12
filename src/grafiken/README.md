# Eigene Grafiken (E58)

Hier liegen die SVG-Grafiken für die festen Plätze der App (`src/ui/GrafikPlatz.svelte`). Der Dateiname ist der Name des Platzes:

| Datei | Platz |
| --- | --- |
| `erster-start.svg` | Tab „Wohnungen“ ohne Haushalt, über „Hier stehen bald deine Wohnungen …“ |
| `wohnungen-leer.svg` | Tab „Wohnungen“ mit Haushalt, aber ohne Heft |
| `alles-da.svg` | Tab „Mappe“, Kasten „Alles da“, statt des Hakens |
| `zusage.svg` | Heft nach einer Zusage (kommt mit dem Heft nach B18) |
| `teilen-1.svg` | Anleitung „So kommt ein Inserat zu Hefta“ (E81, B24): Inserat in der Portal-App öffnen, hochkant 9:16 |
| `teilen-2.svg` | dieselbe Anleitung: auf „Teilen“ tippen |
| `teilen-3.svg` | dieselbe Anleitung: Hefta im Teilen-Menü wählen |
| `teilen-4.svg` | dieselbe Anleitung: die Vorschau von Hefta (breiter vierter Schritt, E84) |

Die Bilder `teilen-1` bis `teilen-4` stammen aus B24 Richtung B (Design, Nachtrag n1) und nutzen die Namen aus `design/tokens.css`, dazu `--schleier`, `--app-zeichen` und `--app-zeichen-haus`. Die Prüfung meldet jedes Token, das es dort nicht gibt.

Fehlt eine Datei, steht am Platz, was heute gezeichnet ist.

## Regeln (geprüft beim Bau, `scripts/check-grafiken.mjs`)

1. **Nur eigene Grafiken.** Jede Datei steht in `herkunft.json` mit `von` (wer sie gemacht hat) und `lizenz` (`eigen`, oder eine freie Lizenz mit Quelle). Ohne Eintrag bricht der Bau ab.
2. **Höchstens 30 KB** je Datei.
3. **Kein Skript, keine fremden Adressen:** kein `<script>`, keine `on…`-Attribute, kein `<image>`, kein `<foreignObject>`, keine Links außer `#…` innerhalb der Datei.
4. **Farben nur aus den Tokens:** `fill` und `stroke` sind `none`, `currentColor` oder `var(--…)` aus `design/tokens.css`. So stimmen die Grafiken hell und dunkel. Feste Farben (`#…`, `rgb(…)`, Farbnamen) lehnt die Prüfung ab.
5. **Bewegung** nur mit CSS oder der Web Animations API und den Tokens `--bw-…`. Bei „Bewegung reduzieren“ sind die Dauern 0 ms. Keine Bibliothek (Lottie nur mit eigener Entscheidung).

Die Grafik ist Schmuck (`aria-hidden`). Was sie zeigt, sagt der Text daneben.
