# Format `hefta.json`, Formatfassung 2

**Stand: 25. November 2026.** Formatfassung 1 ist die erste, die Hefta ausliefert (Hefta 2.0 bis 2.1); sie bedeutet von
da an immer dasselbe. Formatfassung 2 kommt mit Hefta 2.2 und ändert die Rollen und das Rollenwort auf dem Deckblatt
(Abschnitt 6, „Formatfassung 1 lesen“). Ältere Entwürfe gibt es nicht; kein Leser muss sie kennen.

**Zwei Wörter für „Fassung“:**

- `hefta` ist die **Formatfassung**: die Fassung dieser Beschreibung, hier `2`.
- `fassung` ist die **Fassung der Mappe**: die wievielte Mappe an dieselbe Wohnung geht. Sie steht auf dem Deckblatt
  („Fassung 2 vom 18. November 2026“).

**Lizenz:** Diese Beschreibung, `schema.json` und die Beispiele stehen unter Apache-2.0, wie das Paket `hefta-json`, in
dem sie liegen (Datei `LICENSE`). Die App Hefta steht unter AGPL-3.0.

`hefta.json` ist die Lesehilfe für Vermieter. Die JSON-Datei steckt als Anhang in einer PDF-Mappe aus Hefta.
Programme können sie lesen, Menschen merken nichts davon. Dieses Dokument beschreibt das Format vollständig. Wer
einen Leser schreibt, braucht nur dieses Dokument, `schema.json` und die Beispiele, keinen Code von Hefta. Wo ein
Leser raten müsste, sagt dieses Dokument, was gilt. Die Nummern in Klammern (etwa V3, E220, L78-3, A17) verweisen auf
Entscheidungen bei Hefta, die nicht veröffentlicht sind. Jede Regel steht hier vollständig; ein Leser braucht die
Nummern nicht.

## 1. Drei Regeln

1. **Nur, was ohnehin sichtbar ist.**
   - Jede Angabe steht auch auf dem Deckblatt, im Verzeichnis „Was beiliegt“ oder in den Eigenschaften der
     PDF-Datei. Der Zeitpunkt `erstellt` ist das Erstelldatum der PDF.
   - Kennungen wie `rolle`, `typ` oder `mitziehende[].art` sind Übersetzungen dessen, was auf dem Papier steht, in
     eine feste Liste (Abschnitt 6). Sie stehen nicht selbst auf dem Papier.
   - Einige Werte stehen hier in fester Form statt in der Form vom Papier:
     - Datumsangaben als `JJJJ-MM-TT`
     - das Telefon zusätzlich international (`telefon_e164`)
     - die Adresse in Teilen, mit dem Land
   - **Einzige Ausnahme** ist `bewerbung.kennung`: eine zufällige Kennung ohne Bezug zu Personen, Gerät oder
     Haushalt. Ein Leser zeigt sie nie.
2. **Ein Bonus, nie eine Voraussetzung.**
   - Portale, die ein PDF neu drucken, und manche Mailprogramme werfen Anhänge weg. Eine Mappe ohne Anhang ist
     dieselbe Mappe.
   - Wer den Anhang liest, muss ein PDF ohne Anhang genauso annehmen.
3. **Kein Echtheitsnachweis.**
   - Die Lesehilfe beschreibt die Mappe, sie beglaubigt nichts.
   - Es gibt keine Prüfsumme und keine Signatur. Jeder kann eine Lesehilfe ändern.
   - Ein Leser prüft deshalb, ob sie zur Mappe passt, auch gegen das Papier (Abschnitt 11). Passt sie nicht, zeigt er
     sie nicht, auch nicht zum Teil. **Ein Leser zeigt nur, was er gegen die Mappe geprüft hat.**

## 2. Wo die Datei steckt und wie man sie liest

- **Ablage:** als eingebettete Datei der PDF (Embedded File) mit dem Namen `hefta.json`, Typ `application/json`,
  Beziehung `Data` (`/AFRelationship /Data`), Beschreibung „Lesehilfe für Vermieter“.
- **Wann es sie gibt:** nur, wenn die Mappe ein Deckblatt hat und der Schalter „Hinweis und Lesehilfe“ an ist, und nur
  mit einer Kennung der Bewerbung. Einzeldateien tragen keine Lesehilfe.
- **Auslesen**, je nach Werkzeug:
  - PDF.js: `getAttachments()`, dann `getAttachmentContent()`
  - pdf-lib: `getAttachments()` (@cantoo/pdf-lib)
  - Python, pypdf: `PdfReader(...).attachments["hefta.json"][0]`
  - Kommandozeile: `qpdf --show-attachment=hefta.json mappe.pdf`
- **Streng lesen (Abschnitt 13):** Was nicht genau so aussieht, wie hier beschrieben, lehnt ein Leser ab. Er gibt bei
  jeder Eingabe ein Urteil und stürzt nie ab (E220, Regel 1).

## 3. Fassungen und Erweiterung

- **Nummer:** `hefta` ist die Formatfassung, hier `2`. Sie steigt nur, wenn sich die Bedeutung eines Felds
  ändert, ein Pflichtfeld dazukommt oder sich etwas ändert, das auf dem Papier fest ist: die Überschriften (V5), die
  Rollenwörter (V9), die Form der Verzeichniszeile (V6) oder die Sätze zum Schritt (E227).
- **Ohne neue Fassung kommen dazu:** neue freiwillige Felder und neue Kennungen in den festen Listen (Abschnitt 6).
- **Leser:**
  - nehmen jede Formatfassung ab 1 an
  - lesen die Felder, die sie kennen
  - überlesen unbekannte Felder
  - zeigen eine unbekannte Kennung neutral, etwa als „Unterlage“
- **Feste Kennungen:** Eine Kennung wird nie umgedeutet. Ändert sich die Bedeutung, gibt es eine neue Kennung.
- **Eigene Felder anderer Programme** beginnen mit `x_`, gefolgt vom Namen des Programms. Beispiel:
  `"x_beispielprogramm_status": "eingegangen"`.
  - Erlaubt sind sie in jedem Objekt.
  - Hefta schreibt solche Felder nie und liest sie nie.
  - Leser überlesen `x_`-Felder und **zeigen sie nie**, auch nicht „Von Hefta geprüft“ oder Ähnliches (A17). Ob die
    Datei zur Mappe passt, entscheidet allein Abschnitt 11.
  - Im Schema stehen sie als `patternProperties`. Das Muster sagt nur, dass sie erlaubt sind. Andere unbekannte Felder
    bleiben ebenfalls erlaubt, weil spätere Formatfassungen freiwillige Felder ergänzen dürfen; darum gibt es kein
    `additionalProperties: false`.
