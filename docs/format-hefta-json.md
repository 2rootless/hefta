# Format `hefta.json`, Fassung 2

Stand: 6. November 2026 (Fassung 2, Entscheidung E6; Fassung 1 vom 4. November). Die Lesehilfe für Vermieter: eine JSON-Datei, die als Anhang in der PDF-Mappe steckt (PDF-Anhang `hefta.json`, Beziehung „Data“, `application/json`). Programme lesen sie, Menschen merken nichts. Dieses Dokument ist die Beschreibung des Formats und liegt offen im Repository.

## Zwei Regeln

1. **Nur, was ohnehin sichtbar ist.** Alles im Anhang steht auch auf dem Deckblatt oder im Inhalt. Keine Telefonnummern, keine Mailadressen, keine Prüfsummen, keine IDs von Geräten oder Haushalten. Ein Test vergleicht jeden Text des Anhangs mit dem Text des Deckblatts (`src/pdf/anhang.test.ts`). Die eine Ausnahme seit Fassung 2: `bewerbung.kennung`, eine zufällige Kennung ohne Bezug zu Personen, Gerät oder Haushalt (E6). Sie steht nicht auf dem Papier, verrät aber auch nichts, was nicht auf dem Papier steht.
2. **Ein Bonus, nie eine Voraussetzung.** Portale, die ein PDF neu drucken, und manche Mailprogramme werfen Anhänge weg. Eine Mappe ohne Anhang ist dieselbe Mappe. Wer den Anhang liest, muss ein PDF ohne Anhang genauso annehmen.

Der Anhang hängt am Schalter „Hinweis und Lesehilfe“ in „Mappe anpassen“. Ohne Deckblatt gibt es keinen Anhang (es gäbe nichts Sichtbares, das ihn deckt). Einzeldateien tragen in Fassung 1 keinen Anhang.

## Fassungen

`hefta` ist die Fassungsnummer. Sie steigt nur, wenn sich die Bedeutung eines Felds ändert oder ein Pflichtfeld dazukommt. Leser nehmen neuere Fassungen an und lesen die Felder, die sie kennen; unbekannte Felder ignorieren sie. Neue freiwillige Felder brauchen keine neue Fassung.

## Aufbau

