# Format `hefta.json`, Fassung 4

Stand: 18. November 2026 (Fassung 4, Entscheidungen E205 bis E207). Fassung 3 vom 6. November 2026 gilt bis zum Release
von Hefta 2.0; Leser lesen sie weiter (Abschnitt 13).

**Lizenz:** Diese Beschreibung, `schema.json` und die Beispiele stehen unter Apache-2.0, wie das Paket `hefta-json`, in
dem sie liegen (Datei `LICENSE`). Die App Hefta steht unter AGPL-3.0.

`hefta.json` ist die Lesehilfe für Vermieter. Die JSON-Datei steckt als Anhang in einer PDF-Mappe aus Hefta.
Programme können sie lesen, Menschen merken nichts davon. Dieses Dokument beschreibt das Format vollständig. Wer
einen Leser schreibt, braucht nur dieses Dokument, `schema.json` und die Beispiele, keinen Code von Hefta.

## 1. Drei Regeln

1. **Nur, was ohnehin sichtbar ist.**
   - Jeder Wert steht auch auf dem Deckblatt, im Verzeichnis „Was beiliegt“ oder in den Eigenschaften der
     PDF-Datei. Der Zeitpunkt `erstellt` ist das Erstelldatum der PDF.
   - Einige Werte stehen hier in fester Form statt in der Form vom Papier:
     - Datumsangaben als `JJJJ-MM-TT`
     - das Telefon zusätzlich international (`telefon_e164`)
     - das Land
   - **Einzige Ausnahme** ist `bewerbung.kennung`: eine zufällige Kennung ohne Bezug zu Personen, Gerät oder
     Haushalt.
2. **Ein Bonus, nie eine Voraussetzung.**
   - Portale, die ein PDF neu drucken, und manche Mailprogramme werfen Anhänge weg. Eine Mappe ohne Anhang ist
     dieselbe Mappe.
   - Wer den Anhang liest, muss ein PDF ohne Anhang genauso annehmen.
3. **Kein Echtheitsnachweis.**
   - Die Lesehilfe beschreibt die Mappe, sie beglaubigt nichts.
   - Es gibt keine Prüfsumme und keine Signatur. Jeder kann eine Lesehilfe ändern.
   - Ein Leser prüft deshalb, ob sie zur Mappe passt (Abschnitt 11). Passt sie nicht, zeigt er sie nicht.

## 2. Wo die Datei steckt und wie man sie liest

- **Ablage:** als eingebettete Datei der PDF (Embedded File) mit dem Namen `hefta.json`, Typ `application/json`,
  Beziehung `Data` (`/AFRelationship /Data`), Beschreibung „Lesehilfe für Vermieter“.
- **Kodierung:** UTF-8 ohne BOM. Alle Texte in Unicode-Normalform NFC. Leser überlesen eine BOM und vergleichen Texte
  nach NFC.
- **Wann es sie gibt:** nur, wenn die Mappe ein Deckblatt hat und der Schalter „Hinweis und Lesehilfe“ an ist.
  Einzeldateien tragen keine Lesehilfe.
- **Auslesen**, je nach Werkzeug:
  - PDF.js: `getAttachments()`
  - pdf-lib: `getAttachments()` (@cantoo/pdf-lib)
  - Python, pypdf: `PdfReader(...).attachments["hefta.json"][0]`
  - Kommandozeile: `qpdf --show-attachment=hefta.json mappe.pdf`

## 3. Fassungen und Erweiterung

- **Nummer:** `hefta` ist die Nummer der Fassung. Sie steigt nur, wenn sich die Bedeutung eines Felds ändert oder ein
  Pflichtfeld dazukommt.
- **Ohne neue Fassung kommen dazu:** neue freiwillige Felder und neue Kennungen in den festen Listen (Abschnitt 6).
- **Leser:**
  - nehmen jede Fassung ab 4 an
  - lesen die Felder, die sie kennen
  - überlesen unbekannte Felder
  - zeigen eine unbekannte Kennung neutral, etwa als „Unterlage“