- **`x_` als Wert:** Kennungen der festen Listen beginnen nie mit `x_`. Steht `x_…` als Wert in einer Liste, etwa
  `"typ": "x_neu"`, ist es eine unbekannte Kennung und wird neutral gezeigt (Abschnitt 6).

## 4. Aufbau

Beispiel: zwei im Mietvertrag, ein Kind, eine Bürgin, zweite Fassung der Mappe (`beispiele/2-paar-kind-buergin.json`,
gekürzt).

```json
{
  "hefta": 2,
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
        "rolle": "vertrag", "ansprech": true,
        "telefon": "0171 3920001", "telefon_e164": "+491713920001", "email": "max.mustermann@example.com",
        "unterlagen": [
          { "typ": "selbstauskunft", "seiten_mappe": { "von": 2, "bis": 2 } },
          { "typ": "gehaltsnachweis", "seiten_mappe": { "von": 3, "bis": 5 }, "monate": ["2026-08", "2026-09", "2026-10"],
            "vermerke": [{ "art": "als_bild", "datei": 2, "monat": "2026-09" }] },
          { "typ": "bonitaet", "seiten_mappe": { "von": 6, "bis": 6 }, "vom": "2026-10-28",
            "vermerke": [{ "art": "seiten_weggelassen", "seiten_original": [2, 3] }] }
        ]
      },
      { "name": "Lea Mustermann", "vorname": "Lea", "nachname": "Mustermann", "rolle": "vertrag", "unterlagen": [ … ] },
      { "name": "Petra Mustermann", "vorname": "Petra", "nachname": "Mustermann", "rolle": "buerge", "unterlagen": [ … ] }
    ],
    "mitziehende": [{ "text": "Ein Kind", "anzahl": 1, "art": "kind" }]
  },
  "loeschwunsch": "Falls die Wohnung an jemand anderen geht, löschen Sie diese Unterlagen bitte. Vielen Dank."
}
```

## 5. Felder

**Oberste Ebene**

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `hefta` | ja | Formatfassung, hier `2`; eine ganze Zahl (`2.0` gilt als 2, V15) |
| `erstellt` | ja | Zeitpunkt, zu dem die Mappe gebaut wurde, genau in der Form `JJJJ-MM-TTThh:mm:ss` mit `Z` oder `±hh:mm`, ohne Bruchteile von Sekunden: `2026-11-18T19:02:55+01:00`. Gleich dem Erstelldatum der PDF, Abweichung unter einer Sekunde (V11) |
| `fassung` | ja | Fassung der Mappe, wie auf dem Deckblatt („Fassung 2 vom 18. November 2026“, V7). Zählt die Mappen, die an diese Wohnung schon hinausgingen, plus eins |
| `seitenzahl` | ja | Seiten der ganzen Mappe, Deckblatt eingeschlossen; wie im Fuß des Deckblatts („Seite 1 von 16“, V8) |
| `bewerbung` | ja | Abschnitt 5, „Bewerbung“ |
| `haushalt` | ja | Abschnitt 5, „Haushalt“ |
| `schritt` | nein | für welchen Schritt der Bewerbung die Mappe gedacht ist; nur, wenn der feste Satz dazu auf dem Deckblatt steht (Abschnitt 6). Hefta schreibt ihn bis 2.2 nicht. Formatfassung 1 kennt das Feld schon |
| `loeschwunsch` | nein | die Bitte zum Löschen, zeichengleich mit dem Satz auf dem Deckblatt; nur, wenn sie dort steht |

`modus` gehört zu keiner Formatfassung (V23). Steht er doch in einer Datei, überliest ein Leser ihn wie jedes
unbekannte Feld.

**Bewerbung**

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `kennung` | ja | Zufällige Kennung (UUID Version 4, klein geschrieben), je Haushalt und Wohnung, gleich in jeder Fassung derselben Bewerbung. Eine andere Wohnung bekommt eine andere Kennung. Keine Haushalts-ID: Derselbe Haushalt hat für jede Wohnung eine andere. Nie angezeigt, nie gebunden |
| `wohnung` | ja, darf `null` sein | Die Wohnung, wie auf dem Deckblatt. `null`, wenn die Mappe keine Wohnung nennt |
| `wohnung.strasse` | ja, nicht leer | Erste Zeile: Straße und Hausnummer |
| `wohnung.rest` | ja | Der Rest, wie auf dem Deckblatt: Lage im Haus, Postleitzahl und Ort, mit Komma getrennt; darf leer sein |
| `wohnung.teile` | nein | Die Adresse in Teilen; Abschnitt 9. Fehlt, wenn keine Hausnummer erkennbar ist |
| `inserat.portal` | nein | Das Portal, wie auf dem Deckblatt („Zu Ihrem Inserat auf ImmoScout24“ ergibt `ImmoScout24`) |
| `einzug` | nein | Frühester Einzug, wie auf dem Deckblatt („Einzug möglich ab 1. Januar 2027“ ergibt `2027-01-01`) |

**Haushalt**

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `personen[]` | ja, 1 bis 50 | In der Reihenfolge des Deckblatts: zuerst die Ansprechperson, dann wer sonst im Mietvertrag steht, dann Bürginnen und Bürgen |
| `mitziehende[]` | ja, darf leer sein | Kinder und weitere Personen ohne Vertrag |
| `mitziehende[].text` | ja | die feste Form aus `anzahl` und `art`, wie auf dem Deckblatt (V22, Abschnitt 6) |
| `mitziehende[].anzahl` | ja | ganze Zahl ab 1 |
| `mitziehende[].art` | ja | `kind` oder `erwachsen`; jede bekannte Art höchstens einmal |

