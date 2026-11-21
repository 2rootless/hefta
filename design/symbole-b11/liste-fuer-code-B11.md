# Liste für Code · Symbole, Fassung c (B11)

Von: Design · An: Planung, für Code · Stand: 7. November 2026 · gehört zu `hefta-design-B11-2026-11-07.zip`

Die Liste beschreibt den Symbolsatz, aus dem Code Mieter-App, Vermieterseite, Vermieter-App und Mappe baut.

- Teil 1 enthält die Regeln.
- Teil 2 nennt, was an welcher Stelle durch was ersetzt wird.
- Teil 3 ordnet jeder Unterlage im Regelkatalog ein Symbol zu.
- Teil 4 listet alle Dateien.
- Teil 5 zeigt, wohin die App-Symbole gehören.

Alle Formen stehen auch in `svg/symbole.json`, mit den Pfaden der vollen Form und der Kernform.

## 1 · Regeln, Fassung c

| Regel | Wert | Warum |
| --- | --- | --- |
| Raster | 32 × 32, `viewBox="0 0 32 32"`, runde Enden und Ecken, `fill="none"`, `stroke="currentColor"` | wie im Kit |
| Punkte | als Strich der Länge null oder als kleiner Ring, nie als Füllung | Ein Symbol bleibt so eine einzige Strichzeichnung in einer Farbe. |
| Strich je Größe | 12 px: 4,0 · 16 px: 3,2 · 20, 24 und 28 px: 2,4 · 32 und 48 px: 3,2 | Gedruckt misst der Strich so 1,5 bis 2 px, ab 32 px 3,2 px wie das Logo. Mit 2,4 wäre er bei 16 px nur 1,2 px und bei 12 px 0,9 px dünn. |
| volle Form | ab 20 px, für Unterlagen, Figuren und Stände | wie im Kit: „nie kleiner als 20“ |
| Kernform | 12 und 16 px, nur in einem Stein oder Kreis. Es ist eine eigene, vereinfachte Zeichnung: weniger Binnenlinien, größer im Raster, Lücken von mindestens 5 Einheiten | Sie löst den Widerspruch zwischen Band (12 px) und Regel (ab 20 px). Der Rahmen des Steins gibt dem kleinen Bild Halt. Frei in einer Zeile steht ein Bild nie unter 20 px. |
| Bedienung | ab 16 px; der Haken auch 12 px im Stein „alles da“ | Pfeile, Plus und Haken sind ein bis zwei Striche und bleiben bei 16 px klar. |
| Flächen | Stein, Kachel, Kreis, Ziel und App-Symbol dürfen gefüllt sein. Was auf einem Stein oder einem Kinderkreis steht, ist immer `--on-person` (dunkel). | Stein und Kinderkreis sind in beiden Themen weiß. Mit `currentColor` wäre das Symbol im dunklen Thema hell auf Weiß. |
| Größen | 12, 16, 20, 24, 28, 32, 48 px; andere Größen gibt es nicht | Code nutzt heute 13, 14, 18, 22 und 26. Die Umstellung steht in Teil 2. |

## 2 · Was wodurch ersetzt wird

### Mieter-App, `Symbol.svelte` und Bausteine