- **Feste Kennungen:** Eine Kennung wird nie umgedeutet. Ändert sich die Bedeutung, gibt es eine neue Kennung.
- **Eigene Felder anderer Programme** beginnen mit `x_`, gefolgt vom Namen des Programms. Beispiel:
  `"x_beispielprogramm_status": "eingegangen"`.
  - Erlaubt sind sie in jedem Objekt.
  - Hefta schreibt solche Felder nie und liest sie nie.
  - Leser überlesen `x_`-Felder. Ob die Datei zur Mappe passt, entscheidet allein Abschnitt 11.
- **Ältere Fassungen:** Leser von Hefta lesen weiter Fassung 1 bis 3 (Abschnitt 13).

## 4. Aufbau

Beispiel: zwei im Mietvertrag, ein Kind, eine Bürgin, zweite Fassung der Bewerbung (`beispiele/2-paar-kind-buergin.json`,
gekürzt).

```json
{
  "hefta": 4,
  "erstellt": "2026-11-18T19:02:55+01:00",
  "fassung": 2,
  "seitenzahl": 16,
  "bewerbung": {
    "kennung": "d2e0f734-0b59-41ea-95f4-c9715acbe034",
    "wohnung": {
      "strasse": "Lindenring 3",
      "rest": "Erdgeschoss, 20259 Hamburg",
      "teile": { "strasse": "Lindenring", "hausnummer": "3", "plz": "20259", "ort": "Hamburg", "lage": "Erdgeschoss", "land": "DE" }
    },
    "einzug": "2027-01-01"
  },
  "haushalt": {
    "personen": [
      {
        "name": "Max Mustermann", "vorname": "Max", "nachname": "Mustermann",
        "rolle": "hauptmieter", "kontakt": true,
        "telefon": "0171 3920001", "telefon_e164": "+491713920001", "email": "max.mustermann@example.com",
        "unterlagen": [
          { "typ": "selbstauskunft", "seiten_mappe": { "von": 2, "bis": 2 } },
          { "typ": "gehaltsnachweis", "seiten_mappe": { "von": 3, "bis": 5 }, "monate": ["2026-08", "2026-09", "2026-10"],
            "vermerke": [{ "art": "als_bild", "datei": 2, "monat": "2026-09" }] },
          { "typ": "bonitaet", "seiten_mappe": { "von": 6, "bis": 6 }, "vom": "2026-10-28",
            "vermerke": [{ "art": "seiten_weggelassen", "seiten_original": [2, 3] }] }
        ]
      },
      { "name": "Lea Mustermann", "vorname": "Lea", "nachname": "Mustermann", "rolle": "mitmieter", "unterlagen": [ … ] },
      { "name": "Petra Mustermann", "vorname": "Petra", "nachname": "Mustermann", "rolle": "buerge", "unterlagen": [ … ] }
    ],
    "mitziehende": [{ "text": "Ein Kind", "anzahl": 1, "art": "kind" }]
  },
  "modus": "marktueblich",
  "loeschwunsch": "Falls die Wohnung an jemand anderen geht, löschen Sie diese Unterlagen bitte. Vielen Dank."
}
```

## 5. Felder

**Oberste Ebene**

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `hefta` | ja | Fassung des Formats, hier `4` |
| `erstellt` | ja | Zeitpunkt, zu dem die Mappe gebaut wurde, mit Zeitzone: `2026-11-18T19:02:55+01:00`. Gleich dem Erstelldatum in den Eigenschaften der PDF |
| `fassung` | ja | Nummer der Fassung, wie auf dem Deckblatt („Fassung 2 vom 18. November 2026“). Zählt die Mappen, die an diese Wohnung schon hinausgingen, plus eins |
| `seitenzahl` | ja | Seiten der ganzen Mappe, Deckblatt eingeschlossen |
| `bewerbung` | ja | Abschnitt 5, „Bewerbung“ |
| `haushalt` | ja | Abschnitt 5, „Haushalt“ |
| `modus` | nein | Auswahl der Unterlagen; Liste in Abschnitt 6 |
| `schritt` | nein | nur bei `modus: datensparsam`: für welchen Schritt der Bewerbung |
| `loeschwunsch` | nein | die Bitte zum Löschen, zeichengleich mit dem Satz auf dem Deckblatt; nur, wenn sie dort steht |

