# Wortliste der Mappe

Alle Bezeichnungen, die Deckblatt, Kopfzeile und Lesezeichen der PDF-Mappe drucken. Erzeugt aus `data/regelkatalog.de.json` und denselben Funktionen, mit denen die Mappe gebaut wird (`build/wortliste.ts`), nicht von Hand. Ein Test schlägt an, sobald die Liste nicht mehr stimmt; neu schreiben mit `npm run wortliste`.

Wo ein Wort steht: **D** Deckblatt, **I** Inhalt auf dem Deckblatt, **K** Kopfzeile jeder Seite, **L** Lesezeichen, **F** Fußzeile.

## Rollen

Unter dem Namen auf dem Deckblatt (D), in der Kopfzeile als „Name · Rolle“ (K), im Lesezeichen als „Name (Rolle)“ (L). Bürgen tragen in der Kopfzeile „Bürgschaft“ statt der Rolle. Welche Form gilt, wählt die Person beim Anlegen (männlich oder ohne Angabe, weiblich, neutral).

| Kennung | Männlich oder ohne Angabe | Weiblich | Neutral | Stelle im Regelkatalog |
| --- | --- | --- | --- | --- |
| `hauptmieter` | Hauptmieter | Hauptmieterin | Hauptmietpartei | `rollen.hauptmieter.text`, `textWeiblich`, `textNeutral` |
| `mitmieter` | Mitmieter | Mitmieterin | Mitmietpartei | `rollen.mitmieter.text`, `textWeiblich`, `textNeutral` |
| `buerge` | Bürge | Bürgin | bürgt | `rollen.buerge.text`, `textWeiblich`, `textNeutral` |

Nicht gedruckt werden `rollen.kind` („Kind“, „Kinder“) und `rollen.weitere_erwachsene` („Weitere Erwachsene“). Auf dem Deckblatt stehen stattdessen die Zählungen unten („Ein Kind“, „Eine weitere Person“).

## Unterlagen

Im Inhalt und in den Lesezeichen steht die Kurzform (I, L), in der Kopfzeile die Einzahl (K), jeweils ohne weiche Trennstellen. Bei Unterlagen mit Varianten, die je Variante einen Eintrag bekommen, steht der Name der Variante.

| Kennung | Inhalt, Lesezeichen | Kopfzeile | Stelle im Regelkatalog |
| --- | --- | --- | --- |
| `selbstauskunft` | Selbstauskunft | (eigener Kopf der Selbstauskunft) | `dokumenttypen[0].text` |
| `gehaltsnachweis` | Gehaltsnachweise | Gehaltsnachweis | `dokumenttypen[1].text`, `dokumenttypen[1].textEinzeln` |
| `einkommen_selbststaendig` | Einkommensnachweis | Einkommensnachweis | `dokumenttypen[2].text`, `dokumenttypen[2].text` |
| `einkommen_ausbildung` | BAföG-Bescheid oder Ausbildungsvertrag | BAföG-Bescheid oder Ausbildungsvertrag | `dokumenttypen[3].text`, `dokumenttypen[3].text` |
| `einkommen_ausbildung:bafoeg` | BAföG-Bescheid | BAföG-Bescheid | `dokumenttypen[3].varianten[0].text` |
| `einkommen_ausbildung:unterhalt` | Unterhaltsnachweis | Unterhaltsnachweis | `dokumenttypen[3].varianten[1].text` |
| `einkommen_ausbildung:beides` | BAföG und Unterhalt | BAföG und Unterhalt | `dokumenttypen[3].varianten[2].text` |
| `einkommen_ausbildung:ausbildungsvertrag` | Ausbildungsvertrag | Ausbildungsvertrag | `dokumenttypen[3].varianten[3].text` |
| `einkommen_ausbildung:anderes` | Anderer Nachweis | Anderer Nachweis | `dokumenttypen[3].varianten[4].text` |
| `rentenbescheid` | Rentenbescheid | Rentenbescheid | `dokumenttypen[4].text`, `dokumenttypen[4].text` |
| `mietuebernahme_amt` | Nachweis der Mietübernahme | Nachweis der Mietübernahme | `dokumenttypen[5].text`, `dokumenttypen[5].text` |
| `einkommen_sonstig` | Sonstiger Einkommensnachweis | Sonstiger Einkommensnachweis | `dokumenttypen[6].text`, `dokumenttypen[6].text` |
| `bonitaet` | Bonitätsnachweis | Bonitätsnachweis | `dokumenttypen[7].text`, `dokumenttypen[7].text` |
| `mietzahlung` | Mietzahlungen | Mietzahlungen | `dokumenttypen[8].textKurz`, `dokumenttypen[8].textKurz` |
| `buergschaftserklaerung` | Bürgschaftserklärung | Bürgschaftserklärung | `dokumenttypen[9].text`, `dokumenttypen[9].text` |
| `anschreiben` | (nicht in der Mappe) | | `dokumenttypen[10].text` |
| `empfehlung_vorvermieter` | Empfehlung des Vorvermieters | Empfehlung des Vorvermieters | `dokumenttypen[11].text`, `dokumenttypen[11].text` |
| `wbs` | Wohnberechtigungsschein | Wohnberechtigungsschein | `dokumenttypen[12].text`, `dokumenttypen[12].text` |
| `ausweiskopie` | Ausweiskopie | Ausweiskopie | `dokumenttypen[13].text`, `dokumenttypen[13].text` |
| `schufa_datenkopie` | SCHUFA-Datenkopie | SCHUFA-Datenkopie | `dokumenttypen[14].text`, `dokumenttypen[14].text` |

