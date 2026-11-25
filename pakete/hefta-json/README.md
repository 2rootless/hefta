# hefta-json

Die Lesehilfe `hefta.json` aus PDF-Mappen von [Hefta](https://hefta.de) lesen und prüfen.

Hefta macht aus den Unterlagen eines Haushalts eine PDF-Mappe für die Wohnungsbewerbung. In der Mappe steckt als
Anhang eine kleine JSON-Datei: wer sich bewirbt, für welche Wohnung, welche Unterlage auf welcher Seite liegt. Dieses
Paket liest sie und prüft, ob sie zur Mappe passt. Das Format ist in `FORMAT.md` beschrieben, das JSON Schema liegt in
`schema.json`, Beispiele in `beispiele/`.

## Benutzen

```ts
import { lesen, pruefen, typText } from 'hefta-json';

// Aus der PDF, etwa mit PDF.js: der Anhang `hefta.json`, die Seitenzahl, der Text der Seiten vor der ersten
// Unterlage in der Reihenfolge des Inhalts, die leeren Seiten und das Erstelldatum (FORMAT.md, Abschnitt 11).
const lesehilfe = lesen(bytes);
const gruende = lesehilfe ? pruefen(lesehilfe, { seiten, seite1, text, leereSeiten, erstellt }) : null;
if (lesehilfe && gruende?.length === 0) {
  for (const person of lesehilfe.haushalt.personen)
    for (const u of person.unterlagen)
      console.log(person.name, typText(u.typ), u.seiten_mappe.von, u.seiten_mappe.bis);
}
```

- `lesen()` nimmt Text oder Bytes und liest streng nach Fassung 2 und 1: Schema, echte Daten, sauberer Text, Grenzen, keine
  doppelten Schlüssel. Was keine Lesehilfe ist, ergibt `null`. Die Funktion wirft nie.
- `pruefen()` prüft, ob die Lesehilfe zur Mappe passt, Punkte 1 bis 7: Seitenzahl, Seitenbereiche, Rollen und
  Reihenfolge, und dass alles, was Sie zeigen würden, auf dem Deckblatt oder im Verzeichnis steht. `passt()` sagt
  nur ja oder nein. Eine Lesehilfe ist kein Echtheitsnachweis; passt sie nicht, zeigen Sie sie nicht, auch nicht zum
  Teil.
- Das Paket liest keine PDF. Den Anhang und den Text holen Sie mit einer PDF-Bibliothek Ihrer Wahl (`FORMAT.md`,
  Abschnitt 2 und 11).

## Was nicht drinsteht

Einkommen, Beruf, Geburtsdaten, Anrede und Geschlecht stehen absichtlich nicht in der Lesehilfe (`FORMAT.md`,
Abschnitt 15). Bewerbungen nach Einkommen zu sortieren, soll sie nicht erleichtern.

## Lizenz

Apache-2.0, siehe `LICENSE`. Das gilt für den Code, die Beschreibung, das Schema und die Beispiele.
