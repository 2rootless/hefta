# 00-LIESMICH · hefta-design-B11-2026-11-07 · Symbole, Fassung c

Von: Design · An: Planung · Stand: 7. November 2026 · Antwort auf: Nachricht 7. November b („Auftrag B11, Symbole“) mit `19-symbole-bestand.md`; deine Antwort vom 7. November zur Form der Haushaltszeile

## Was drin ist

| Ordner, Datei | Was | Für wen |
| --- | --- | --- |
| `bericht-B11-2026-11-07.md` | Bericht: Umsetzung je Auftrag, ergänzte Regeln mit Begründung, Antwort zur Anleitung „Zum Home-Bildschirm“, Prüfungen | Planung |
| `liste-fuer-code-B11.md` | Liste für Code: Regeln, Name alt → neu an jeder Stelle, Unterlage → Symbol, alle Dateien, wohin die App-Symbole gehören | Code, Planung |
| `tafel/hefta-symbole-tafel.html` | Übersichtstafel: jedes Symbol in jeder Größe, hell und dunkel, mit Band, Haushaltszeile, Ständen, App-Symbolen, einer Skizze der Mieter-App und den Prüfungen | Auftraggeber, Planung, Code |
| `tafel/hefta-symbole-tafel.png`, `-grau.png` | die Tafel als Bild, in Farbe und in Graustufen | Auftraggeber, Planung |
| `svg/unterlage/` | 13 Unterlagen: volle Form 20, 24, 28, 32 und 48 px; Kernform 12 und 16 px (außer Deckblatt) | Code |
| `svg/bedienung/` | 22 Symbole der Bedienung, 12 bis 28 px, je nach Gebrauch | Code |
| `svg/figur/` | Person und Kind, 12 bis 24 px | Code |
| `svg/stand/` | fünf Stände der Vermieter-App, 16, 20 und 24 px | Code |
| `svg/band/` | Steine (fehlt, bald, da, mehr, alles da) und Ziel (offen, fertig, feiern) | Code |
| `svg/haushalt/` | Kachel und Kreise der Haushaltszeile und des Hinweises, Kachel mit Figur, Personenzeichen ■ ○ □ | Code |
| `svg/symbole.json` | alle Pfade der vollen Form und der Kernform, Strich je Größe, Regeln, alte Namen | Code |
| `app/ios/` | App-Symbol hell, dunkel, getönt, je 1024 px, als SVG und PNG | Code |
| `app/android/` | adaptiv: Vordergrund, Hintergrund, einfarbig (108 dp); Play 512; Symbol für das Startbild; `mitteilung/` in fünf Dichten | Code |
| `app/start/` | Startbild iOS und Android, hell und dunkel, mit Vorschau | Code |

Die HTML-Tafel läuft ohne Netz. Die SVG-Dateien folgen dem Thema über `currentColor`. Steine und Kacheln lesen `--stone`, `--person`, `--on-person` und `--person-child`.

## Bilder nach Auftrag

| Auftrag | Wo in der Tafel |
| --- | --- |
| 1, Unterlagen, auch 12 und 16 px im Stein | „Unterlagen“, „Band“, „Prüfung: Personenfarben“ |
| 2, Bedienung | „Bedienung“ |
| 3, Figuren als System | „Figuren und Haushaltszeile“, „Im Zusammenhang“ |
| 4, Band | „Band“, „Prüfung: Personenfarben“ |
| 5, App, Startbild, Mitteilung | „App-Symbol, Startbild, Mitteilung“ |
| 6, Vermieter-App | „Stände der Vermieter-App“ |
| Prüfen: Größen, hell und dunkel, Graustufen, Personenfarben, ohne Wort | jede Tabelle hell und dunkel; `-grau.png`; „Prüfung: Personenfarben“, „Prüfung: ohne Wort“, „Prüfung: ähnlichste Paare“ |

## Was neu ist

- **Kernform** für 12 und 16 px, nur im Stein oder Kreis. Die volle Form gibt es ab 20 px.
- **Strich je Größe:** 4,0 bei 12 px, 3,2 bei 16 px, 2,4 von 20 bis 28 px, 3,2 ab 32 px.
- **Haushaltszeile:** Personen im Vertrag stehen als Kachel da, ohne Vertrag als Kreis, wie in der Mappe.
- **Neue Unterlagen:** Anschreiben und Deckblatt.
- **Neu für die App:** App-Symbol, Startbild und Mitteilung.

Fertig zum Weitergeben. Die Wörter der Bedienung und der Figuren für Screenreader (Bericht 3.10) gelten erst nach dem Prüflauf der Planung.