| heute | wo | neu | Größe heute → neu |
| --- | --- | --- | --- |
| `form` | Unterlage: Selbstauskunft, Bürgschaft, Anschreiben, Empfehlung, WBS, Ausweiskopie | je Unterlage ein eigenes Symbol, siehe Teil 3 | Band 12 → 12 Kernform; Person 16 → **20** volle Form |
| `euro` | Einkommen, sechs Arten | `einkommen` | wie oben |
| `shield` | Bonität, SCHUFA-Datenkopie | `bonitaet`, `datenkopie` | wie oben |
| `key` | Mietzahlungen | `mietzahlungen`. Vorsicht: Der Schlüssel heißt jetzt Wohnberechtigungsschein (`wbs`). | wie oben |
| `plus` | Eintragen, Hochladen, Mappe erstellen, Upload | `plus` | 14 → 16, 16 → 16 |
| `haken` | elf Bausteine | `haken` | 13, 14 → 16; 16 → 16; 18 → 20; 22 → 24; im Stein 12 |
| `weiter` | 16 Bausteine, Listenzeilen | `weiter` | 14, 16 → 16; 18 → 20 |
| `zurueck` | Kopf, Haushalt, Person | `zurueck` | 18 → 20 |
| `zahnrad` | Kopfzeile | `zahnrad` (neu gezeichnet, Name für Screenreader „Einstellungen“) | 20 → 20 |
| `info` | Person löschen, Person | `info` | 18 → 20 |
| `datei` | Rutsch | `datei` | 26 → 28 |
| `schloss` | Upload | `schloss` | 20 → 20 |
| `personen` | nirgends genutzt | entfällt; für Figuren gelten `person` und `kind` | – |
| × (U+00D7) | Blatt, Hinweis, Datum, große Seite | `schliessen` | Schriftgröße → 20 (in 44 px Tippfläche) |
| › (U+203A) | Hinweis (55) | `weiter`, 16 | Im Fließtext „Einstellungen › Allgemein“ bleibt das Zeichen: Dort ist es Satzzeichen, kein Symbol. |
| − (U+2212), + (U+002B) | Haushalt, Zähler | `minus`, `plus` | Schriftgröße → 20 in den runden Knöpfen von 44 px |
| Stein im Band | Übersicht, Person | `svg/band/hefta-stein-{fehlt, bald, da, mehr, alles-da}-24.svg`, darin die Kernform 12 px | Kreis 24, Symbol 12 wie heute. Neu: Ring um „da“ (Teil 1, Flächen; Bericht 3.4). |
| Ziel | Ende des Bands | `svg/band/hefta-ziel-{offen, fertig, feiern}-56.svg` | nach `groesse`; die Dateien sind bei 56 px gezeichnet |
| Kreise der Haushaltszeile | Übersicht oben | im Vertrag `hefta-kachel-vertrag-36` (Kachel, Ecke 6 px, Personenfarbe, Anfangsbuchstabe Archivo 700); ohne Vertrag `hefta-kreis-person-36`, `hefta-kreis-kind-26` | Figur 22 → 20, 17 → 16 (Kernform) |
| Figuren im Hinweis (55) | unter dem Vertrag | `hefta-kreis-person-28`, `hefta-kreis-kind-22` | Figur 15 → 16, 12 → 12 (Kernform) |
| Figuren beim ersten Start | drei Punkte f1 bis f3 | `hefta-kachel-figur-40`: Kachel in Personenfarbe, Figur 24 in `--on-person` | 24er-Raster → 40 |
| Personenpunkt (56) | „Wer ist dabei?“ | Kachel statt Kreis (`hefta-zeichen-vertrag-16` oder CSS mit Ecke 1/12) | 14 → 16 |
| Kästchen (56) | „Wer ist dabei?“ | bleibt ein Kästchen; darin `haken` 16 in `--on-person` | 24 |
| Punkt im Band | Band, quer | `stein-da` ohne Ring, wenn er auf `--track` liegt; mit Ring auf Personenfarbe | 14, 12 → 12 |
| Teilen-Symbol, „Zum Home-Bildschirm“ | Anleitung | **nicht nachgezeichnet**; entfällt mit der App (Bericht 2) | – |
| Logo-Kachel, Favicon, Web-App-Symbol | Kopf, Browser | unverändert aus dem Kit | – |

### Vermieterseite und Vermieter-App

| heute | wo | neu |
| --- | --- | --- |
| `vs-back`, „‹“, „←“ | Mappe, Anfordern, Absagen, Schritte, Rechtliches; Kopf der Bewerbung; Lesen am Telefon | `zurueck` 20 |
| `vs-ch`, „›“, „Weiter ›“ | Zeilen, Links, Kopf, Leiste | `weiter` 16 hinter dem Wort, 20 als Pfeil im Kopf |
| „▾“ | Wohnung, Liste, Register am Telefon | `ab` 16 |
| `vs-dz`, `vs-drop klein` | leere Seite, Eingang | `hochladen` 28 (leere Seite) und 20 (Eingang) |
| Datei, `vs-st-ohne` | Eingang, Stand „Ohne Lesehilfe“ | `datei` 20 |
| `vs-li`, `vs-dp`, `vs-lis` | Mappe | in der Bestandsaufnahme ohne Bedeutung genannt. Wahrscheinlich Liste, Deckblatt und Register: dann `deckblatt` 20 für das Deckblatt, für den Rest die Unterlagen aus Teil 3. Bitte prüfen. |
| Etiketten der Zeilen | Selbstauskunft, Einkommen, Bonität, Bürgschaft, Mietzahlungen, Weiteres | unverändert aus dem Kit (Fassung b = volle Form der Fassung c) |
| Deckblatt im Register | Lesen | `deckblatt` 20 (neu) |
| Personenzeichen ■ ○ □ | Mappe | unverändert. Als Dateien gibt es sie in 12 und 16 px, Code darf sie aber weiter mit CSS zeichnen. |
| Zoom − und + | Lesen | `minus`, `plus` 20 |
| Kopieren, „Kopiert“ | Kontakt, Prüfen | Das Wort bleibt. In der App am Telefon steht `kopieren` 20 vor dem Wort. |
| Telefon, Mail | Kontakt am Telefon | `telefon`, `mail` 20 vor der Nummer und der Adresse |
| Rückgängig | Zeile nach dem Absagen | Das Wort bleibt; `rueckgaengig` 20 nur in der App, wenn die Zeile schmal wird |
| Stände (voraus) | Liste der App | `stand-neu`, `stand-angesehen`, `stand-zugesagt`, `stand-abgesagt`, `stand-mieter` 20, immer mit dem Wort daneben |
| Filter, Suche (voraus) | Liste der App | `filter`, `lupe` 20 |
| Löschtermin (voraus) | „Löschen am …“, Blatt „Absagen“ | `kalender` 16 in der Liste, 20 im Blatt |
| Wohnung (voraus) | Kopf, Wechsel | `wohnung` 20 mit `ab` 16 |
| Einstellungen | App | `zahnrad` 20 |
| Umzug zwischen Geräten | erster Start | kein Symbol: Der Knopf trägt den Satz „Von einem anderen Gerät umziehen“, ein Bild dazu wäre unklar. |