**Person**

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `name` | ja | Der volle Name wie auf dem Deckblatt. Immer gleich `vorname`, ein Leerzeichen, `nachname`; ohne Nachnamen nur der Vorname. Abschnitt 7 |
| `vorname` | ja, nicht leer | Vorname oder Vornamen, wie auf dem Deckblatt |
| `nachname` | ja, darf leer sein | Nachname, wie auf dem Deckblatt |
| `rolle` | ja | `vertrag` oder `buerge`; Abschnitt 6 |
| `ansprech` | nein | `true` bei der Ansprechperson des Haushalts: Sie steht zuerst, im Mietvertrag, und unter „Kontakt“ auf dem Deckblatt; höchstens eine |
| `telefon` | nein, nur bei `ansprech`, nur mit `telefon_e164` | Telefon, zeichengleich wie auf dem Deckblatt, in fester Form; Abschnitt 8 |
| `telefon_e164` | genau dann, wenn `telefon` steht | Dasselbe Telefon international, `+` und 7 bis 15 Ziffern; Abschnitt 8 |
| `email` | nein, nur bei `ansprech` | Mail, zeichengleich wie auf dem Deckblatt |
| `unterlagen[]` | ja, 0 bis 50 | Die Unterlagen dieser Person, in der Reihenfolge der Mappe |

**Unterlage**

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `typ` | ja | Art der Unterlage; Abschnitt 6 |
| `seiten_mappe` | ja | `{ "von": 3, "bis": 5 }`: erste und letzte Seite **in der Mappe**, wie im Verzeichnis |
| `monate` | nein | Bei Serien die Monate, `JJJJ-MM` mit Monat 01 bis 12, streng aufsteigend und ohne Doppel, wie im Verzeichnis |
| `vom` | nein | Ausstellungstag, `JJJJ-MM-TT`, ein echter Kalendertag, wie im Verzeichnis |
| `pruefweg` | nein | Wie man die Echtheit beim Aussteller prüfen kann; Abschnitt 6 |
| `vermerke[]` | nein | Wie die Unterlage in die Mappe übernommen wurde; Abschnitt 10 |

## 6. Feste Listen

Jede Kennung behält ihre Bedeutung. Neue Kennungen können ohne neue Fassung dazukommen; alle Listen sind darum im
Schema offen (Kennungen aus `^[a-z][a-z0-9_]*$`). Leser zeigen Unbekanntes neutral:

- `rolle` als „Person“. Eine unbekannte Rolle zählt weder als im Mietvertrag noch als Bürge (E220, Regel 6).
- `typ` als „Unterlage“. Gebunden werden dann nur ihre Seiten im Block der Person (V10).
- `mitziehende[].art` als „weitere Person“. Gezeigt wird sie, wenn ihr Text unter „Ziehen mit ein“ steht; gezählt
  wird sie nicht, weil es keine feste Form gibt (L78-1).
- `schritt`: nicht gezeigt, nicht gebunden; die Mappe wird trotzdem gezeigt (L78-4).

**`rolle` und Überschrift (V9, Formatfassung 2).** Auf dem Deckblatt steht jede Person unter ihrer Überschrift. Ein
Rollenwort steht nicht mehr dahinter: Unter „Im Mietvertrag“ folgt dem Namen nur die Tätigkeit, unter „Bürgt“ steht nur
der Name.

| Kennung | Bedeutung | Überschrift |
| --- | --- | --- |
| `vertrag` | steht im Mietvertrag | Im Mietvertrag |
| `buerge` | bürgt gegenüber dem Vermieter für die Pflichten der Personen im Mietvertrag; der Umfang steht in der Bürgschaftserklärung (§ 765, § 767 BGB). Steht nicht im Mietvertrag; Abschnitt 12 | Bürgt |

**Formatfassung 1 lesen (Hefta 2.0 bis 2.1).** Formatfassung 1 kannte statt `vertrag` die Kennungen `hauptmieter` (die erste Person,
genau eine) und `mitmieter`, statt `ansprech` das Feld `kontakt`, und auf dem Deckblatt stand hinter jedem Namen ein
Rollenwort. Ein Leser zeigt beide Fassungen gleich, ohne „Hauptmieter“:

| Formatfassung 1 | gelesen als | Rollenwort auf dem Deckblatt beginnt mit |
| --- | --- | --- |
| `hauptmieter` | im Mietvertrag | `Hauptmiet` (Hauptmieter, Hauptmieterin, Hauptmietpartei) |
| `mitmieter` | im Mietvertrag | `Mitmiet` (Mitmieter, Mitmieterin, Mitmietpartei) |
| `buerge` | bürgt | `Bürg` (Bürge, Bürgin, Bürgschaft) |
| `kontakt: true` | die Person unter „Kontakt“ | |

In Formatfassung 1 darf nach dem Rollenwort ein Komma und die Tätigkeit folgen („Hauptmieter, Elektroniker“). In
Formatfassung 2 gilt `kontakt` nicht mehr: Telefon und Mail stehen nur bei `ansprech`.

**Gemischte Dateien.** Ein Leser richtet sich immer nach `hefta`:

- `kontakt` in Formatfassung 2 wird überlesen. Telefon oder Mail ohne `ansprech` werden abgelehnt (Abschnitt 5).
- `rolle: hauptmieter` oder `mitmieter` in Formatfassung 2 gilt als im Mietvertrag und wird unter „Im Mietvertrag“
  gebunden. Punkt 6 aus Abschnitt 11 gilt dann in der Form für Formatfassung 2 (keine Pflicht auf genau einen
  Hauptmieter). Hefta schreibt das nie.
- Ein Haushalt ohne Person im Mietvertrag wird nicht abgelehnt. Hefta schreibt ihn nie.
- Eine Lesehilfe in Formatfassung 2 an einer Mappe aus Hefta 2.0 oder 2.1 (Deckblatt mit Rollenwort hinter dem Namen)
  passt, wenn alle Bindungen aus Abschnitt 11 aufgehen. Das Rollenwort hinter dem Namen stört die Bindung nicht.

**`mitziehende[].art` und die feste Form (V22)**

| `art` | `anzahl` 1 | `anzahl` 2 bis 12 | ab 13 |
| --- | --- | --- | --- |
| `kind` | Ein Kind | Zwei Kinder … Zwölf Kinder | 13 Kinder |
| `erwachsen` | Eine weitere Person | Zwei weitere Personen … Zwölf weitere Personen | 13 weitere Personen |

