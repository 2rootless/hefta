# Feste Mappen (E60)

Seit dem Start von Version 1 im Store (E60) gibt es Mappen bei Fremden. Die Vermieterseite muss jede Fassung der Lesehilfe lesen, die je veröffentlicht wurde.

- Diese Dateien werden **nie neu erzeugt und nie gelöscht**.
- Für jede neue Fassung der Lesehilfe kommt eine eigene Datei dazu.
- `tests/e2e/vermieter.spec.ts` lädt jede davon bei jedem Lauf.

| Datei | Gebaut mit | Lesehilfe | Inhalt |
| --- | --- | --- | --- |
| `version1-familie.pdf` | Code von Version 1 (Stand `31e7436`), `scripts/muster-mappen.mjs`, Fall 6 | Fassung 3 | Max und Lea Mustermann, ein Kind, Petra bürgt, mit Bitte zum Löschen. Alles erfunden, jede Seite trägt „MUSTER“. |
