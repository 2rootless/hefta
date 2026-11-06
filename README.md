# Hefta

Hefta macht aus den Unterlagen eines Haushalts für eine Wohnungsbewerbung eine PDF-Mappe: Selbstauskunft, Einkommensnachweise, Bonitätsauskunft, Bürgschaft, mit Deckblatt und Inhalt, für alle, die einziehen. Dazu gehört eine Seite für Vermieter, die solche Mappen im Browser liest.

- App: [hefta.de](https://hefta.de)
- Für Vermieter: [vermieter.hefta.de](https://vermieter.hefta.de)

## Grundsätze

- **Nichts verlässt das Gerät.** Kein Konto, kein Server mit Daten, keine Analyse, kein Tracking, keine fremden Schriften oder Skripte. Etwas geht nur weg, wenn die Person es selbst teilt oder herunterlädt. Eine Content-Security-Policy sperrt Verbindungen zu anderen Hosts; die Vermieter-Seite verbietet sich nach dem Laden jede Verbindung.
- **Daten statt Code für die Regeln.** Welche Unterlage wer in welchem Schritt der Bewerbung braucht, steht in `data/regelkatalog.de.json`, nach der Orientierungshilfe der Datenschutzkonferenz zu Selbstauskünften von Mietinteressenten (Fassung 2.0, Januar 2026).
- **Keine Rechtsberatung.** Hinweise sind allgemein und nennen ihre Quelle. Ein Test prüft, dass jede Aussage über Recht sagt, wer sie macht (`src/domain/zuschreibung.test.ts`).
- **Erzeugt wird nur, was der Haushalt selbst angibt:** Selbstauskunft, Deckblatt, Inhalt. Nachweise werden gebündelt, nie erzeugt. Geschwärztes wird beim Export eingebrannt.

## Die Lesehilfe

Jede Mappe kann eine kleine JSON-Datei als PDF-Anhang tragen, die beschreibt, was auf welchen Seiten steht. Sie enthält nur, was ohnehin auf dem Deckblatt steht, dazu eine zufällige Kennung der Bewerbung. Programme, die Mappen lesen, finden die Beschreibung in [`docs/format-hefta-json.md`](docs/format-hefta-json.md). Eine Mappe ohne Anhang ist dieselbe Mappe.

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `src/` | App (Svelte 5, TypeScript), Vermieter-Seite in `src/vermieter/`, PDF-Bau in `src/pdf/`, Speicher (IndexedDB, verschlüsselte Backups) in `src/storage/` |
| `data/` | Regelkatalog, Ratgeber, Texte und Vorlagen als Daten |
| `build/` | Bauschritte: Content-Security-Policy, Ratgeber- und Datenschutzseite als fertiges HTML |
| `tests/e2e/` | Browsertests mit Playwright, dazu der Prüfkatalog der Bildschirme |
| `design/` | Design-Tokens und Logo |

## Entwickeln

```
npm install
npx playwright install chromium webkit
npm run dev        # Entwicklungsserver
npm run verify     # Typen, Lint, Unit-Tests, Bau, Browsertests
```

`npm run build` baut beide Seiten nach `dist/` und `dist-vermieter/` und prüft danach, dass keine fremden Hosts darin vorkommen. Beispieldateien zum Ausprobieren: `node scripts/testdateien.mjs design-sync/testdateien`, danach erzeugt `npm run test:backups` fünf Test-Backups mit erfundenen Daten.

Die Zitate im Ratgeber prüft ein Test wörtlich gegen die Texte der Orientierungshilfe, des Musterbogens und einer Pressemitteilung. Diese Texte liegen nicht im Repository; ohne sie entfällt nur diese eine Prüfung. Wer sie in `design/quellen/` ablegt (Dateinamen in `data/ratgeber.de.json`), bekommt sie mit.

## Lizenz

GNU Affero General Public License, Version 3 (`AGPL-3.0-only`), siehe [`LICENSE`](LICENSE). Die Schrift Archivo steht unter der SIL Open Font License 1.1. Die Lizenzen aller Bibliotheken liegen nach dem Bau in `dist/lizenzen.txt` und werden mit der App ausgeliefert.

**Name und Logo** „Hefta“ (`design/logo/`) sind von der Lizenz ausgenommen. Wer den Code weitergibt oder verändert, gibt seinem Angebot bitte einen eigenen Namen und ein eigenes Zeichen.

Impressum und Datenschutzerklärung: [hefta.de](https://hefta.de/#/einstellungen/rechtliches).