Die Zahlen zwei bis zwölf stehen als Wort, groß geschrieben am Satzanfang, ab 13 als Ziffer. Ein Leser rechnet nach.

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
| `buergschaftserklaerung` | Bürgschaftserklärung | Bürgschaftserklärung; nur bei `buerge`. Die Mappe enthält nur eine Kopie: Wirksam ist die Erklärung nur auf Papier mit eigenhändiger Unterschrift (§ 766 BGB) |
| `anschreiben` | Anschreiben | von Hefta erstellt |
| `empfehlung_vorvermieter` | Empfehlung des Vorvermieters | Empfehlung des Vorvermieters |
| `wbs` | Wohnberechtigungsschein | Wohnberechtigungsschein |
| `ausweiskopie` | Ausweiskopie | Ausweiskopie |
| `schufa_datenkopie` | SCHUFA-Datenkopie | Auskunft der SCHUFA an die Person selbst |

**`pruefweg`:** `pruefcode`. Die Unterlage trägt einen Code, mit dem der Vermieter sie beim Aussteller prüfen kann.
Der Prüfweg ist nicht an das Papier gebunden. Ein Leser zeigt ihn darum nie als geprüfte Angabe, höchstens als
allgemeinen Hinweis, wie man eine solche Unterlage beim Aussteller prüfen kann; den Code selbst liest er aus der
Unterlage, nicht aus der Lesehilfe.

**`schritt` und der feste Satz (E227).** `schritt` steht nur, wenn sein Satz auf dem Deckblatt steht: direkt unter dem
Satz zum Haushalt, vor „Im Mietvertrag“. Wortlaut und Ort sind fest wie die Überschriften; eine Änderung bringt eine
neue Formatfassung.

| Kennung | Bedeutung | Satz auf dem Deckblatt |
| --- | --- | --- |
| `besichtigung` | Anfrage oder Besichtigung | Zur Besichtigung nur dieses Deckblatt. Die Unterlagen folgen auf Wunsch. |
| `will_wohnung` | „Ich will die Wohnung“ | Zum Mietwunsch ohne Einkommens- und Bonitätsnachweise. Beide folgen nach der Zusage. |
| `zusage` | nach der Zusage, vor dem Vertrag | Zum Vertrag ohne Ausweiskopie. Der Ausweis wird bei der Unterschrift vorgezeigt. |

Hefta bietet bis 2.2 keine Auswahl nach Schritt an, die das Deckblatt ändert. Es schreibt darum weder `schritt` noch
einen dieser Sätze.

**`vermerke[].art`:** Liste in Abschnitt 10.

## 7. Namen

- **Was steht drin:** `vorname` und `nachname` stehen getrennt, wie die Person sie in Hefta eingetragen hat, und so,
  wie sie auf dem Deckblatt stehen.
- **Hefta teilt keinen Namen selbst auf.** Ein „von“ oder ein „Dr.“ steht dort, wo die Person es eingetragen hat.
- **Kein Namenszusatz:** Hefta kennt kein eigenes Feld für Namenszusätze. Deshalb gibt es auch kein Feld
  `namenszusatz`.
- **Nur lateinische Schrift (V18):** Jeder Buchstabe eines Namens gehört zur lateinischen Schrift, Akzente und
  Sonderbuchstaben eingeschlossen (é, ß, Ø, ı, İ, ş, ễ). Ein Name mit Buchstaben einer anderen Schrift wird abgelehnt,
  auch einzelne wie das kyrillische „е“ (A5).
  - Zeichen, die keine Buchstaben sind, prüft diese Regel nicht: Leerzeichen, Bindestrich, Apostroph und Punkt („Dr.“)
    sind erlaubt, soweit der saubere Text (Abschnitt 13) und die Regel zu Leerzeichen sie zulassen.
  - Kann das PDF einen Namen nicht schreiben, etwa in kyrillischer Schrift, trägt die Person ihn in lateinischen
    Buchstaben ein, wie im Pass. Diese Form steht auf dem Deckblatt und hier.
  - Die ursprüngliche Schrift steht nicht auf dem Papier und darum auch nicht hier (Regel 1).
- **Leerzeichen (V17):** Zwei Leerzeichen nebeneinander in einem Namen werden abgelehnt. Am Rand steht keins (V16).
- **Keine Anrede und kein Geschlecht.** Das Rollenwort vom Deckblatt („Hauptmieterin“) steht nicht drin, weil man aus
  ihm auf das Geschlecht schließen könnte. `rolle` ist neutral.

| Fall | `vorname` | `nachname` | `name` |
| --- | --- | --- | --- |
| mehrere Vornamen | `Anna Maria` | `Muster` | `Anna Maria Muster` |
| Doppelname | `Lea` | `Muster-Beispiel` | `Lea Muster-Beispiel` |
| Adelsprädikat, im Nachnamen eingetragen | `Anna Maria` | `von Muster-Beispiel` | `Anna Maria von Muster-Beispiel` |
| nur ein Name | `Aylin` | (leer) | `Aylin` |
| Doktorgrad, im Vornamen eingetragen | `Dr. Maximiliane-Charlotte Henriette` | `Beispielsdorf-Mustermann` | wie beide zusammen, ohne Kürzung |
| kyrillisch eingetragen, lateinisch auf dem Deckblatt | `Sergej` | `Ivanov` | `Sergej Ivanov` |
| vietnamesische Zeichen (schreibt das PDF) | `Thị Mai` | `Nguyễn` | `Thị Mai Nguyễn`, in NFC |
| Apostroph | `Zoë` | `O’Brien` | `Zoë O’Brien`; der Apostroph wie auf dem Deckblatt (V3) |

- **Länge:** Es gibt keine Höchstlänge. Das Deckblatt bricht lange Namen um, hier stehen sie ganz.
- **Dieselbe Person über mehrere Fassungen:** Wer dieselbe Person in mehreren Fassungen wiederfinden will, vergleicht
  `vorname` und `nachname`. Eine Kennung je Person gibt es nicht (Regel 1).

## 8. Kontakt und Telefon

- **Wo:** Kontaktdaten stehen bei der Ansprechperson (`ansprech: true`; in Formatfassung 1 `kontakt: true`) und nur so,
  wie sie auf dem Deckblatt stehen. Was dort fehlt, fehlt hier.
- **Telefon mit Land (E222):** Jede Telefonnummer in Hefta hat ihr Land. Der Schreiber kennt es und schreibt die
  Nummer immer zweimal: `telefon` in der Form vom Deckblatt und `telefon_e164` international. Das eine gibt es nicht
  ohne das andere (L78-2). **Leser rechnen nie selbst um.**