**Bewerbung**

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `kennung` | ja | Zufällige Kennung (UUID v4), je Haushalt und Wohnung, gleich in jeder Fassung derselben Bewerbung. Eine andere Wohnung bekommt eine andere Kennung. Keine Haushalts-ID: Derselbe Haushalt hat für jede Wohnung eine andere |
| `wohnung` | ja, darf `null` sein | Die Wohnung, wie auf dem Deckblatt. `null`, wenn die Mappe keine Wohnung nennt |
| `wohnung.strasse` | ja | Erste Zeile: Straße und Hausnummer |
| `wohnung.rest` | ja | Der Rest, wie auf dem Deckblatt: Lage im Haus, Postleitzahl und Ort, mit Komma getrennt; darf leer sein |
| `wohnung.teile` | nein | Die Adresse in Teilen; Abschnitt 9. Fehlt, wenn keine Hausnummer erkennbar ist |
| `inserat.portal` | nein | Das Portal, wie auf dem Deckblatt („Zu Ihrem Inserat auf ImmoScout24“ ergibt `ImmoScout24`) |
| `einzug` | nein | Frühester Einzug, wie auf dem Deckblatt („Einzug möglich ab 1. Januar 2027“ ergibt `2027-01-01`) |

**Haushalt**

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `personen[]` | ja, mindestens eine | In der Reihenfolge des Deckblatts; erst wer im Mietvertrag steht, dann Bürginnen und Bürgen |
| `mitziehende[]` | ja, darf leer sein | Kinder und weitere Personen ohne Vertrag |
| `mitziehende[].text` | ja | wie auf dem Deckblatt, etwa „Ein Kind“ |
| `mitziehende[].anzahl` | ja | ganze Zahl ab 1 |
| `mitziehende[].art` | ja | `kind` oder `erwachsen` |

**Person**

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `name` | ja | Der volle Name wie auf dem Deckblatt. Immer gleich `vorname`, ein Leerzeichen, `nachname`; ohne Nachnamen nur der Vorname. Abschnitt 7 |
| `vorname` | ja, nicht leer | Vorname oder Vornamen, wie auf dem Deckblatt |
| `nachname` | ja, darf leer sein | Nachname, wie auf dem Deckblatt |
| `rolle` | ja | `hauptmieter`, `mitmieter` oder `buerge`; Abschnitt 6 |
| `kontakt` | nein | `true` bei der Person, die auf dem Deckblatt als Kontakt steht; höchstens eine |
| `telefon` | nein, nur bei `kontakt` | Telefon, zeichengleich wie auf dem Deckblatt |
| `telefon_e164` | nein, nur mit `telefon` | Dasselbe Telefon in internationaler Form, nur wenn eindeutig; Abschnitt 8 |
| `email` | nein, nur bei `kontakt` | Mail, zeichengleich wie auf dem Deckblatt |
| `unterlagen[]` | ja, darf leer sein | Die Unterlagen dieser Person, in der Reihenfolge der Mappe |

**Unterlage**

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `typ` | ja | Art der Unterlage; Abschnitt 6 |
| `seiten_mappe` | ja | `{ "von": 3, "bis": 5 }`: erste und letzte Seite **in der Mappe**, wie im Verzeichnis |
| `monate` | nein | Bei Serien die Monate, `JJJJ-MM`, aufsteigend, wie im Verzeichnis |
| `vom` | nein | Ausstellungstag, `JJJJ-MM-TT`, wie im Verzeichnis |
| `pruefweg` | nein | Wie man die Echtheit beim Aussteller prüfen kann; Abschnitt 6 |
| `vermerke[]` | nein | Wie die Unterlage in die Mappe übernommen wurde; Abschnitt 10 |

## 6. Feste Listen

Jede Kennung behält ihre Bedeutung. Neue Kennungen können ohne neue Fassung dazukommen; alle Listen sind darum im
Schema offen (Kennungen aus `^[a-z][a-z0-9_]*$`). Leser zeigen Unbekanntes neutral: Unbekannt zeigt ein Leser `rolle`
als „Person“, `mitziehende[].art` als „weitere Person“ und `typ` als „Unterlage“; `modus` und `schritt` lässt er weg.