### Mappe (PDF)

Nichts ändert sich: Quadrat, Rahmen-Quadrat und Ring bleiben, ebenso die Marke im Fuß. Sie sind die Vorlage, an der sich die Haushaltszeile jetzt ausrichtet.

## 3 · Unterlagen: Kennung im Regelkatalog → Symbol

| Kennung (`wortliste-mappe.md`) | Symbol | heute in der Mieter-App |
| --- | --- | --- |
| `selbstauskunft` | `selbstauskunft` | `form` |
| `gehaltsnachweis` | `einkommen` | `euro` |
| `einkommen_selbststaendig` | `einkommen` | `euro` |
| `einkommen_ausbildung` (alle Varianten, auch Ausbildungsvertrag) | `einkommen` | `euro` |
| `rentenbescheid` | `einkommen` | `euro` |
| `mietuebernahme_amt` | `einkommen` | `euro` |
| `einkommen_sonstig` | `einkommen` | `euro` |
| `bonitaet` | `bonitaet` | `shield` |
| `mietzahlung` | `mietzahlungen` | `key` |
| `buergschaftserklaerung` | `buergschaft` | `form` |
| `anschreiben` | `anschreiben` (neu) | `form` |
| `empfehlung_vorvermieter` | `empfehlung` | `form` |
| `wbs` | `wbs` | `form` |
| `ausweiskopie` | `ausweis` | `form` |
| `schufa_datenkopie` | `datenkopie` | `shield` |
| jede andere | `weiteres` | – |

`arbeitsvertrag` aus dem Kit hat im Regelkatalog keine eigene Kennung. Der Ausbildungsvertrag ist eine Variante von Einkommen. Das Symbol bleibt im Satz, falls ein Arbeitsvertrag als eigene Unterlage kommt.

`deckblatt` ist keine Unterlage der Mieter-App. Es steht nur im Register der Vermieterseite und hat darum keine Kernform.

## 4 · Dateien

Name: `svg/<gruppe>/hefta-<name>-<px>.svg`. Jede Datei hat die Größe in `width` und `height`, den Strich für diese Größe und `aria-hidden="true"`. Den Namen für Screenreader setzt Code am Knopf oder an der Zeile, nicht im SVG.

