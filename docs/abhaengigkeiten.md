# Abhängigkeiten

Hefta selbst steht unter der **AGPL-3.0** (`LICENSE`, Entscheidung T vom 4.11.2026); die Schriften Archivo, Source Serif 4 und IBM Plex Sans unter der OFL-1.1 (`src/pdf/fonts/`). Alle Lizenztexte, auch die der Bibliotheken, liegen dem Build als `lizenzen.txt` bei (`build/hefta-plugin.ts`, geprüft von `scripts/check-dist.mjs`). Alle Abhängigkeiten unten sind damit verträglich.

Jede Bibliothek braucht einen Grund, aktive Pflege und eine passende Lizenz (MIT, Apache-2.0, BSD, ISC, OFL). Versionen sind exakt festgeschrieben (`package.json` + `package-lock.json`). Stand: 31. Oktober 2026.

## In der App (werden ausgeliefert)

| Paket | Version | Lizenz | Wofür |
| --- | --- | --- | --- |
| svelte | 5.57.3 | MIT | Oberfläche; kompiliert zu kleinem Code ohne große Laufzeit. |
| idb | 8.0.4 | ISC | Dünner Wrapper um IndexedDB, den einzigen dauerhaften Speicher, den Safari zuverlässig bietet. |
| @cantoo/pdf-lib | 2.11.1 | MIT | PDF-Mappe zusammenbauen: Seiten einfügen, einpassen, Text und Bilder setzen. Gepflegter Fork von pdf-lib (Original seit 2021 ohne Release). Bringt mit: culori, node-html-better-parser, html-entities (MIT), tslib (0BSD). |
| @cantoo/fontkit | 2.0.12 | MIT | Eigene Schrift (Archivo) ins PDF einbetten. |
| pdfjs-dist | 6.4.299 | Apache-2.0 | PDFs anzeigen, Miniaturen, Seiten rastern (Schwärzung einbrennen), passwortgeschützte PDFs öffnen. Worker, CMaps, Standardschriften, ICC-Profil und WebAssembly-Decoder (OpenJPEG BSD-2, JBIG2 aus PDFium BSD-3/Apache-2.0, QCMS MIT) liegen lokal in `dist/pdfjs/`; der JavaScript-Interpreter für Skripte in PDFs (quickjs) wird bewusst nicht ausgeliefert. |
| @fontsource-variable/archivo | 5.3.0 | OFL-1.1 | Archivo mit Breiten- und Gewichtsachse als lokale Datei (Latein, Latein erweitert und Vietnamesisch). |

Dazu, ohne npm: **Archivo statische Schnitte** in `src/pdf/fonts/` (Regular, Bold, ExtraBold Wide), einmalig erzeugt mit `scripts/make-pdf-fonts.py` aus `google/fonts/ofl/archivo/Archivo[wdth,wght].ttf`, Lizenz OFL-1.1 (`src/pdf/fonts/OFL.txt`).

## Nur im Probe-Bau `probe-vision` (PC75, nie im Release)

| Paket | Version | Lizenz | Wofür |
| --- | --- | --- | --- |
| tesseract.js | 7.0.0 | Apache-2.0 | Messung Vision gegen Tesseract am iPhone (PC68, Abschnitt 4). Als Dateien in `public/probe/ocr/`, nicht über npm; geladen nach dem Ja des Auftraggebers zu CP40. |
| tesseract.js-core | 7.0.0 | Apache-2.0 | Kern von Tesseract als WebAssembly, nur die LSTM-Fassungen. |
| deu.traineddata | aus tessdata_fast | Apache-2.0 | Deutsches Sprachmodell für Tesseract. |
| ocrb_int.traineddata | Stand April 2019 (laut README) | Apache-2.0 | Lesemodell für OCR-B, die Schrift der Zeilen unten (ICAO 9303), dritter Lauf der Probe (PC77 E155/2, Ja des Auftraggebers). Quelle: github.com/Shreeshrii/tessdata_ocrb, 1.453.578 Byte, SHA-256 `814f0d862538249d4122db8d41807b08fd7c31181455df7f596a2ed5ce4434ee`. Angelernt auf `tessdata_best/eng` mit künstlichen Zeilen. Später für Tesseract in App und Browser. |

**Nur für Musterfotos in Tests, nie in App oder Website:** OCR-B-Schrift `ocr-b-outline` (CTAN, Z. Wagner nach den METAFONT-Quellen von N. Schwarz, Stand 6.1.2011), Datei `ocrb10.otf`. Lizenz laut README: frei zu nutzen, zu ändern und weiterzugeben, ohne Einschränkung. Paket 592.281 Byte, SHA-256 `2e625b468d92849071a2ec7debe8a8fe47cdf6f4ea8117e350f093ed32b90617`. Liegt im Werkzeugordner (`HEFTA_OCRB`), nicht im Repository (PC77 E155/2).

## Nur in der Entwicklung (werden nicht ausgeliefert)

| Paket | Lizenz | Wofür |
| --- | --- | --- |
| vite, @sveltejs/vite-plugin-svelte | MIT | Build und Entwicklungsserver. |
| typescript | Apache-2.0 | Typprüfung. Version 6.0, weil die Svelte-Werkzeuge TypeScript 7 noch nicht unterstützen. |
| svelte-check | MIT | Typprüfung der Svelte-Dateien. |
| vitest | MIT | Unit-Tests. |
| fake-indexeddb | Apache-2.0 | IndexedDB in Unit-Tests (ab M1). |
| @playwright/test | Apache-2.0 | Browser-Tests in WebKit und Chromium, App-Symbole erzeugen. |
| @axe-core/playwright, axe-core | **MPL-2.0** | Automatischer Barrierefreiheits-Check. Ausnahme vom Auftraggeber am 31.10.2026 erlaubt: nur in Tests, nie in der App. |
| eslint, @eslint/js, typescript-eslint, eslint-plugin-svelte, globals | MIT | Lint. |
| prettier, prettier-plugin-svelte | MIT | Formatierung. |
| @types/node | MIT | Typen für Build-Skripte. |
| fonttools (Python, nicht im Projekt installiert) | MIT | Einmalig für die statischen PDF-Schriftschnitte. |
| pypdf, cryptography (Python, nicht im Projekt installiert) | BSD-3-Clause, Apache-2.0/BSD | Einmalig für `tests/fixtures/portal-*.pdf` (`scripts/make-test-pdfs.py`): PDFs, die wie bei Lohnportalen ohne Passwort aufgehen, aber verschlüsselt sind. |

`npm audit --omit=dev` meldet für die ausgelieferte App nichts (Stand 4. November 2026). Mit Entwicklungswerkzeugen sind es 14 Hinweise (2 niedrig, 12 mittel), alle in Werkzeugen, die nie auf dem Gerät laufen. Bei den nächsten Updates der Werkzeuge erneut prüfen.
