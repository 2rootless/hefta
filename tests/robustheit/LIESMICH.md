# Robustheitskatalog (E232)

Ab 2.0 hat jeder Bereich einen Korpus: Fälle mit Eingabe und erwartetem Ergebnis. Für 2.0 ist er angelegt und mit dem
gefüllt, was es schon gibt (PC120, Abschnitt 5). **Ab jetzt wird jeder Fehler zuerst ein Fall.** Erst dann kommt der Fix.

## Aufbau (Vorschlag von Code)

- `bereiche.json`: das Verzeichnis nach dem Dokument „Hefta Robustheitskatalog“ der Planung (PC123). Je Bereich
  stehen dort Name, Messgröße, Quellen (Datei, was sie prüft, wie viele Fälle) und die Quote. Die Quote für 2.0 ist
  die erste Zahl je Bereich, ohne Ziel (Regel 4). Richtig oder ehrlich leer zählt als richtig, ein falscher Wert als
  falsch (Regel 5). In keiner Version darf sie sinken (Regel 1).
- `<bereich>/`: Fälle und Soll, die nur hier liegen, als JSON. Bisher `n/strassenarten.json` (PC120, §8, 5) und
  `i/katalog-soll.json`, das Soll zu den 42 Inseraten aus PC117 (Adresse, Warmmiete, Zimmer, Fläche; `null` heißt:
  steht nicht eindeutig im Inserat, jeder gelesene Wert ist dann falsch).
- `src/test/robustheit.test.ts`: Dieser Test hält das Verzeichnis ehrlich. Jede Quelle muss es geben, und die Zahlen
  müssen stimmen, wo sie sich ohne Browser zählen lassen. Die Fälle, die nur hier liegen, laufen mit Gegenprobe.
  Für I und N rechnet er die Quote aus dem Katalog und prüft, dass sie nicht unter die Zahl in `bereiche.json` sinkt.
  `ROBUST_TABELLE=<pfad> npx vitest run src/test/robustheit.test.ts` schreibt die Übersicht mit allen Quoten.

Bestehende Fälle bleiben, wo sie sind, also bei ihrem Test. Das Verzeichnis zeigt nur auf sie. So läuft jeder Fall
weiter in seiner Reihe, in Chromium und WebKit, wo er dort schon lief.

## Ein neuer Fall

1. Der Fall kommt in die Quelle seines Bereichs, sonst nach `<bereich>/…json`.
2. In `bereiche.json` die Zahl erhöhen. Ohne diesen Schritt wird `robustheit.test.ts` rot.
3. Der Test des Falls muss vor dem Fix rot sein. Das ist die Gegenprobe.

## Daten

Nur Musterdaten (W7). Erfundene Straßen tragen eine Postleitzahl von 00000 bis 00999 (Fassung 25). Echte Inserate
kommen hier nicht hinein (PC120, Abschnitt 3).