**`rolle`**

| Kennung | Bedeutung |
| --- | --- |
| `hauptmieter` | steht im Mietvertrag, als erste Person des Haushalts |
| `mitmieter` | steht ebenfalls im Mietvertrag |
| `buerge` | bürgt für den Haushalt, steht nicht im Mietvertrag; Abschnitt 12 |

**`mitziehende[].art`:** `kind` (Kind), `erwachsen` (weitere erwachsene Person ohne Vertrag)

**`typ`** – „Im Verzeichnis“ ist der Wortlaut in „Was beiliegt“ der Mappe. Er enthält weder `|` noch `;`.

| Kennung | Im Verzeichnis | Bedeutung |
| --- | --- | --- |
| `selbstauskunft` | Selbstauskunft | von Hefta aus den Angaben der Person erstellt |
| `gehaltsnachweis` | Gehaltsnachweise | eine Serie mit `monate` |
| `einkommen_selbststaendig` | Einkommensnachweis | Einkommensnachweis bei Selbstständigkeit |
| `einkommen_ausbildung` | BAföG-Bescheid oder Ausbildungsvertrag | BAföG-Bescheid oder Ausbildungsvertrag |
| `rentenbescheid` | Rentenbescheid | Rentenbescheid |
| `mietuebernahme_amt` | Nachweis der Mietübernahme | Nachweis, dass ein Amt die Miete übernimmt |
| `einkommen_sonstig` | Sonstiger Einkommensnachweis | sonstiger Einkommensnachweis |
| `bonitaet` | Bonitätsnachweis | Bonitätsnachweis, etwa einer Auskunftei |
| `mietzahlung` | Mietzahlungen | Mietschuldenfreiheit oder Nachweis der Mietzahlungen |
| `buergschaftserklaerung` | Bürgschaftserklärung | Bürgschaftserklärung; nur bei `buerge` |
| `anschreiben` | Anschreiben | von Hefta erstellt |
| `empfehlung_vorvermieter` | Empfehlung des Vorvermieters | Empfehlung des Vorvermieters |
| `wbs` | Wohnberechtigungsschein | Wohnberechtigungsschein |
| `ausweiskopie` | Ausweiskopie | Ausweiskopie |
| `schufa_datenkopie` | SCHUFA-Datenkopie | Auskunft der SCHUFA an die Person selbst |

**`pruefweg`:** `pruefcode`. Die Unterlage trägt einen Code, mit dem der Vermieter sie beim Aussteller prüfen kann.

**`modus`**

| Kennung | Bedeutung |
| --- | --- |
| `alles` | alles Übliche und alles, was helfen kann |
| `marktueblich` | was der Markt üblicherweise verlangt |
| `datensparsam` | nur, was der Schritt in `schritt` braucht |
| `eigene_auswahl` | Unterlage für Unterlage selbst gewählt |

**`schritt`**

| Kennung | Bedeutung |
| --- | --- |
| `besichtigung` | Anfrage oder Besichtigung |
| `will_wohnung` | „Ich will die Wohnung“ |
| `zusage` | nach der Zusage, vor dem Vertrag |

**`vermerke[].art`:** Liste in Abschnitt 10.

## 7. Namen

- **Was steht drin:** `vorname` und `nachname` stehen getrennt, wie die Person sie in Hefta eingetragen hat, und so,
  wie sie auf dem Deckblatt stehen.
- **Hefta teilt keinen Namen selbst auf.** Ein „von“ oder ein „Dr.“ steht dort, wo die Person es eingetragen hat.
- **Kein Namenszusatz:** Hefta kennt kein eigenes Feld für Namenszusätze. Deshalb gibt es auch kein Feld
  `namenszusatz`.
- **Nicht lateinische Schrift:**
  - Kann das PDF einen Namen nicht schreiben, etwa in kyrillischer Schrift, trägt die Person ihn in lateinischen
    Buchstaben ein, wie im Pass. Diese Form steht auf dem Deckblatt und hier.
  - Die ursprüngliche Schrift steht nicht auf dem Papier und darum auch nicht hier (Regel 1).