- **Feste Form von `telefon`:** Ziffern in Gruppen, ein Leerzeichen dazwischen, sonst nichts.
  - Deutsche Nummern national nach DIN 5008: `0`, Vorwahl, Leerzeichen, Rufnummer.
  - Alle anderen international nach E.123: `+`, Ländervorwahl, Gruppen des Landes.
  - Kein Schrägstrich, kein Bindestrich, keine Klammer, kein „(0)“, keine Durchwahl, keine Buchstaben.
- **Regel für Leser:**
  - Beginnt `telefon_e164` mit `+49`, beginnt `telefon` mit `0`, und seine Ziffern sind „0“ und die Ziffern von
    `telefon_e164` nach „+49“.
  - Sonst beginnt `telefon` mit `+` und ist ohne Leerzeichen gleich `telefon_e164`.
  - Stimmt das nicht, lehnt der Leser die Lesehilfe ab.

| `telefon` (Deckblatt) | `telefon_e164` | |
| --- | --- | --- |
| `0171 3920001` | `+491713920001` | Handy, Deutschland |
| `040 66969123` | `+494066969123` | Festnetz Hamburg |
| `+44 20 7946 0018` | `+442079460018` | Großbritannien |
| `+49 171 3920001` | `+491713920001` | abgelehnt: deutsche Nummern stehen national |
| `0171/3920007`, `0171-3920001`, `+49 (0)171 3920006` | | abgelehnt: keine feste Form |

- **`tel:`-Links** nehmen immer `telefon_e164`.
- **In der Tabelle (CSV):** `telefon_e164` steht ohne Apostroph, wenn es die Form `^\+[1-9]\d{6,14}$` hat; eine
  solche Zelle kann keine Formel sein (T5). `telefon` behält den Apostroph, wenn es mit „+“ beginnt, damit eine
  Tabellenkalkulation keine Formel daraus macht (V20).
- **Festnetz oder Handy:** Ob eine Nummer ein Festnetz oder ein Handy ist, sagt das Format nicht.

## 9. Adresse

- **Das freie Feld bleibt maßgeblich:** `strasse` und `rest`, wie auf dem Deckblatt.
- **`teile`** folgt fest aus diesem Feld. Leser rechnen es nach (V19):
  - `strasse` und `hausnummer`: Die Hausnummer ist das letzte Wort von `wohnung.strasse`, wenn es mit einer Ziffer
    beginnt; davor steht die Straße. Sonst fehlt `teile` ganz.
  - `plz` und `ort`: die Angabe in `rest`, die mit fünf Ziffern und einem Leerzeichen beginnt.
  - `lage`: alle anderen Angaben aus `rest`, in ihrer Reihenfolge, verbunden mit „, “.
  - Was nicht erkennbar ist, bleibt leer (`""`).
- **`land`** ist `DE`, nach ISO 3166-1 mit zwei Großbuchstaben. Hefta kennt nur Adressen in Deutschland, und die
  Nachrechnung nach V19 ergibt `DE`. Eine Lesehilfe mit einem anderen Land erfüllt das Schema, passt aber heute nicht.

## 10. Vermerke (Hefta schreibt sie bis 2.2 noch nicht)

- **Was ein Vermerk sagt:** wie eine Unterlage in die Mappe übernommen wurde. Im Verzeichnis „Was beiliegt“ steht er
  als graue Zeile unter der Unterlage. Ein Leser bindet ihn an diesen Wortlaut (Abschnitt 11).
- **Seitenzahlen:** `seiten_original` zählt im **Original**, ab 1, ohne Doppel. `seiten_mappe` dagegen zählt in der
  Mappe. Beides wird nie vermischt. Mit `datei` zählt `seiten_original` in dieser Datei.
- **Ganze Unterlage:** Betrifft ein Vermerk die ganze Unterlage, fehlt `seiten_original`.
- **Wortlaut** im Verzeichnis, zusammengesetzt aus Art, Seiten und Ort:
  - Art: „weggelassen“, „verkleinert“, „als Bild übernommen“, „Formularfelder fest“; eine unbekannte Art „angepasst“.
  - Mit `seiten_original` stehen die Seiten davor: „Seite 3 verkleinert“, „Seiten 2 und 3 weggelassen“, „Seiten 2, 3
    und 5 weggelassen“. Ohne `seiten_original` steht nur die Art.
  - Mit `monat` steht der Monat davor: „September 2026: als Bild übernommen“, „September 2026: Seite 2 verkleinert“.
    `monat` geht `datei` vor: Steht beides, nennt die Zeile nur den Monat.
  - Sonst mit `datei`: „Datei 2: verkleinert“.
  - Ohne beides beginnt die Zeile groß: „Verkleinert“, „Seiten 2 und 3 weggelassen“.
  - Gebunden wird der Wortlaut irgendwo im Verzeichnis, nicht nur im Block der Person.

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

Eine Lesehilfe kann geändert oder von einer anderen Mappe sein (Regel 3). Ein Leser zeigt sie nur, wenn sie streng
gelesen wurde (Abschnitt 13) und alles Folgende stimmt, sonst gar nicht, auch nicht zum Teil:

1. `seitenzahl` gleich der Zahl der Seiten der PDF.
2. 2 ≤ `von` ≤ `bis` ≤ `seitenzahl`. Die Bereiche aller Unterlagen überschneiden sich nicht. Lücken zwischen den
   Bereichen sind erlaubt. `monate` ist streng aufsteigend und ohne Doppel.
3. und 4. gehen in Punkt 7 auf: Namen, Straße, Telefon und Mail sind dort an ihre Stelle auf dem Papier gebunden.
5. `name` ist gleich `vorname`, ein Leerzeichen, `nachname`; ist `nachname` leer, gleich `vorname`. Verglichen in NFC.
6. Höchstens eine Person hat `ansprech`; wenn, dann steht sie zuerst und im Mietvertrag (E366). Bürginnen und Bürgen
   stehen nach allen im Mietvertrag. Jede bekannte Art der Mitziehenden steht höchstens einmal, ihr `text` ist die
   feste Form (V22). *Formatfassung 1:* höchstens eine Person hat `kontakt`, **genau eine** hat `rolle: hauptmieter`,
   und sie steht zuerst (E216).
7. **Bindung an das Papier (E223).** Was ein Leser zeigt, steht auf dem Papier. Die Regeln dazu folgen.

