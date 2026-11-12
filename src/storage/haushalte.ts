// Version 2, mehrere Haushalte (docs/10-version-2.md, C7, C8): einen Haushalt mit allem, was zu
// ihm gehört, herauslösen (Backup je Haushalt) und zwei Bestände zusammenführen (Einspielen
// „hinzufügen“ statt „ersetzen“). Reine Funktionen auf den Datensätzen, wie im Backup-Manifest.

type Datensaetze = Record<string, unknown[]>;
type MitId = { id: string; updatedAt?: string };

const ids = (liste: unknown[] | undefined) => new Set((liste ?? []).map((x) => (x as MitId).id));

export interface Teilbestand {
  daten: Datensaetze;
  /** Dateien (Originale und aufbereitete Fassungen), die die Versionen brauchen. */
  dateien: string[];
}

/**
 * Alles zu einem Haushalt: der Haushalt, seine Zugehörigkeiten (auch herausgenommene), deren
 * Personen mit allen Unterlagen und Versionen, die Bewerbungen. Ohne Einstellungen der App.
 * Eine Person in zwei Haushalten (Bürgin) steckt in beiden Teilbeständen.
 */
export function teilbestand(daten: Datensaetze, haushaltId: string): Teilbestand {
  const zugehoerigkeiten = (daten.zugehoerigkeiten ?? []).filter(
    (z) => (z as { haushaltId: string }).haushaltId === haushaltId,
  );
  const personen = new Set(zugehoerigkeiten.map((z) => (z as { personId: string }).personId));
  const dokumente = (daten.dokumente ?? []).filter((d) =>
    personen.has((d as { personId: string }).personId),
  );
  const dokIds = ids(dokumente);
  const versionen = (daten.versionen ?? []).filter((v) =>
    dokIds.has((v as { dokumentId: string }).dokumentId),
  );
  const dateien = new Set<string>();
  for (const v of versionen as { original: string; aufbereitet: string | null }[]) {
    dateien.add(v.original);
    if (v.aufbereitet) dateien.add(v.aufbereitet);
  }
  return {
    daten: {
      haushalte: (daten.haushalte ?? []).filter((h) => (h as MitId).id === haushaltId),
      zugehoerigkeiten,
      personen: (daten.personen ?? []).filter((p) => personen.has((p as MitId).id)),
      dokumente,
      versionen,
      bewerbungen: (daten.bewerbungen ?? []).filter(
        (b) => (b as { haushaltId: string }).haushaltId === haushaltId,
      ),
      hefte: (daten.hefte ?? []).filter(
        (h) => (h as { haushaltId: string | null }).haushaltId === haushaltId,
      ),
    },
    dateien: [...dateien],
  };
}

export interface Zusammengefuehrt {
  daten: Datensaetze;
  /** Datensätze aus dem neuen Bestand, die es noch nicht gab. */
  neu: number;
  /** Gleiche ID in beiden, der neuere Stand hat gewonnen (z. B. eine Person in zwei Haushalten). */
  aktualisiert: string[];
}

/**
 * Führt `neu` in `bestehend` zusammen: nichts Bestehendes geht verloren. Gibt es einen Datensatz
 * in beiden, bleibt der zuletzt geänderte. Die Einstellungen der App bleiben die bestehenden.
 */
export function zusammenfuehren(bestehend: Datensaetze, neu: Datensaetze): Zusammengefuehrt {
  const daten: Datensaetze = {};
  let anzahlNeu = 0;
  const aktualisiert: string[] = [];
  for (const ort of new Set([...Object.keys(bestehend), ...Object.keys(neu)])) {
    const liste = new Map<string, unknown>();
    for (const x of bestehend[ort] ?? []) liste.set((x as MitId).id, x);
    if (ort !== 'einstellungen')
      for (const x of neu[ort] ?? []) {
        const { id, updatedAt = '' } = x as MitId;
        const alt = liste.get(id) as MitId | undefined;
        if (!alt) {
          liste.set(id, x);
          anzahlNeu++;
        } else if (updatedAt > (alt.updatedAt ?? '')) {
          liste.set(id, x);
          aktualisiert.push(id);
        }
      }
    daten[ort] = [...liste.values()];
  }
  return { daten, neu: anzahlNeu, aktualisiert };
}