| Name | Wort (für `aria-label` und den Tooltip) | Gruppe | Dateien: Größe (Form) | Herkunft |
| --- | --- | --- | --- | --- |
| `selbstauskunft` | Selbstauskunft | unterlage | 12 (kern), 16 (kern), 20 (fein), 24 (fein), 28 (fein), 32 (stark), 48 (stark) | Kit, Fassung b |
| `einkommen` | Einkommen | unterlage | 12 (kern), 16 (kern), 20 (fein), 24 (fein), 28 (fein), 32 (stark), 48 (stark) | Kit, Fassung b |
| `bonitaet` | Bonität | unterlage | 12 (kern), 16 (kern), 20 (fein), 24 (fein), 28 (fein), 32 (stark), 48 (stark) | Kit, Fassung b |
| `buergschaft` | Bürgschaft | unterlage | 12 (kern), 16 (kern), 20 (fein), 24 (fein), 28 (fein), 32 (stark), 48 (stark) | Kit, Fassung b |
| `mietzahlungen` | Mietzahlungen | unterlage | 12 (kern), 16 (kern), 20 (fein), 24 (fein), 28 (fein), 32 (stark), 48 (stark) | Kit, Fassung b |
| `arbeitsvertrag` | Arbeitsvertrag | unterlage | 12 (kern), 16 (kern), 20 (fein), 24 (fein), 28 (fein), 32 (stark), 48 (stark) | Kit, Fassung b |
| `empfehlung` | Empfehlung | unterlage | 12 (kern), 16 (kern), 20 (fein), 24 (fein), 28 (fein), 32 (stark), 48 (stark) | Kit, Fassung b |
| `wbs` | Wohnberechtigungsschein | unterlage | 12 (kern), 16 (kern), 20 (fein), 24 (fein), 28 (fein), 32 (stark), 48 (stark) | Kit, Fassung b |
| `ausweis` | Ausweiskopie | unterlage | 12 (kern), 16 (kern), 20 (fein), 24 (fein), 28 (fein), 32 (stark), 48 (stark) | Kit, Fassung b |
| `datenkopie` | SCHUFA-Datenkopie | unterlage | 12 (kern), 16 (kern), 20 (fein), 24 (fein), 28 (fein), 32 (stark), 48 (stark) | Kit, Fassung b |
| `weiteres` | Weiteres | unterlage | 12 (kern), 16 (kern), 20 (fein), 24 (fein), 28 (fein), 32 (stark), 48 (stark) | Kit, Fassung b |
| `anschreiben` | Anschreiben | unterlage | 12 (kern), 16 (kern), 20 (fein), 24 (fein), 28 (fein), 32 (stark), 48 (stark) | neu in B11 |
| `deckblatt` | Deckblatt | unterlage | 20 (fein), 24 (fein), 28 (fein), 32 (stark), 48 (stark) | neu in B11 |
| `plus` | Hinzufügen | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `minus` | Weniger | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `haken` | Erledigt | bedienung | 12 (fein), 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `weiter` | Weiter | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `zurueck` | Zurück | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `auf` | Einklappen | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `ab` | Aufklappen, wählen | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `schliessen` | Schließen | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `zahnrad` | Einstellungen | bedienung | 20 (fein), 24 (fein) | neu in B11 |
| `info` | Hinweis | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `datei` | Datei wählen | bedienung | 20 (fein), 24 (fein), 28 (fein) | neu in B11 |
| `schloss` | Mit Passwort geschützt | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `lupe` | Suchen | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `kopieren` | Kopieren | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `telefon` | Anrufen | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `mail` | Mail | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `rueckgaengig` | Rückgängig | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `hochladen` | Hineinlegen, hochladen | bedienung | 20 (fein), 24 (fein), 28 (fein) | neu in B11 |
| `sichern` | Sichern (Backup) | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `kalender` | Löschtermin | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `wohnung` | Wohnung | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `filter` | Filtern | bedienung | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `person` | Person (erwachsen) | figur | 12 (kern), 16 (kern), 20 (fein), 24 (fein) | neu in B11 |
| `kind` | Kind | figur | 12 (kern), 16 (kern), 20 (fein), 24 (fein) | neu in B11 |
| `stand-neu` | Neu | stand | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `stand-angesehen` | Angesehen | stand | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `stand-zugesagt` | Zugesagt | stand | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `stand-abgesagt` | Abgesagt | stand | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |
| `stand-mieter` | Mieter | stand | 16 (fein), 20 (fein), 24 (fein) | neu in B11 |

### Teile aus Flächen