## Serien und Daten

Gehaltsnachweise (`dokumenttypen[1].serie`): Im Inhalt steht nach dem Namen der Zeitraum aller Monate (I). Jede Datei bekommt ein eigenes Kopfband mit ihren Monaten (K), das auch im Lesezeichen unter der Unterlage steht (L).

| Fall | Inhalt (I) | Kopfzeile und Lesezeichen (K, L) |
| --- | --- | --- |
| ein Monat | Gehaltsnachweise, September | Gehaltsnachweis September 2026 |
| drei Monate, drei Dateien | Gehaltsnachweise, Juli bis September | Gehaltsnachweis Juli 2026<br>Gehaltsnachweis August 2026<br>Gehaltsnachweis September 2026 |
| drei Monate in einer Datei | Gehaltsnachweise, Juli bis September | Gehaltsnachweis Juli bis September 2026 |
| über den Jahreswechsel | Gehaltsnachweise, November 2025 bis Januar 2026 | Gehaltsnachweis November 2025<br>Gehaltsnachweis Dezember 2025<br>Gehaltsnachweis Januar 2026 |

Unterlagen mit Datum (`dokumenttypen[].datum` ist `ausstellungsdatum`): im Inhalt „Bonitätsnachweis, vom 20. Oktober 2026“ (I), in der Kopfzeile „Bonitätsnachweis vom 20. Oktober 2026“ (K). Ohne Datum nur der Name.

## Zählungen

Neben „Wer einzieht“ steht die Zahl aller, die einziehen (D). Kinder und weitere Personen ohne Vertrag stehen als eigene Einträge mit der Zeile „ohne Mietvertrag“ darunter (D). Zahlen bis zwölf als Wort. Diese Wörter stehen nicht im Regelkatalog, sondern in `src/domain/mappeWoerter.ts`.

| Anzahl | Wer einzieht | Kinder | Weitere Personen |
| --- | --- | --- | --- |
| 1 | 1 Person | Ein Kind | Eine weitere Person |
| 2 | 2 Personen | Zwei Kinder | Zwei weitere Personen |
| 3 | 3 Personen | Drei Kinder | Drei weitere Personen |
| 4 | 4 Personen | Vier Kinder | Vier weitere Personen |
| 5 | 5 Personen | Fünf Kinder | Fünf weitere Personen |
| 12 | 12 Personen | Zwölf Kinder | Zwölf weitere Personen |
| 13 | 13 Personen | 13 Kinder | 13 weitere Personen |

## Studium und Ausbildung

Hat eine Person im Studium oder in der Ausbildung keinen Beruf eingetragen, steht auf dem Deckblatt statt des Berufs:

| Art | Text | Stelle im Regelkatalog |
| --- | --- | --- |
| `studium` | Im Studium | `lebenssituationen.studierend_azubi.arten.studium.text` |
| `ausbildung` | In Ausbildung | `lebenssituationen.studierend_azubi.arten.ausbildung.text` |

## Fußzeile

Unten auf jeder Seite (F), links Wohnung und Namen der Vertragsparteien, rechts die Seitenzahl:

- „Bewerbung Hauptstraße 12 · Max und Lea Mustermann“: Straße und Nummer aus der ersten Zeile der Adresse bis zum ersten Komma; ohne Adresse „Bewerbung · Max und Lea Mustermann“
- „Seite 3 von 16“

## Feste Wörter

Überschriften und Marken, die der Bau der Mappe selbst zeichnet, aus `src/pdf/bewerbung.ts` gelesen. Sie stehen nicht im Regelkatalog.

- Bewerbung um die Wohnung
- Bewerbung um eine Wohnung
- Bürgschaft
- Deckblatt
- Kontakt
- ohne Mietvertrag
- Was beiliegt
- Was beiliegt (Fortsetzung)
- Wer einzieht
