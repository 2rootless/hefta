# Format `hefta.json`

Die Beschreibung des Formats steht an einer Stelle (Fassung 1, 18. November 2026, E205 bis E208, E216 bis E227):
**`pakete/hefta-json/FORMAT.md`**, zusammen mit dem JSON Schema (`schema.json`), den Beispielen (`beispiele/`) und
dem Paket `hefta-json` zum Lesen und Prüfen. Alles dort steht unter Apache-2.0.

- **Schreiben:** `src/pdf/anhang.ts` in der App.
- **Lesen und Prüfen:** das Paket; die Vermieterseite nutzt es (`src/vermieter/lesen.ts`, `regel.ts`).
- **Export als CSV auf der Vermieterseite:** `src/vermieter/export.ts`; Beschreibung im Entwurf
  `docs/hefta-json-4/export-entwurf.md` auf dem Zweig `hefta-2`.
- **Ältere Fassungen 1 bis 3:** Die Vermieterseite liest sie weiter (`FORMAT.md`, Abschnitt 13). Fassung 3 war hier
  bis zum 18. November 2026 beschrieben; sie steht im Verlauf dieser Datei.
