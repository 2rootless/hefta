# Zweite, fremde Probe (DP78, PC116)

Design hat `leser78.py` nur aus `FORMAT.md`, `schema.json`, den Beispielen und dem Stresskatalog geschrieben, ohne
den Code von Hefta (DP76, DP78; davor `leser72.py` aus DP72, den er ersetzt). Er liegt hier unverändert, in Fassung 4
des Lesers aus DP82 (PC126): Er bindet die Zeile im Verzeichnis an die zwei Formen aus V6, „– Seite n“ und „– Seiten n
bis m“, lehnt Text ab, der nicht in NFC steht (V16), und nimmt V7 streng: Fehlt „Fassung n vom …“ auf dem Deckblatt,
passt die Mappe nicht (Fall V7a im Stresskatalog). SHA-256 von `leser78.py`:
`a8779aacc3089b59efd2bbc7ed7c954ace927e098dc1758461700a178b31339a`.

- `gegen78.py` (Code): leser78 urteilt über Lesehilfen ohne Papier (Punkte 1 bis 6) und schreibt seine CSV. Der Test
  `src/fremd.test.ts` vergleicht beides mit dem Paket und mit der CSV der Vermieter-Seite.
- `urteil78.py` (Code): leser78 urteilt über echte PDF-Mappen mit Papier (Punkt 7). Der Stresstest der App
  (`src/vermieter/stress.test.ts`) vergleicht damit 95 Fälle aus DP76 und DP78.

Beide Skripte rufen nur Funktionen von leser78 auf. Sie laufen in den Tests mit `python3 -E -P -B` und brauchen
pypdf, pdfplumber und jsonschema (nur zum Testen, E125). Sie gehören nicht zum veröffentlichten Paket.