```json
{
  "hefta": 2,
  "erstellt": "2026-11-06",
  "bewerbung": {
    "kennung": "3b7c2f1e-8d4a-4c6b-9e2f-1a5d7c9b0e42",
    "wohnung": {
      "strasse": "Hauptstraße 12",
      "rest": "3. OG links · 22767 Hamburg",
      "teile": { "strasse": "Hauptstraße", "hausnummer": "12", "plz": "22767", "ort": "Hamburg", "lage": "3. OG links" }
    }
  },
  "haushalt": {
    "personen": [
      { "name": "Max Mustermann", "rolle": "hauptmieter", "kontakt": true },
      { "name": "Lea Mustermann", "rolle": "mitmieter" },
      { "name": "Petra Mustermann", "rolle": "buerge" }
    ],
    "mitziehende": [{ "text": "Ein Kind", "anzahl": 1 }]
  },
  "unterlagen": [
    { "person": 0, "typ": "selbstauskunft", "seiten": [2, 2] },
    { "person": 0, "typ": "gehaltsnachweis", "seiten": [3, 5], "monate": ["2026-07", "2026-08", "2026-09"] },
    { "person": 0, "typ": "bonitaet", "seiten": [6, 6], "vom": "2026-10-20", "pruefweg": "pruefcode" }
  ],
  "modus": "marktueblich",
  "loeschwunsch": "Falls die Wohnung an jemand anderen geht, löschen Sie diese Unterlagen bitte. Vielen Dank."
}
```

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `hefta` | ja | Fassung, ganze Zahl ab 1 |
| `erstellt` | ja | Tag der Erstellung, `JJJJ-MM-TT`, wie in den PDF-Metadaten. Das ist das Datum der Fassung: Jede neu gebaute Mappe ist eine neue Fassung der Bewerbung |
| `bewerbung.kennung` | ja, seit Fassung 2 | Zufällige Kennung (UUID v4) je Bewerbung, also je Haushalt und Wohnung; gleich in jeder Fassung derselben Bewerbung. Hefta merkt sie sich an der Bewerbung, sie kommt mit ins Backup. Eine andere Wohnung bekommt eine andere Kennung, eine andere Schreibweise derselben Wohnung nicht. Wofür: Ein Leser ordnet nachgeschickte Mappen derselben Bewerbung zu |
| `bewerbung.wohnung` | ja, darf `null` sein | Straße und Hausnummer, dazu der Rest (Lage, Ort), geteilt wie auf dem Deckblatt |
| `bewerbung.wohnung.teile` | nein, seit Fassung 2 | Die Adresse in Teilen: `strasse`, `hausnummer`, `plz`, `ort`, `lage` (leer, was nicht erkennbar ist). Aus dem freien Feld gelesen: erste Angabe Straße mit Nummer, eine Angabe mit fünfstelliger Postleitzahl ist der Ort, alles andere die Lage. Fehlt, wenn keine Hausnummer erkennbar ist. Das freie Feld bleibt maßgeblich |
| `haushalt.personen[]` | ja | `name` wie auf dem Deckblatt; `rolle` ist `hauptmieter`, `mitmieter` oder `buerge`; `kontakt: true` bei der Person, die als Kontakt auf dem Deckblatt steht (die Angaben selbst stehen nur dort) |
| `haushalt.mitziehende[]` | ja | Kinder und weitere Personen ohne Vertrag, mit Text wie auf dem Deckblatt und Anzahl |
| `unterlagen[]` | ja | je Eintrag im Inhalt: `person` ist der Index in `personen`, `typ` die Kennung aus `data/regelkatalog.de.json`, `seiten` erste und letzte Seite in der Mappe; freiwillig `monate` (`JJJJ-MM`) bei Serien, `vom` (`JJJJ-MM-TT`) bei datierten Unterlagen, `pruefweg` (heute nur `pruefcode`) |
| `seitenzahl` | nein | Gesamtzahl der Seiten der Mappe. Stimmt sie nicht, zeigt ein Leser die Lesehilfe nicht (seit dem 5.11.2026, keine neue Fassung) |
| `modus` | nein | `alles`, `marktueblich`, `datensparsam` oder `eigene_auswahl` |
| `schritt` | nein | bei `datensparsam`: `besichtigung`, `will_wohnung` oder `zusage` |
| `loeschwunsch` | nein | die Bitte zum Löschen, zeichengleich mit dem Satz auf dem Deckblatt; nur wenn sie an ist (`design/bitte-zum-loeschen.md`) |

Nicht enthalten, absichtlich: Telefon, Mail, Beruf, Einkommen, Geburtsdaten, Dateinamen, Prüfsummen, Haushalts- oder Geräte-IDs, der freie Satz vom Deckblatt. Die Kennung der Bewerbung ist keine Haushalts-ID: Derselbe Haushalt hat für jede Wohnung eine andere.

## Lesen

Mit PDF.js: `getAttachments()` liefert die Anhänge, den Inhalt von `hefta.json` dann `getAttachmentContent(id)`. Mit pdf-lib: `getAttachments()`. Danach `anhangLesen` aus `src/pdf/anhang.ts`: nimmt neuere Fassungen an, gibt `null` für alles, was kein Anhang ist, und wirft nie.

## Fassungen im Überblick

| Fassung | Seit | Neu |
| --- | --- | --- |
| 1 | 4.11.2026 | Grundaufbau |
| 2 | 6.11.2026 | `bewerbung.kennung` (Pflicht), `bewerbung.wohnung.teile` (freiwillig); E6 |