- **Keine Anrede und kein Geschlecht.** Auch die Bezeichnung „Hauptmieterin“ oder „Mitmietpartei“ vom Deckblatt
  steht nicht drin, weil man aus ihr auf das Geschlecht schließen könnte. `rolle` ist neutral.

| Fall | `vorname` | `nachname` | `name` |
| --- | --- | --- | --- |
| mehrere Vornamen | `Anna Maria` | `Muster` | `Anna Maria Muster` |
| Doppelname | `Lea` | `Muster-Beispiel` | `Lea Muster-Beispiel` |
| Adelsprädikat, im Nachnamen eingetragen | `Anna Maria` | `von Muster-Beispiel` | `Anna Maria von Muster-Beispiel` |
| nur ein Name | `Aylin` | (leer) | `Aylin` |
| Doktorgrad, im Vornamen eingetragen | `Dr. Maximiliane-Charlotte Henriette` | `Beispielsdorf-Mustermann` | wie beide zusammen, ohne Kürzung |
| kyrillisch eingetragen, lateinisch auf dem Deckblatt | `Sergej` | `Ivanov` | `Sergej Ivanov` |
| vietnamesische Zeichen (schreibt das PDF) | `Thị Mai` | `Nguyễn` | `Thị Mai Nguyễn`, in NFC |

- **Länge:** Es gibt keine Höchstlänge. Das Deckblatt bricht lange Namen um, hier stehen sie ganz.
- **Dieselbe Person über mehrere Fassungen:** Wer dieselbe Person in mehreren Fassungen wiederfinden will, vergleicht
  `vorname` und `nachname`. Eine Kennung je Person gibt es nicht (Regel 1).

## 8. Kontakt und Telefon

- **Wo:** Kontaktdaten stehen bei der Person mit `kontakt: true` und nur so, wie sie auf dem Deckblatt stehen. Was
  dort fehlt, fehlt hier.
- **`telefon_e164`** ist dieselbe Nummer international, aber nur, wenn das eindeutig geht:
  1. „(0)“ fällt weg. Ebenso Leerzeichen, Schrägstrich, Bindestrich, Punkt und Klammern.
  2. Beginnt die Nummer mit `00`, wird daraus `+`.
  3. Beginnt sie mit einer einzelnen `0`, ist es eine deutsche Nummer: `+49`, dann die Nummer ohne die `0`.
  4. Bleibt danach nicht genau ein `+` mit 7 bis 15 Ziffern, deren erste nicht 0 ist, fehlt `telefon_e164`.
     Dann fehlt `telefon_e164`.

| `telefon` | `telefon_e164` |
| --- | --- |
| `0171 3920001` | `+491713920001` |
| `+49 171 3920001` | `+491713920001` |
| `0049 (0)171 39 200 01` | `+491713920001` |
| `0171/3920007` | `+491713920007` |
| `+44 20 7946 0018` | `+442079460018` |
| `3920001` (ohne Vorwahl) | fehlt |

- **Maßgeblich bleibt, was auf dem Deckblatt steht.**
- **Festnetz oder Handy:** Ob eine Nummer ein Festnetz oder ein Handy ist, sagt das Format nicht.

## 9. Adresse

- **Das freie Feld bleibt maßgeblich:** `strasse` und `rest`, wie auf dem Deckblatt.
- **`teile`** liest Hefta aus diesem Feld:
  - Die erste Angabe ist Straße mit Hausnummer.
  - Eine Angabe mit fünfstelliger Postleitzahl ist der Ort.
  - Alles andere ist die Lage im Haus.
- **Was nicht erkennbar ist, bleibt leer** (`""`). Ohne erkennbare Hausnummer fehlt `teile` ganz.
- **`land`** ist immer `DE`, nach ISO 3166-1 mit zwei Buchstaben. Hefta kennt nur Adressen in Deutschland. Leser
  nehmen jeden Code aus zwei Großbuchstaben an; ein weiteres Land wäre eine neue Kennung ohne neue Fassung (E207).

## 10. Vermerke (für DP64; Hefta schreibt sie erst, wenn DP64 gebaut ist)