**Welches Papier (V1, V2).** Deckblatt und Verzeichnis sind die Seiten vor der kleinsten `seiten_mappe.von`; ohne
Unterlagen ist es Seite 1. Gelesen wird der Text in der Reihenfolge des Inhalts, wie PDF.js ihn mit
`getTextContent()` liefert, Zeile für Zeile. Hefta setzt Deckblatt und Verzeichnis in Lesereihenfolge.

> **Warnung (V2):** Werkzeuge, die den Text nach seiner Lage auf der Seite neu ordnen (etwa pdfplumber), können
> Zeilen anders zusammensetzen. Dann greift diese Prüfung nicht verlässlich. Ein Leser nutzt die Reihenfolge des
> Inhalts.

**Wie verglichen wird.**

- **Text (V4):** in NFC; weiche Trennstriche (U+00AD) fallen weg; geschützte Leerzeichen (U+00A0, U+202F) gelten als
  Leerzeichen; Leerraum zählt als ein Leerzeichen; klein geschrieben nach Unicode (Default Case Conversion, wie
  `toLowerCase`), ohne ß zu ss zu falten.
- **Ganzes Wort (V3):** Ein Wert steht nur als ganzes Wort oder ganze Wortfolge, nie als Teilstück („Lea“ steht nicht
  in „Leander“, „Beispiel“ nicht in „Muster-Beispiel“). Zum Wort gehören Buchstaben, Zeichen zu Buchstaben, Ziffern,
  `_`, die Striche `-` (U+002D) und `‐` (U+2010) und die Apostrophe `'` (U+0027), `’` (U+2019) und `` ` `` (U+0060).
  Alles andere ist eine Grenze, ebenso der Rand. Apostroph- und Strichformen werden nicht angeglichen: `O'Brien` ist
  nicht `O’Brien`.
- **Zeilenumbruch nach Bindestrich (V3):** Ein Umbruch direkt nach einem Bindestrich zählt nicht
  („Beispielsdorf-“ und in der nächsten Zeile „Mustermann“ ergibt „Beispielsdorf-Mustermann“).
- **Feste Überschriften (V5):** „Im Mietvertrag“, „Ziehen mit ein“, „Bürgt“, „Kontakt“, „Was beiliegt“, je als eigene
  Zeile. Ein Abschnitt reicht bis zur nächsten Überschrift oder bis zum Fuß („Fassung …“, „Erstellt mit Hefta“,
  „Seite 1 von …“).
- **Zwischenzeile „Bürgschaft“:** Im Verzeichnis „Was beiliegt“ steht vor der ersten Person, die bürgt, die Zeile
  „Bürgschaft“. Sie ist fest, beendet keinen Abschnitt und wird nicht gebunden; ein Leser überliest sie.

**Was woran gebunden ist:**

| Anzeige | gebunden an |
| --- | --- |
| Wohnung | `strasse` und `rest` als ganze Wörter auf dem Deckblatt; `teile` nachgerechnet (V19) |
| Einzug, Portal | „Einzug möglich ab 1. Januar 2027“, „Inserat auf ImmoScout24“ |
| Satz zum Schritt | Seite 1, vor der ersten Zeile, die mit einer festen Überschrift beginnt (L78-3) |
| Personen | ganzer Name unter „Im Mietvertrag“ oder „Bürgt“ (V9); in Formatfassung 1 dahinter das passende Rollenwort |
| Kontakt | Name unter „Kontakt“, dazu Telefon und Mail (Leerzeichen zählen nicht) |
| Unterlagen | Zeile im Verzeichnis im Block der Person: Wortlaut, Zusatz, Seiten (V6); unbekannte Art nur die Seiten (V10) |
| Vermerke | Wortlaut im Verzeichnis |
| Mitziehende | Text unter „Ziehen mit ein“ |
| Löschbitte | wörtlich auf dem Deckblatt (Leerzeichen zählen nicht); nur in dieser Richtung, siehe unten |
| Fassung, Seitenzahl, erstellt | „Fassung n vom …“ (V7), „Seite 1 von N“ (V8), Erstelldatum der PDF (V11) |
| Seiten jeder Unterlage | nicht leer, also mit Text oder Bild (V12) |

**Die Zeile im Verzeichnis (V6).** Unter dem Namen der Person steht je Unterlage eine Zeile: der Wortlaut aus
Abschnitt 6, dann der Zusatz, dann die Seiten.

| Zusatz | Beispiel |
| --- | --- |
| Serie im selben Jahr | Gehaltsnachweise, September bis November – Seiten 3 bis 5 |
| Serie über den Jahreswechsel (E220, Regel 8) | Gehaltsnachweise, Dezember 2026 bis Januar 2027 – Seiten 3 bis 4 |
| ein Monat | Gehaltsnachweise, November 2026 – Seite 3 |
| mit Tag | Bonitätsnachweis vom 10. November 2026 – Seite 6 |
| ohne | Selbstauskunft – Seite 2 |

Zwischen Zusatz und Seiten steht „ – “ (Leerzeichen, Gedankenstrich U+2013, Leerzeichen).

- **Über Zeilen hinweg:** Eine Zeile im Verzeichnis kann auf dem Papier umbrechen; Werkzeuge liefern dann etwa
  „Gehaltsnachweise, August bis“ und „Oktober – Seiten 3 bis 5“ getrennt. Gesucht wird darum im Text des Verzeichnisses
  als ein Fluss, in dem ein Zeilenumbruch wie ein Leerzeichen zählt (V4, mit der Ausnahme nach einem Bindestrich).
- **Der Block einer Person** beginnt bei ihrem `name` als ganzem Wort (V3) im Verzeichnis und endet vor dem nächsten
  `name` einer anderen Person aus `personen` oder am Ende des Verzeichnisses. Ihre Zeilen stehen in diesem Block.
- **Seiten:** genau „Seite n“ oder „Seiten n bis m“. Formen wie „Seiten 2–3“, eine Zahl allein oder „Seite 3 bis 5“
  passen nicht.
- **`monate` und `vom` zusammen:** Die Zeile nennt dann nur die Monate; `vom` wird nicht gebunden und nicht gezeigt.
- **Serie mit Lücke:** Die Zeile nennt nur den ersten und den letzten Monat („August bis Oktober“), auch wenn
  `monate` einen Monat dazwischen nicht enthält. Ob ein Monat fehlt, steht also nicht auf dem Papier. Ein Leser zeigt
  darum nur die Spanne wie auf dem Papier und schließt aus `monate` nichts weiter.