| Datei | Was |
| --- | --- |
| `svg/band/hefta-stein-fehlt-24.svg` | Stein „fehlt“ (Beispiel mit Einkommen) |
| `svg/band/hefta-stein-bald-24.svg` | Stein „läuft bald ab“ (Beispiel mit Einkommen) |
| `svg/band/hefta-stein-da-24.svg` | Stein „da“ |
| `svg/band/hefta-stein-mehr-24.svg` | Stein „+n weitere“ |
| `svg/band/hefta-stein-alles-da-24.svg` | Stein „alles da“ |
| `svg/band/hefta-ziel-offen-56.svg` | Ziel „offen“ |
| `svg/band/hefta-ziel-fertig-56.svg` | Ziel „fertig“ |
| `svg/band/hefta-ziel-feiern-56.svg` | Ziel „feiern“ |
| `svg/haushalt/hefta-kachel-vertrag-36.svg` | Kachel: Person im Vertrag, mit Anfangsbuchstabe |
| `svg/haushalt/hefta-kreis-person-36.svg` | Kreis: Erwachsene ohne Vertrag, Haushaltszeile |
| `svg/haushalt/hefta-kreis-kind-26.svg` | Kreis: Kind, Haushaltszeile |
| `svg/haushalt/hefta-kreis-person-28.svg` | Kreis: Erwachsene ohne Vertrag, Hinweis |
| `svg/haushalt/hefta-kreis-kind-22.svg` | Kreis: Kind, Hinweis |
| `svg/haushalt/hefta-kachel-figur-40.svg` | Kachel mit Figur: erster Start |
| `svg/haushalt/hefta-zeichen-vertrag-12.svg` | Personenzeichen ■ im Vertrag |
| `svg/haushalt/hefta-zeichen-vertrag-16.svg` | Personenzeichen ■ im Vertrag |
| `svg/haushalt/hefta-zeichen-ohne-12.svg` | Personenzeichen ○ ohne Vertrag |
| `svg/haushalt/hefta-zeichen-ohne-16.svg` | Personenzeichen ○ ohne Vertrag |
| `svg/haushalt/hefta-zeichen-buergt-12.svg` | Personenzeichen □ bürgt |
| `svg/haushalt/hefta-zeichen-buergt-16.svg` | Personenzeichen □ bürgt |

Steine und Kacheln lesen diese CSS-Variablen: `--stone`, `--person`, `--on-person` und `--person-child`, mit den Werten aus `tokens.css` als Rückfall. Das Symbol im Stein setzt Code aus der Kernform 12 px an die Stelle (6, 6) des Steins von 24 px. Die Dateien zeigen dort Einkommen als Beispiel.

## 5 · App-Symbole, Startbild, Mitteilung

| Datei | wohin | Hinweis |
| --- | --- | --- |
| `app/ios/hefta-ios-hell-1024.png` | Xcode, AppIcon, „Any Appearance“ | Koralle voll, ohne Rundung und ohne Transparenz; iOS rundet selbst. Die Marke ist 55 % so hoch wie die Kachel, wie im Kit. |
| `app/ios/hefta-ios-dunkel-1024.png` | AppIcon, „Dark“ | ohne Hintergrund. iOS legt seinen dunklen Grund darunter. Die Marke steht in Koralle. |
| `app/ios/hefta-ios-getoent-1024.png` | AppIcon, „Tinted“ | voll deckend, nur Graustufen: weiße Marke auf Schwarz. iOS tönt sie selbst. |
| `app/android/hefta-android-vordergrund-432.svg` und `.png` | `mipmap-anydpi-v26/ic_launcher.xml`, `<foreground>` | 108 dp; die Marke ist 37,5 dp hoch und liegt ganz in der sicheren Zone von 66 dp. Als Vector Drawable aus dem SVG übernehmen. |
| `app/android/hefta-android-hintergrund-432.png` | `<background>` | einfarbig Koralle `#ff8466`; besser als Farbe statt als Bild |
| `app/android/hefta-android-einfarbig-432.svg` | `<monochrome>` | nur die Marke, für die getönten Symbole ab Android 13 |
| `app/android/hefta-play-512.png` | Play Console, App-Symbol | voll Koralle; Google rundet selbst |
| `app/android/hefta-android-start-symbol-960.svg` und `.png` | `windowSplashScreenAnimatedIcon` | 240 dp mit Hintergrund: weiße Marke, 90 dp hoch, im Kreis von 160 dp. Dazu `windowSplashScreenIconBackgroundColor` = `#ff8466` und `windowSplashScreenBackground` = `--ground` (`#f5f6fa`), dunkel `#14151f`. |
| `app/start/hefta-marke-start.svg`, `hefta-start-ios-{hell,dunkel}.svg` | iOS, Launch Screen | Marke 64 pt mittig auf `--ground`, `ink`; dunkel `#f1f2f8` auf `#14151f`. Die Vorschauen sind PNG im selben Ordner. |
| `app/android/mitteilung/hefta-mitteilung-24.svg`, `drawable-*/ic_stat_hefta.png` | `setSmallIcon` | weiß auf transparent, 24 dp mit 20 dp Inhalt, mdpi bis xxxhdpi; nur nötig, wenn die App Mitteilungen schickt |

Eine Vermieter-App gibt es noch nicht im Store. Für sie ist kein eigenes App-Symbol gezeichnet (Bericht, Abschnitt 7).