- **Was ein Vermerk sagt:** wie eine Unterlage in die Mappe übernommen wurde. Im Verzeichnis „Was beiliegt“ steht er
  als graue Zeile unter der Unterlage.
- **Seitenzahlen:** `seiten_original` zählt im **Original**, ab 1. `seiten_mappe` dagegen zählt in der Mappe. Beides
  wird nie vermischt. Mit `datei` zählt `seiten_original` in dieser Datei.
- **Ganze Unterlage:** Betrifft ein Vermerk die ganze Unterlage, fehlt `seiten_original`.
- **Wortlaut für die Anzeige** (wie im Verzeichnis, DP64): „Seiten 2 und 3 weggelassen“, „Verkleinert“, „Als Bild
  übernommen“, „Formularfelder fest“; mit Seiten etwa „Seite 3 verkleinert“; bei Serien mit dem Monat davor, etwa
  „Oktober: als Bild übernommen“.

| `art` | Bedeutung | Felder |
| --- | --- | --- |
| `seiten_weggelassen` | Seiten des Originals fehlen in der Mappe | `seiten_original`, Pflicht |
| `verkleinert` | Das Original war größer als A4 und steht kleiner da | `seiten_original`, nur wenn nicht die ganze Unterlage |
| `als_bild` | Eine Seite aus einem PDF kam nur als Bild in die Mappe, ihr Text lässt sich nicht mehr markieren | `seiten_original`, nur wenn nicht die ganze Unterlage |
| `formularfelder_fest` | Das Original hatte ausfüllbare Felder, ihr Inhalt steht jetzt fest auf der Seite | – |

- **Unterlagen aus mehreren Dateien:**
  - `datei` nennt die Datei, ab 1, in der Reihenfolge der Mappe.
  - Bei Serien nennt `monat` zusätzlich den Monat.
  - Fehlt `datei`, gilt der Vermerk für die ganze Unterlage.
- **Neue Arten** bekommen neue Kennungen, etwa später für Geschwärztes. Ein Leser zeigt eine unbekannte Art neutral
  als „angepasst“.

## 11. Ob eine Lesehilfe zur Mappe passt

Eine Lesehilfe kann geändert oder von einer anderen Mappe sein (Regel 3). Ein Leser zeigt sie nur, wenn alles
Folgende stimmt, und sonst gar nicht, auch nicht zum Teil:

1. `seitenzahl` gleich der Zahl der Seiten der PDF.
2. 2 ≤ `von` ≤ `bis` ≤ `seitenzahl`. Die Bereiche aller Unterlagen überschneiden sich nicht. Lücken sind erlaubt. Die
   Reihenfolge prüft der Leser nicht.
3. Jedes Wort jedes `name` steht im Text von Seite 1. Ebenso die Wörter von `wohnung.strasse`.
   - Verglichen wird ohne Groß- und Kleinschreibung.
   - Leerzeichen, geschützte Leerzeichen und weiche Trennstriche zählen dabei nicht.
4. `telefon` und `email` stehen wörtlich auf Seite 1, mit derselben Regel für Leerzeichen.
5. `name` ist gleich `vorname`, ein Leerzeichen, `nachname`; ist `nachname` leer, gleich `vorname`.
6. Höchstens eine Person hat `kontakt`. Höchstens eine hat `rolle: hauptmieter`, und die steht zuerst. Bürginnen und
   Bürgen stehen nach allen im Mietvertrag. Mindestens eine Person steht im Mietvertrag (`rolle` nicht `buerge`).
   `schritt` steht nur bei `modus: datensparsam`.

Genau einen Hauptmieter garantiert Hefta nicht: Wird die hauptmietende Person aus dem Haushalt genommen, rückt
niemand nach. Dann steht in der Lesehilfe niemand mit `hauptmieter`.

Die Funktion `passt()` im Paket prüft alle sechs Punkte, dazu die Formen aller Felder. Die Vermieterseite von Hefta
nutzt genau diese Funktion.

## 12. Bezüge

- **Unterlagen gehören zu ihrer Person.** Sie stehen in `personen[].unterlagen`, nicht mehr in einer eigenen Liste
  mit einer Nummer, die auf eine Person zeigt. Eine Reihenfolge kann so nichts verwechseln.