- **Das Jahr einer Serie im selben Jahr** steht nicht in der Zeile („September bis November“); es kommt aus `monate`.
  Ein Leser zeigt die Zeile wie auf dem Papier, ohne Jahr.

**Die Löschbitte** wird nur in einer Richtung gebunden: Steht `loeschwunsch`, muss der Satz auf dem Deckblatt stehen.
Steht auf dem Deckblatt eine Bitte, aber kein `loeschwunsch`, passt die Lesehilfe trotzdem; ein Leser zeigt die Bitte
dann nicht als Angabe der Lesehilfe.

**Der Satz zum Schritt (E227, L78-3).** Steht `schritt` mit einer bekannten Kennung, steht sein Satz auf Seite 1 vor
der ersten Überschrift. Steht irgendwo auf dem Papier ein Satz zu einem anderen Schritt, oder ein Satz ohne
`schritt`, passt die Lesehilfe nicht. Ein Satz zählt, sobald eine Lesart ihn findet, auch über einen Umbruch nach
„Einkommens-“ hinweg (V3).

**Das Deckblatt von Hefta**, von oben: „Bewerbung um die Wohnung“; Straße und Rest; „Zu Ihrem Inserat auf …“ und
„Einzug möglich ab …“, wenn es sie gibt; der Satz zum Haushalt; der Satz zum Schritt, wenn es ihn gibt; ein freier
Satz; „Im Mietvertrag“ mit Namen und Tätigkeit; „Ziehen mit ein“; „Bürgt“ mit Namen; „Kontakt“; „Was beiliegt“ mit den
Zeilen je Person; im Fuß „Fassung n vom …“, die Bitte zum Löschen, „Erstellt mit Hefta“ und „Seite 1 von N“. Das Aussehen
darf sich ändern; die Wörter der Überschriften, die Rollenwörter, die Form der Verzeichniszeile und die Sätze zum
Schritt nicht.

Die Funktion `pruefen()` im Paket `hefta-json` prüft alle sieben Punkte und nennt die Gründe; `passt()` sagt nur ja
oder nein. Die Vermieterseite von Hefta nutzt genau diese Prüfung. Ein eigener Leser braucht das Paket nicht; dieses
Dokument genügt.

## 12. Bezüge

- **Unterlagen gehören zu ihrer Person.** Sie stehen in `personen[].unterlagen`. Eine Reihenfolge kann so nichts
  verwechseln.
- **Kontakt:** Die Ansprechperson trägt `ansprech: true` und ihre Kontaktdaten selbst (Formatfassung 1:
  `kontakt: true`).
- **Bürgschaft:**
  - Eine Person mit `rolle: buerge` bürgt gegenüber dem Vermieter für die Pflichten der Personen im Mietvertrag;
    der Umfang steht in der Bürgschaftserklärung (§ 765, § 767 BGB).
  - Hefta kennt keine Bürgschaft für eine einzelne Person, darum gibt es dafür kein Feld.
- **Dieselbe Bewerbung über mehrere Fassungen der Mappe:**
  - Es ist dieselbe `bewerbung.kennung`.
  - Die Fassungen ordnet `erstellt`.
  - `fassung` zählt nur Mappen, die schon hinausgingen. Zwei Mappen, die vor dem Senden gebaut wurden, tragen
    dieselbe `fassung`, aber verschiedene `erstellt`.
  - Eine Kennung belegt nichts: Eine fremde Mappe kann dieselbe Kennung tragen (A18). Ein Leser ordnet damit nur zu.

## 13. Strenges Lesen

Was hier steht, gilt vor Abschnitt 11. Trifft eine Regel nicht zu, lehnt der Leser die Lesehilfe ab.

- **Kodierung:** UTF-8. Eine BOM am Anfang wird überlesen. UTF-16 und kaputtes UTF-8 werden abgelehnt.
- **JSON:** ein Objekt. Ein doppelter Schlüssel in irgendeinem Objekt wird abgelehnt (V13); `JSON.parse` erkennt ihn
  nicht, der Leser braucht dafür eine eigene Prüfung.
- **Zahlen:** ganze Zahlen; `1.0` gilt als 1 (V15). Der Schreiber schreibt keine Nachkommastellen.
- **Grenzen (V14):** höchstens 1 MiB, 50 Personen, 50 Unterlagen je Person, 20 Ebenen tief, auch in `x_`-Feldern. Eine
  echte Mappe erreicht keine davon. Im Schema stehen die Grenzen für Personen und Unterlagen als `maxItems`; Größe und
  Tiefe prüft nur der Leser.
- **Schema:** Die Datei erfüllt `schema.json`, mit allen Pflichtfeldern, Mustern und Abhängigkeiten.
- **Echte Werte (E220, Regel 2):** Jeder Tag ist ein echter Kalendertag (kein 30. Februar), jeder Monat 01 bis 12,
  `erstellt` ein echter Zeitpunkt (Stunde bis 23, Minute und Sekunde bis 59, Zeitzone bis ±14:59).
- **Sauberer Text (V16)** in jedem Feld, das ein Leser zeigt:
  - in Unicode-Normalform NFC; eine andere Form wird abgelehnt, nicht umgewandelt
  - kein Steuerzeichen, kein unsichtbares Formatzeichen (U+200B), kein Zeichen, das die Schreibrichtung ändert
    (U+202E), kein Zeilen- oder Absatztrenner, kein privates oder nicht vergebenes Zeichen
  - kein Leerzeichen am Rand, nicht nur Leerzeichen
- **Namen:** zusätzlich die Regeln zu Leerzeichen und zur Schrift aus Abschnitt 7.
- **Telefon:** die Regel aus Abschnitt 8.

## 14. Abgleich mit OpenImmo-Feedback

- **Was OpenImmo-Feedback ist:** Damit schicken Portale Anfragen von Interessenten an Maklersoftware (Element
  `interessent` in `objekt`).
- **Quelle:** die Feldnamen aus der offenen Bibliothek OpenEstate-IO, die aus dem Schema 1.2.7 erzeugt ist. Das
  Schema selbst gibt der OpenImmo e.V. nur unter Lizenz und ohne Weitergabe heraus.