- **Kontakt:** Die Kontaktperson trägt `kontakt: true` und ihre Kontaktdaten selbst.
- **Bürgschaft:**
  - Eine Person mit `rolle: buerge` bürgt für den Haushalt, also für alle, die im Mietvertrag stehen.
  - Hefta kennt keine Bürgschaft für eine einzelne Person, darum gibt es dafür kein Feld.
- **Dieselbe Bewerbung über mehrere Fassungen:**
  - Es ist dieselbe `bewerbung.kennung`.
  - Die Fassungen ordnet `erstellt`.
  - `fassung` zählt nur Mappen, die schon hinausgingen. Zwei Mappen, die vor dem Senden gebaut wurden, tragen
    dieselbe `fassung`, aber verschiedene `erstellt`.

## 13. Ältere Fassungen

Leser von Hefta lesen Fassung 1 bis 3 weiter und machen daraus dasselbe Bild wie bei Fassung 4:

| Fassung 1 bis 3 | wird zu |
| --- | --- |
| `unterlagen[]` mit `person` (Nummer) | `personen[n].unterlagen` |
| `seiten: [3, 5]` | `seiten_mappe: { von: 3, bis: 5 }` |
| `haushalt.kontakt.telefon`, `.email` | `telefon`, `email` bei der Person mit `kontakt` |
| `erstellt: "2026-11-06"` | bleibt ein Tag; ohne Uhrzeit |
| ohne `vorname`, `nachname`, `fassung` | fehlen; `name` bleibt |

Fremde Leser müssen ältere Fassungen nicht lesen. Es gibt höchstens eine Mappe in fremder Hand, und sie lässt sich
neu erzeugen.

## 14. Abgleich mit OpenImmo-Feedback

- **Was OpenImmo-Feedback ist:** Damit schicken Portale Anfragen von Interessenten an Maklersoftware (Element
  `interessent` in `objekt`).
- **Quelle:** die Feldnamen aus der offenen Bibliothek OpenEstate-IO, die aus dem Schema 1.2.7 erzeugt ist. Das
  Schema selbst gibt der OpenImmo e.V. nur unter Lizenz und ohne Weitergabe heraus.

| hefta.json | OpenImmo-Feedback | Abgleich |
| --- | --- | --- |
| `vorname` | `interessent/vorname` | gleich |
| `nachname` | `interessent/nachname` | gleich. Im Haupt-Schema heißt der Nachname der Kontaktperson `name`; für Bewerbungen ist Feedback das Vorbild |
| `email` | `interessent/email` | gleich |
| `telefon` | `interessent/tel` | Name abweichend. `telefon` ist seit Fassung 3 so; Festnetz oder Handy (`mobil`) ist nicht sicher zu erkennen |
| – | `interessent/anrede` | fehlt absichtlich: steht nicht auf dem Deckblatt (Regel 1) |
| `bewerbung.kennung` | `interessent/int_id` | Bedeutung nah (Kennung der Anfrage), Name bleibt |
| `teile.strasse`, `hausnummer`, `plz`, `ort` | `geo/strasse`, `hausnummer`, `plz`, `ort` | gleich |
| `teile.land`: `DE` | `land/@iso_land`: `DEU` | OpenImmo nimmt drei Buchstaben, hier zwei: Das ist in JSON und für Telefonnummern (E.164) üblich. Eine feste Tabelle übersetzt |
| `teile.lage` (freier Text) | `geo/etage`, `geo/wohnungsnr` | Hefta kann „3. OG links“ nicht sicher teilen; darum freier Text |
| `inserat.portal` | `sender/name` (Portal) | Bedeutung nah, nur der Name des Portals |
| – | `objekt/oobj_id`, `expose_url` | fehlen: Hefta kennt die Nummer des Anbieters nicht, und der Link steht nicht auf dem Deckblatt |
| `x_…` | `user_defined_simplefield`, `user_defined_extend` | gleicher Zweck, als Präfix statt als Element |
| `personen[]`, `rolle`, `unterlagen[]` | – | keine Entsprechung. Feedback kennt eine Person je Anfrage, keine Haushalte und keine Unterlagen |

## 15. Absichtlich nicht enthalten

| Was | Warum |
| --- | --- |
| Beruf, Arbeitgeber, Einkommen, Geburtsdaten | Sie stehen zwar in der Selbstauskunft, also in der Mappe. Maschinenlesbar würden sie zum Sortieren von Bewerbungen nach Einkommen einladen. Die Mappe zeigt sie Menschen, die Lesehilfe nicht |
| Anrede, Geschlecht, die Bezeichnung „Hauptmieterin“ oder „Mitmietpartei“ | Die Anrede steht nicht auf dem Papier; aus der Bezeichnung ließe sich das Geschlecht ablesen (Abschnitt 7) |
| Name in der ursprünglichen Schrift | steht nicht auf dem Papier (Regel 1) |
| der freie Satz vom Deckblatt | freier Text ohne festen Inhalt; für Programme ohne Nutzen |
| Dateinamen, Prüfsummen, Haushalts-, Personen- oder Geräte-IDs | nicht auf dem Papier, und sie verbänden Mappen über Wohnungen hinweg |
| Link zum Inserat | steht nicht auf dem Deckblatt; nur der Name des Portals |
| Signatur, Prüfsumme der Mappe | Die Lesehilfe ist kein Echtheitsnachweis (Regel 3) |

## 16. Dateien

**Im Paket `hefta-json`:**

| Datei | Inhalt |
| --- | --- |
| `FORMAT.md` | diese Beschreibung |
| `schema.json` | JSON Schema, draft-07; das ist der Entwurf mit der breitesten Unterstützung in Werkzeugen |
| `beispiele/1-eine-person.json` | eine Person, mit Portal und Einzug |
| `beispiele/2-paar-kind-buergin.json` | Paar, ein Kind, Bürgin, zweite Fassung, mit Vermerken |
| `beispiele/3-nach-der-zusage.json` | datensparsam, Schritt `zusage`, dritte Fassung |
| `beispiele/4-ohne-wohnung.json` | Mappe ohne Wohnung, Kontakt nur mit Mail |
| `beispiele/5-grenzfaelle-namen.json` | Grenzfälle bei Namen, dazu ein `x_`-Feld |
| `test/fremd/` | Designs unabhängiger Leser in Python (DP72) als zweite Probe; nur für die Tests, nicht im veröffentlichten Paket |

**Nur im Repository von Hefta:**

| Datei | Inhalt |
| --- | --- |
| `docs/hefta-json-4/export-entwurf.md` | der Export der Vermieterseite als CSV |
| `tests/fixtures/export/2-paar-kind-buergin.csv` | Export von Beispiel 2, Zeichen für Zeichen |
| `src/pdf/anhang.ts` | der Schreiber in der App |

## 17. Paket `hefta-json`

- **Was es kann:** In TypeScript, gebaut zu JavaScript-Modulen mit Typen. Zur Laufzeit hängt es an nichts.
  - `lesen(json)`: nimmt Text oder Bytes. Gibt Fassung 1 bis 4 als ein Bild nach Fassung 4 zurück (Abschnitt 13),
    sonst `null`; wirft nie.
  - `passt(lesehilfe, { seiten, textSeite1 })`: die Prüfung aus Abschnitt 11
  - `telefonE164(telefon)`: die Regel aus Abschnitt 8
  - die festen Listen aus Abschnitt 6 mit ihrer Bedeutung: `ROLLEN`, `TYPEN`, `VERZEICHNIS`, `PRUEFWEGE`, `MODI`,
    `SCHRITTE`, `VERMERKE`, `MITZIEHENDE`, dazu `UNBEKANNT` für die neutrale Anzeige
  - `typText(typ)`: der Wortlaut im Verzeichnis, unbekannt „Unterlage“
  - `hefta-json/schema.json`
- **Nicht im Paket:** das Auslesen aus der PDF. Das bräuchte eine PDF-Bibliothek; die Wege stehen in Abschnitt 2.
- **Hefta selbst** nutzt das Paket: die App zum Schreiben, die Vermieterseite zum Lesen und Prüfen.