- **Warum nicht OpenImmo selbst:** OpenImmo-Feedback beschreibt eine Anfrage einer Person an ein Objekt. Hefta
  beschreibt einen Haushalt mit Unterlagen und Seiten in einer Mappe. Wo es dieselbe Sache gibt, heißt das Feld gleich;
  wo nicht, sagt die Tabelle warum.

| hefta.json | OpenImmo-Feedback | Abgleich |
| --- | --- | --- |
| `vorname` | `interessent/vorname` | gleich |
| `nachname` | `interessent/nachname` | gleich. Im Haupt-Schema heißt der Nachname der Kontaktperson `name`; für Bewerbungen ist Feedback das Vorbild |
| `email` | `interessent/email` | gleich |
| `telefon` | `interessent/tel` | Name abweichend; Festnetz oder Handy (`mobil`) ist nicht sicher zu erkennen |
| `telefon_e164` | – | international, für Links und Software (E222) |
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
| Anrede, Geschlecht, das Rollenwort „Hauptmieterin“ oder „Mitmietpartei“ | Die Anrede steht nicht auf dem Papier; aus dem Rollenwort ließe sich das Geschlecht ablesen (Abschnitt 7) |
| Auswahl der Unterlagen (`modus`) | steht nicht auf dem Papier und nützt dem Vermieter wenig (V23) |
| Name in der ursprünglichen Schrift | steht nicht auf dem Papier (Regel 1) |
| der freie Satz vom Deckblatt | freier Text ohne festen Inhalt; für Programme ohne Nutzen |
| Dateinamen, Prüfsummen, Haushalts-, Personen- oder Geräte-IDs | nicht auf dem Papier, und sie verbänden Mappen über Wohnungen hinweg |
| Link zum Inserat | steht nicht auf dem Deckblatt; nur der Name des Portals |
| Signatur, Prüfsumme der Mappe | Die Lesehilfe ist kein Echtheitsnachweis (Regel 3) |

## 16. Dateien

**Im Paket `hefta-json`** (die Pfade gelten im Paket; wer nur diese Beschreibung bekommt, findet die Beispiele im
Ordner `beispiele/` daneben):

| Datei | Inhalt |
| --- | --- |
| `FORMAT.md` | diese Beschreibung |
| `schema.json` | JSON Schema, draft-07; das ist der Entwurf mit der breitesten Unterstützung in Werkzeugen |
| `beispiele/1-eine-person.json` | eine Person, mit Portal und Einzug |
| `beispiele/2-paar-kind-buergin.json` | Paar, ein Kind, Bürgin, zweite Fassung der Mappe, mit Vermerken |
| `beispiele/3-nach-der-zusage.json` | Schritt `zusage` mit seinem Satz, dritte Fassung der Mappe |
| `beispiele/4-ohne-wohnung.json` | Mappe ohne Wohnung, Kontakt nur mit Mail |
| `beispiele/5-grenzfaelle-namen.json` | Grenzfälle bei Namen, dazu ein `x_`-Feld |
| `beispiele/fassung-1/` | dieselben fünf Beispiele in Formatfassung 1 |
| `test/fremd/` | ein unabhängiger Leser in Python als zweite Probe; nur für die Tests, nicht im veröffentlichten Paket |
| `test/deckblatt.ts` | Deckblatt nach Abschnitt 11 als Text, für die Tests |

**Nur im Repository von Hefta:**

| Datei | Inhalt |
| --- | --- |
| `docs/hefta-json-4/export-entwurf.md` | der Export der Vermieterseite als CSV |
| `tests/fixtures/export/2-paar-kind-buergin.csv` | Export von Beispiel 2, Zeichen für Zeichen |
| `src/pdf/anhang.ts`, `src/pdf/bewerbung.ts` | der Schreiber in der App: Lesehilfe, Deckblatt und Verzeichnis |
| `src/vermieter/papier.ts` | liest das Papier einer Mappe mit PDF.js für Punkt 7 |
| `src/vermieter/stress.test.ts` | der Stresstest: 95 Mappen aus DP76 und DP78, mit dem fremden Leser verglichen |

## 17. Paket `hefta-json`

- **Was es kann:** In TypeScript, gebaut zu JavaScript-Modulen mit Typen. Zur Laufzeit hängt es an nichts.
  - `lesen(json)`: nimmt Text oder Bytes, liest streng nach Abschnitt 13 und gibt die Lesehilfe zurück, sonst `null`;
    wirft nie. `lesenMitGrund(json)` nennt dazu den Grund.
  - `pruefen(lesehilfe, mappe)`: die Punkte 1 bis 7 aus Abschnitt 11; gibt die Gründe zurück, leer heißt: passt.
    `mappe` ist `{ seiten, seite1, text, leereSeiten, erstellt }`: Seitenzahl, Text von Seite 1 und der Seiten vor
    der ersten Unterlage (Zeilen mit Zeilenumbruch), leere Seiten, Erstelldatum der PDF.
  - `passt(lesehilfe, mappe)`: gleich `pruefen(...).length === 0`
  - `telefonPasst(telefon, telefon_e164)`: die Regel für Leser aus Abschnitt 8
  - Bausteine für eigene Leser und Schreiber: `normiert`, `datumText`, `monateText`, `seitenText`,
    `verzeichnisZeile`, `vermerkText`, `teileAus`, `mitziehendText`, `SCHRITT_SATZ`, `UEBERSCHRIFTEN`
  - die festen Listen aus Abschnitt 6 mit ihrer Bedeutung: `ROLLEN`, `TYPEN`, `VERZEICHNIS`, `PRUEFWEGE`,
    `SCHRITTE`, `VERMERKE`, `MITZIEHENDE`, dazu `UNBEKANNT` für die neutrale Anzeige
  - `typText(typ)`: der Wortlaut im Verzeichnis, unbekannt „Unterlage“
  - `hefta-json/schema.json`
- **Nicht im Paket:** das Auslesen aus der PDF, also Anhang, Text, leere Seiten und Erstelldatum. Das bräuchte eine
  PDF-Bibliothek; die Wege stehen in Abschnitt 2. Die Vermieterseite von Hefta macht es mit PDF.js
  (`src/vermieter/papier.ts`).
- **Hefta selbst** nutzt das Paket: die App zum Schreiben, die Vermieterseite zum Lesen und Prüfen.
